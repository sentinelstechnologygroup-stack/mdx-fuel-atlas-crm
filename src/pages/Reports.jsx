import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { atlas } from '@/api/atlasClient';
import { listEmployeeLookup } from '@/api/userDirectoryService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, Users, CheckCircle2, Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import SalesPerformance from '@/components/reports/SalesPerformance';
import OpportunityAdvancedReport from '@/components/reports/OpportunityAdvancedReport';
import OpportunitiesListReport from '@/components/reports/OpportunitiesListReport'; // Fixed import
import ConversionReport from '@/components/reports/ConversionReport';
import ActivityReport from '@/components/reports/ActivityReport';
import CustomReports from '@/components/reports/CustomReports';
import CustomDashboard from '@/components/reports/CustomDashboard';
import AiInsights from '@/components/reports/AiInsights';
import { BrainCircuit } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";

export default function ReportsPage() {
  const { theme } = useSettings();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState('all');
  const [activeReport, setActiveReport] = useState('list');

  // Fetch all necessary data
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => atlas.entities.Lead.list(),
    initialData: []
  });

  const { data: opportunities, isLoading: oppsLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => atlas.entities.Opportunity.list(),
    initialData: []
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => atlas.entities.Task.list(),
    initialData: []
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: () => atlas.entities.Activity.list(),
    initialData: []
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: listEmployeeLookup,
    initialData: []
  });

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
      try {
          setIsExporting(true);
          const response = await atlas.functions.invoke('exportReport', { reportId: activeReport, timeRange });
          
          if (response.status === 200 && response.data?.file) {
              // Decode base64 to binary
              const binaryString = window.atob(response.data.file);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
              }

              // Create blob and download
              const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = response.data.filename || `${activeReport}_report.xlsx`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              a.remove();
              toast.success("Report exported successfully");
          } else {
              throw new Error("Export failed or no data returned");
          }
      } catch (error) {
          console.error("Export error:", error);
          toast.error("Failed to export report");
      } finally {
          setIsExporting(false);
      }
  };

  const isLoading = leadsLoading || oppsLoading || tasksLoading || activitiesLoading;

  if (isLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div>;
  }

  const reports = [
      { id: 'list', name: 'Detailed Report', icon: Users },
      { id: 'advanced', name: 'Opportunities Dashboard', icon: TrendingUp },
      { id: 'sales', name: 'Sales Performance', icon: TrendingUp },
      { id: 'conversion', name: 'Conversion Rates', icon: CheckCircle2 },
      { id: 'activity', name: 'Activity Report', icon: Calendar },
      { id: 'custom_reports', name: 'Custom Reports', icon: Users },
      { id: 'custom_dashboard', name: 'Personal Dashboard', icon: Users },
      { id: 'ai_insights', name: 'AI Insights', icon: BrainCircuit, color: 'text-indigo-600' }
  ];

  return (
    <div className={`min-h-screen p-6 transition-colors ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50/50'}`} dir="ltr">
      <div className="max-w-[1600px] mx-auto space-y-6">
          {/* Header */}
          <div className={`rounded-xl shadow-lg backdrop-blur-xl border p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors ${
              theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'
          }`}>
            <div>
              <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400' : 'text-neutral-900'}`}>Reports & Analytics</h1>
              <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Comprehensive overview of performance, conversions and business activity</p>
            </div>
            
            <div className="flex items-center gap-3">
                {/* Refresh Data Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                        queryClient.invalidateQueries(['leads']);
                        queryClient.invalidateQueries(['opportunities']);
                        queryClient.invalidateQueries(['tasks']);
                        queryClient.invalidateQueries(['activities']);
                        toast.success("Refreshing data...");
                    }}
                    className={theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}
                    title="Refresh Data"
                >
                    <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>

                <Button 
                    onClick={handleExport} 
                    disabled={isExporting}
                    variant="outline"
                    className={`gap-2 ${theme === 'dark' ? 'bg-slate-700 text-white border-slate-600 hover:bg-slate-600' : 'bg-white text-neutral-700 border-neutral-200'}`}
                >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span className="hidden sm:inline">Export Excel</span>
                </Button>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block" />

                <span className={`text-sm font-medium hidden md:inline-block ${theme === 'dark' ? 'text-slate-300' : 'text-neutral-600'}`}>Time Range:</span>
                <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className={`w-[130px] sm:w-[180px] ${
                    theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-neutral-200'
                }`}>
                    <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent className={`${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white'}`}>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="this_year">This Year</SelectItem>
                </SelectContent>
                </Select>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6 items-start">
              {/* Mobile Navigation (Horizontal Scrollable Tabs) */}
              <div className="col-span-12 lg:hidden mb-2">
                  <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide -mx-6 px-6">
                      {reports.map((report) => {
                          const isActive = activeReport === report.id;
                          return (
                              <button
                                  key={report.id}
                                  onClick={() => setActiveReport(report.id)}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border
                                      ${isActive 
                                          ? theme === 'dark'
                                              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
                                              : 'bg-red-50 text-red-600 border-red-200'
                                          : theme === 'dark'
                                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                                              : 'bg-white text-slate-600 border-slate-200'
                                      }
                                  `}
                              >
                                  <report.icon className="w-3.5 h-3.5" />
                                  {report.name}
                              </button>
                          );
                      })}
                  </div>
              </div>

              {/* Sidebar Navigation (Desktop) */}
              <div className="hidden lg:block lg:col-span-2 space-y-1">
                  {reports.map((report) => {
                      const isActive = activeReport === report.id;
                      const Icon = report.icon;
                      return (
                          <button
                              key={report.id}
                              onClick={() => setActiveReport(report.id)}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium text-left
                                  ${isActive 
                                      ? theme === 'dark'
                                          ? 'bg-slate-700 text-cyan-400 shadow-sm border border-cyan-500/30 font-bold'
                                          : 'bg-white text-red-700 shadow-sm border border-red-100 font-bold'
                                      : theme === 'dark'
                                          ? 'text-slate-400 hover:bg-slate-800 hover:text-cyan-400'
                                          : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                                  }
                              `}
                          >
                              <Icon className={`w-4 h-4 ${isActive ? (theme === 'dark' ? 'text-cyan-400' : 'text-red-600') : report.color || 'text-slate-400'}`} />
                              {report.name}
                          </button>
                      );
                  })}
              </div>

              {/* Main Content Area */}
              <div className="col-span-12 lg:col-span-10">
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {activeReport === 'list' && <OpportunitiesListReport opportunities={opportunities} />}
                      {activeReport === 'advanced' && <OpportunityAdvancedReport leads={leads} opportunities={opportunities} />}
                      {activeReport === 'sales' && <SalesPerformance leads={leads} opportunities={opportunities} timeRange={timeRange} />}
                      {activeReport === 'conversion' && <ConversionReport leads={leads} opportunities={opportunities} timeRange={timeRange} />}
                      {activeReport === 'activity' && <ActivityReport tasks={tasks} activities={activities} leads={leads} users={users} timeRange={timeRange} />}
                      {activeReport === 'custom_reports' && <CustomReports />}
                      {activeReport === 'custom_dashboard' && <CustomDashboard />}
                      {activeReport === 'ai_insights' && <AiInsights />}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
}
