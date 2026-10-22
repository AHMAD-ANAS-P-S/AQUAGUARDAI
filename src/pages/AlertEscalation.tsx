import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sanitizeAlertTitle, sanitizeLocationName } from "@/utils/sanitizeLocation";
import { supabase } from "@/integrations/supabase/client";
import { Clock, CheckCircle, AlertTriangle, Phone, User } from "lucide-react";
import { toast } from "sonner";
import { Navigation } from "@/components/layout/Navigation";

const AlertEscalation = () => {
  const [escalations, setEscalations] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);

  useEffect(() => {
    loadEscalations();
    loadActiveAlerts();

    const channel = supabase
      .channel('escalation_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alert_escalation_logs' }, loadEscalations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, loadActiveAlerts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadEscalations = async () => {
    const { data, error } = await supabase
      .from('alert_escalation_logs')
      .select('*, alerts(title, severity, villages(name))')
      .order('sent_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading escalations:', error);
      return;
    }

    setEscalations(data || []);
  };

  const loadActiveAlerts = async () => {
    const { data } = await supabase
      .from('alerts')
      .select('*, villages(name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    setActiveAlerts(data || []);
  };

  const handleAcknowledge = async (escalationId: string, alertId: string) => {
    const { error: logError } = await supabase
      .from('alert_escalation_logs')
      .update({
        acknowledged_at: new Date().toISOString(),
        response_time_seconds: Math.floor((Date.now() - new Date(escalations.find(e => e.id === escalationId)?.sent_at).getTime()) / 1000),
      })
      .eq('id', escalationId);

    if (logError) {
      toast.error('Failed to acknowledge alert');
      return;
    }

    const { error: ackError } = await supabase
      .from('alert_acknowledgments')
      .insert({
        alert_id: alertId,
        acknowledgment_method: 'web',
        notes: 'Acknowledged via web dashboard',
      });

    if (!ackError) {
      toast.success('Alert acknowledged successfully');
      loadEscalations();
    }
  };

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-yellow-500';
      case 2: return 'bg-orange-500';
      case 3: return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getLevelName = (level: number) => {
    switch (level) {
      case 1: return 'ASHA Worker';
      case 2: return 'District Officer';
      case 3: return 'State Health Dept';
      default: return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Alert Escalation System</h1>
          <p className="text-muted-foreground">Automated alert escalation with response tracking</p>
        </div>

        {/* Escalation Flow Info */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-primary/10 to-secondary/10">
          <h3 className="text-lg font-semibold text-foreground mb-4">Escalation Flow</h3>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center flex-1">
              <div className="w-12 h-12 rounded-full bg-yellow-500 text-white flex items-center justify-center mx-auto mb-2 font-bold">1</div>
              <p className="font-medium text-foreground">ASHA Worker</p>
              <p className="text-sm text-muted-foreground">5 min response time</p>
            </div>
            <AlertTriangle className="h-6 w-6 text-muted-foreground rotate-90 md:rotate-0" />
            <div className="text-center flex-1">
              <div className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center mx-auto mb-2 font-bold">2</div>
              <p className="font-medium text-foreground">District Officer</p>
              <p className="text-sm text-muted-foreground">10 min response time</p>
            </div>
            <AlertTriangle className="h-6 w-6 text-muted-foreground rotate-90 md:rotate-0" />
            <div className="text-center flex-1">
              <div className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center mx-auto mb-2 font-bold">3</div>
              <p className="font-medium text-foreground">State Health Dept</p>
              <p className="text-sm text-muted-foreground">15 min response time</p>
            </div>
          </div>
        </Card>

        {/* Active Alerts */}
        <Card className="p-6 mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Active Alerts</h3>
          {activeAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active alerts</p>
          ) : (
            <div className="space-y-3">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground">{sanitizeAlertTitle(alert.title)}</h4>
                      <p className="text-sm text-muted-foreground">{sanitizeLocationName(alert.villages?.name)}</p>
                    </div>
                    <Badge variant={alert.severity === 'high' ? 'destructive' : 'default'}>
                      {alert.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Escalation Logs */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Escalation History</h3>
          <div className="space-y-4">
            {escalations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No escalations yet</p>
            ) : (
              escalations.map((escalation) => (
                <div key={escalation.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${getLevelColor(escalation.escalation_level)} text-white flex items-center justify-center font-bold`}>
                        {escalation.escalation_level}
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">
                          {sanitizeAlertTitle(escalation.alerts?.title)}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {sanitizeLocationName(escalation.alerts?.villages?.name)}
                        </p>
                      </div>
                    </div>
                    {escalation.acknowledged_at ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Acknowledged
                      </Badge>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={() => handleAcknowledge(escalation.id, escalation.alert_id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Recipient
                      </p>
                      <p className="font-medium text-foreground">{escalation.recipient_name || escalation.recipient_role}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        Contact
                      </p>
                      <p className="font-medium text-foreground">{escalation.recipient_phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Sent At
                      </p>
                      <p className="font-medium text-foreground">
                        {new Date(escalation.sent_at).toLocaleTimeString()}
                      </p>
                    </div>
                    {escalation.response_time_seconds && (
                      <div>
                        <p className="text-muted-foreground">Response Time</p>
                        <p className="font-medium text-foreground">
                          {Math.floor(escalation.response_time_seconds / 60)}m {escalation.response_time_seconds % 60}s
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AlertEscalation;
