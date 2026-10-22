import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { db } from "@/utils/db";
import { useTranslation } from "react-i18next";
import { sanitizeLocationName } from "@/utils/sanitizeLocation";

import { 
  Droplet, AlertTriangle, Users, Activity, Shield, Award, 
  CheckCircle, RefreshCw, Bot, ShieldAlert, BarChart2, 
  TrendingUp, Eye, Layers, Database, 
  Thermometer, Check, Plus, ShieldCheck, MapPin, Trophy, X, CheckCircle2, Microscope
} from "lucide-react";

import { WaterQualityChart } from "@/components/dashboard/WaterQualityChart";
import { RiskMap } from "@/components/dashboard/RiskMap";
import { RecentAlerts } from "@/components/dashboard/RecentAlerts";
import { HealthStats } from "@/components/dashboard/HealthStats";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ----------------------------------------------------
// 1. SKELETON LOADER
// ----------------------------------------------------
const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:pl-72 pt-20 lg:pt-8 bg-gradient-to-br from-background via-background to-primary/5 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
          <div className="h-10 bg-muted rounded w-32"></div>
        </div>
        <div className="h-16 bg-card border border-border/60 rounded-2xl"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-card border border-border/60 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-[300px] bg-card border border-border/60 rounded-2xl"></div>
            <div className="h-[250px] bg-card border border-border/60 rounded-2xl"></div>
          </div>
          <div className="h-[400px] bg-card border border-border/60 rounded-2xl"></div>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 2. ADMINISTRATOR DASHBOARD
