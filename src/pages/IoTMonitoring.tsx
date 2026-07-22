import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, WifiOff, Battery, BatteryLow, Activity, MapPin, TrendingUp, Copy, CheckCircle, Terminal, Cpu, Radio } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "@/components/layout/Navigation";
import { WaterQualityChart } from "@/components/dashboard/WaterQualityChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const ESP32_CODE = `#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===== CONFIGURATION =====
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* SENSOR_ID = "SENSOR_001";  // Unique sensor ID
const char* VILLAGE_ID = "YOUR_VILLAGE_UUID";  // From AquaGuard dashboard

// Backend integration
const char* SUPABASE_URL = "${SUPABASE_URL}";
const char* SUPABASE_KEY = "${SUPABASE_ANON_KEY}";

// ===== PIN CONFIGURATION =====
#define PH_PIN 34           // pH sensor analog pin
#define TDS_PIN 35          // TDS sensor analog pin
#define TEMP_PIN 4          // DS18B20 temperature pin
#define TURBIDITY_PIN 32    // Turbidity sensor analog pin

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\n✅ Connected to WiFi!");
  Serial.print("📡 IP: "); Serial.println(WiFi.localIP());
}

float readPH() {
  int raw = analogRead(PH_PIN);
  float voltage = raw * 3.3 / 4095.0;
  return 3.5 * voltage + 0.5; // Calibration formula
}

float readTDS() {
  int raw = analogRead(TDS_PIN);
  float voltage = raw * 3.3 / 4095.0;
  return (133.42 * pow(voltage, 3) - 255.86 * pow(voltage, 2) + 857.39 * voltage) * 0.5;
}

float readTurbidity() {
  int raw = analogRead(TURBIDITY_PIN);
  float voltage = raw * 3.3 / 4095.0;
  return max(0.0f, -1120.4 * pow(voltage, 2) + 5742.3 * voltage - 4353.8);
}

String getWaterStatus(float ph, float tds, float turbidity) {
  if (ph < 6.5 || ph > 8.5 || tds > 500 || turbidity > 4.0) return "contaminated";
  if (ph < 6.8 || ph > 8.2 || tds > 300 || turbidity > 1.0) return "warning";
  return "normal";
}

void sendToAquaGuard(float ph, float tds, float turbidity, float temp) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String endpoint = String(SUPABASE_URL) + "/rest/v1/water_quality_readings";
  http.begin(endpoint);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Prefer", "return=minimal");
  
  StaticJsonDocument<256> doc;
  doc["sensor_id"] = SENSOR_ID;
  doc["village_id"] = VILLAGE_ID;
  doc["ph"] = ph;
  doc["tds"] = tds;
  doc["turbidity"] = turbidity;
  doc["temperature"] = temp;
  doc["status"] = getWaterStatus(ph, tds, turbidity);
  
  String body;
  serializeJson(doc, body);
  
  int code = http.POST(body);
  Serial.printf("📤 HTTP %d | pH:%.2f TDS:%.1f Turb:%.2f Temp:%.1f\\n", code, ph, tds, turbidity, temp);
  http.end();
}

