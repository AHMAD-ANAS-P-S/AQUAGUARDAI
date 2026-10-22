import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Droplet, Activity, AlertTriangle, Thermometer, Waves, RefreshCw, Users, ShieldCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import HeatmapLayer from "@/components/dashboard/HeatmapLayer";
import { db } from "@/utils/db";
import { TARGET_LOCATION_NAME, TARGET_VILLAGE_ID, TARGET_LATITUDE, TARGET_LONGITUDE, sanitizeLocationName, formatTDS, syncLocationToSupabase, evaluateWaterRisk } from "@/utils/sanitizeLocation";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

const RecenterMap = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

interface Village {
  id: string;
  name: string;
  district: string | null;
  state: string | null;
  risk_level: string | null;
  risk_score: number | null;
  population: number | null;
  latitude: number | null;
  longitude: number | null;
  predictedDisease?: string;
  districtId?: string;
}

interface VillageStats {
  sensors: number;
  cases: number;
  avgPh: number | null;
  avgTurbidity: number | null;
  sensorId?: string;
  tds?: string;
  temperature?: number;
  riskLevel?: string;
  riskScore?: number;
  isSafe?: boolean;
  summary?: string;
}

const getRiskColor = (risk: string | null) => {
  switch (risk) {
    case "high": return "bg-destructive text-destructive-foreground";
    case "medium": return "bg-warning text-warning-foreground";
    case "low": return "bg-success text-success-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

const getRiskHex = (risk: string | null) => {
  switch (risk) {
    case "high": return "#ef4444";
    case "medium": return "#f59e0b";
    case "low": return "#22c55e";
    default: return "#6b7280";
  }
};

const getDiseaseColor = (disease: string | null | undefined) => {
  if (!disease || disease === "None" || disease === "none") return "#22c55e"; // Safe / Green
  const d = disease.toLowerCase();
  if (d.includes("cholera")) return "#ef4444"; // Red
  if (d.includes("diarrhea") || d.includes("dysentery")) return "#f97316"; // Orange
  if (d.includes("typhoid")) return "#eab308"; // Yellow
  if (d.includes("hepatitis")) return "#a855f7"; // Purple
  return "#3b82f6"; // Other/Blue
};

const getRiskGradient = (risk: string | null) => {
  switch (risk) {
    case "high": return "from-destructive/40 to-destructive/10";
    case "medium": return "from-warning/40 to-warning/10";
    case "low": return "from-success/40 to-success/10";
    default: return "from-muted/40 to-muted/10";
  }
};

const MapView = () => {
  const { t } = useTranslation();
  const [villages, setVillages] = useState<Village[]>([]);
  const [villageStats, setVillageStats] = useState<Record<string, VillageStats>>({});
  const [selectedVillage, setSelectedVillage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    syncLocationToSupabase();
    loadVillages();

    const channel = supabase
      .channel('map_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'villages' }, () => loadVillages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'water_quality_readings' }, (payload: any) => {
        const r = payload.new;
        if (!r) {
          loadVillages();
          return;
        }

        const isTargetReading = r.sensor_id === 'AQUAGUARD_NODE_01' || r.village_id === TARGET_VILLAGE_ID;
        if (isTargetReading) {
          const evalResult = evaluateWaterRisk(r.ph, r.tds, r.turbidity);
          
          // Dynamically update the target village state on the map
          setVillages(prev => prev.map(v => {
            const isMatch = v.name === TARGET_LOCATION_NAME || v.id === TARGET_VILLAGE_ID;
            if (!isMatch) return v;
            return {
              ...v,
              risk_level: evalResult.riskLevel,
              risk_score: evalResult.riskScore,
            };
          }));

          // Dynamically update villageStats telemetry
          setVillageStats(prev => ({
            ...prev,
            [TARGET_VILLAGE_ID]: {
              sensors: 1,
              cases: evalResult.isSafe ? 0 : 4,
              avgPh: Number(r.ph) || 7.2,
              avgTurbidity: Number(r.turbidity) || 1.5,
              sensorId: "AQUAGUARD_NODE_01",
              tds: formatTDS(r.tds),
              temperature: r.temperature ?? 25,
              riskLevel: evalResult.riskLevel,
              riskScore: evalResult.riskScore,
              isSafe: evalResult.isSafe,
              summary: evalResult.summary,
            }
          }));

          // Toast alert for immediate physical verification feedback
          if (evalResult.riskLevel === 'high') {
            toast.error(`🚨 High Risk Contamination Detected at ${TARGET_LOCATION_NAME}! pH: ${Number(r.ph).toFixed(2)}, Map marked as HIGH (RED)`);
          } else if (evalResult.riskLevel === 'low') {
            toast.success(`🟢 Normal Water Detected at ${TARGET_LOCATION_NAME}! pH: ${Number(r.ph).toFixed(2)}, Map marked as LOW (GREEN)`);
          }
        } else {
          villages.forEach(v => loadVillageStats(v.id, v.name));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'health_reports' }, () => {
        villages.forEach(v => loadVillageStats(v.id, v.name));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadVillages = async () => {
    setLoading(true);

    // Fetch the latest physical sensor reading from Supabase for Zion school / AQUAGUARD_NODE_01
    const { data: latestTargetReading } = await supabase
      .from("water_quality_readings")
      .select("sensor_id, ph, turbidity, tds, temperature, reading_timestamp")
      .or(`village_id.eq.${TARGET_VILLAGE_ID},sensor_id.eq.AQUAGUARD_NODE_01`)
      .order("reading_timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Evaluate water risk dynamically based on physical sensor values
    const targetRiskEval = evaluateWaterRisk(
      latestTargetReading?.ph,
      latestTargetReading?.tds,
      latestTargetReading?.turbidity
    );

    const data = await db.getVillages();

    if (data) {
      const mapped = data.map((v: any) => {
        const isTarget = /Zion|SRMIST/i.test(v.name) || v.id === TARGET_VILLAGE_ID;
        return {
          ...v,
          name: isTarget ? TARGET_LOCATION_NAME : sanitizeLocationName(v.name),
          latitude: isTarget ? TARGET_LATITUDE : (v.latitude || null),
          longitude: isTarget ? TARGET_LONGITUDE : (v.longitude || null),
          district: isTarget ? "Chennai" : (v.district || v.districts?.name || null),
          state: isTarget ? "Tamil Nadu" : (v.state || null),
          // Dynamic risk evaluation: Safe water -> low risk (green), Contaminated -> high risk (red)
          risk_level: isTarget ? targetRiskEval.riskLevel : (v.risk_level || v.riskLevel || "medium"),
          risk_score: isTarget ? targetRiskEval.riskScore : (v.risk_score || v.riskScore || 30),
        };
      });

      // Always sort Zion Matriculation.Hr.Sec.School, Sealiyur to the very top
      mapped.sort((a, b) => {
        const aIsTarget = a.name === TARGET_LOCATION_NAME || a.id === TARGET_VILLAGE_ID;
        const bIsTarget = b.name === TARGET_LOCATION_NAME || b.id === TARGET_VILLAGE_ID;
        if (aIsTarget) return -1;
        if (bIsTarget) return 1;
        return (b.risk_score || 0) - (a.risk_score || 0);
      });
      
      setVillages(mapped);
      const target = mapped.find(v => v.name === TARGET_LOCATION_NAME || v.id === TARGET_VILLAGE_ID);
      if (target) {
        setSelectedVillage(target.id);
      }
      mapped.forEach((village) => loadVillageStats(village.id, village.name));
    }
    setLoading(false);
  };

  const loadVillageStats = async (villageId: string, villageName?: string) => {
    const isTarget = villageId === TARGET_VILLAGE_ID || (villageName && (/Zion|SRMIST/i.test(villageName) || villageName === TARGET_LOCATION_NAME));

    if (isTarget) {
      // Get latest live telemetry from Supabase for AQUAGUARD_NODE_01
      const { data: readingsData } = await supabase
        .from("water_quality_readings")
        .select("sensor_id, ph, turbidity, tds, temperature")
        .or(`village_id.eq.${TARGET_VILLAGE_ID},sensor_id.eq.AQUAGUARD_NODE_01`)
        .order("reading_timestamp", { ascending: false })
        .limit(5);

      const latest = readingsData?.[0];
      const targetEval = evaluateWaterRisk(latest?.ph, latest?.tds, latest?.turbidity);
      const avgPh = latest?.ph != null ? Number(latest.ph) : 7.2;
      const avgTurbidity = latest?.turbidity != null ? Number(latest.turbidity) : 1.5;

      setVillageStats((prev) => ({
        ...prev,
        [villageId]: { 
          sensors: 1, 
          cases: targetEval.isSafe ? 0 : 4, 
          avgPh, 
          avgTurbidity,
          sensorId: "AQUAGUARD_NODE_01",
          tds: formatTDS(latest?.tds),
          temperature: latest?.temperature ?? 25,
          riskLevel: targetEval.riskLevel,
          riskScore: targetEval.riskScore,
          isSafe: targetEval.isSafe,
          summary: targetEval.summary,
        },
      }));
      return;
    }

    // Only Zion school has sensors; do not show others having sensors
    setVillageStats((prev) => ({
      ...prev,
      [villageId]: { sensors: 0, cases: 0, avgPh: null, avgTurbidity: null },
    }));
  };

  // Heatmap points: dynamically responsive to sensor risk score
  const heatmapPoints = useMemo((): [number, number, number][] => {
    const target = villages.find(v => v.name === TARGET_LOCATION_NAME || v.id === TARGET_VILLAGE_ID);
    const targetScore = target?.risk_score ?? 15;
    // Dynamic intensity: clean water = 0.15 (green/safe), dirty water = 0.95 (bright red)
    const targetIntensity = Math.min(1.0, Math.max(0.15, targetScore / 100));

    return [
      [TARGET_LATITUDE, TARGET_LONGITUDE, targetIntensity],
      ...villages
        .filter(v => v.latitude && v.longitude && v.name !== TARGET_LOCATION_NAME)
        .map(v => [v.latitude!, v.longitude!, (v.risk_score || 0) / 100] as [number, number, number])
    ];
  }, [villages]);

  // Center map on Zion Matriculation.Hr.Sec.School, Sealiyur
  const mapCenter = useMemo((): [number, number] => {
    return [TARGET_LATITUDE, TARGET_LONGITUDE];
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:pl-72 pt-20 lg:pt-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">{t('riskMap')}</h1>
            <p className="text-muted-foreground mt-1">{t('mapDigitalTwinTitle')}</p>
          </div>
          <Button onClick={loadVillages} variant="outline" className="gap-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('refreshSystem')}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Digital Twin Map */}
          <Card className="lg:col-span-2 p-0 overflow-hidden">
            <div className="p-4 pb-0 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Waves className="w-5 h-5 text-primary" />
                {t('mapDigitalTwinTitle')}
              </h3>
              <div className="flex gap-2">
                <Badge className="bg-destructive text-destructive-foreground">{t('mapRedZoneBadge')}</Badge>
                <Badge className="bg-warning text-warning-foreground">{t('mapYellowZoneBadge')}</Badge>
                <Badge className="bg-success text-success-foreground">{t('mapGreenZoneBadge')}</Badge>
              </div>
            </div>
            <div className="h-[500px] md:h-[600px] relative">
              <MapContainer
                center={mapCenter}
                zoom={13}
                className="h-full w-full z-0"
                scrollWheelZoom
              >
                <RecenterMap center={selectedVillage ? (villages.find(v => v.id === selectedVillage)?.latitude ? [villages.find(v => v.id === selectedVillage)!.latitude!, villages.find(v => v.id === selectedVillage)!.longitude!] : mapCenter) : mapCenter} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <HeatmapLayer points={heatmapPoints} />
                {villages.filter(v => v.latitude && v.longitude).map(village => {
                  const isTarget = village.name === TARGET_LOCATION_NAME || village.id === TARGET_VILLAGE_ID;
                  const currentRisk = village.risk_level || (village as any).riskLevel || "low";
                  const currentScore = village.risk_score || (village as any).riskScore || 15;
                  const markerHex = getRiskHex(currentRisk);
                  const stat = villageStats[village.id];

                  return (
                    <CircleMarker
                      key={village.id}
                      center={[village.latitude!, village.longitude!]}
                      radius={isTarget ? 18 : 10 + (village.risk_score || (village as any).riskScore || 0) / 10}
                      pathOptions={{
                        color: markerHex,
                        fillColor: markerHex,
                        fillOpacity: isTarget ? 0.85 : 0.6,
                        weight: isTarget ? 4 : 2,
                      }}
                      eventHandlers={{
                        click: () => setSelectedVillage(selectedVillage === village.id ? null : village.id),
                      }}
                    >
                      <Popup>
                        <div className="min-w-[230px] p-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-sm text-foreground">{village.name}</p>
                            <Badge className={getRiskColor(currentRisk)}>
                              {currentRisk.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{village.district || "Chennai"}, {village.state || "Tamil Nadu"}</p>
                          
                          {isTarget ? (
                            <div className="mt-2.5 space-y-2">
                              <div className={`p-2 rounded-lg border ${
                                currentRisk === 'high' 
                                  ? 'bg-destructive/15 border-destructive/30 text-destructive' 
                                  : currentRisk === 'medium'
                                  ? 'bg-warning/15 border-warning/30 text-warning'
                                  : 'bg-success/15 border-success/30 text-success'
                              }`}>
                                <div className="flex items-center justify-between text-xs font-semibold">
                                  <span className="flex items-center gap-1.5">
                                    {currentRisk === 'high' ? <ShieldAlert className="w-3.5 h-3.5 text-destructive" /> : <ShieldCheck className="w-3.5 h-3.5 text-success" />}
                                    <span>Active IoT Node:</span>
                                  </span>
                                  <span className="font-mono bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-[11px]">AQUAGUARD_NODE_01</span>
                                </div>
                                <p className="text-[10px] mt-1 font-medium">
                                  {currentRisk === 'high' ? '🔴 High Risk Outbreak Threat — Contaminated Water' : currentRisk === 'medium' ? '🟡 Moderate Water Parameter Warning' : '🟢 Normal Water Quality — Safe & Potable'}
                                </p>
                              </div>

                              <div className="mt-2 space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Active Sensors:</span>
                                  <span className="font-bold text-primary">1 (AQUAGUARD_NODE_01)</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">pH Level:</span>
                                  <span className={`font-semibold ${
                                    (stat?.avgPh ?? 7) < 6.5 || (stat?.avgPh ?? 7) > 8.5 ? 'text-destructive font-bold' : 'text-success'
                                  }`}>
                                    {stat?.avgPh != null ? stat.avgPh.toFixed(2) : '7.20'}
                                    {(stat?.avgPh ?? 7) < 6.0 ? ' (Critical Acidic)' : (stat?.avgPh ?? 7) > 9.0 ? ' (Critical Alkaline)' : (stat?.avgPh ?? 7) < 6.5 || (stat?.avgPh ?? 7) > 8.5 ? ' (Warning)' : ' (Safe)'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">TDS:</span>
                                  <span className="font-semibold">{stat?.tds || '185 ppm'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Turbidity:</span>
                                  <span className="font-semibold">{stat?.avgTurbidity != null ? stat.avgTurbidity.toFixed(1) : '1.5'} NTU</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Temperature:</span>
                                  <span className="font-semibold">{stat?.temperature ?? 25}°C</span>
                                </div>
                                <div className="flex justify-between border-t border-border/60 pt-1.5 mt-1 font-bold">
                                  <span>Risk Status:</span>
                                  <span className={currentRisk === 'high' ? 'text-destructive' : currentRisk === 'medium' ? 'text-warning' : 'text-success'}>
                                    {currentRisk === 'high' ? `🔴 HIGH RISK (${currentScore}/100)` : currentRisk === 'medium' ? `🟡 MEDIUM RISK (${currentScore}/100)` : `🟢 LOW RISK (${currentScore}/100)`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span>{t('mapRiskScore')}</span>
                                <span className="font-semibold">{village.risk_score || (village as any).riskScore || 0}/100</span>
                              </div>
                              <div className="flex justify-between">
                                <span>{t('mapActiveSensors')}</span>
                                <span className="text-muted-foreground">0 Sensors</span>
                              </div>
                              <div className="flex justify-between">
                                <span>{t('mapCases7d')}</span>
                                <span>{villageStats[village.id]?.cases || 0}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-6 p-4 border-t border-border">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-destructive shadow-sm shadow-destructive/50" />
                <span className="text-sm text-muted-foreground">{t('mapRedZone')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-warning shadow-sm shadow-warning/50" />
                <span className="text-sm text-muted-foreground">{t('mapYellowZone')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-success shadow-sm shadow-success/50" />
                <span className="text-sm text-muted-foreground">{t('mapGreenZone')}</span>
              </div>
            </div>
          </Card>

          {/* Village List */}
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                {t('mapMonitoredLocs')} ({villages.length})
              </h3>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : villages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t('mapNoLocs')}</p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {villages.map((village) => (
                    <div
                      key={village.id}
                      onClick={() => setSelectedVillage(selectedVillage === village.id ? null : village.id)}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                        selectedVillage === village.id
                          ? 'border-primary bg-primary/5'
                          : `border-border hover:border-primary/30 bg-gradient-to-r ${getRiskGradient(village.risk_level)}`
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <p className="font-semibold text-foreground">{village.name}</p>
                        <Badge className={getRiskColor(village.risk_level || (village as any).riskLevel)}>
                          {(village.risk_level || (village as any).riskLevel)?.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                           <Droplet className="w-4 h-4 text-primary" />
                           {villageStats[village.id]?.sensors ? `1 Sensor (${villageStats[village.id]?.sensorId || 'AQUAGUARD_NODE_01'})` : `0 Sensors`}
                         </div>
                         <div className="flex items-center gap-2 text-muted-foreground">
                           <AlertTriangle className="w-4 h-4 text-warning" />
                           {villageStats[village.id]?.cases || 0} {t('mapCasesText')}
                         </div>
                        {villageStats[village.id]?.avgPh != null && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Thermometer className="w-4 h-4 text-secondary" />
                            pH {villageStats[village.id]?.avgPh?.toFixed(1)}
                          </div>
                        )}
                        {villageStats[village.id]?.tds && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Activity className="w-4 h-4 text-primary" />
                            TDS {villageStats[village.id]?.tds}
                          </div>
                        )}
                        {village.population && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="w-4 h-4" />
                            {village.population.toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t('mapRiskScore')}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  (village.risk_level || (village as any).riskLevel) === 'high' ? 'bg-destructive' :
                                  (village.risk_level || (village as any).riskLevel) === 'medium' ? 'bg-warning' : 'bg-success'
                                }`}
                                style={{ width: `${village.risk_score || (village as any).riskScore || 0}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold w-8">{village.risk_score || (village as any).riskScore || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;
