import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { db } from "@/utils/db";
import { sanitizeLocationName, sanitizeAlertTitle, formatTDS } from "@/utils/sanitizeLocation";

const ExportReports = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [villages, setVillages] = useState<any[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportType, setExportType] = useState<string>("health_reports");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const loadVillages = async () => {
      const data = await db.getVillages();
      if (data) {
        const mapped = data.map(v => ({
          id: v.id,
          name: v.name,
          district: v.district || null
        }));
        const sorted = [...mapped].sort((a, b) => a.name.localeCompare(b.name));
        setVillages(sorted);
      }
    };
    loadVillages();
  }, []);

  const exportCSV = async () => {
    setExporting(true);
    try {
      let query: any;
      if (exportType === "health_reports") {
        query = supabase.from("health_reports").select("*, villages(name, districts(name))");
      } else if (exportType === "water_quality") {
        query = supabase.from("water_quality_readings").select("*, villages(name, districts(name))");
      } else {
        query = supabase.from("alerts").select("*, villages(name, districts(name))");
      }

      if (selectedVillage !== "all") query = query.eq("village_id", selectedVillage);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ variant: "destructive", title: "No Data", description: "No records found for the selected filters." });
        setExporting(false);
        return;
      }

      // Build CSV
      const headers = Object.keys(data[0]).filter(k => k !== "villages");
      headers.push("village_name", "district");
      const csvRows = [headers.join(",")];
      for (const row of data) {
        const values = headers.map(h => {
          if (h === "village_name") return `"${sanitizeLocationName(row.villages?.name) || ""}"`;
          if (h === "district") return `"${row.villages?.districts?.name || "Chennai"}"`;
          if (h === "title") return `"${sanitizeAlertTitle(row.title)}"`;
          if (h === "tds") return `"${formatTDS(row.tds)}"`;
          const val = row[h];
          if (val === null || val === undefined) return "";
          if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(","));
      }

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportType}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Export Complete", description: `${data.length} records exported as CSV.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Export Failed", description: error instanceof Error ? error.message : "Unknown error" });
    }
    setExporting(false);
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      let query: any;
      if (exportType === "health_reports") {
        query = supabase.from("health_reports").select("*, villages(name, districts(name))");
      } else if (exportType === "water_quality") {
        query = supabase.from("water_quality_readings").select("*, villages(name, districts(name))");
      } else {
        query = supabase.from("alerts").select("*, villages(name, districts(name))");
      }

      if (selectedVillage !== "all") query = query.eq("village_id", selectedVillage);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ variant: "destructive", title: "No Data", description: "No records found." });
        setExporting(false);
        return;
      }

      // Generate simple PDF using HTML-to-print
      const title = exportType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const villageName = selectedVillage === "all" ? "All Villages" : villages.find(v => v.id === selectedVillage)?.name || "";
      
      let tableHeaders = "";
      let tableRows = "";

      if (exportType === "health_reports") {
        tableHeaders = "<th>Date</th><th>Village</th><th>Reporter</th><th>Symptoms</th><th>Cases</th><th>Status</th>";
        tableRows = data.map(r => `<tr>
          <td>${new Date(r.created_at).toLocaleDateString()}</td>
          <td>${sanitizeLocationName(r.villages?.name)}</td>
          <td>${r.reporter_name}</td>
          <td>${Array.isArray(r.symptoms) ? r.symptoms.join(", ") : r.symptoms}</td>
          <td>${r.cases_count || 0}</td>
          <td>${r.status}</td>
        </tr>`).join("");
      } else if (exportType === "water_quality") {
        tableHeaders = "<th>Date</th><th>Village</th><th>pH</th><th>TDS</th><th>Turbidity</th><th>Temp</th><th>Status</th>";
        tableRows = data.map(r => `<tr>
          <td>${new Date(r.created_at || r.reading_timestamp).toLocaleDateString()}</td>
          <td>${sanitizeLocationName(r.villages?.name)}</td>
          <td>${r.ph ?? "-"}</td>
          <td>${formatTDS(r.tds)}</td>
          <td>${r.turbidity ?? "-"}</td>
          <td>${r.temperature ? `${r.temperature}°C` : "-"}</td>
          <td>${r.status || "-"}</td>
        </tr>`).join("");
      } else {
        tableHeaders = "<th>Date</th><th>Village</th><th>Title</th><th>Severity</th><th>Status</th>";
        tableRows = data.map(r => `<tr>
          <td>${new Date(r.created_at).toLocaleDateString()}</td>
          <td>${sanitizeLocationName(r.villages?.name)}</td>
          <td>${sanitizeAlertTitle(r.title)}</td>
          <td>${r.severity}</td>
          <td>${r.status}</td>
        </tr>`).join("");
      }

      const brandTitle = t('branding.title');
      const htmlContent = `
        <html><head><title>${title} Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #1e40af; } h2 { color: #374151; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f3f4f6; font-weight: bold; }
          .meta { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
        </style></head>
        <body>
          <h1>${brandTitle} - ${title}</h1>
          <div class="meta">
            <p>Village: ${villageName} | Generated: ${new Date().toLocaleString()}</p>
            ${dateFrom ? `<p>Period: ${dateFrom} to ${dateTo || "Present"}</p>` : ""}
            <p>Total Records: ${data.length}</p>
          </div>
          <table><thead><tr>${tableHeaders}</tr></thead><tbody>${tableRows}</tbody></table>
        </body></html>`;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
      }

      toast({ title: "PDF Ready", description: "Print dialog opened for PDF export." });
    } catch (error) {
      toast({ variant: "destructive", title: "Export Failed", description: error instanceof Error ? error.message : "Unknown error" });
    }
    setExporting(false);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:pl-72 pt-20 lg:pt-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">{t('exportTitle', 'Export Reports')}</h1>
          <p className="text-muted-foreground mt-1">{t('exportSubtitle', 'Download village or district data as CSV or PDF')}</p>
        </div>

        <Card className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('exportReportType', 'Report Type')}</Label>
              <Select value={exportType} onValueChange={setExportType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="health_reports">{t('exportHealthReports', 'Health Reports')}</SelectItem>
                  <SelectItem value="water_quality">{t('exportWaterQuality', 'Water Quality Readings')}</SelectItem>
                  <SelectItem value="alerts">{t('exportAlerts', 'Alerts')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('exportVillageFilter', 'Village / District')}</Label>
              <Select value={selectedVillage} onValueChange={setSelectedVillage}>
                <SelectTrigger><SelectValue placeholder={t('exportAllVillages', 'All villages')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('exportAllVillages', 'All Villages')}</SelectItem>
                  {villages.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name} {v.district ? `(${v.district})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('exportStartDate', 'Date From')}</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('exportEndDate', 'Date To')}</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={exportCSV} className="gap-2" disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              {exporting ? t('exportExporting', 'Exporting...') : t('exportDownloadCsv', 'Export CSV')}
            </Button>
            <Button onClick={exportPDF} variant="outline" className="gap-2" disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {t('exportPrintPdf', 'Print / PDF')}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">{t('exportInfo', 'Export Info')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-primary mb-2" />
              <p className="font-medium text-foreground">{t('csvFormat', 'CSV Format')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('csvFormatDesc', 'Open in Excel, Google Sheets, or any spreadsheet tool')}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <FileText className="w-8 h-8 mx-auto text-primary mb-2" />
              <p className="font-medium text-foreground">{t('pdfFormat', 'PDF Format')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('pdfFormatDesc', 'Print-ready reports with formatting')}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <Download className="w-8 h-8 mx-auto text-primary mb-2" />
              <p className="font-medium text-foreground">{t('filterDownload', 'Filter & Download')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('filterDownloadDesc', 'Filter by village, date range, and report type')}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ExportReports;
