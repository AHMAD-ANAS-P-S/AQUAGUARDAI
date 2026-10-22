import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { db } from "@/utils/db";
import { sanitizeLocationName, TARGET_LOCATION_NAME, TARGET_VILLAGE_ID, evaluateWaterRisk } from "@/utils/sanitizeLocation";

const getRiskColor = (risk: string) => {
  switch (risk) {
    case "high": return "bg-destructive text-destructive-foreground";
    case "medium": return "bg-warning text-warning-foreground";
    case "low": return "bg-success text-success-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

export const RiskMap = () => {
  const { t } = useTranslation();
  const [villages, setVillages] = useState<any[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const fetchVillages = async () => {
      // Get latest physical reading to evaluate Zion dynamically
      const { data: latestTargetReading } = await supabase
        .from("water_quality_readings")
        .select("sensor_id, ph, turbidity, tds")
        .or(`village_id.eq.${TARGET_VILLAGE_ID},sensor_id.eq.AQUAGUARD_NODE_01`)
        .order("reading_timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();

      const targetEval = evaluateWaterRisk(
        latestTargetReading?.ph,
        latestTargetReading?.tds,
        latestTargetReading?.turbidity
      );

      const { data } = await supabase
        .from("villages")
        .select("*")
        .order("risk_score", { ascending: false });
      
      let baseList: any[] = [];
      if (data && data.length > 0) {
        baseList = data;
        setIsDemo(false);
      } else {
        // Use local db mock data
        const local = await db.getVillages();
        baseList = local.sort((a: any, b: any) => (b.riskScore || 0) - (a.riskScore || 0)).slice(0, 8);
        setIsDemo(true);
      }

      const formatted = baseList.map((v: any) => {
        const isTarget = v.id === TARGET_VILLAGE_ID || /Zion|SRMIST/i.test(v.name);
        if (!isTarget) return v;
        return {
          ...v,
          name: TARGET_LOCATION_NAME,
          risk_level: targetEval.riskLevel,
          risk_score: targetEval.riskScore,
          riskLevel: targetEval.riskLevel,
          riskScore: targetEval.riskScore,
        };
      });

      setVillages(formatted);
    };

    fetchVillages();

    const channel = supabase
      .channel("village_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "villages" }, () => fetchVillages())
      .on("postgres_changes", { event: "*", schema: "public", table: "water_quality_readings" }, () => fetchVillages())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getRiskLabel = (risk: string) => {
    if (risk === 'high') return t('high');
    if (risk === 'medium') return t('medium');
    return t('low');
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t('outbreakRiskMap')}</h3>
            <p className="text-sm text-muted-foreground">{t('checkRiskStatus')}</p>
          </div>
          {isDemo && (
            <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/20">
              Demo
            </Badge>
          )}
        </div>
        
        <div className="space-y-3">
          {villages.map((village: any) => {
            const risk = village.risk_level || village.riskLevel || "low";
            const score = village.risk_score || village.riskScore || 0;
            return (
              <div
                key={village.id}
                className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-foreground">{sanitizeLocationName(village.name)}</p>
                  <p className="text-sm text-muted-foreground">{t('mapRiskScore')}: {score}/100</p>
                </div>
                <Badge className={getRiskColor(risk)}>
                  {getRiskLabel(risk).toUpperCase()}
                </Badge>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive"></div>
            <span className="text-sm text-muted-foreground">{t('highRisk')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning"></div>
            <span className="text-sm text-muted-foreground">{t('medium')} {t('riskLevel')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success"></div>
            <span className="text-sm text-muted-foreground">{t('low')} {t('riskLevel')}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
