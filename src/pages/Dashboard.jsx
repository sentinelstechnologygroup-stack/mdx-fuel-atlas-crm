import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area } from
'recharts';
import { Users, DollarSign, Activity, CheckCircle2, Clock, Calendar, AlertCircle, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import moment from 'moment';
import TasksWidget from '@/components/dashboard/TasksWidget';
import ForecastWidget from '@/components/dashboard/ForecastWidget';
import LeaderboardWidget from '@/components/dashboard/LeaderboardWidget';
import StagnantDealsWidget from '@/components/dashboard/StagnantDealsWidget';
import AddWidgetDialog from '@/components/dashboard/AddWidgetDialog';
import { useSettings } from '@/components/context/SettingsContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('all'); // 'today', 'week', 'month', 'quarter', 'year', 'all'
  const [showAddWidget, setShowAddWidget] = useState(false);
  const { theme, branding, pipelineStages } = useSettings();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const getStageColor = (stageName) => {
    // Normalize stage name (remove translations in parens)
    const normalizedName = stageName?.split('(')[0]?.trim();
    const stage = pipelineStages?.find(s => s.label === normalizedName || s.id === normalizedName || s.label?.startsWith(normalizedName));
    const colorClass = stage?.color || 'bg-slate-400';
    
    // Map Tailwind classes to Hex for Recharts
    const colorMap = {
      'bg-blue-400': '#22d3ee', // Neon Cyan
      'bg-blue-500': '#06b6d4',
      'bg-indigo-400': '#a78bfa', // Neon Violet
      'bg-indigo-500': '#8b5cf6',
      'bg-purple-400': '#e879f9', // Neon Fuchsia
      'bg-purple-500': '#d946ef',
      'bg-amber-400': '#facc15', // Neon Yellow
      'bg-amber-500': '#eab308',
      'bg-emerald-500': '#34d399', // Neon Emerald
      'bg-emerald-400': '#4ade80', // Neon Green
      'bg-slate-300': '#e2e8f0', // Lighter Slate
      'bg-slate-400': '#cbd5e1',
      'bg-slate-500': '#94a3b8',
      'bg-red-500': '#f43f5e', // Neon Rose
    };

    return colorMap[colorClass] || '#8884d8';
  };

  const { data: leads = [], isLoading: isLoadingLeads } = useQuery({ queryKey: ['leads'], queryFn: () => base44.entities.Lead.list() });
  const { data: opportunities = [], isLoading: isLoadingOpps } = useQuery({ queryKey: ['opportunities'], queryFn: () => base44.entities.Opportunity.list() });
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({ queryKey: ['tasks'], queryFn: () => base44.entities.Task.list() });
  const [tempWidgets, setTempWidgets] = useState([]);

  // Filter data by time range
  const { filteredLeads, filteredOpps, dateRangeLabel } = useMemo(() => {
    let start = moment();
    let label = "";

    switch (timeRange) {
      case 'today':
        start = moment().startOf('day');
        label = "Today";
        break;
      case 'week':
        start = moment().startOf('week');
        label = "Current Week";
        break;
      case 'month':
        start = moment().startOf('month');
        label = "Current Month";
        break;
      case 'quarter':
        start = moment().startOf('quarter');
        label = "Current Quarter";
        break;
      case 'year':
        start = moment().startOf('year');
        label = "Current Year";
        break;
      default:
        start = moment('2000-01-01');
        label = "All Time";
    }

    return {
      filteredLeads: leads.filter((l) => moment(l.custom_data?.simulated_date || l.created_date).isSameOrAfter(start)),
      filteredOpps: opportunities.filter((o) => moment(o.custom_data?.simulated_date || o.created_date).isSameOrAfter(start)),
      dateRangeLabel: label
    };
  }, [leads, opportunities, timeRange]);

  // חישוב מדדים (KPIs)
  const stats = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const newLeads = filteredLeads.filter((l) => l.lead_status === 'New').length;
    const convertedLeads = filteredLeads.filter((l) => l.lead_status?.includes('Converted')).length;

    const totalOpps = filteredOpps.length;
    const wonOpps = filteredOpps.filter((o) => o.deal_stage?.includes('Won'));
    const totalWonValue = wonOpps.reduce((sum, o) => sum + (o.amount || 0), 0);

    // Opportunity Stages
    const oppsByStage = filteredOpps.reduce((acc, o) => {
      const stage = o.deal_stage || 'Other';
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {});
    const stageData = Object.entries(oppsByStage).map(([name, value]) => ({ 
      name, 
      value,
      fill: getStageColor(name)
    }));

    // Sales Trends Data (Leads vs Won Deals)
    const trendMap = {};
    const dateFormat = timeRange === 'year' ? 'MMM' : 'DD/MM';

    filteredLeads.forEach((l) => {
      const date = moment(l.custom_data?.simulated_date || l.created_date).format(dateFormat);
      if (!trendMap[date]) trendMap[date] = { date, leads: 0, sales: 0 };
      trendMap[date].leads++;
    });

    wonOpps.forEach((o) => {
      const date = moment(o.custom_data?.simulated_date || o.updated_date || o.created_date).format(dateFormat);
      if (!trendMap[date]) trendMap[date] = { date, leads: 0, sales: 0 };
      trendMap[date].sales++;
    });

    const trendData = Object.values(trendMap).sort((a, b) => 0); // Simple sort

    // Tasks
    const today = moment().endOf('day');
    const upcomingTasks = tasks.filter((t) => {
      if (t.status === 'done') return false;
      const due = moment(t.due_date);
      return due.isValid() && due.isSameOrBefore(today.clone().add(7, 'days'));
    }).sort((a, b) => moment(a.due_date).valueOf() - moment(b.due_date).valueOf()).slice(0, 5);

    return {
      totalLeads, newLeads, convertedLeads,
      totalOpps, wonOppsCount: wonOpps.length, totalWonValue,
      stageData, trendData, upcomingTasks
    };
  }, [filteredLeads, filteredOpps, tasks, timeRange, pipelineStages]);

  if (isLoadingLeads || isLoadingOpps || isLoadingTasks) return <div className="p-8"><Skeleton className="h-96 w-full rounded-3xl" /></div>;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const glassCardClasses = theme === 'dark' 
    ? 'bg-slate-900/60 backdrop-blur-xl border-slate-700/50 shadow-xl shadow-black/20' 
    : 'bg-white/60 backdrop-blur-xl border-white/50 shadow-xl shadow-slate-200/50';

  return (
    <div className="space-y-6 md:space-y-8 pb-24 md:pb-12 max-w-[1600px] mx-auto">

      {/* Zen Bento Header Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* 1. Hero / Focus Card (Span 8) */}
          <div className={`md:col-span-8 rounded-[2rem] p-8 md:p-10 border relative overflow-hidden flex flex-col justify-between min-h-[300px] transition-all duration-500 group ${
            theme === 'dark' 
            ? 'bg-gradient-to-br from-indigo-900/80 via-slate-900/90 to-slate-900 border-indigo-500/30' 
            : 'bg-gradient-to-br from-indigo-50 via-white/80 to-white border-white/60'
          } shadow-2xl ${theme === 'dark' ? 'shadow-indigo-900/20' : 'shadow-indigo-100/50'}`}>
              
              <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <h1 className={`text-4xl md:text-5xl font-bold tracking-tight mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                        {getGreeting()}
                    </h1>
                    <p className={`text-lg ${theme === 'dark' ? 'text-indigo-200' : 'text-slate-500'}`}>
                        {moment().format("dddd, MMMM Do YYYY")}
                    </p>
                  </div>

                  <div className="mt-8 flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <Link to={createPageUrl('ActNow')}>
                        <Button className={`h-14 px-8 rounded-2xl text-lg font-semibold transition-all hover:scale-105 shadow-lg ${
                            theme === 'dark' 
                            ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/30' 
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                        }`}>
                            <Activity className="w-5 h-5 mr-2" />
                            Start "Act Now" Engine
                        </Button>
                    </Link>
                    <Link to={`${createPageUrl('Leads')}?view=new`} className={`flex items-center gap-4 px-6 py-3 rounded-2xl border backdrop-blur-md hover:scale-105 transition-transform cursor-pointer ${
                        theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-white/50 border-white/50 text-slate-600 hover:bg-white/80'
                    }`}>
                         <div className="flex -space-x-2">
                             {leads.filter(l => moment(l.created_date).isSame(moment(), 'day')).slice(0, 3).length > 0 ? (
                                 leads.filter(l => moment(l.created_date).isSame(moment(), 'day')).slice(0, 3).map((lead, i) => (
                                     <div key={lead.id || i} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold uppercase ${
                                         theme === 'dark' ? 'border-slate-800 bg-slate-700 text-cyan-400' : 'border-white bg-indigo-100 text-indigo-700'
                                     }`} title={lead.full_name}>
                                         {lead.full_name?.substring(0, 2) || "??"}
                                     </div>
                                 ))
                             ) : (
                                 <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                                     theme === 'dark' ? 'border-slate-800 bg-slate-700' : 'border-white bg-slate-100'
                                 }`}>
                                     0
                                 </div>
                             )}
                         </div>
                         <span className="text-sm font-medium">
                             {leads.filter(l => moment(l.created_date).isSame(moment(), 'day')).length} New Leads Today
                         </span>
                    </Link>
                  </div>
              </div>

              {/* Dynamic Abstract Background */}
              <div className={`absolute -right-20 -bottom-32 w-96 h-96 rounded-full blur-[100px] opacity-60 pointer-events-none transition-transform duration-[10s] ease-in-out group-hover:scale-110 ${
                  theme === 'dark' ? 'bg-indigo-600' : 'bg-indigo-200'
              }`}></div>

          </div>

          {/* 2. Quick Stats Grid (Span 4) */}
          <div className="md:col-span-4 grid grid-cols-2 gap-4">
               {/* Stat 1 */}
               <Link to={`${createPageUrl('Opportunities')}?view=won`} className={`col-span-2 rounded-3xl p-6 border flex items-center justify-between transition-transform hover:scale-[1.02] cursor-pointer ${glassCardClasses}`}>
                   <div>
                       <p className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Total Revenue</p>
                       <p className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-emerald-400' : 'text-slate-800'}`}>
                           ${(stats.totalWonValue / 1000000).toFixed(2)}m
                       </p>
                   </div>
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                       <DollarSign className="w-6 h-6" />
                   </div>
               </Link>

               {/* Stat 2 */}
               <Link to={`${createPageUrl('Leads')}?view=all`} className={`rounded-3xl p-6 border flex flex-col justify-center transition-transform hover:scale-[1.02] cursor-pointer ${glassCardClasses}`}>
                   <div className={`w-10 h-10 mb-3 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                       <Users className="w-5 h-5" />
                   </div>
                   <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{stats.totalLeads}</p>
                   <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Active Leads</p>
               </Link>

               {/* Stat 3 */}
               <Link to={`${createPageUrl('Opportunities')}?view=won`} className={`rounded-3xl p-6 border flex flex-col justify-center transition-transform hover:scale-[1.02] cursor-pointer ${glassCardClasses}`}>
                   <div className={`w-10 h-10 mb-3 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                       <Activity className="w-5 h-5" />
                   </div>
                   <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{stats.wonOppsCount}</p>
                   <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Deals Won</p>
               </Link>
          </div>
      </div>

      {/* Sales Performance Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 1. Forecast */}
          <div className={`rounded-[2rem] p-6 border ${glassCardClasses}`}>
              <ForecastWidget 
                  opportunities={filteredOpps} 
                  timeRange={timeRange}
                  periodTarget={250000} // Hardcoded for MVP visualization
              />
          </div>

          {/* 2. Leaderboard */}
          <div className={`rounded-[2rem] p-6 border ${glassCardClasses}`}>
              <LeaderboardWidget opportunities={filteredOpps} />
          </div>

          {/* 3. Stagnant Deals */}
          <div className={`rounded-[2rem] p-6 border ${glassCardClasses}`}>
              <StagnantDealsWidget opportunities={opportunities} />
          </div>
      </div>

      {/* Main Content Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">

          {/* Large Chart (Span 8) */}
          <div className={`md:col-span-8 rounded-[2rem] p-6 md:p-8 border ${glassCardClasses}`}>
              <div className="flex items-center justify-between mb-8">
                  <Link to={createPageUrl('Reports')} className={`text-xl font-bold flex items-center gap-2 hover:opacity-80 transition-opacity ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                      <span className="w-2 h-8 rounded-full bg-blue-500 inline-block mr-2"></span>
                      Growth Overview
                  </Link>
                   <Select value={timeRange} onValueChange={setTimeRange}>
                      <SelectTrigger className={`w-[140px] h-10 rounded-full border-none ${
                    theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`
                    }>
                          <SelectValue placeholder="Range" />
                      </SelectTrigger>
                      <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                          <SelectItem value="week">This Week</SelectItem>
                          <SelectItem value="month">This Month</SelectItem>
                          <SelectItem value="quarter">This Quarter</SelectItem>
                          <SelectItem value="year">This Year</SelectItem>
                          <SelectItem value="all">All Time</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#f1f5f9'} />
                        <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} 
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} 
                        />
                        <RechartsTooltip 
                            contentStyle={{ 
                                borderRadius: '16px', 
                                border: 'none', 
                                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                                backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                                color: theme === 'dark' ? '#fff' : '#000'
                            }} 
                        />
                        <Area 
                            type="monotone" 
                            dataKey="leads" 
                            name="Leads" 
                            stroke="#6366f1" 
                            strokeWidth={3}
                            fill="url(#colorLeads)" 
                        />
                        <Area 
                            type="monotone" 
                            dataKey="sales" 
                            name="Sales" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            fill="url(#colorSales)" 
                        />
                    </AreaChart>
                </ResponsiveContainer>
              </div>
          </div>

          {/* Right Column Stack (Span 4) */}
          <div className="md:col-span-4 flex flex-col gap-6">
              
              {/* Tasks Widget */}
              <div className="flex-1">
                 <TasksWidget className={`h-full ${glassCardClasses.replace('rounded-3xl', 'rounded-[2rem]')}`} />
              </div>

              {/* Pipeline Donut */}
              <div className={`rounded-[2rem] p-6 border ${glassCardClasses}`}>
                  <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Pipeline Breakdown</h3>
                  <div className="h-[200px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie
                                  data={stats.stageData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                                  className="cursor-pointer focus:outline-none"
                                  onClick={(data) => {
                                      if (data && data.name) {
                                          // Try to filter by stage ID if possible, otherwise navigate
                                          // Assuming Opportunity page handles ?action=filter&stage=... or similar manually implemented
                                          // For now, simple navigation
                                          navigate(`${createPageUrl('Opportunities')}?view=pipeline`); 
                                      }
                                  }}
                              >
                                  {stats.stageData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                                  ))}
                              </Pie>
                              <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                          </PieChart>
                      </ResponsiveContainer>
                      {/* Center Text */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                              {stats.totalOpps}
                          </span>
                          <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Opps</span>
                      </div>
                  </div>
              </div>

          </div>
      </div>

      {/* Add Report Placeholder (Full Width) */}
      <div onClick={() => setShowAddWidget(true)} className="cursor-pointer group">
        <div className={`h-24 rounded-[2rem] border-2 border-dashed flex items-center justify-center gap-4 transition-all ${
          theme === 'dark' ? 
          'border-slate-700 bg-slate-800/30 hover:border-indigo-500/50 hover:bg-slate-800' : 
          'border-slate-200 bg-white/50 hover:border-indigo-300 hover:bg-white'
        }`}>
          <div className={`p-2 rounded-full transition-all group-hover:scale-110 ${
            theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
          }`}>
            <Plus className="w-6 h-6" />
          </div>
          <span className={`font-medium ${theme === 'dark' ? 'text-slate-400 group-hover:text-indigo-300' : 'text-slate-600 group-hover:text-indigo-700'}`}>
            Customize Your Dashboard
          </span>
        </div>
      </div>

      <AddWidgetDialog 
        open={showAddWidget} 
        onOpenChange={setShowAddWidget} 
        onSave={(data) => {
          setTempWidgets([...tempWidgets, { ...data, id: Date.now() }]);
          setShowAddWidget(false);
        }} 
      />
    </div>);

}

function CustomWidget({ config, theme }) {
  // Simple rendering of custom widget placeholder/chart
  // In a real implementation, this would render the actual chart based on config
  return (
      <Card className={`border-none shadow-sm rounded-2xl flex flex-col h-full min-h-[300px] ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
          <CardHeader>
              <CardTitle className={`text-lg font-semibold tracking-tight ${theme === 'dark' ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400' : 'text-blue-700'}`}>
                  {config.name}
              </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center text-slate-500">
             {/* Simplified display for now since we don't have the generic chart component ready in this context */}
             <div className="text-center">
                 <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
                 <p className="text-sm">Custom {config.type} for {config.entity_type}</p>
                 <p className="text-xs opacity-70">Group by: {config.config?.xAxis}</p>
             </div>
          </CardContent>
      </Card>
  );
}

function KpiCard({ title, value, subtext, icon: Icon, color, total }) {
  const { theme } = useSettings();
  return (
    <div className={`p-5 md:p-6 rounded-3xl shadow-lg border relative overflow-hidden group hover:scale-[1.02] transition-all backdrop-blur-xl ${
    theme === 'dark' ?
    'bg-slate-800/60 border-slate-700/50 hover:border-cyan-500/50 text-white' :
    'bg-white/60 border-white/50 text-slate-900'}`
    }>
            <div className="relative z-10 text-center">
                <div className="flex items-center justify-center mb-4">
                    <div className={`p-3 rounded-2xl ${color} ${theme === 'dark' ? 'bg-opacity-20' : 'bg-opacity-10'}`}>
                        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
                    </div>
                    {total && <span className={`text-xs font-bold px-2 py-1 rounded-full ml-2 ${
          theme === 'dark' ? 'text-cyan-400 bg-slate-700' : 'text-neutral-500 bg-neutral-50'}`
          }>{total} Total</span>}
                </div>
                <h3 className={`text-2xl md:text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-neutral-800'}`}>{value}</h3>
                <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-neutral-600'}`}>{title}</p>
                <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>{subtext}</p>
            </div>
        </div>);

}