void loop() {
  float ph = readPH();
  float tds = readTDS();
  float turbidity = readTurbidity();
  float temp = 25.0; // Add DS18B20 library for real reading
  
  sendToAquaGuard(ph, tds, turbidity, temp);
  delay(30000); // Send every 30 seconds
}`;

const IoTMonitoring = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [latestReadings, setLatestReadings] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, offline: 0, low_battery: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadDevices();
    loadPredictions();
    loadLatestReadings();

    const devicesChannel = supabase.channel('iot_devices_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iot_devices' }, loadDevices)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'water_quality_readings' }, loadLatestReadings)
      .subscribe();

    const predictionsChannel = supabase.channel('predictions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_predictions' }, loadPredictions)
      .subscribe();

    return () => {
      supabase.removeChannel(devicesChannel);
      supabase.removeChannel(predictionsChannel);
    };
  }, []);

  const loadDevices = async () => {
    const { data, error } = await supabase.from('iot_devices').select('*, villages(name)').order('last_communication', { ascending: false });
    if (error) { toast.error('Failed to load IoT devices'); return; }
    setDevices(data || []);
    const total = data?.length || 0;
    setStats({
      total,
      active: data?.filter(d => d.status === 'active').length || 0,
      offline: data?.filter(d => d.status === 'offline').length || 0,
      low_battery: data?.filter(d => d.battery_level && d.battery_level < 20).length || 0,
    });
  };

  const loadPredictions = async () => {
    const { data } = await supabase.from('ai_predictions').select('*, villages(name)').order('predicted_at', { ascending: false }).limit(5);
    setPredictions(data || []);
  };

  const loadLatestReadings = async () => {
    const { data } = await supabase.from('water_quality_readings').select('*, villages(name)').order('reading_timestamp', { ascending: false }).limit(6);
    setLatestReadings(data || []);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(ESP32_CODE);
    setCopied(true);
    toast.success('ESP32 code copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  const getStatusColor = (status: string) => {
    if (status === 'active') return 'bg-green-500';
    if (status === 'offline') return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const determineWaterStatus = (ph: number, tds: number, turbidity: number) => {
    if (ph < 6.5 || ph > 8.5 || tds > 500 || turbidity > 4.0) return "critical";
    if (ph < 6.8 || ph > 8.2 || tds > 300 || turbidity > 1.0) return "warning";
    return "normal";
  };

  const getReadingStatus = (reading: any) => {
    const statusVal = reading.status || determineWaterStatus(reading.ph, reading.tds, reading.turbidity);

    switch (statusVal) {
        case "critical":
            return {
                label: "🔴 Critical",
                cls: "text-red-500"
            };
        case "warning":
            return {
                label: "🟡 Warning",
                cls: "text-yellow-500"
            };
        case "normal":
        default:
            return {
                label: "🟢 Normal",
                cls: "text-green-500"
            };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <Navigation />
      <div className="lg:ml-64 p-4 md:p-6 pt-20 lg:pt-6">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-foreground mb-1 flex items-center gap-3">
            <Radio className="h-8 w-8 text-primary" />
            {t('iotTitle', 'IoT Sensor Network')}
          </h1>
          <p className="text-muted-foreground">{t('iotSubtitle', 'Real-time water quality monitoring & ESP32 connection guide')}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: t('iotTotalDevices', 'Total Devices'), value: stats.total, icon: <Activity className="h-8 w-8" />, color: "text-primary", bg: "from-primary/15 to-primary/5 border-primary/20" },
            { label: t('iotActiveOnline', 'Active / Online'), value: stats.active, icon: <Wifi className="h-8 w-8" />, color: "text-green-500", bg: "from-green-500/15 to-green-600/5 border-green-500/20" },
            { label: t('iotOffline', 'Offline'), value: stats.offline, icon: <WifiOff className="h-8 w-8" />, color: "text-red-500", bg: "from-red-500/15 to-red-600/5 border-red-500/20" },
            { label: t('iotLowBattery', 'Low Battery'), value: stats.low_battery, icon: <BatteryLow className="h-8 w-8" />, color: "text-yellow-500", bg: "from-yellow-500/15 to-yellow-600/5 border-yellow-500/20" },
          ].map((s, i) => (
            <Card key={i} className={`p-5 bg-gradient-to-br ${s.bg} border`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                </div>
                <div className={`${s.color} opacity-30`}>{s.icon}</div>
              </div>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="live" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="live">📡 {t('liveData', 'Live Data')}</TabsTrigger>
            <TabsTrigger value="devices">🔌 {t('devices', 'Devices')}</TabsTrigger>
            <TabsTrigger value="connect">⚙️ {t('connectIot', 'Connect IoT')}</TabsTrigger>
            <TabsTrigger value="predictions">🤖 {t('ai', 'AI')}</TabsTrigger>
          </TabsList>

          {/* Live Data */}
          <TabsContent value="live" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <WaterQualityChart />
              <Card className="p-5">
                <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  {t('iotTelemetryStream', 'Latest Sensor Readings')}
                  <Badge className="animate-pulse bg-green-500/20 text-green-500 border-green-500/30 ml-auto">LIVE</Badge>
                </h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {latestReadings.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{t('iotNoDevices', 'No sensor data yet. Connect your IoT device to start streaming data.')}</p>
                  ) : latestReadings.map(r => {
                    const status = getReadingStatus(r);
                    return (
                      <div key={r.id} className="p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{r.sensor_id || r.villages?.name || 'Sensor'}</p>
                            <p className="text-xs text-muted-foreground">{r.villages?.name}</p>
                          </div>
                          <span className={`text-xs font-semibold ${status.cls}`}>{status.label}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {[
                            { label: t('iotPh', 'pH'), value: r.ph?.toFixed(1) ?? '-' },
                            { label: t('iotTds', 'TDS'), value: r.tds ? `${r.tds}` : '-' },
                            { label: t('iotTurbidity', 'Turbidity'), value: r.turbidity?.toFixed(1) ?? '-' },
                            { label: t('iotTemp', 'Temp'), value: r.temperature ? `${r.temperature}°` : '-' },
                          ].map((m, i) => (
                            <div key={i} className="p-1.5 bg-muted/30 rounded-lg">
                              <p className="text-xs text-muted-foreground">{m.label}</p>
                              <p className="text-sm font-bold text-foreground">{m.value}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {r.reading_timestamp ? new Date(r.reading_timestamp).toLocaleTimeString() : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Devices */}
          <TabsContent value="devices">
            <Card className="p-6">
              <h3 className="text-base font-bold text-foreground mb-4">{t('iotActiveDevices', 'Registered IoT Devices')}</h3>
              {devices.length === 0 ? (
                <div className="text-center py-12">
                  <Cpu className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground mb-2">{t('iotNoDevicesRegistered', 'No devices registered yet')}</p>
                  <p className="text-sm text-muted-foreground">{t('iotSetupInstructions', 'Go to "Connect IoT" tab to set up your ESP32 sensor')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {devices.map(device => (
                    <div key={device.id} className="border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(device.status)} mt-1.5`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-foreground">{device.sensor_id}</h4>
                              <Badge variant="outline">{device.device_type}</Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{device.villages?.name || device.location_name || 'Unknown'}</span>
                              <span className="flex items-center gap-1">{device.communication_mode === 'wifi' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}{device.communication_mode}</span>
                              <span className="flex items-center gap-1">{device.battery_level < 20 ? <BatteryLow className="h-3 w-3 text-red-500" /> : <Battery className="h-3 w-3 text-green-500" />}{device.battery_level}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{t('iotLastComm', 'Last seen')}: {device.last_communication ? new Date(device.last_communication).toLocaleString() : 'Never'}</p>
                          </div>
                        </div>
                        <Badge variant={device.status === 'active' ? 'default' : 'secondary'}>{device.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Connect IoT Guide */}
          <TabsContent value="connect" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {[
                { step: "1", title: t('hardwareSetup', 'Hardware Setup'), icon: <Cpu className="h-6 w-6" />, items: ["ESP32 Dev Board", "pH Sensor Module", "TDS Sensor", "DS18B20 Temperature", "Turbidity Sensor", "SIM800L GSM (optional)"] },
                { step: "2", title: t('softwareSetup', 'Software Setup'), icon: <Terminal className="h-6 w-6" />, items: ["Install Arduino IDE", "Add ESP32 board support", "Install ArduinoJson library", "Install WiFi library", "Copy code from tab below", "Update WiFi & Village ID"] },
                { step: "3", title: t('connectTest', 'Connect & Test'), icon: <Wifi className="h-6 w-6" />, items: ["Flash code to ESP32", "Open Serial Monitor", "Check WiFi connection", "Verify HTTP 201 response", "Data appears in Live tab", "Device shows as Active"] },
              ].map((s, i) => (
                <Card key={i} className="p-5 border-primary/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-sm">{s.step}</div>
                    <div className="text-primary">{s.icon}</div>
                    <h3 className="font-bold text-foreground">{s.title}</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {s.items.map((item, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>

            {/* Wiring Guide */}
            <Card className="p-6">
              <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                {t('iotWiringDiagram', 'ESP32 Wiring Diagram')}
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-foreground mb-3 text-sm">{t('iotPinConnections', 'Pin Connections')}</h4>
                  <div className="space-y-2">
                    {[
                      { pin: "GPIO 34 (ADC)", sensor: "pH Sensor → Analog Out", color: "bg-blue-500" },
                      { pin: "GPIO 35 (ADC)", sensor: "TDS Sensor → Analog Out", color: "bg-green-500" },
                      { pin: "GPIO 32 (ADC)", sensor: "Turbidity → Analog Out", color: "bg-yellow-500" },
                      { pin: "GPIO 4 (1-Wire)", sensor: "DS18B20 → Data Pin", color: "bg-red-500" },
                      { pin: "3.3V / GND", sensor: "All sensors power", color: "bg-gray-500" },
                    ].map((conn, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                        <div className={`w-3 h-3 rounded-full ${conn.color} flex-shrink-0`} />
                        <span className="text-xs font-mono text-primary font-semibold w-32">{conn.pin}</span>
                        <span className="text-xs text-muted-foreground">{conn.sensor}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-3 text-sm">{t('iotApiEndpoint', 'API Endpoint (Auto-configured)')}</h4>
                  <div className="p-3 rounded-xl bg-muted/30 font-mono text-xs space-y-2">
                    <p className="text-primary">POST /rest/v1/water_quality_readings</p>
                    <p className="text-muted-foreground">Host: {SUPABASE_URL?.replace('https://', '')}</p>
                    <p className="text-muted-foreground">Auth: Bearer [anon_key]</p>
                    <div className="mt-2 p-2 bg-background rounded-lg">
                      <pre className="text-xs text-foreground">{`{
  "sensor_id": "SENSOR_001",
  "village_id": "uuid",
  "ph": 7.2,
  "tds": 145.5,
  "turbidity": 0.8,
  "temperature": 26.4,
  "status": "normal"
}`}</pre>
                    </div>
                  </div>
                  <div className="mt-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <p className="text-xs text-green-600 font-medium">{t('iotSafeThresholds', '✅ Safe Thresholds')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('iotSafeThresholdsDesc', 'pH: 6.5–8.5 | TDS: <500ppm | Turbidity: <4 NTU | Temp: 15–35°C')}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Code */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-primary" />
                  {t('iotEspCodeTitle', 'ESP32 Arduino Code — Ready to Flash')}
                </h3>
                <Button onClick={copyCode} variant="outline" size="sm" className="gap-2">
                  {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('iotCopied', 'Copied!') : t('iotCopyFirmware', 'Copy Code')}
                </Button>
              </div>
              <div className="relative">
                <pre className="text-xs text-foreground font-mono bg-muted/30 p-4 rounded-xl overflow-auto max-h-80 leading-relaxed whitespace-pre">
                  {ESP32_CODE}
                </pre>
              </div>
              <div className="mt-4 grid md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs font-semibold text-yellow-600 mb-1">{t('iotBeforeFlashing', '⚠️ Before Flashing')}</p>
                  <p className="text-xs text-muted-foreground">{t('iotBeforeFlashingDesc', 'Replace YOUR_WIFI_SSID, YOUR_WIFI_PASSWORD, and YOUR_VILLAGE_UUID with actual values from your AquaGuard dashboard.')}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs font-semibold text-blue-600 mb-1">{t('iotRequiredLibraries', '📦 Required Libraries')}</p>
                  <p className="text-xs text-muted-foreground">{t('iotRequiredLibrariesDesc', 'ArduinoJson (v6+), HTTPClient (built-in), WiFi (built-in), OneWire + DallasTemperature (for DS18B20)')}</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Prediction panel */}
          <TabsContent value="predictions">
            <Card className="p-6">
              <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {t('symptomClusterAi', 'AI Outbreak Predictions')}
              </h3>
              <div className="space-y-4">
                {predictions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{t('iotNoPredictions', 'No AI predictions generated yet. Data from sensors triggers automatic predictions.')}</p>
                ) : predictions.map(p => (
                  <div key={p.id} className="border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-sm font-semibold text-foreground">{p.villages?.name || 'Unknown Village'}</span>
                        <p className="text-xs text-muted-foreground">{p.prediction_type}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(p.confidence_score * 100)}% {t('confidence', 'confidence')}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">{t('predictedRisk', 'Predicted Risk')}</p>
                        <p className="font-bold text-foreground">{p.prediction_data?.predicted_risk || 'N/A'}</p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">{t('trend', 'Trend')}</p>
                        <p className="font-bold text-foreground">{p.prediction_data?.trend || 'stable'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default IoTMonitoring;
