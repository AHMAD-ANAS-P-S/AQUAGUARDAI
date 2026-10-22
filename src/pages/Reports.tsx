import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Send, Upload, X, MapPin, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { db } from "@/utils/db";
import { sanitizeLocationName } from "@/utils/sanitizeLocation";

const Reports = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [villages, setVillages] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    village_id: "",
    reporter_name: "",
    symptoms: [] as string[],
    cases_count: 1,
    notes: "",
    report_type: "health_report",
  });
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<string>("");

  const symptoms = ["Diarrhea", "Fever", "Vomiting", "Headache", "Nausea", "Fatigue"];

  const detectGPS = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "GPS Unavailable", description: "Your device doesn't support GPS." });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setGpsLoading(false);
        toast({ title: "GPS Detected", description: `Location: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` });
      },
      (err) => {
        setGpsLoading(false);
        toast({ variant: "destructive", title: "GPS Error", description: err.message });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    loadVillages();
    loadReports();
    
    const channel = supabase
      .channel('health_reports_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'health_reports' }, () => {
        loadReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadVillages = async () => {
    const data = await db.getVillages();
    if (data) {
      const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
      setVillages(sorted);
    }
  };

  const loadReports = async () => {
    const { data } = await supabase
      .from("health_reports")
      .select(`
        *,
        villages (name)
      `)
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) setReports(data);
  };

  const toggleSymptom = (symptom: string) => {
    setFormData(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...prev.symptoms, symptom]
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.village_id || formData.symptoms.length === 0) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all required fields.",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("health_reports").insert({
      village_id: formData.village_id,
      reporter_name: formData.reporter_name,
      symptoms: formData.symptoms,
      cases_count: formData.cases_count,
      notes: `${formData.notes}${gpsLocation ? `\n[GPS: ${gpsLocation}]` : ""}`,
      user_id: user.id,
      photo_url: photoPreview || null,
      report_type: formData.report_type,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Report Submitted",
        description: "Health report has been recorded successfully.",
      });
      
      setFormData({
        village_id: "",
        reporter_name: "",
        symptoms: [],
        cases_count: 1,
        notes: "",
        report_type: "health_report",
      });
      setGpsLocation("");
      setPhotoPreview("");
    }

    setLoading(false);
  };

  const getSymptomLabel = (s: string) => {
    switch (s.toLowerCase()) {
      case 'diarrhea': return t('diarrhea', 'Diarrhea');
      case 'fever': return t('fever', 'Fever');
      case 'vomiting': return t('vomiting', 'Vomiting');
      case 'headache': return t('headache', 'Headache');
      case 'nausea': return t('nausea', 'Nausea');
      case 'fatigue': return t('fatigue', 'Fatigue');
      default: return s;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:pl-72 pt-20 lg:pt-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">{t('reportsTitle', 'Health Reports')}</h1>
          <p className="text-muted-foreground">{t('reportsSubtitle', 'Submit community health data and symptoms')}</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Report Type Selection */}
            <div className="space-y-2">
              <Label>{t('reportsType', 'Report Type *')}</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "health_report", label: t('reportsHealthReport', '🏥 Health Report'), desc: t('reportsHealthReportDesc', 'Symptom & disease data') },
                  { value: "water_complaint", label: t('reportsWaterComplaint', '💧 Water Complaint'), desc: t('reportsWaterComplaintDesc', 'Water quality issue') },
                  { value: "emergency", label: t('reportsEmergency', '🚨 Emergency'), desc: t('reportsEmergencyDesc', 'Urgent outbreak') },
                ].map(rt => (
                  <div
                    key={rt.value}
                    onClick={() => setFormData({ ...formData, report_type: rt.value })}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                      formData.report_type === rt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <p className="font-medium text-sm text-foreground">{rt.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{rt.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="village">{t('reportsVillageCommunity', 'Village/Community *')}</Label>
                <Select value={formData.village_id} onValueChange={(value) => setFormData({ ...formData, village_id: value })}>
                  <SelectTrigger id="village">
                    <SelectValue placeholder={t('reportsSelectVillage', 'Select village')} />
                  </SelectTrigger>
                  <SelectContent>
                    {villages.map((village) => (
                      <SelectItem key={village.id} value={village.id}>
                        {village.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reporter">{t('reportsReporterName', 'Reporter Name *')}</Label>
                <Input
                  id="reporter"
                  value={formData.reporter_name}
                  onChange={(e) => setFormData({ ...formData, reporter_name: e.target.value })}
                  placeholder={t('reportsReporterNamePlaceholder', 'ASHA worker name')}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('reportsSymptomsChecked', 'Symptoms Reported *')}</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {symptoms.map((symptom) => (
                  <div key={symptom} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={symptom}
                      checked={formData.symptoms.includes(symptom)}
                      onChange={() => toggleSymptom(symptom)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor={symptom} className="text-sm text-foreground cursor-pointer">
                      {getSymptomLabel(symptom)}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cases">{t('reportsCasesCount', 'Number of Cases *')}</Label>
              <Input
                id="cases"
                type="number"
                min="1"
                value={formData.cases_count}
                onChange={(e) => setFormData({ ...formData, cases_count: parseInt(e.target.value) || 1 })}
                placeholder={t('numCasesPlaceholder', 'Enter number of people affected')}
              />
            </div>

            {/* Auto GPS */}
            <div className="space-y-2">
              <Label>{t('reportsGpsLocation', 'Location (Auto GPS or Manual)')}</Label>
              <div className="flex gap-2">
                <Input
                  value={gpsLocation}
                  onChange={(e) => setGpsLocation(e.target.value)}
                  placeholder={t('reportsGpsPlaceholder', 'Lat, Lng (click detect or type manually)')}
                  className="flex-1"
                />
                <Button type="button" variant="outline" className="gap-2" onClick={detectGPS} disabled={gpsLoading}>
                  {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  {t('reportsAutoDetectGps', 'Detect')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('reportsNotes', 'Additional Notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('reportsDescribe', 'Enter any additional observations or details...')}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('reportsPhotoAttachment', 'Water Test Strip Photo (Optional)')}</Label>
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => setPhotoPreview("")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    {t('reportsUploadPhoto', 'Upload Image')}
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {t('reportsPhotoDesc', 'Upload a photo of water test strip for analysis')}
              </p>
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              <Send className="w-4 h-4" />
              {loading ? t('submitting', 'Submitting...') : t('reportsSubmit', 'Submit Report')}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">{t('reportsRecentSubmitted', 'Recent Submissions')}</h3>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('noReports', 'No reports yet')}</p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground">{sanitizeLocationName(report.villages?.name)}</p>
                      <Badge variant="outline">{report.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {report.cases_count} {report.cases_count === 1 ? 'case' : 'cases'} - {report.symptoms.map((sym: string) => getSymptomLabel(sym)).join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('reportsLoggedBy', 'Reporter')}: {report.reporter_name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                    {new Date(report.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Reports;
