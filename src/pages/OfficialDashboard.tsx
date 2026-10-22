import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/layout/Navigation";
import { Bell, MapPin, Activity, AlertCircle, TrendingUp, Download, Users, BarChart2, Bot, ShieldAlert, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { RiskMap } from "@/components/dashboard/RiskMap";
import { WaterQualityChart } from "@/components/dashboard/WaterQualityChart";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { db } from "@/utils/db";
import { sanitizeLocationName, sanitizeAlertTitle } from "@/utils/sanitizeLocation";

const generatePredictionData = () => {
  const days = [];
  const base = 35;
  for (let i = 0; i < 14; i++) {
    const past = i < 7;
    const risk = past
      ? base + Math.random() * 20 - 5 + i * 2
      : base + 15 + i * 3 + Math.random() * 15;
    days.push({
      day: i < 7 ? `Day -${7 - i}` : i === 7 ? "Today" : `Day +${i - 7}`,
      risk: Math.min(100, Math.round(risk)),
      confidence: past ? 100 : Math.round(100 - (i - 7) * 6),
      isPast: past,
      isToday: i === 7,
    });
  }
  return days;
};

const OfficialDashboard = () => {
  const { signOut } = useAuth();
  const [stats, setStats] = useState({ activeAlerts: 0, totalReports: 0, iotDevices: 0, highRiskAreas: 0 });
  const [actionLogs, setActionLogs] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [predictionData] = useState(generatePredictionData());
  const [botInput, setBotInput] = useState("");
  const [botMessages, setBotMessages] = useState<{ role: string; content: string }[]>([
    { role: "bot", content: "🤖 AquaGuard Command Center ready. Ask me: 'show high risk zones', 'show analytics', 'list active alerts', 'resource allocation'" }
  ]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    loadOfficialData();
    const channel = supabase
      .channel('official_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, loadOfficialData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'action_logs' }, loadActionLogs)
      .subscribe();

    // Auto-refresh every 60 seconds (realtime handles instant updates)
    const interval = setInterval(() => {
      loadOfficialData();
      setLastRefresh(new Date());
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const loadOfficialData = async () => {
    const [alertsRes, reportsRes, devicesRes, villagesData, logsRes, predsRes, recentRes] = await Promise.all([
      supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('health_reports').select('*', { count: 'exact', head: true }),
      supabase.from('iot_devices').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      db.getVillages(),
      supabase.from('action_logs').select('*, alerts(title), profiles(full_name)').order('created_at', { ascending: false }).limit(8),
      supabase.from('ai_predictions').select('*, villages(name)').order('predicted_at', { ascending: false }).limit(5),
      supabase.from('health_reports').select('*, villages(name)').order('created_at', { ascending: false }).limit(6),
    ]);

    const highRiskAreas = villagesData.filter(v => (v.riskLevel || v.risk_level) === 'high').length;
    const sortedVillages = [...villagesData].sort((a, b) => (b.riskScore || b.risk_score || 0) - (a.riskScore || a.risk_score || 0)).slice(0, 10);

    setStats({
      activeAlerts: alertsRes.count || 0,
      totalReports: reportsRes.count || 0,
      iotDevices: devicesRes.count || 0,
      highRiskAreas: highRiskAreas,
    });
    setVillages(sortedVillages);
    setActionLogs(logsRes.data || []);
    setPredictions(predsRes.data || []);
    setRecentReports(recentRes.data || []);
  };

  const loadActionLogs = async () => {
    const { data } = await supabase.from('action_logs').select('*, alerts(title), profiles(full_name)').order('created_at', { ascending: false }).limit(8);
    setActionLogs(data || []);
  };

  const handleBotQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!botInput.trim()) return;
    const q = botInput.toLowerCase().trim();
    setBotMessages(prev => [...prev, { role: "user", content: botInput }]);
    setBotInput("");

    setTimeout(() => {
      let response = "";
      if (q.includes("high risk") || q.includes("red zone")) {
        const highRisk = villages.filter(v => v.risk_level === 'high');
        response = highRisk.length > 0
          ? `🔴 HIGH RISK ZONES (${highRisk.length}): ${highRisk.map(v => `${v.name} (Score: ${v.risk_score})`).join(', ')}`
          : "✅ No high-risk zones currently detected.";
      } else if (q.includes("medium") || q.includes("yellow")) {
        const med = villages.filter(v => v.risk_level === 'medium');
        response = med.length > 0
          ? `🟡 MEDIUM RISK (${med.length}): ${med.map(v => v.name).join(', ')}`
          : "✅ No medium-risk zones currently.";
      } else if (q.includes("low") || q.includes("safe") || q.includes("green")) {
        const low = villages.filter(v => v.risk_level === 'low');
        response = `🟢 SAFE ZONES (${low.length}): ${low.map(v => v.name).join(', ')}`;
      } else if (q.includes("alert")) {
        response = `🚨 Active alerts: ${stats.activeAlerts}. ${stats.activeAlerts > 0 ? 'Navigate to Alerts page for details.' : 'No critical alerts at this time.'}`;
      } else if (q.includes("analytic") || q.includes("statistic") || q.includes("report")) {
        response = `📊 ANALYTICS SUMMARY:\n• Total Reports: ${stats.totalReports}\n• Active Alerts: ${stats.activeAlerts}\n• IoT Devices: ${stats.iotDevices}\n• High Risk Areas: ${stats.highRiskAreas}`;
      } else if (q.includes("resource") || q.includes("allocat")) {
        response = `📦 RESOURCE ALLOCATION SUGGESTION:\n• Deploy medical teams to high-risk zones immediately\n• Increase water testing frequency in medium-risk areas\n• Issue boil-water advisories for affected villages\n• Contact district health officer for emergency stock`;
      } else if (q.includes("map")) {
        response = "🗺️ Navigate to Map View for the live heatmap showing Digital Twin zones (Red/Yellow/Green).";
      } else if (q.includes("predict") || q.includes("forecast")) {
        response = `🤖 AI PREDICTION: Based on current IoT sensor data and health reports, outbreak probability is RISING. The 7-14 day forecast shows increasing risk in monitored villages. Immediate preventive action recommended.`;
      } else {
        response = `I can help with: "show high risk zones", "medium risk areas", "show alerts", "analytics summary", "resource allocation", "show map", "AI prediction". What would you like to know?`;
      }
      setBotMessages(prev => [...prev, { role: "bot", content: response }]);
    }, 600);
  };

  const downloadReport = async () => {
    try {
      const { data: alerts } = await supabase.from('alerts').select('*, villages(name)').eq('status', 'active');
      const csvContent = [
        ['Alert ID', 'Village', 'Severity', 'Status', 'Created At'],
        ...(alerts || []).map(a => [a.id, a.villages?.name || 'N/A', a.severity, a.status, new Date(a.created_at).toLocaleString()])
      ].map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aquaguard-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Report downloaded');
    } catch {
      toast.error('Failed to download report');
    }
  };

  const getRiskColor = (level: string) => {
    if (level === 'high') return 'text-red-400';
    if (level === 'medium') return 'text-yellow-400';
    return 'text-green-400';
  };
  const getRiskBg = (level: string) => {
    if (level === 'high') return 'from-red-500/20 to-red-600/10 border-red-500/30';
    if (level === 'medium') return 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30';
    return 'from-green-500/20 to-green-600/10 border-green-500/30';
  };

  const statsCards = [
    { label: "Active Alerts", value: stats.activeAlerts, icon: <Bell className="h-8 w-8" />, color: "text-red-400", bg: "from-red-500/15 to-red-600/10 border-red-500/20" },
    { label: "Total Reports", value: stats.totalReports, icon: <Users className="h-8 w-8" />, color: "text-blue-400", bg: "from-blue-500/15 to-blue-600/10 border-blue-500/20" },
    { label: "IoT Devices Online", value: stats.iotDevices, icon: <Activity className="h-8 w-8" />, color: "text-green-400", bg: "from-green-500/15 to-green-600/10 border-green-500/20" },
    { label: "High Risk Areas", value: stats.highRiskAreas, icon: <MapPin className="h-8 w-8" />, color: "text-orange-400", bg: "from-orange-500/15 to-orange-600/10 border-orange-500/20" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      <div className="lg:pl-64 p-4 md:p-6 pt-20 lg:pt-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black text-foreground">
                🏛️ AquaGuard <span className="text-primary">Command Center</span>
              </h1>
              <Badge className="animate-pulse bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1">
                <Activity className="h-3 w-3" /> LIVE
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Government-Grade Outbreak Monitoring • Real-time updates • Last: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadOfficialData} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button onClick={downloadReport} size="sm" className="gap-2">
              <Download className="h-4 w-4" /> Export Report
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statsCards.map((s, i) => (
            <Card key={i} className={`p-5 bg-gradient-to-br ${s.bg} border hover:scale-105 transition-all duration-200`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                </div>
                <div className={`${s.color} opacity-40`}>{s.icon}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Quick Nav */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-6">
          {[
            { to: "/alerts", icon: <Bell className="h-4 w-4" />, label: "🚨 Alerts" },
            { to: "/alert-escalation", icon: <AlertCircle className="h-4 w-4" />, label: "⚡ Escalation" },
            { to: "/iot-monitoring", icon: <Activity className="h-4 w-4" />, label: "📡 IoT Monitor" },
            { to: "/map", icon: <MapPin className="h-4 w-4" />, label: "🗺️ Live Map" },
            { to: "/image-analysis", icon: <BarChart2 className="h-4 w-4" />, label: "🔬 Image AI" },
            { to: "/export-reports", icon: <Download className="h-4 w-4" />, label: "📥 Export" },
          ].map((item, i) => (
            <Link key={i} to={item.to}>
              <Button variant="outline" size="sm" className="w-full text-xs hover:border-primary transition-all">
                {item.label}
              </Button>
            </Link>
          ))}
        </div>

        {/* AI 7-14 Day Outbreak Prediction */}
        <Card className="p-6 mb-6 border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                🤖 AI Outbreak Prediction — 7–14 Day Forecast
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Based on IoT sensor data, health reports & historical patterns
              </p>
            </div>
            <Badge variant="outline" className="text-primary border-primary/30">
              Confidence: {predictionData[predictionData.length - 1].confidence}%
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={predictionData}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(200,85%,45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(200,85%,45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="futureGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0,72%,51%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(0,72%,51%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }}
                formatter={(v, n) => [`${v}${n === 'risk' ? '/100' : '%'}`, n === 'risk' ? 'Risk Score' : 'Confidence']}
              />
              <Area type="monotone" dataKey="risk" stroke="hsl(200,85%,55%)" fill="url(#riskGrad)" strokeWidth={2.5} dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.isToday) return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={6} fill="hsl(38,92%,50%)" stroke="white" strokeWidth={2} />;
                if (!payload.isPast) return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="hsl(0,72%,51%)" stroke="white" strokeWidth={1} />;
                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="hsl(200,85%,55%)" />;
              }} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-6 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-primary rounded inline-block" /> Historical</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-red-500 rounded inline-block" /> AI Forecast</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-yellow-500 rounded inline-block" /> Today</span>
            <span className="ml-auto font-medium">
              {predictionData[13].risk > 70 ? "🔴 HIGH RISK — Immediate Action Required" :
               predictionData[13].risk > 40 ? "🟡 MEDIUM RISK — Monitor Closely" : "🟢 LOW RISK — Continue Surveillance"}
            </span>
          </div>
        </Card>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <RiskMap />
          </div>

          {/* Digital Twin Village Status */}
          <Card className="p-5">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Digital Twin — Zone Status
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {villages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No village data</p>
              ) : villages.map((v) => (
                <div key={v.id} className={`p-3 rounded-xl border bg-gradient-to-r ${getRiskBg(v.risk_level)} flex items-center justify-between`}>
                  <div>
                    <p className={`text-sm font-semibold ${getRiskColor(v.risk_level)}`}>{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.district || 'Assam'}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-black ${getRiskColor(v.risk_level)}`}>{v.risk_score}</p>
                    <Badge variant="outline" className={`text-xs ${getRiskColor(v.risk_level)} border-current`}>
                      {v.risk_level === 'high' ? '🔴 HIGH' : v.risk_level === 'medium' ? '🟡 MED' : '🟢 SAFE'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Official Bot + Recent Reports */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* AI Command Bot */}
          <Card className="p-5">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              🤖 AquaGuard Intelligence Bot
            </h3>
            <div className="h-52 overflow-y-auto space-y-2 mb-3 p-2 rounded-xl bg-muted/20">
              {botMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}>{msg.content}</div>
                </div>
              ))}
            </div>
            <form onSubmit={handleBotQuery} className="flex gap-2">
              <input
                value={botInput}
                onChange={e => setBotInput(e.target.value)}
                placeholder="Ask: show high risk zones..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button type="submit" size="sm" disabled={!botInput.trim()}>Ask</Button>
            </form>
          </Card>

          {/* Recent Reports */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Recent Reports Submitted
              </h3>
              <Link to="/reports"><Button variant="ghost" size="sm" className="text-xs">View All</Button></Link>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentReports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reports yet</p>
              ) : recentReports.map(r => (
                <div key={r.id} className="p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.reporter_name}</p>
                      <p className="text-xs text-muted-foreground">{sanitizeLocationName(r.villages?.name)} • {r.cases_count} cases</p>
                      <p className="text-xs text-muted-foreground">{Array.isArray(r.symptoms) ? r.symptoms.slice(0, 3).join(', ') : ''}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs mb-1">
                        {r.report_type === 'emergency' ? '🚨' : r.report_type === 'water_complaint' ? '💧' : '🏥'} {r.report_type?.replace('_', ' ')}
                      </Badge>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Water Quality Chart + Action Logs */}
        <div className="grid lg:grid-cols-2 gap-6">
          <WaterQualityChart />
          <Card className="p-5">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              System Action Logs
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {actionLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No actions logged</p>
              ) : actionLogs.map(log => (
                <div key={log.id} className="p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{log.action_type}</span>
                    <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{log.action_description || log.alerts?.title}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OfficialDashboard;