// ----------------------------------------------------
const AdminDashboard = ({ 
  districts, villages, allVillages, selectedDistrict, selectedVillage,
  handleDistrictChange, setSelectedVillage, openVillageProfile, handleRefresh, isRefreshing,
  activeSensorsCount, activeAlertsCount, totalCasesCount, sensors, 
  simulationResult, runOutbreakSimulation, t
}: any) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('adminConsole')}</h2>
          <p className="text-xs text-muted-foreground">{t('adminConsoleDesc')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="gap-1">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> {t('refreshSystem')}
        </Button>
      </div>

      {/* FILTER PANEL */}
      <Card className="p-4 border border-border/60 bg-card/40 backdrop-blur-md rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{t('district')}:</span>
          </div>
          <Select value={selectedDistrict} onValueChange={handleDistrictChange}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl">
              <SelectValue placeholder={t('district')} />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{t('village')}:</span>
          </div>
          <Select value={selectedVillage} onValueChange={setSelectedVillage}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl">
              <SelectValue placeholder={t('village')} />
            </SelectTrigger>
            <SelectContent>
              {villages.map((v: any) => (
                <SelectItem key={v.id} value={v.id}>{sanitizeLocationName(v.name)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedVillage && (
          <Button size="sm" variant="outline" onClick={() => openVillageProfile(selectedVillage)} className="gap-1 border-primary/20 hover:border-primary">
            <Eye className="h-4 w-4" /> {t('inspectProfile')}
          </Button>
        )}
      </Card>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">{t('activeSensors')}</p>
              <h3 className="text-2xl font-bold text-primary mt-1">{activeSensorsCount} / {sensors.length}</h3>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <Droplet className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">{t('activeAlerts')}</p>
              <h3 className="text-2xl font-bold text-destructive mt-1">{activeAlertsCount}</h3>
            </div>
            <div className="p-3 bg-destructive/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">{t('monitoredVillages')}</p>
              <h3 className="text-2xl font-bold text-secondary mt-1">{allVillages.length}</h3>
            </div>
            <div className="p-3 bg-secondary/10 rounded-xl">
              <Users className="w-6 h-6 text-secondary" />
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-success/10 to-success/5 border border-success/20 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">{t('casesLogged')}</p>
              <h3 className="text-2xl font-bold text-success mt-1">{totalCasesCount}</h3>
            </div>
            <div className="p-3 bg-success/10 rounded-xl">
              <Activity className="w-6 h-6 text-success" />
            </div>
          </div>
        </Card>
      </div>

      {/* CORE INTEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RiskMap />
          <WaterQualityChart />
        </div>

        <div className="space-y-6">
          {/* SIMULATION CARD */}
          <Card className="p-5 border border-primary/20 bg-card space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-primary" />
                {t('simulationEngine')}
              </h3>
              <p className="text-xs text-muted-foreground">{t('simulationEngineDesc')}</p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" className="flex-1 text-xs" onClick={() => runOutbreakSimulation(false)}>
                  {t('withoutIntervention')}
                </Button>
                <Button size="sm" className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => runOutbreakSimulation(true)}>
                  {t('withIntervention')}
                </Button>
              </div>

              {simulationResult && (
                <div className="p-4 bg-muted/40 border border-border/40 rounded-2xl space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {t('simulationResult')} ({simulationResult.applied ? t('withIntervention') : t('withoutIntervention')})
                      </p>
                      {simulationResult.villageName && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{simulationResult.villageName}</p>
                      )}
                    </div>
                    <Badge className={simulationResult.applied ? 'bg-green-500/20 text-green-500 border-green-500/20' : 'bg-red-500/20 text-red-500 border-red-500/20'}>
                      {simulationResult.applied ? 'Reduced' : 'Projected Growth'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 bg-card rounded-xl border border-border/30">
                      <p className={`text-2xl font-black ${simulationResult.applied ? 'text-green-500' : 'text-red-500'}`}>
                        {simulationResult.riskScore}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">{t('riskIndex')}</p>
                    </div>
                    <div className="p-2 bg-card rounded-xl border border-border/30">
                      <p className={`text-2xl font-black ${simulationResult.applied ? 'text-green-500' : 'text-red-500'}`}>
                        {simulationResult.expectedCases}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{t('predictedCasesDesc')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`p-3 rounded-xl border ${simulationResult.applied ? 'bg-background/60 border-border/40' : 'bg-red-500/10 border-red-500/20'}`}>
                      <p className="font-semibold text-foreground">{t('withoutIntervention')}</p>
                      <p className="text-muted-foreground mt-1">
                        {simulationResult.baseline.riskScore}% risk / {simulationResult.baseline.expectedCases} cases
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl border ${simulationResult.applied ? 'bg-green-500/10 border-green-500/20' : 'bg-background/60 border-border/40'}`}>
                      <p className="font-semibold text-foreground">{t('withIntervention')}</p>
                      <p className="text-muted-foreground mt-1">
                        {simulationResult.intervention.riskScore}% risk / {simulationResult.intervention.expectedCases} cases
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 bg-green-500/10 rounded-xl border border-green-500/20">
                      <p className="text-lg font-black text-green-500">{simulationResult.impact.casesPrevented}</p>
                      <p className="text-[10px] text-muted-foreground">Cases Prevented</p>
                    </div>
                    <div className="p-2 bg-green-500/10 rounded-xl border border-green-500/20">
                      <p className="text-lg font-black text-green-500">{simulationResult.impact.riskReductionPercent}%</p>
                      <p className="text-[10px] text-muted-foreground">Risk Reduction</p>
                    </div>
                    <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
                      <p className="text-lg font-black text-primary">{simulationResult.impact.populationProtected.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Population Protected</p>
                    </div>
                    <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
                      <p className="text-lg font-black text-primary">{simulationResult.impact.responseTimeSaved}</p>
                      <p className="text-[10px] text-muted-foreground">Response Time Saved</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Simulated Actions</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {simulationResult.actions.map((action: string) => (
                        <div key={action} className="flex items-center gap-2 rounded-xl border border-border/40 bg-card p-2 text-[11px] font-medium text-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          <span>{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-background/60 border border-border/30">
                      <p className="text-sm font-bold text-foreground">{simulationResult.drivers.villageRiskScore}%</p>
                      <p className="text-[9px] text-muted-foreground">Village Risk</p>
                    </div>
                    <div className="p-2 rounded-xl bg-background/60 border border-border/30">
                      <p className="text-sm font-bold text-foreground">{simulationResult.drivers.activeAlerts}</p>
                      <p className="text-[9px] text-muted-foreground">Active Alerts</p>
                    </div>
                    <div className="p-2 rounded-xl bg-background/60 border border-border/30">
                      <p className="text-sm font-bold text-foreground">{simulationResult.drivers.waterQualityRisk}%</p>
                      <p className="text-[9px] text-muted-foreground">Water Risk</p>
                    </div>
                    <div className="p-2 rounded-xl bg-background/60 border border-border/30">
                      <p className="text-sm font-bold text-foreground">{simulationResult.drivers.diseaseReportRisk}%</p>
                      <p className="text-[9px] text-muted-foreground">Disease Reports</p>
                    </div>
                    <div className="p-2 rounded-xl bg-background/60 border border-border/30">
                      <p className="text-sm font-bold text-foreground">{simulationResult.drivers.aiPredictionScore}%</p>
                      <p className="text-[9px] text-muted-foreground">{t('branding.aiPrediction')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* SENSOR HEALTH MONITORING */}
          <Card className="p-5">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {t('sensorHealth')}
            </h3>
            <div className="space-y-2">
              {sensors.slice(0, 5).map((s: any) => (
                <div key={s.id} className="p-3 bg-muted/20 border border-border/40 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground truncate max-w-[160px]">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t('battery')}: {s.battery}</p>
                  </div>
                  <Badge className={s.status === 'Online' ? 'bg-green-500/20 text-green-400 border-green-500/20' : s.status === 'Low Battery' ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' : 'bg-red-500/20 text-red-400 border-red-500/20'}>
                    {s.status === 'Online' ? t('online') : s.status === 'Low Battery' ? t('lowBattery') : t('offline')}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentAlerts />
        <HealthStats />
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 3. HEALTH OFFICER DASHBOARD
// ----------------------------------------------------
const HealthOfficerDashboard = ({
  districts, villages, allVillages, selectedDistrict, selectedVillage,
  handleDistrictChange, setSelectedVillage, openVillageProfile, handleRefresh, isRefreshing,
  activeAlertsCount, totalCasesCount, pendingReports, handleApproveReport,
  handleRejectReport, selectedVillageData, getResourceRecommendations,
  actionsChecked, setActionsChecked, t
}: any) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('healthOfficerConsole')}</h2>
          <p className="text-xs text-muted-foreground">{t('healthOfficerConsoleDesc')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="gap-1">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> {t('refreshSystem')}
        </Button>
      </div>

      {/* FILTER PANEL */}
      <Card className="p-4 border border-border/60 bg-card/40 backdrop-blur-md rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{t('district')}:</span>
          </div>
          <Select value={selectedDistrict} onValueChange={handleDistrictChange}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl">
              <SelectValue placeholder={t('district')} />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{t('village')}:</span>
          </div>
          <Select value={selectedVillage} onValueChange={setSelectedVillage}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl">
              <SelectValue placeholder={t('village')} />
            </SelectTrigger>
            <SelectContent>
              {villages.map((v: any) => (
                <SelectItem key={v.id} value={v.id}>{sanitizeLocationName(v.name)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedVillage && (
          <Button size="sm" variant="outline" onClick={() => openVillageProfile(selectedVillage)} className="gap-1 border-primary/20 hover:border-primary">
            <Eye className="h-4 w-4" /> {t('inspectProfile')}
          </Button>
        )}
      </Card>

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border border-primary/20 bg-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">{t('activeAlerts')}</p>
              <h3 className="text-2xl font-bold text-destructive mt-1">{activeAlertsCount}</h3>
            </div>
            <div className="p-3 bg-destructive/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
          </div>
        </Card>

        <Card className="p-5 border border-primary/20 bg-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">{t('loggedCasesTotal')}</p>
              <h3 className="text-2xl font-bold text-success mt-1">{totalCasesCount}</h3>
            </div>
            <div className="p-3 bg-success/10 rounded-xl">
              <Activity className="w-6 h-6 text-success" />
            </div>
          </div>
        </Card>

        <Card className="p-5 border border-primary/20 bg-card">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">{t('pendingAshaReports')}</p>
              <h3 className="text-2xl font-bold text-primary mt-1">{pendingReports.filter((r: any) => r.status === "Pending").length}</h3>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>
      </div>

      {/* CORE SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RiskMap />
          <WaterQualityChart />
        </div>

        <div className="space-y-6">
          {/* AI EXPLAINABILITY */}
          {selectedVillageData && (
            <Card className="p-5 border border-primary/20 bg-gradient-to-br from-card to-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">{t('aiExplainability')}</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-background/55 p-3 rounded-xl border border-border/30">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('village')}</p>
                    <p className="text-sm font-semibold text-foreground">{selectedVillageData.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{t('riskLevel')}</p>
                    <Badge className={selectedVillageData.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}>
                      {selectedVillageData.riskLevel === 'high' ? t('high') : selectedVillageData.riskLevel === 'medium' ? t('medium') : t('low')}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">{t('whyAssessment')}</p>
                  <div className="p-3 bg-destructive/5 rounded-xl border border-destructive/10 text-xs text-foreground/80 leading-relaxed">
                    {selectedVillageData.riskLevel === 'high' ? (
                      <ul className="space-y-1 list-disc list-inside">
                        <li>+ {selectedVillageData.cases} {t('casesLogged')}</li>
                        <li>+ {t('turbidity')} above safe limits</li>
                        <li>+ Seasonal heavy rainfall pattern matched</li>
                      </ul>
                    ) : (
                      <ul className="space-y-1 list-disc list-inside">
                        <li>+ Stable symptom counts in community</li>
                        <li>+ Water sensors reporting safe {t('phLevel')} (6.5-8.5)</li>
                        <li>+ Regular chlorine disinfection logs uploaded</li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* AI RECOMMENDATION */}
          {selectedVillageData && (
            <Card className="p-5 border border-primary/20 bg-gradient-to-br from-card to-secondary/5">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-5 w-5 text-secondary" />
                <h3 className="text-base font-bold text-foreground">{t('aiRecommendationEngine')}</h3>
              </div>
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  {t('recommendedContingency')} <strong>{selectedVillageData.name}</strong>:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-muted/40 rounded-xl text-center">
                    <p className="text-lg font-bold text-secondary">{getResourceRecommendations(selectedVillageData.riskScore).doctors}</p>
                    <p className="text-[10px] text-muted-foreground">{t('doctors')}</p>
                  </div>
                  <div className="p-2 bg-muted/40 rounded-xl text-center">
                    <p className="text-lg font-bold text-secondary">{getResourceRecommendations(selectedVillageData.riskScore).nurses}</p>
                    <p className="text-[10px] text-muted-foreground">{t('nurses')}</p>
                  </div>
                  <div className="p-2 bg-muted/40 rounded-xl text-center">
                    <p className="text-lg font-bold text-secondary">{getResourceRecommendations(selectedVillageData.riskScore).ORS}</p>
                    <p className="text-[10px] text-muted-foreground">{t('orsKits')}</p>
                  </div>
                  <div className="p-2 bg-muted/40 rounded-xl text-center">
                    <p className="text-lg font-bold text-secondary">{getResourceRecommendations(selectedVillageData.riskScore).tankers}</p>
                    <p className="text-[10px] text-muted-foreground">{t('waterTanker')}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ASHA APPROVALS */}
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            {t('ashaVerificationTitle')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('ashaVerificationDesc')}</p>
        </div>

        <div className="space-y-3">
          {pendingReports.filter((r: any) => r.status === "Pending").length === 0 ? (
            <div className="text-center py-6">
              <ShieldCheck className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-500">{t('allReportsProcessed')}</p>
              <p className="text-xs text-muted-foreground">{t('noReportsPending')}</p>
            </div>
          ) : (
            pendingReports.filter((r: any) => r.status === "Pending").map((r: any) => (
              <div key={r.id} className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{r.type} — {r.village}</h4>
                    <p className="text-xs text-muted-foreground">{r.reporter} • {r.date}</p>
                  </div>
                  <Badge variant="outline" className="text-xs font-semibold">{r.cases} {t('casesLogged')}</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed italic bg-card/60 p-2.5 rounded-xl border border-border/30">
                  "{r.details}"
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApproveReport(r.id)} className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs gap-1">
                    <Check className="h-3.5 w-3.5" /> {t('approveFeedAi')}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleRejectReport(r.id)} className="h-8 text-xs gap-1">
                    <X className="h-3.5 w-3.5" /> {t('rejectReport')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

// ----------------------------------------------------
// 4. CLINICAL STAFF DASHBOARD
// ----------------------------------------------------
const ClinicalStaffDashboard = ({ allVillages, symptomClusters, openVillageProfile, t }: any) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">{t('clinicConsole')}</h2>
        <p className="text-xs text-muted-foreground">{t('clinicConsoleDesc')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase">{t('patientCases')}</span>
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-foreground">24 {t('activeCases')}</h3>
          <p className="text-xs text-muted-foreground">{t('loggedThreeVillages')}</p>
          <Button size="sm" className="w-full mt-2" onClick={() => window.location.href = "/reports"}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {t('logNewSymptom')}
          </Button>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase">{t('pathogenPhotos')}</span>
            <Eye className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-foreground">{t('imageAnalysisTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('imageAnalysisSub')}</p>
          <Button size="sm" variant="outline" className="w-full mt-2 border-primary/20 hover:border-primary" onClick={() => window.location.href = "/image-analysis"}>
            <Microscope className="h-3.5 w-3.5 mr-1" /> {t('openImageAnalyzer')}
          </Button>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase">{t('regionalHeatmap')}</span>
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-foreground">{t('riskZonesTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('checkRiskStatus')}</p>
          <Button size="sm" variant="outline" className="w-full mt-2 border-primary/20 hover:border-primary" onClick={() => window.location.href = "/map"}>
            <Eye className="h-3.5 w-3.5 mr-1" /> {t('openLiveHeatmap')}
          </Button>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RiskMap />
        </div>

        {/* Symptom Cluster Panel */}
        <Card className="p-5 space-y-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            {t('symptomClusterAi')}
          </h3>
          <div className="space-y-3">
            {symptomClusters.map((c: any) => (
              <div key={c.id} className="p-3 bg-muted/20 border border-border/40 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{c.village}</span>
                  <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/20">{c.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t('detailsLabel')} {c.details}</p>
                <div className="flex justify-between text-[10px] text-primary">
                  <span>{t('patternLabel')} {c.pattern}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 5. ASHA WORKER DASHBOARD
// ----------------------------------------------------
const ASHAWorkerDashboard = ({ allVillages, selectedVillage, setSelectedVillage, t }: any) => {
  const { toast } = useToast();
  const [symptomData, setSymptomData] = useState({ symptoms: "", cases: "1", details: "" });
  const [waterData, setWaterData] = useState({ source: "well", issue: "", details: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSymptomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptomData.symptoms) {
      toast({ variant: "destructive", title: t('error'), description: t('symptomTypesPlaceholder') });
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast({ title: `✓ ${t('submitSymptomReport')}`, description: t('reportsRecentSubmitted') });
      setSymptomData({ symptoms: "", cases: "1", details: "" });
    }, 1000);
  };

  const handleWaterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waterData.issue) {
      toast({ variant: "destructive", title: t('error'), description: t('observedIssue') });
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast({ title: `✓ ${t('submitContaminationReport')}`, description: t('reportsRecentSubmitted') });
      setWaterData({ source: "well", issue: "", details: "" });
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">{t('ashaPortal')}</h2>
        <p className="text-xs text-muted-foreground">{t('ashaPortalDesc')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* SYMPTOM CASE REPORT */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Activity className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">{t('logSymptomCase')}</h3>
            </div>
            <form onSubmit={handleSymptomSubmit} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('reportsSelectVillage')}</label>
                  <select 
                    value={selectedVillage} 
                    onChange={(e) => setSelectedVillage(e.target.value)}
                    className="w-full h-10 px-3 border border-border bg-background rounded-xl text-xs"
                  >
                    {allVillages.map((v: any) => (
                      <option key={v.id} value={v.id}>{sanitizeLocationName(v.name)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('numCases')}</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={symptomData.cases} 
                    onChange={(e) => setSymptomData(prev => ({ ...prev, cases: e.target.value }))}
                    className="w-full h-10 px-3 border border-border bg-background rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('symptomTypesPlaceholder')}</label>
                <input 
                  type="text" 
                  placeholder={t('symptomTypesPlaceholder')}
                  value={symptomData.symptoms} 
                  onChange={(e) => setSymptomData(prev => ({ ...prev, symptoms: e.target.value }))}
                  className="w-full h-10 px-3 border border-border bg-background rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('additionalDetails')}</label>
                <textarea 
                  rows={2} 
                  placeholder={t('describeObservations')}
                  value={symptomData.details} 
                  onChange={(e) => setSymptomData(prev => ({ ...prev, details: e.target.value }))}
                  className="w-full p-3 border border-border bg-background rounded-xl text-xs"
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full h-10 gap-1.5">
                {submitting ? t('loading') : <><Plus className="h-4 w-4" /> {t('submitSymptomReport')}</>}
              </Button>
            </form>
          </Card>

          {/* WATER CONTAMINATION REPORT */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Droplet className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">{t('logWaterContamination')}</h3>
            </div>
            <form onSubmit={handleWaterSubmit} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('waterSourceType')}</label>
                  <select 
                    value={waterData.source} 
                    onChange={(e) => setWaterData(prev => ({ ...prev, source: e.target.value }))}
                    className="w-full h-10 px-3 border border-border bg-background rounded-xl text-xs"
                  >
                    <option value="well">{t('publicTubeWell')}</option>
                    <option value="pond">{t('communityPond')}</option>
                    <option value="river">{t('riverSource')}</option>
                    <option value="pipe">{t('pipedSupply')}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('observedIssue')}</label>
                  <select 
                    value={waterData.issue} 
                    onChange={(e) => setWaterData(prev => ({ ...prev, issue: e.target.value }))}
                    className="w-full h-10 px-3 border border-border bg-background rounded-xl text-xs"
                  >
                    <option value="">-- {t('observedIssue')} --</option>
                    <option value="turbid">{t('discoloredMuddy')}</option>
                    <option value="smell">{t('foulSmell')}</option>
                    <option value="algae">{t('greenAlgae')}</option>
                    <option value="leak">{t('pipelineLeak')}</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('observationNotes')}</label>
                <textarea 
                  rows={2} 
                  placeholder={t('describeLeakage')}
                  value={waterData.details} 
                  onChange={(e) => setWaterData(prev => ({ ...prev, details: e.target.value }))}
                  className="w-full p-3 border border-border bg-background rounded-xl text-xs"
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full h-10 gap-1.5">
                {submitting ? t('loading') : <><Plus className="h-4 w-4" /> {t('submitContaminationReport')}</>}
              </Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          {/* REGIONAL ALERTS */}
          <Card className="p-5 space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('ashaAlertsStream')}
            </h3>
            <p className="text-xs text-muted-foreground">{t('urgentContainmentBriefs')}</p>
            <div className="space-y-2">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-red-500">Dibrugarh Town</span>
                  <Badge className="bg-red-500 text-white text-[9px]">{t('critical').toUpperCase()}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Fecal pathogen coliform count elevated in public tube well #3. Advisory issued to boil all drinking water.</p>
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-500">Naharkatia</span>
                  <Badge className="bg-amber-500 text-white text-[9px]">{t('medium').toUpperCase()}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Minor symptom cluster detected (diarrhea/vomiting) in sector 2. Clean chlorination tablet distributions are underway.</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3 bg-gradient-to-br from-primary/10 to-primary/5">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h3 className="text-xs font-bold text-foreground">{t('ashaQuickGuide')}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('ashaQuickGuideDesc')}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 6. VOLUNTEER DASHBOARD (WITH QUIZ)
// ----------------------------------------------------
const VolunteerDashboard = ({ allVillages, selectedVillage, setSelectedVillage, t }: any) => {
  const { toast } = useToast();
  const [symptomData, setSymptomData] = useState({ symptoms: "", cases: "1", details: "" });
  const [submitting, setSubmitting] = useState(false);

  const [points, setPoints] = useState(() => parseInt(localStorage.getItem("volunteer_points") || "250"));
  const [quizzes, setQuizzes] = useState(() => [
    { id: 1, title: "Clean Water Sanitation", completed: localStorage.getItem("quiz_1_done") === "true", points: 50 },
    { id: 2, title: "Hygiene & Handwashing", completed: localStorage.getItem("quiz_2_done") === "true", points: 70 },
  ]);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");

  const handleSymptomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptomData.symptoms) {
      toast({ variant: "destructive", title: t('error'), description: t('symptomTypesPlaceholder') });
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast({ title: `✓ ${t('logCommunityReport')}`, description: t('reportsRecentSubmitted') });
      setSymptomData({ symptoms: "", cases: "1", details: "" });
    }, 1000);
  };

  const handleQuizStart = (quiz: any) => {
    if (quiz.completed) {
      toast({ title: t('completedLabel'), description: t('completedLabel') });
      return;
    }
    setActiveQuiz(quiz);
    setSelectedAnswer("");
  };

  const handleQuizSubmit = () => {
    if (!selectedAnswer) return;
    const isCorrect = selectedAnswer === "correct";
    if (isCorrect) {
      const newPoints = points + activeQuiz.points;
      setPoints(newPoints);
      localStorage.setItem("volunteer_points", newPoints.toString());
      localStorage.setItem(`quiz_${activeQuiz.id}_done`, "true");
      setQuizzes(prev => prev.map(q => q.id === activeQuiz.id ? { ...q, completed: true } : q));
      toast({ title: `🎉 ${t('gamification.newBadge')}`, description: `+${activeQuiz.points} ${t('ptsLabel')}` });
    } else {
      toast({ variant: "destructive", title: "❌", description: t('error') });
    }
    setActiveQuiz(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('volunteerCenter')}</h2>
          <p className="text-xs text-muted-foreground">{t('volunteerCenterDesc')}</p>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-primary">{points} {t('ptsLabel')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RiskMap />

          {/* REPORT FORM */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Plus className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">{t('logCommunityCase')}</h3>
            </div>
            <form onSubmit={handleSymptomSubmit} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('reportsSelectVillage')}</label>
                  <select 
                    value={selectedVillage} 
                    onChange={(e) => setSelectedVillage(e.target.value)}
                    className="w-full h-10 px-3 border border-border bg-background rounded-xl text-xs"
                  >
                    {allVillages.map((v: any) => (
                      <option key={v.id} value={v.id}>{sanitizeLocationName(v.name)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('numCases')}</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={symptomData.cases} 
                    onChange={(e) => setSymptomData(prev => ({ ...prev, cases: e.target.value }))}
                    className="w-full h-10 px-3 border border-border bg-background rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t('symptomsObserved')}</label>
                <input 
                  type="text" 
                  placeholder={t('symptomTypesPlaceholder')}
                  value={symptomData.symptoms} 
                  onChange={(e) => setSymptomData(prev => ({ ...prev, symptoms: e.target.value }))}
                  className="w-full h-10 px-3 border border-border bg-background rounded-xl text-xs"
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full h-10">
                {submitting ? t('loading') : t('logCommunityReport')}
              </Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          {/* LEARN & EARN */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Award className="h-5 w-5 text-secondary" />
              <h3 className="text-base font-bold text-foreground">{t('learnEarnPortal')}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{t('learnEarnDesc')}</p>
            
            <div className="space-y-2">
              {quizzes.map((q) => (
                <div key={q.id} className="p-3 bg-muted/20 border border-border/40 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{q.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t('valueLabel')} {q.points} {t('ptsLabel')}</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant={q.completed ? "ghost" : "default"} 
                    className="text-xs h-8"
                    onClick={() => handleQuizStart(q)}
                  >
                    {q.completed ? `✓ ${t('completedLabel')}` : t('startQuiz')}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* QUIZ INTERACTIVE DIALOG */}
      {activeQuiz && (
        <Dialog open={!!activeQuiz} onOpenChange={() => setActiveQuiz(null)}>
          <DialogContent className="max-w-md rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                {activeQuiz.title} Quiz
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-3 text-sm">
              {activeQuiz.id === 1 ? (
                <>
                  <p className="font-semibold text-foreground">What is the safe pH range for drinking water?</p>
                  <div className="space-y-2">
                    <button onClick={() => setSelectedAnswer("wrong1")} className={`w-full p-3 rounded-xl border text-left text-xs ${selectedAnswer === "wrong1" ? "border-primary bg-primary/5 text-primary" : "border-border/60"}`}>
                      A. 4.0 - 5.5 (Acidic)
                    </button>
                    <button onClick={() => setSelectedAnswer("correct")} className={`w-full p-3 rounded-xl border text-left text-xs ${selectedAnswer === "correct" ? "border-primary bg-primary/5 text-primary" : "border-border/60"}`}>
                      B. 6.5 - 8.5 (Neutral / Standard)
                    </button>
                    <button onClick={() => setSelectedAnswer("wrong2")} className={`w-full p-3 rounded-xl border text-left text-xs ${selectedAnswer === "wrong2" ? "border-primary bg-primary/5 text-primary" : "border-border/60"}`}>
                      C. 9.0 - 11.0 (Highly Alkaline)
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-semibold text-foreground">Which method is most effective for killing pathogens in drinking water?</p>
                  <div className="space-y-2">
                    <button onClick={() => setSelectedAnswer("wrong1")} className={`w-full p-3 rounded-xl border text-left text-xs ${selectedAnswer === "wrong1" ? "border-primary bg-primary/5 text-primary" : "border-border/60"}`}>
                      A. Simple sedimentation sand-filtering
                    </button>
                    <button onClick={() => setSelectedAnswer("correct")} className={`w-full p-3 rounded-xl border text-left text-xs ${selectedAnswer === "correct" ? "border-primary bg-primary/5 text-primary" : "border-border/60"}`}>
                      B. Rolling boil for 1 full minute
                    </button>
                    <button onClick={() => setSelectedAnswer("wrong2")} className={`w-full p-3 rounded-xl border text-left text-xs ${selectedAnswer === "wrong2" ? "border-primary bg-primary/5 text-primary" : "border-border/60"}`}>
                      C. Leaving it open to direct sunlight for 5 minutes
                    </button>
                  </div>
                </>
              )}

              <div className="flex gap-2 justify-end pt-3">
                <Button variant="ghost" onClick={() => setActiveQuiz(null)}>{t('cancel')}</Button>
                <Button onClick={handleQuizSubmit}>{t('submitAnswer')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// ----------------------------------------------------
// 7. MAIN DASHBOARD CONTAINER
// ----------------------------------------------------
const Dashboard = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { roles, loading: roleLoading } = useUserRole();

  const [selectedDistrict, setSelectedDistrict] = useState<string>("d1");
  const [selectedVillage, setSelectedVillage] = useState<string>("v1");
  const [districts, setDistricts] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);
  const [allVillages, setAllVillages] = useState<any[]>([]);

  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [sensors, setSensors] = useState<any[]>([]);
  const [symptomClusters, setSymptomClusters] = useState<any[]>([]);
  const [pendingReports, setPendingReports] = useState<any[]>([]);
  const [kpi, setKpi] = useState<any>(null);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileVillage, setProfileVillage] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [actionsChecked, setActionsChecked] = useState<Record<string, boolean>>({
    alert: true,
    medical: false,
    awareness: false,
    ors: false,
    testing: true
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    const districtsData = await db.getDistricts();
    const allVillagesData = await db.getVillages();
    const predsData = await db.getPredictions();
    const resourcesData = await db.getResources();
    const interventionsData = await db.getInterventions();
    const sensorsData = await db.getSensors();
    const clustersData = await db.getSymptomClusters();
    const pendingData = await db.getPendingReports();
    const kpiData = db.getImpactKPIs();

    setDistricts(districtsData);
    setAllVillages(allVillagesData);
    setPredictions(predsData);
    setResources(resourcesData);
    setInterventions(interventionsData);
    setSensors(sensorsData);
    setSymptomClusters(clustersData);
    setPendingReports(pendingData);
    setKpi(kpiData);

    const filtered = allVillagesData.filter((v: any) => v.districtId === selectedDistrict);
    setVillages(filtered);
    if (filtered.length > 0) {
      setSelectedVillage(filtered[0].id);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAllData();
    // Keep spinner visible briefly for UX feedback
    setTimeout(() => {
      setIsRefreshing(false);
      toast({
        title: `✅ ${t('refreshSystem')}`,
        description: t('success'),
      });
    }, 1200);
  };

  const handleDistrictChange = (val: string) => {
    setSelectedDistrict(val);
    const filtered = allVillages.filter((v: any) => v.districtId === val);
    setVillages(filtered);
    if (filtered.length > 0) {
      setSelectedVillage(filtered[0].id);
    }
  };

  const openVillageProfile = (vId: string) => {
    const v = allVillages.find((x: any) => x.id === vId);
    if (v) {
      setProfileVillage(v);
      setIsProfileOpen(true);
    }
  };

  const runOutbreakSimulation = (applyIntervention: boolean) => {
    const result = db.simulateIntervention(selectedVillage, applyIntervention);
    setSimulationResult({ applied: applyIntervention, ...result });
    toast({
      title: `🔮 ${t('simulationResult')}`,
      description: t('predictedCasesDesc'),
    });
  };

  const handleApproveReport = (id: string) => {
    const updated = db.approveReport(id);
    setPendingReports([...updated]);
    loadAllData();
    toast({ title: `✅ ${t('approveFeedAi')}`, description: t('ashaVerificationDesc') });
  };

  const handleRejectReport = (id: string) => {
    const updated = db.rejectReport(id);
    setPendingReports([...updated]);
    toast({ title: `❌ ${t('rejectReport')}`, description: t('error') });
  };

  const getResourceRecommendations = (riskScore: number) => {
    if (riskScore >= 80) return { doctors: 2, nurses: 5, ORS: 200, tankers: 1 };
    else if (riskScore >= 45) return { doctors: 1, nurses: 2, ORS: 100, tankers: 0 };
    return { doctors: 0, nurses: 1, ORS: 30, tankers: 0 };
  };

  const selectedVillageData = allVillages.find((v: any) => v.id === selectedVillage) || allVillages[0];
  const activeAlertsCount = allVillages.reduce((acc: number, v: any) => acc + (v.alerts || 0), 0);
  const totalCasesCount = allVillages.reduce((acc: number, v: any) => acc + (v.cases || 0), 0);
  const activeSensorsCount = sensors.filter((s: any) => s.status === "Online").length;

  const getPrimaryRole = (rolesList: string[]) => {
    if (rolesList.includes('admin')) return 'admin';
    if (rolesList.includes('official') || rolesList.includes('health_official')) return 'official';
    if (rolesList.includes('clinic_staff') || rolesList.includes('clinic_staffs')) return 'clinic_staff';
    if (rolesList.includes('asha_worker')) return 'asha_worker';
    return 'volunteer';
  };

  if (roleLoading) return <DashboardSkeleton />;

  const primaryRole = getPrimaryRole(roles);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:pl-72 pt-20 lg:pt-8 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
            {t('branding.title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('auth.subtitle')}</p>
        </div>

        {/* ROLE SPECIFIC DASHBOARDS */}
        {primaryRole === 'admin' && (
          <AdminDashboard 
            districts={districts} villages={villages} allVillages={allVillages}
            selectedDistrict={selectedDistrict} selectedVillage={selectedVillage}
            handleDistrictChange={handleDistrictChange} setSelectedVillage={setSelectedVillage}
            openVillageProfile={openVillageProfile} handleRefresh={handleRefresh} isRefreshing={isRefreshing}
            activeSensorsCount={activeSensorsCount} activeAlertsCount={activeAlertsCount}
            totalCasesCount={totalCasesCount} sensors={sensors}
            simulationResult={simulationResult} runOutbreakSimulation={runOutbreakSimulation}
            t={t}
          />
        )}

        {primaryRole === 'official' && (
          <HealthOfficerDashboard 
            districts={districts} villages={villages} allVillages={allVillages}
            selectedDistrict={selectedDistrict} selectedVillage={selectedVillage}
            handleDistrictChange={handleDistrictChange} setSelectedVillage={setSelectedVillage}
            openVillageProfile={openVillageProfile} handleRefresh={handleRefresh} isRefreshing={isRefreshing}
            activeAlertsCount={activeAlertsCount} totalCasesCount={totalCasesCount}
            pendingReports={pendingReports} handleApproveReport={handleApproveReport}
            handleRejectReport={handleRejectReport} selectedVillageData={selectedVillageData}
            getResourceRecommendations={getResourceRecommendations}
            actionsChecked={actionsChecked} setActionsChecked={setActionsChecked}
            t={t}
          />
        )}

        {primaryRole === 'clinic_staff' && (
          <ClinicalStaffDashboard 
            allVillages={allVillages} symptomClusters={symptomClusters}
            openVillageProfile={openVillageProfile} t={t}
          />
        )}

        {primaryRole === 'asha_worker' && (
          <ASHAWorkerDashboard 
            allVillages={allVillages} selectedVillage={selectedVillage}
            setSelectedVillage={setSelectedVillage} t={t}
          />
        )}

        {primaryRole === 'volunteer' && (
          <VolunteerDashboard 
            allVillages={allVillages} selectedVillage={selectedVillage}
            setSelectedVillage={setSelectedVillage} t={t}
          />
        )}

        {/* VILLAGE PROFILE DIALOG */}
        {isProfileOpen && profileVillage && (
          <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  {t('village')}: {profileVillage.name}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-4">
                  <Card className="p-4 bg-muted/20 border-border/40">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Demographics & {t('activeSensors')}</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Population</p>
                        <p className="font-semibold text-foreground">{profileVillage.population}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('activeSensors')}</p>
                        <p className="font-semibold text-foreground">{profileVillage.waterSources} sites</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Main Supply</p>
                        <p className="font-semibold text-foreground">{profileVillage.mainWaterSource}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('riskLevel')}</p>
                        <Badge className={profileVillage.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}>
                          {profileVillage.riskLevel === 'high' ? t('high') : profileVillage.riskLevel === 'medium' ? t('medium') : t('low')}
                        </Badge>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 bg-muted/20 border-border/40 space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('outbreakRiskMap')}</h4>
                    <div className="flex justify-between items-center text-sm">
                      <span>{t('activeCases')}</span>
                      <span className="font-bold text-foreground">{profileVillage.cases} {t('casesLogged')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Historical Outbreaks</span>
                      <span className="font-bold text-foreground">3 recorded (Monsoon)</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>{t('mapRiskScore')}</span>
                      <span className="font-bold text-primary">{profileVillage.predictionScore}%</span>
                    </div>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="p-4 bg-muted/20 border-border/40 space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('activeIotSensors')}</h4>
                    {sensors.filter((s: any) => s.village === profileVillage.name).length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t('iotNoDevices')}</p>
                    ) : sensors.filter((s: any) => s.village === profileVillage.name).map((s: any) => (
                      <div key={s.id} className="flex justify-between items-center text-xs">
                        <span className="font-medium text-foreground">{s.name.split(" (")[0]}</span>
                        <Badge variant="outline" className={s.status === 'Online' ? 'text-green-400 border-green-500/20' : 'text-red-400 border-red-500/20'}>
                          {s.status === 'Online' ? t('online') : t('offline')} ({s.battery})
                        </Badge>
                      </div>
                    ))}
                  </Card>

                  <Card className="p-4 bg-muted/20 border-border/40 space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('interventionEffectiveness')}</h4>
                    <div className="flex justify-between items-center text-xs">
                      <span>Medical Teams</span>
                      <span className="font-medium text-foreground">{profileVillage.resourcesAssigned} Teams</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span>{t('activeIotSensors')}</span>
                      <span className="font-medium text-foreground">
                        {interventions.filter((i: any) => i.villageName === profileVillage.name).length} {t('activeCases')}
                      </span>
                    </div>
                  </Card>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={() => setIsProfileOpen(false)}>{t('closeProfile')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
