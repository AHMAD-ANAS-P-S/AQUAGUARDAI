import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/layout/Navigation";
import { Shield, AlertTriangle, Droplets, FileText, BookOpen, Mic, LogOut, Bot, MapPin, TrendingUp, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LanguageSelector } from "@/components/LanguageSelector";
import { MultilingualVoiceAssistant } from "@/components/MultilingualVoiceAssistant";
import { RealtimeNotifications } from "@/components/RealtimeNotifications";
import { db } from "@/utils/db";
import { sanitizeLocationName, sanitizeAlertTitle, sanitizeAlertMessage } from "@/utils/sanitizeLocation";

const CommunityDashboard = () => {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [villageRisk, setVillageRisk] = useState<any>(null);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [myReports, setMyReports] = useState<any[]>([]);
  const [casesToday, setCasesToday] = useState(0);
  const [botInput, setBotInput] = useState("");
  const [botMessages, setBotMessages] = useState<{ role: string; content: string }[]>([
    { role: "bot", content: "👋 Hi! I'm your AquaGuard guide. Ask me: 'how to submit a report', 'what is Learn & Earn', 'how to use voice', or 'show my area alerts'" }
  ]);

  useEffect(() => {
    loadCommunityData();
    const channel = supabase
      .channel('community_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, loadCommunityData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadCommunityData = async () => {
    const villages = await db.getVillages();
    const sorted = [...villages].sort((a, b) => (b.riskScore || b.risk_score || 0) - (a.riskScore || a.risk_score || 0));
    if (sorted.length > 0) {
      setVillageRisk({
        ...sorted[0],
        risk_score: sorted[0].riskScore ?? sorted[0].risk_score,
        risk_level: sorted[0].riskLevel ?? sorted[0].risk_level
      });
    }

    const { data: alerts } = await supabase.from('alerts').select('*, villages(name)').eq('status', 'active').order('created_at', { ascending: false }).limit(5);
    setRecentAlerts(alerts || []);

    const today = new Date().toISOString().split('T')[0];
    const { data: todayReports } = await supabase.from('health_reports').select('cases_count').gte('created_at', today);
    const total = (todayReports || []).reduce((acc, r) => acc + (r.cases_count || 0), 0);
    setCasesToday(total);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: reports } = await supabase.from('health_reports').select('*, villages(name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5);
      setMyReports(reports || []);
    }
  };

  const getRiskColor = (risk: string) => {
    if (risk === 'high') return 'text-red-500';
    if (risk === 'medium') return 'text-yellow-500';
    return 'text-green-500';
  };

  const getRiskBadge = (risk: string) => {
    if (risk === 'high') return '🔴 High Risk';
    if (risk === 'medium') return '🟡 Caution';
    return '🟢 Safe';
  };

  const handleBotQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!botInput.trim()) return;
    const q = botInput.toLowerCase();
    setBotMessages(prev => [...prev, { role: "user", content: botInput }]);
    setBotInput("");

    setTimeout(() => {
      let resp = "";
      if (q.includes("report") || q.includes("submit")) {
        resp = "📝 To submit a report:\n1. Tap 'Report Health Issue' below\n2. Select report type (Health/Water/Emergency)\n3. Choose your village\n4. Enter symptoms and number affected\n5. Add GPS location\n6. Hit Submit!";
      } else if (q.includes("learn") || q.includes("earn") || q.includes("point") || q.includes("certificate")) {
        resp = "🏆 Learn & Earn: Complete health quizzes to earn points! You can win badges and download certificates. Every 100 points = 1 level up!";
      } else if (q.includes("voice") || q.includes("speak")) {
        resp = "🎤 Voice Input: Tap the Voice Assistant card or the mic icon to speak your report in your local language (Hindi, Assamese, Bengali & more supported!)";
      } else if (q.includes("alert") || q.includes("outbreak")) {
        resp = `🚨 Your area has ${recentAlerts.length} active alert(s). ${recentAlerts.length > 0 ? `Latest: "${recentAlerts[0]?.title}"` : 'All clear!'} Stay safe and follow health guidelines.`;
      } else if (q.includes("offline") || q.includes("internet")) {
        resp = "📶 Offline Mode: AquaGuard works offline! Reports are saved and auto-synced when you reconnect. Look for the offline indicator at the top.";
      } else if (q.includes("sms")) {
        resp = "📱 SMS Reporting: No internet? Send an SMS with your report to our hotline. Format: REPORT [Village] [Symptoms] [Cases]";
      } else if (q.includes("image") || q.includes("water photo")) {
        resp = "📸 Image Analysis: Go to 'Image Analysis' page to upload water body photos. Our AI will detect contamination and pathogens!";
      } else {
        resp = "I can help with: 'how to submit a report', 'Learn & Earn', 'voice input', 'my alerts', 'offline mode', 'SMS reporting', 'image analysis'. What do you need?";
      }
      setBotMessages(prev => [...prev, { role: "bot", content: resp }]);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <RealtimeNotifications />
      <div className="lg:pl-64 px-4 py-6 pt-20 lg:pt-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">
              👋 {t('welcomeBack')}!
            </h1>
            <p className="text-muted-foreground text-sm">{t('stayInformed')}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <Button variant="destructive" size="sm" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">{t('common.logout')}</span>
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20 text-center">
            <p className="text-2xl font-black text-red-500">{casesToday}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('casesToday')}</p>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20 text-center">
            <p className="text-2xl font-black text-orange-500">{recentAlerts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('activeAlerts')}</p>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 text-center">
            <p className={`text-lg font-black ${getRiskColor(villageRisk?.risk_level || 'low')}`}>
              {villageRisk?.risk_level === 'high' ? 'HIGH' : villageRisk?.risk_level === 'medium' ? 'MED' : 'LOW'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t('riskLevel')}</p>
          </Card>
        </div>

        {/* Area Risk Banner */}
        {villageRisk && (
          <Card className="p-5 mb-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">{villageRisk.name}</h2>
                <p className="text-sm text-muted-foreground mb-2">{t('myArea')}</p>
                <div className="flex items-center gap-2">
                  <Shield className={`h-6 w-6 ${getRiskColor(villageRisk.risk_level)}`} />
                  <span className={`text-xl font-bold ${getRiskColor(villageRisk.risk_level)}`}>
                    {getRiskBadge(villageRisk.risk_level)}
                  </span>
                </div>
              </div>
              <div className="text-center">
                <div className={`text-5xl font-black ${getRiskColor(villageRisk.risk_level)}`}>
                  {villageRisk.risk_score}
                </div>
                <p className="text-xs text-muted-foreground">{t('riskIndex')}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Voice Assistant */}
        <div className="mb-6">
          <MultilingualVoiceAssistant />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Link to="/reports">
            <Card className="p-5 hover:shadow-xl hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20 group">
              <FileText className="h-10 w-10 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-foreground text-sm mb-1">{t('nav.reportIssue')}</h3>
              <p className="text-xs text-muted-foreground">{t('reportDesc')}</p>
            </Card>
          </Link>
          <Link to="/alerts">
            <Card className="p-5 hover:shadow-xl hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20 group">
              <AlertTriangle className="h-10 w-10 text-red-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-foreground text-sm mb-1">{t('nav.alerts')}</h3>
              <p className="text-xs text-muted-foreground">{recentAlerts.length} {t('activeNow')}</p>
            </Card>
          </Link>
          <Link to="/map">
            <Card className="p-5 hover:shadow-xl hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20 group">
              <MapPin className="h-10 w-10 text-green-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-foreground text-sm mb-1">{t('nav.mapView')}</h3>
              <p className="text-xs text-muted-foreground">{t('riskZones')}</p>
            </Card>
          </Link>
          <Link to="/image-analysis">
            <Card className="p-5 hover:shadow-xl hover:scale-105 hover:-translate-y-1 transition-all duration-200 cursor-pointer bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20 group">
              <Droplets className="h-10 w-10 text-purple-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-foreground text-sm mb-1">Image Analysis</h3>
              <p className="text-xs text-muted-foreground">{t('uploadWater')}</p>
            </Card>
          </Link>
        </div>

        {/* Learn & Earn + Voice */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Link to="/awareness">
            <Card className="p-5 hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border-yellow-500/20 group">
              <BookOpen className="h-8 w-8 text-yellow-500 mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-foreground text-sm">{t('nav.learnEarn')} 🏆</h3>
              <p className="text-xs text-muted-foreground">{t('quizzes')}</p>
            </Card>
          </Link>
          <Link to="/awareness">
            <Card className="p-5 hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20 group">
              <Mic className="h-8 w-8 text-orange-500 mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-foreground text-sm">{t('voiceReport')} 🎤</h3>
              <p className="text-xs text-muted-foreground">{t('voiceDesc')}</p>
            </Card>
          </Link>
        </div>

        {/* Guidance Bot + Alerts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Guidance Bot */}
          <Card className="p-5">
            <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              {t('guideBot')}
            </h3>
            <div className="h-48 overflow-y-auto space-y-2 mb-3 p-2 rounded-xl bg-muted/20">
              {botMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs whitespace-pre-line ${
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  }`}>{msg.content}</div>
                </div>
              ))}
            </div>
            <form onSubmit={handleBotQuery} className="flex gap-2">
              <input
                value={botInput}
                onChange={e => setBotInput(e.target.value)}
                placeholder="How do I submit a report?"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button type="submit" size="sm" disabled={!botInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>

          {/* Active Alerts */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Active Alerts
              </h3>
              <Link to="/alerts"><Button variant="ghost" size="sm" className="text-xs">View All</Button></Link>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {recentAlerts.length === 0 ? (
                <div className="text-center py-6">
                  <Shield className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-green-500 font-medium">All Clear!</p>
                  <p className="text-xs text-muted-foreground">No active alerts</p>
                </div>
              ) : recentAlerts.map(alert => (
                <div key={alert.id} className="border border-border rounded-xl p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-semibold text-foreground text-sm">{sanitizeAlertTitle(alert.title)}</h4>
                    <Badge variant={alert.severity === 'high' ? 'destructive' : 'default'} className="text-xs">
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{sanitizeLocationName(alert.villages?.name)} • {sanitizeAlertMessage(alert.message)?.slice(0, 60)}...</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* My Reports */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t('myReports')}
            </h3>
            <Link to="/reports"><Button variant="ghost" size="sm" className="text-xs">+ New Report</Button></Link>
          </div>
          {myReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('noReports')}</p>
          ) : (
            <div className="space-y-2">
              {myReports.map(report => (
                <div key={report.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-foreground">{sanitizeLocationName(report.villages?.name)}</p>
                    <p className="text-xs text-muted-foreground">{report.cases_count} cases • {Array.isArray(report.symptoms) ? report.symptoms.slice(0, 2).join(', ') : ''}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs">{report.status}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(report.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CommunityDashboard;
