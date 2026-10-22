import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { sanitizeAlertTitle, sanitizeLocationName, sanitizeAlertMessage } from "@/utils/sanitizeLocation";

interface Alert {
  id: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  message: string;
  created_at: string;
  villages: { name: string } | null;
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "high":
    case "critical":
      return "bg-destructive text-destructive-foreground";
    case "medium":
      return "bg-warning text-warning-foreground";
    case "low":
      return "bg-success text-success-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const mockAlerts: Alert[] = [
  {
    id: "a1",
    title: "High Turbidity Alert",
    type: "Water Quality",
    severity: "critical",
    status: "active",
    message: "Water sensor #3 in Silchar Ward 5 detected turbidity at 12.0 NTU (Safe limit is 5 NTU).",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    villages: { name: "Silchar Ward 5" }
  },
  {
    id: "a2",
    title: "Gastrointestinal Outbreak Warning",
    type: "Health Report",
    severity: "high",
    status: "active",
    message: "ASHA worker reported 7 active cases of severe diarrhea and vomiting within 24 hours.",
    created_at: new Date(Date.now() - 7200000).toISOString(),
    villages: { name: "Dibrugarh Town" }
  },
  {
    id: "a3",
    title: "Acidic pH Level warning",
    type: "Water Quality",
    severity: "medium",
    status: "active",
    message: "Water sensor #2 in Mariani Well detected pH at 6.1, indicating elevated acidity.",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    villages: { name: "Mariani" }
  }
];

export const RecentAlerts = () => {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from("alerts")
        .select(`*, villages(name)`)
        .order("created_at", { ascending: false })
        .limit(5);

      if (data && data.length > 0) {
        setAlerts(data as any);
        setIsDemo(false);
      } else {
        setAlerts(mockAlerts);
        setIsDemo(true);
      }
    };

    fetchAlerts();

    const channel = supabase
      .channel("alerts_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => fetchAlerts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getSeverityLabel = (severity: string) => {
    if (severity === 'critical') return t('critical');
    if (severity === 'high') return t('high');
    if (severity === 'medium') return t('medium');
    return t('low');
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">{t('recentAlerts')}</h3>
              {isDemo && (
                <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/20">
                  Demo
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{t('activeAlerts')}</p>
          </div>
          <Bell className="w-5 h-5 text-primary" />
        </div>

        <div className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('noAlerts')}</p>
          ) : alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex gap-3 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-shrink-0 mt-1">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{sanitizeAlertTitle(alert.title)}</p>
                  <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                    {getSeverityLabel(alert.severity)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{sanitizeLocationName(alert.villages?.name)}</p>
                <p className="text-sm text-foreground">{sanitizeAlertMessage(alert.message)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(alert.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
