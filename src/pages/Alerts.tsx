import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeAlertTitle, sanitizeLocationName, sanitizeAlertMessage, syncLocationToSupabase } from "@/utils/sanitizeLocation";

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical":
    case "high":
      return "bg-destructive text-destructive-foreground";
    case "medium":
      return "bg-warning text-warning-foreground";
    case "low":
      return "bg-success text-success-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "active":
      return <AlertTriangle className="w-5 h-5 text-destructive" />;
    case "investigating":
      return <Clock className="w-5 h-5 text-warning" />;
    case "resolved":
      return <CheckCircle className="w-5 h-5 text-success" />;
    default:
      return <Activity className="w-5 h-5 text-muted-foreground" />;
  }
};

const Alerts = () => {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [stats, setStats] = useState({
    active: 0,
    investigating: 0,
    resolvedToday: 0,
    totalWeek: 0,
  });

  useEffect(() => {
    syncLocationToSupabase();
    loadAlerts();
    loadStats();

    const channel = supabase
      .channel('alerts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        loadAlerts();
        loadStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadAlerts = async () => {
    const { data } = await supabase
      .from("alerts")
      .select(`
        *,
        villages (name)
      `)
      .order("created_at", { ascending: false });

    if (data) setAlerts(data);
  };

  const loadStats = async () => {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const weekStart = new Date(now.setDate(now.getDate() - 7)).toISOString();

    const { data: activeData } = await supabase
      .from("alerts")
      .select("id", { count: "exact" })
      .eq("status", "active");

    const { data: investigatingData } = await supabase
      .from("alerts")
      .select("id", { count: "exact" })
      .eq("status", "investigating");

    const { data: resolvedTodayData } = await supabase
      .from("alerts")
      .select("id", { count: "exact" })
      .eq("status", "resolved")
      .gte("resolved_at", todayStart);

    const { data: weekData } = await supabase
      .from("alerts")
      .select("id", { count: "exact" })
      .gte("created_at", weekStart);

    setStats({
      active: activeData?.length || 0,
      investigating: investigatingData?.length || 0,
      resolvedToday: resolvedTodayData?.length || 0,
      totalWeek: weekData?.length || 0,
    });
  };

  const handleMarkResolved = async (alertId: string) => {
    const { error } = await supabase
      .from("alerts")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", alertId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Alert Resolved",
        description: "The alert has been marked as resolved.",
      });
    }
  };

  const handleMarkInvestigating = async (alertId: string) => {
    const { error } = await supabase
      .from("alerts")
      .update({ status: "investigating" })
      .eq("id", alertId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Status Updated",
        description: "Alert is now under investigation.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:pl-72 pt-20 lg:pt-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Alert Management</h1>
            <p className="text-muted-foreground">Real-time disease outbreak warnings</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
            <p className="text-sm text-muted-foreground">Active Alerts</p>
            <p className="text-2xl font-bold text-destructive mt-1">{stats.active}</p>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <p className="text-sm text-muted-foreground">Investigating</p>
            <p className="text-2xl font-bold text-warning mt-1">{stats.investigating}</p>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <p className="text-sm text-muted-foreground">Resolved Today</p>
            <p className="text-2xl font-bold text-success mt-1">{stats.resolvedToday}</p>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <p className="text-sm text-muted-foreground">Total This Week</p>
            <p className="text-2xl font-bold text-primary mt-1">{stats.totalWeek}</p>
          </Card>
        </div>

        <div className="space-y-4">
          {alerts.length === 0 ? (
            <Card className="p-12">
              <p className="text-center text-muted-foreground">No alerts at this time</p>
            </Card>
          ) : (
            alerts.map((alert) => (
              <Card key={alert.id} className="p-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 mt-1">{getStatusIcon(alert.status)}</div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-foreground">{sanitizeAlertTitle(alert.title || alert.type)}</h3>
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {sanitizeLocationName(alert.villages?.name)} • {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {alert.status}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Alert Details:</p>
                        <p className="text-sm text-muted-foreground">{sanitizeAlertMessage(alert.message)}</p>
                      </div>
                      {alert.actions_taken && (
                        <div>
                          <p className="text-sm font-medium text-foreground">Actions Taken:</p>
                          <p className="text-sm text-muted-foreground">{alert.actions_taken}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      {alert.status === "active" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleMarkInvestigating(alert.id)}>
                            Mark Investigating
                          </Button>
                          <Button size="sm" onClick={() => handleMarkResolved(alert.id)}>
                            Mark as Resolved
                          </Button>
                        </>
                      )}
                      {alert.status === "investigating" && (
                        <Button size="sm" onClick={() => handleMarkResolved(alert.id)}>
                          Mark as Resolved
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Alerts;
