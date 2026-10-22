import { supabase } from "@/integrations/supabase/client";

// LocalStorage helpers
const getFallback = <T>(key: string, defaultValue: T): T => {
  const stored = localStorage.getItem(`aquaguard_${key}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Merge new items if it's an array of objects with an 'id'
      if (Array.isArray(parsed) && Array.isArray(defaultValue) && defaultValue.length > 0 && typeof defaultValue[0] === 'object' && 'id' in defaultValue[0]) {
        const existingIds = new Set(parsed.map(item => item.id));
        const newItems = defaultValue.filter(item => !existingIds.has(item.id));
        if (newItems.length > 0) {
          const merged = [...parsed, ...newItems];
          localStorage.setItem(`aquaguard_${key}`, JSON.stringify(merged));
          return merged as unknown as T;
        }
      }
      return parsed;
    } catch {
      return stored as unknown as T;
    }
  }
  localStorage.setItem(`aquaguard_${key}`, JSON.stringify(defaultValue));
  return defaultValue;
};

const saveFallback = <T>(key: string, data: T): void => {
  localStorage.setItem(`aquaguard_${key}`, JSON.stringify(data));
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const readNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

type WaterSensorReading = {
  pH?: unknown;
  turbidity?: unknown;
  bacterial?: unknown;
  do?: unknown;
};

const calculateWaterRisk = (sensor?: WaterSensorReading) => {
  if (!sensor) return 35;

  const ph = readNumber(sensor.pH, 7);
  const turbidity = readNumber(sensor.turbidity, 0);
  const bacterial = readNumber(sensor.bacterial, 0);
  const dissolvedOxygen = readNumber(sensor.do, 7);

  const phRisk = ph < 6.5 ? (6.5 - ph) * 18 : ph > 8.5 ? (ph - 8.5) * 18 : 0;
  const turbidityRisk = Math.max(0, turbidity - 5) * 5.5;
  const bacterialRisk = Math.max(0, bacterial - 10) * 0.22;
  const oxygenRisk = dissolvedOxygen < 5 ? (5 - dissolvedOxygen) * 9 : 0;

  return clamp(Math.round(phRisk + turbidityRisk + bacterialRisk + oxygenRisk), 0, 100);
};

const SIMULATED_ACTIONS = [
  "Water Tanker Deployment",
  "Chlorination Drive",
  "Medical Camp",
  "Awareness Campaign",
];

// Initial Mock Data Setup for Presentations & Offline fallback
const MOCK_DISTRICTS = [
  { id: "d1", name: "Dibrugarh", cases: 142, alerts: 4, resources: 85, risk: "high" },
  { id: "d2", name: "Jorhat", cases: 78, alerts: 1, resources: 40, risk: "medium" },
  { id: "d3", name: "Majuli", cases: 25, alerts: 0, resources: 20, risk: "low" },
  { id: "d4", name: "Silchar", cases: 110, alerts: 3, resources: 70, risk: "high" },
  { id: "d5", name: "Tezpur", cases: 54, alerts: 1, resources: 35, risk: "medium" },
  { id: "d6", name: "Chennai", cases: 210, alerts: 5, resources: 90, risk: "high" },
  { id: "d7", name: "Tiruvallur", cases: 85, alerts: 2, resources: 45, risk: "medium" },
  { id: "d8", name: "Kanchipuram", cases: 65, alerts: 1, resources: 50, risk: "medium" },
  { id: "d9", name: "Erode", cases: 30, alerts: 0, resources: 40, risk: "low" },
  { id: "d10", name: "Vellore", cases: 42, alerts: 1, resources: 35, risk: "medium" },
  { id: "d11", name: "Salem", cases: 15, alerts: 0, resources: 25, risk: "low" },
];

const MOCK_VILLAGES = [
  { id: "66e0b29f-2fa6-4e48-98cc-37f6b914a598", districtId: "d6", name: "Zion Matriculation.Hr.Sec.School, Sealiyur", population: 3500, waterSources: 2, cases: 4, riskScore: 94, riskLevel: "high", alerts: 1, resourcesAssigned: 2, predictionScore: 95, predictedDisease: "Water Acidity & Bacterial Contamination", mainWaterSource: "Campus Supply / Borewell", latitude: 12.9160, longitude: 80.1380, sensorId: "AQUAGUARD_NODE_01", sensorsCount: 1, state: "Tamil Nadu", district: "Chennai" },
  { id: "v1", districtId: "d1", name: "Dibrugarh Town", population: 15000, waterSources: 4, cases: 42, riskScore: 85, riskLevel: "high", alerts: 2, resourcesAssigned: 5, predictionScore: 92, predictedDisease: "Cholera", mainWaterSource: "Brahmaputra Canal", latitude: 27.4728, longitude: 94.9120, sensorsCount: 0 },
  { id: "v2", districtId: "d1", name: "Barbaruah", population: 8200, waterSources: 3, cases: 18, riskScore: 48, riskLevel: "medium", alerts: 1, resourcesAssigned: 2, predictionScore: 54, predictedDisease: "Diarrhea", mainWaterSource: "Community Handpump", latitude: 27.3915, longitude: 94.8872, sensorsCount: 0 },
  { id: "v3", districtId: "d1", name: "Khowang", population: 6400, waterSources: 2, cases: 8, riskScore: 28, riskLevel: "low", alerts: 0, resourcesAssigned: 1, predictionScore: 22, predictedDisease: "None", mainWaterSource: "Open Well", latitude: 27.2882, longitude: 94.8988, sensorsCount: 0 },
  { id: "v4", districtId: "d2", name: "Jorhat Center", population: 21000, waterSources: 6, cases: 35, riskScore: 52, riskLevel: "medium", alerts: 1, resourcesAssigned: 3, predictionScore: 61, predictedDisease: "Typhoid", mainWaterSource: "Municipal Pipeline", latitude: 26.7509, longitude: 94.2037, sensorsCount: 0 },
  { id: "v5", districtId: "d2", name: "Mariani", population: 11500, waterSources: 4, cases: 24, riskScore: 72, riskLevel: "high", alerts: 2, resourcesAssigned: 4, predictionScore: 81, predictedDisease: "Hepatitis A", mainWaterSource: "River Stream", latitude: 26.6667, longitude: 94.3333, sensorsCount: 0 },
  { id: "v6", districtId: "d2", name: "Teok", population: 7800, waterSources: 3, cases: 6, riskScore: 19, riskLevel: "low", alerts: 0, resourcesAssigned: 0, predictionScore: 15, predictedDisease: "None", mainWaterSource: "Deep Tube Well", latitude: 26.8202, longitude: 94.4312, sensorsCount: 0 },
  { id: "v7", districtId: "d3", name: "Kamalabari", population: 5200, waterSources: 2, cases: 12, riskScore: 35, riskLevel: "low", alerts: 0, resourcesAssigned: 1, predictionScore: 30, predictedDisease: "None", mainWaterSource: "River Water", latitude: 26.9634, longitude: 94.0506, sensorsCount: 0 },
  { id: "v8", districtId: "d3", name: "Garamur", population: 4900, waterSources: 2, cases: 9, riskScore: 22, riskLevel: "low", alerts: 0, resourcesAssigned: 1, predictionScore: 18, predictedDisease: "None", mainWaterSource: "Hand Pump", latitude: 26.9535, longitude: 94.0620, sensorsCount: 0 },
  { id: "v9", districtId: "d4", name: "Silchar Ward 5", population: 18500, waterSources: 5, cases: 58, riskScore: 89, riskLevel: "high", alerts: 3, resourcesAssigned: 6, predictionScore: 94, predictedDisease: "Cholera", mainWaterSource: "Pond Water", latitude: 24.8333, longitude: 92.7789, sensorsCount: 0 },
  { id: "v10", districtId: "d5", name: "Tezpur Bazar", population: 14000, waterSources: 4, cases: 15, riskScore: 40, riskLevel: "medium", alerts: 0, resourcesAssigned: 2, predictionScore: 45, predictedDisease: "Dysentery", mainWaterSource: "Borewell Water", latitude: 26.6528, longitude: 92.7926, sensorsCount: 0 },
  { id: "v11", districtId: "d7", name: "Karlambakkam", population: 6000, waterSources: 3, cases: 12, riskScore: 45, riskLevel: "medium", alerts: 1, resourcesAssigned: 2, predictionScore: 50, predictedDisease: "Diarrhea", mainWaterSource: "Borewell Water", latitude: 13.1611, longitude: 79.9482 },
  { id: "v12", districtId: "d8", name: "Thiruper", population: 4500, waterSources: 2, cases: 5, riskScore: 25, riskLevel: "low", alerts: 0, resourcesAssigned: 1, predictionScore: 20, predictedDisease: "None", mainWaterSource: "Community Handpump", latitude: 12.8342, longitude: 79.7036 },
  { id: "v13", districtId: "d8", name: "Andhimanam", population: 5200, waterSources: 2, cases: 8, riskScore: 30, riskLevel: "low", alerts: 0, resourcesAssigned: 1, predictionScore: 28, predictedDisease: "None", mainWaterSource: "Open Well", latitude: 12.7562, longitude: 79.8225 },
  { id: "v14", districtId: "d8", name: "Pappankuzhi", population: 3800, waterSources: 1, cases: 2, riskScore: 15, riskLevel: "low", alerts: 0, resourcesAssigned: 0, predictionScore: 12, predictedDisease: "None", mainWaterSource: "Hand Pump", latitude: 12.8931, longitude: 79.8833 },
  { id: "v15", districtId: "d11", name: "Vengaivayal", population: 2900, waterSources: 1, cases: 14, riskScore: 65, riskLevel: "high", alerts: 1, resourcesAssigned: 2, predictionScore: 72, predictedDisease: "Typhoid", mainWaterSource: "Pond Water", latitude: 11.6643, longitude: 78.1460 },
  { id: "v16", districtId: "d1", name: "Karlambakkam", population: 6000, waterSources: 3, cases: 12, riskScore: 45, riskLevel: "medium", alerts: 1, resourcesAssigned: 2, predictionScore: 50, predictedDisease: "Diarrhea", mainWaterSource: "Borewell Water", latitude: 13.1611, longitude: 79.9482 },
  { id: "v17", districtId: "d1", name: "Thiruper", population: 4500, waterSources: 2, cases: 5, riskScore: 25, riskLevel: "low", alerts: 0, resourcesAssigned: 1, predictionScore: 20, predictedDisease: "None", mainWaterSource: "Community Handpump", latitude: 12.8342, longitude: 79.7036 },
  { id: "v18", districtId: "d1", name: "Andhimanam", population: 5200, waterSources: 2, cases: 8, riskScore: 30, riskLevel: "low", alerts: 0, resourcesAssigned: 1, predictionScore: 28, predictedDisease: "None", mainWaterSource: "Open Well", latitude: 12.7562, longitude: 79.8225 },
  { id: "v19", districtId: "d1", name: "Pappankuzhi", population: 3800, waterSources: 1, cases: 2, riskScore: 15, riskLevel: "low", alerts: 0, resourcesAssigned: 0, predictionScore: 12, predictedDisease: "None", mainWaterSource: "Hand Pump", latitude: 12.8931, longitude: 79.8833 },
  { id: "v20", districtId: "d1", name: "Vengaivayal", population: 2900, waterSources: 1, cases: 14, riskScore: 65, riskLevel: "high", alerts: 1, resourcesAssigned: 2, predictionScore: 72, predictedDisease: "Typhoid", mainWaterSource: "Pond Water", latitude: 11.6643, longitude: 78.1460 },
];

const MOCK_PREDICTIONS = [
  { id: "p1", villageName: "Dibrugarh Town", riskScore: 85, predictedDisease: "Cholera", confidence: 92, reason: "+ 15 diarrhea cases, + Turbidity above safe limit, + Heavy monsoon rainfall in last 7 days, + Historical seasonal pattern matched" },
  { id: "p2", villageName: "Mariani", riskScore: 72, predictedDisease: "Hepatitis A", confidence: 84, reason: "+ 8 vomiting cases, + Contaminated well reports, + High bacterial count from IoT Sensor #2" },
  { id: "p3", villageName: "Silchar Ward 5", riskScore: 89, predictedDisease: "Cholera", confidence: 95, reason: "+ 22 gastrointestinal cases, + Safe pH thresholds breached, + Flooding in low-lying water resources" },
  { id: "p4", villageName: "Jorhat Center", riskScore: 52, predictedDisease: "Typhoid", confidence: 78, reason: "+ 5 fever cases, + Pipeline leakage detected, + Warm temperature aiding bacterial growth" },
];

const MOCK_RESOURCES = [
  { id: "r1", type: "Doctors", allocated: 12, required: 15, status: "Shortage" },
  { id: "r2", type: "Nurses", allocated: 28, required: 35, status: "Shortage" },
  { id: "r3", type: "ORS Kits", allocated: 1200, required: 1500, status: "Shortage" },
  { id: "r4", type: "Medicines (Doxycycline)", allocated: 850, required: 800, status: "Adequate" },
  { id: "r5", type: "Water Tankers", allocated: 4, required: 6, status: "Shortage" },
  { id: "r6", type: "Health Workers", allocated: 45, required: 45, status: "Adequate" },
];

const MOCK_INTERVENTIONS = [
  { id: "i1", villageName: "Dibrugarh Town", alertTitle: "Water Contamination Alert", status: "Medicine Distributed", team: "Response Unit A", progress: 75, steps: { alert: true, team: true, test: true, medicine: true, campaign: false, resolved: false } },
  { id: "i2", villageName: "Silchar Ward 5", alertTitle: "Cholera Outbreak Alert", status: "Investigation Started", team: "Epidemic Team 1", progress: 40, steps: { alert: true, team: true, test: false, medicine: false, campaign: false, resolved: false } },
  { id: "i3", villageName: "Mariani", alertTitle: "High Bacterial Load Warning", status: "Water Source Tested", team: "PHED Sanitation Cell", progress: 60, steps: { alert: true, team: true, test: true, medicine: false, campaign: false, resolved: false } },
  { id: "i4", villageName: "Jorhat Center", alertTitle: "Enteric Fever Alert", status: "Team Assigned", team: "Local Medical Officer", progress: 25, steps: { alert: true, team: true, test: false, medicine: false, campaign: false, resolved: false } },
];

const MOCK_SENSORS = [
  {
    id: "fb701d70-204c-4d6b-8cb7-fa3b20fa74bb",
    sensor_id: "AQUAGUARD_NODE_01",
    name: "AQUAGUARD_NODE_01 (Zion Matriculation.Hr.Sec.School, Sealiyur)",
    status: "Online",
    battery: "100%",
    village: "Zion Matriculation.Hr.Sec.School, Sealiyur",
    location_name: "Zion Matriculation.Hr.Sec.School, Sealiyur",
    pH: 3.8,
    tds: 185,
    turbidity: 3.0,
    temp: "25°C",
    do: "6.2 mg/L",
    bacterial: "85 CFU/ml"
  }
];

const MOCK_CLUSTERS = [
  { id: "c1", village: "Dibrugarh Town", details: "12 Fever, 9 Vomiting, 7 Diarrhea", pattern: "Possible Cholera / Gastrointestinal Outbreak", status: "Critical" },
  { id: "c2", village: "Silchar Ward 5", details: "18 Diarrhea, 14 Vomiting, 8 Dehydration", pattern: "Severe Water Contamination Outbreak", status: "Critical" },
  { id: "c3", village: "Mariani", details: "6 Fever, 5 Jaundice, 4 Nausea", pattern: "Potential Hepatitis A Outbreak", status: "High Alert" },
];

const MOCK_PENDING_REPORTS = [
  { id: "rep1", reporter: "Sunita Devi (ASHA)", village: "Dibrugarh Town", type: "Health Report", details: "7 children showing severe diarrhea and vomiting. All drink from same canal source.", cases: 7, date: "2026-06-20", status: "Pending" },
  { id: "rep2", reporter: "Rajesh Bora (Volunteer)", village: "Mariani", type: "Water Complaint", details: "Turbid well water with foul smell reported by multiple households.", cases: 0, date: "2026-06-21", status: "Pending" },
  { id: "rep3", reporter: "Anita Gogoi (ASHA)", village: "Silchar Ward 5", type: "Emergency Report", details: "Sudden spike in high-fever cases accompanied by intense abdominal pain.", cases: 12, date: "2026-06-21", status: "Pending" },
];

const MOCK_KPI = {
  villagesMonitored: 50,
  populationCovered: 120000,
  reportsCollected: 500,
  alertsGenerated: 20,
  outbreaksPrevented: 12,
  responseTimeReduction: "85%"
};

// Database utility object
export const db = {
  getDistricts: async () => {
    return getFallback("districts", MOCK_DISTRICTS);
  },

  getVillages: async () => {
    try {
      const { data, error } = await supabase.from('villages').select('*, districts(name)').order('name');
      if (error) throw error;
      
      const local = getFallback("villages", MOCK_VILLAGES);

      // Process database items to sanitize SRMIST -> Zion Matriculation.Hr.Sec.School, Sealiyur
      const processedDbData = (data || []).map((d: any) => {
        if (/SRMIST|Vadapalani/i.test(d.name) || d.id === '66e0b29f-2fa6-4e48-98cc-37f6b914a598') {
          return {
            ...d,
            name: "Zion Matriculation.Hr.Sec.School, Sealiyur",
            latitude: 12.9160,
            longitude: 80.1380,
            state: "Tamil Nadu",
            district: "Chennai",
            risk_level: d.risk_level || "low",
            risk_score: d.risk_score ?? 15
          };
        }
        return d;
      });

      // Ensure Zion school exists in the returned list
      const hasZion = local.some(l => l.id === "66e0b29f-2fa6-4e48-98cc-37f6b914a598" || /Zion/i.test(l.name));
      const baseList = hasZion ? local : [MOCK_VILLAGES[0], ...local];

      const merged = baseList.map(l => {
        const isTarget = l.id === "66e0b29f-2fa6-4e48-98cc-37f6b914a598" || /Zion|SRMIST/i.test(l.name);
        const dbVal = processedDbData.find((d: any) => 
          (isTarget && (d.id === "66e0b29f-2fa6-4e48-98cc-37f6b914a598" || /Zion|SRMIST/i.test(d.name))) || 
          d.name === l.name
        );
        if (dbVal) {
          return { 
            ...l, 
            ...dbVal,
            name: isTarget ? "Zion Matriculation.Hr.Sec.School, Sealiyur" : dbVal.name,
            latitude: isTarget ? 12.9160 : (dbVal.latitude || l.latitude),
            longitude: isTarget ? 80.1380 : (dbVal.longitude || l.longitude),
            district: dbVal.districts?.name || dbVal.district || l.district || null,
            sensorsCount: isTarget ? 1 : 0
          };
        }
        if (isTarget) {
          return {
            ...l,
            name: "Zion Matriculation.Hr.Sec.School, Sealiyur",
            latitude: 12.9160,
            longitude: 80.1380,
            district: "Chennai",
            state: "Tamil Nadu",
            sensorsCount: 1
          };
        }
        return {
          ...l,
          sensorsCount: 0
        };
      });

      return merged;
    } catch {
      return getFallback("villages", MOCK_VILLAGES);
    }
  },

  saveVillage: async (village: any) => {
    const local = getFallback("villages", MOCK_VILLAGES);
    const idx = local.findIndex(v => v.id === village.id);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...village };
      saveFallback("villages", local);
    }
    try {
      const isUuid = village.districtId && village.districtId.length === 36;
      await supabase.from('villages').upsert({
        name: village.name,
        risk_score: village.riskScore,
        risk_level: village.riskLevel,
        population: village.population,
        district_id: isUuid ? village.districtId : null
      });
    } catch (e) {
      console.warn("[AquaGuard DB] Suppress live DB update error on fallback:", e);
    }
  },

  getPredictions: async () => {
    try {
      const { data, error } = await supabase.from('ai_predictions').select('*, villages(name)');
      if (error) throw error;
      if (data && data.length > 0) {
        return data.map(d => ({
          id: d.id,
          villageName: d.villages?.name || "Unknown",
          riskScore: d.confidence_score ? Math.round(d.confidence_score * 100) : 70,
          predictedDisease: d.prediction_type,
          confidence: d.confidence_score ? Math.round(d.confidence_score * 100) : 90,
          reason: (d.prediction_data as any)?.reason || "Anomalous symptoms and water contamination trends detected."
        }));
      }
      return getFallback("predictions", MOCK_PREDICTIONS);
    } catch {
      return getFallback("predictions", MOCK_PREDICTIONS);
    }
  },

  getResources: async () => {
    return getFallback("resources", MOCK_RESOURCES);
  },

  updateResource: (id: string, allocated: number) => {
    const local = getFallback("resources", MOCK_RESOURCES);
    const idx = local.findIndex(r => r.id === id);
    if (idx !== -1) {
      local[idx].allocated = allocated;
      local[idx].status = allocated >= local[idx].required ? "Adequate" : "Shortage";
      saveFallback("resources", local);
    }
    return local;
  },

  getInterventions: async () => {
    return getFallback("interventions", MOCK_INTERVENTIONS);
  },

  updateInterventionStatus: (id: string, stepName: string, value: boolean) => {
    const local = getFallback("interventions", MOCK_INTERVENTIONS);
    const idx = local.findIndex(i => i.id === id);
    if (idx !== -1) {
      local[idx].steps = { ...local[idx].steps, [stepName]: value };
      
      // Calculate progress and current status
      const { alert, team, test, medicine, campaign, resolved } = local[idx].steps;
      let progress = 10;
      let status = "Alert Generated";

      if (team) { progress = 25; status = "Team Assigned"; }
      if (test) { progress = 45; status = "Water Source Tested"; }
      if (medicine) { progress = 70; status = "Medicine Distributed"; }
      if (campaign) { progress = 85; status = "Campaign Conducted"; }
      if (resolved) { progress = 100; status = "Resolved"; }

      local[idx].progress = progress;
      local[idx].status = status;
      saveFallback("interventions", local);
    }
    return local;
  },

  getSensors: async () => {
    saveFallback("sensors", MOCK_SENSORS);
    return MOCK_SENSORS;
  },

  getSymptomClusters: async () => {
    return getFallback("clusters", MOCK_CLUSTERS);
  },

  getPendingReports: async () => {
    return getFallback("pending_reports", MOCK_PENDING_REPORTS);
  },

  approveReport: (id: string) => {
    const local = getFallback("pending_reports", MOCK_PENDING_REPORTS);
    const idx = local.findIndex(r => r.id === id);
    if (idx !== -1) {
      local[idx].status = "Approved";
      saveFallback("pending_reports", local);
      
      // Increment reports submitted KPI
      const kpis = getFallback("kpi", MOCK_KPI);
      kpis.reportsCollected += 1;
      saveFallback("kpi", kpis);
    }
    return local;
  },

  rejectReport: (id: string) => {
    const local = getFallback("pending_reports", MOCK_PENDING_REPORTS);
    const idx = local.findIndex(r => r.id === id);
    if (idx !== -1) {
      local[idx].status = "Rejected";
      saveFallback("pending_reports", local);
    }
    return local;
  },

  getImpactKPIs: () => {
    return getFallback("kpi", MOCK_KPI);
  },

  simulateIntervention: (villageId: string, applyIntervention: boolean) => {
    const villages = getFallback("villages", MOCK_VILLAGES);
    const predictions = getFallback("predictions", MOCK_PREDICTIONS);
    const sensors = getFallback("sensors", MOCK_SENSORS);
    const clusters = getFallback("clusters", MOCK_CLUSTERS);
    const pendingReports = getFallback("pending_reports", MOCK_PENDING_REPORTS);
    const village = villages.find(v => v.id === villageId);
    if (!village) {
      return {
        riskScore: applyIntervention ? 30 : 62,
        expectedCases: applyIntervention ? 8 : 29,
        baseline: { riskScore: 62, expectedCases: 29 },
        intervention: { riskScore: 30, expectedCases: 8 },
        impact: { casesPrevented: 21, riskReductionPercent: 52, populationProtected: 900, responseTimeSaved: "18 hours" },
        actions: SIMULATED_ACTIONS,
        drivers: { villageRiskScore: 50, activeAlerts: 1, waterQualityRisk: 35, diseaseReportRisk: 25, aiPredictionScore: 50 }
      };
    }

    const villageRiskScore = clamp(readNumber(village.riskScore, 50), 0, 100);
    const activeAlerts = readNumber(village.alerts, 0);
    const currentCases = readNumber(village.cases, 0);
    const population = Math.max(1, readNumber(village.population, 1000));
    const aiPredictionScore = clamp(
      readNumber(village.predictionScore, predictions.find((p) => p.villageName === village.name)?.confidence || villageRiskScore),
      0,
      100
    );
    const waterQualityRisk = calculateWaterRisk(sensors.find((s) => s.village === village.name));
    const villageCluster = clusters.find((cluster) => cluster.village === village.name);
    const clusterRisk = villageCluster?.status === "Critical" ? 36 : villageCluster?.status === "High Alert" ? 26 : villageCluster ? 14 : 0;
    const reportCases = pendingReports
      .filter((report) => report.village === village.name && report.status === "Pending")
      .reduce((sum: number, report) => sum + readNumber(report.cases, 0), 0);
    const diseaseReportRisk = clamp(clusterRisk + reportCases * 2.4 + currentCases / Math.max(1, population / 1000), 0, 100);
    const alertRisk = clamp(activeAlerts * 24, 0, 100);

    const outbreakPressure = clamp(Math.round(
      villageRiskScore * 0.34 +
      aiPredictionScore * 0.22 +
      waterQualityRisk * 0.18 +
      diseaseReportRisk * 0.16 +
      alertRisk * 0.10
    ), 0, 100);

    const noActionRiskIncrease = Math.round(
      6 +
      activeAlerts * 4 +
      waterQualityRisk * 0.10 +
      diseaseReportRisk * 0.08 +
      aiPredictionScore * 0.06
    );
    const noActionRisk = clamp(
      Math.max(villageRiskScore + (villageRiskScore >= 65 ? 8 : 4), outbreakPressure + noActionRiskIncrease),
      0,
      100
    );

    const populationExposure = population * (noActionRisk / 100) * 0.018;
    const noActionGrowthFactor = 1.45 + noActionRisk / 95 + activeAlerts * 0.12 + waterQualityRisk / 260;
    const noActionCases = Math.max(
      currentCases + activeAlerts * 3 + 2,
      Math.round(currentCases * noActionGrowthFactor + populationExposure + reportCases)
    );

    const interventionStrength = clamp(
      0.34 +
      activeAlerts * 0.025 +
      waterQualityRisk / 600 +
      aiPredictionScore / 900 +
      (village.riskLevel === "high" ? 0.08 : 0),
      0.38,
      0.72
    );
    const interventionRiskDrop = Math.round(
      10 +
      villageRiskScore * interventionStrength * 0.42 +
      waterQualityRisk * 0.12 +
      diseaseReportRisk * 0.10 +
      activeAlerts * 2
    );
    const interventionRisk = clamp(
      Math.min(villageRiskScore - (villageRiskScore >= 65 ? 12 : 6), outbreakPressure - interventionRiskDrop),
      5,
      100
    );

    const protectedPopulation = Math.round(population * clamp((noActionRisk - interventionRisk) / 100, 0.05, 0.82));
    const interventionCases = Math.max(
      1,
      Math.round(noActionCases * (1 - interventionStrength) - activeAlerts * 2 - waterQualityRisk / 18)
    );
    const casesPrevented = Math.max(0, noActionCases - interventionCases);
    const riskReductionPercent = noActionRisk > 0
      ? Math.round(((noActionRisk - interventionRisk) / noActionRisk) * 100)
      : 0;
    const responseHoursSaved = clamp(Math.round(8 + activeAlerts * 6 + waterQualityRisk / 5 + aiPredictionScore / 8), 8, 48);

    const baseline = { riskScore: noActionRisk, expectedCases: noActionCases };
    const intervention = { riskScore: interventionRisk, expectedCases: interventionCases };
    const selectedScenario = applyIntervention ? intervention : baseline;

    return {
      ...selectedScenario,
      baseline,
      intervention,
      impact: {
        casesPrevented,
        riskReductionPercent,
        populationProtected: protectedPopulation,
        responseTimeSaved: `${responseHoursSaved} hours`,
      },
      actions: SIMULATED_ACTIONS,
      drivers: {
        villageRiskScore,
        activeAlerts,
        waterQualityRisk,
        diseaseReportRisk: Math.round(diseaseReportRisk),
        aiPredictionScore,
      },
      villageName: village.name,
    };
  }
};