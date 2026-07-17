import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend, ComposedChart
} from 'recharts';
import { Download, Filter, RefreshCw, Calendar, User, Filter as FilterIcon, Table as TableIcon, BarChart3, TrendingUp } from "lucide-react";
import moment from 'moment';
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSettings } from "@/components/context/SettingsContext";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ff6b6b', '#4ecdc4'];

export default function OpportunityAdvancedReport({ leads, opportunities }) {
  const { theme } = useSettings();
  const [filterRep, setFilterRep] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [dateRange, setDateRange] = useState('this_year');

  const filteredData = useMemo(() => {
    let filtered = [...opportunities];
    const now = moment();

    if (dateRange !== 'all') {
      filtered = filtered.filter(o => {
        const date = moment(o.custom_data?.simulated_date || o.created_date);
        switch(dateRange) {
          case 'this_month': return date.isSame(now, 'month');
          case 'last_month': return date.isSame(now.clone().subtract(1, 'month'), 'month');
          case 'this_quarter': return date.isSame(now, 'quarter');
          case 'this_year': return date.isSame(now, 'year');
          default: return true;
        }
      });
    }

    if (filterRep !== 'all') filtered = filtered.filter(o => o.created_by === filterRep);
    if (filterStage !== 'all') filtered = filtered.filter(o => o.deal_stage === filterStage);

    return filtered;
  }, [opportunities, dateRange, filterRep, filterStage]);

  const salesReps = useMemo(() => Array.from(new Set(opportunities.map(o => o.created_by).filter(Boolean))), [opportunities]);
  const stages = useMemo(() => Array.from(new Set(opportunities.map(o => o.deal_stage).filter(Boolean))), [opportunities]);

  const progressionData = useMemo(() => {
    const counts = {};
    filteredData.forEach(o => {
      const stage = o.deal_stage?.split('(')[0]?.trim() || 'Unknown';
      if (!counts[stage]) counts[stage] = { name: stage, count: 0, value: 0 };
      counts[stage].count += 1;
      counts[stage].value += (o.amount || 0);
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [filteredData]);

  const sourceData = useMemo(() => {
    const wonDeals = filteredData.filter(o => o.deal_stage?.includes('Won') || o.deal_stage?.includes('בהצלחה'));
    const counts = {};
    wonDeals.forEach(o => {
      const lead = leads.find(l => l.id === o.lead_id);
      const source = lead?.source_year || 'Unknown'; 
      if (!counts[source]) counts[source] = { name: source, value: 0 };
      counts[source].value += 1;
    });
    return Object.values(counts);
  }, [filteredData, leads]);

  const revenueData = useMemo(() => {
    const data = {};
    filteredData.forEach(o => {
        if (!o.expected_close_date) return;
        const month = moment(o.expected_close_date).format('YYYY-MM');
        if (!data[month]) data[month] = { month, expected: 0, actual: 0 };
        data[month].expected += (o.amount || 0) * ((o.probability || 0) / 100);
        if (o.deal_stage?.includes('Won')) {
            data[month].actual += (o.amount || 0);
        }
    });
    return Object.values(data).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredData]);

  const salesCycleData = useMemo(() => {
    const productCycles = {};
    filteredData.forEach(o => {
        const createdDate = o.custom_data?.simulated_date || o.created_date;
        if ((o.deal_stage?.includes('Won') || o.deal_stage?.includes('בהצלחה')) && createdDate) {
            const start = moment(createdDate);
            const end = o.updated_date ? moment(o.updated_date) : moment();
            const days = end.diff(start, 'days');
            const prod = o.product_type || 'Other';
            if (!productCycles[prod]) productCycles[prod] = [];
            productCycles[prod].push(days);
        }
    });
    return Object.entries(productCycles).map(([name, cycles]) => ({
        name,
        avgDays: Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length)
    }));
  }, [filteredData]);

  const totalPipeline = filteredData.reduce((sum, o) => sum + (o.amount || 0), 0);
  const weightedPipeline = filteredData.reduce((sum, o) => sum + ((o.amount || 0) * ((o.probability || 0) / 100)), 0);
  const winRate = filteredData.length > 0 ? (filteredData.filter(o => o.deal_stage?.includes('Won')).length / filteredData.length) * 100 : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className={`p-4 rounded-xl shadow-sm border flex flex-col md:flex-row gap-4 items-end md:items-center justify-between ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-neutral-100'}`}>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="space-y-1">
                <label className={`text-xs font-medium ml-1 ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Date Range</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className={`w-[180px] ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-neutral-50'}`}>
                        <Calendar className={`w-4 h-4 ml-2 ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-400'}`} />
                        <SelectValue placeholder="Select Range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="last_month">Last Month</SelectItem>
                        <SelectItem value="this_quarter">This Quarter</SelectItem>
                        <SelectItem value="this_year">This Year</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <label className={`text-xs font-medium ml-1 ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Sales Rep</label>
                <Select value={filterRep} onValueChange={setFilterRep}>
                    <SelectTrigger className={`w-[180px] ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-neutral-50'}`}>
                        <User className={`w-4 h-4 ml-2 ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-400'}`} />
                        <SelectValue placeholder="All Reps" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Reps</SelectItem>
                        {salesReps.map(rep => <SelectItem key={rep} value={rep}>{rep}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <label className={`text-xs font-medium ml-1 ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Deal Stage</label>
                <Select value={filterStage} onValueChange={setFilterStage}>
                    <SelectTrigger className={`w-[180px] ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-neutral-50'}`}>
                        <FilterIcon className={`w-4 h-4 ml-2 ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-400'}`} />
                        <SelectValue placeholder="All Stages" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Stages</SelectItem>
                        {stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-slate-700 border-slate-600' : 'bg-neutral-50 border-neutral-200'}`}>
            <div className={`text-center px-4 border-l ${theme === 'dark' ? 'border-slate-600' : 'border-neutral-200'}`}>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Pipeline Value</p>
                <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-neutral-800'}`}>${totalPipeline.toLocaleString()}</p>
            </div>
            <div className={`text-center px-4 border-l ${theme === 'dark' ? 'border-slate-600' : 'border-neutral-200'}`}>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Weighted Forecast</p>
                <p className="text-lg font-bold text-red-600">${weightedPipeline.toLocaleString()}</p>
            </div>
            <div className="text-center px-4">
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Win Rate</p>
                <p className="text-lg font-bold text-green-600">{winRate.toFixed(1)}%</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={`shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'border-neutral-100'}`}>
            <CardHeader>
                <CardTitle className={`text-lg flex items-center gap-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                    <BarChart3 className="w-5 h-5 text-red-500" /> Deal Progression (Count & Value)
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={progressionData} layout="vertical" margin={{ left: 0, right: 30, top: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={70} 
                            tick={{fontSize: 9, fill: theme === 'dark' ? '#94a3b8' : '#666'}} 
                            tickFormatter={(val) => val.length > 8 ? `${val.substring(0, 8)}..` : val}
                        />
                        <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', color: theme === 'dark' ? '#fff' : '#000', fontSize: '12px'}} formatter={(value, name) => name === 'value' ? `$${value.toLocaleString()}` : value} />
                        <Bar dataKey="count" name="Count" fill="#ef4444" barSize={16} radius={[0, 4, 4, 0]} />
                    </ComposedChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <Card className={`shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'border-neutral-100'}`}>
            <CardHeader>
                <CardTitle className={`text-lg flex items-center gap-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                    <PieChart className="w-5 h-5 text-purple-500" /> Conversions by Source (Won Deals)
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={sourceData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                            {sourceData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', color: theme === 'dark' ? '#fff' : '#000', border: 'none' }} />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: theme === 'dark' ? '#9ca3af' : '#666' }} />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={`shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'border-neutral-100'}`}>
            <CardHeader>
                <CardTitle className={`text-lg flex items-center gap-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                    <TrendingUp className="w-5 h-5 text-green-500" /> Revenue Forecast (Weighted vs Actual)
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="month" stroke={theme === 'dark' ? '#94a3b8' : '#666'} />
                        <YAxis tickFormatter={(val) => `${val/1000}k`} stroke={theme === 'dark' ? '#94a3b8' : '#666'} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e5e7eb'} />
                        <Tooltip formatter={(val) => `$${val.toLocaleString()}`} contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', color: theme === 'dark' ? '#fff' : '#000', border: 'none' }} />
                        <Area type="monotone" dataKey="expected" name="Weighted Forecast" stroke="#8884d8" fillOpacity={1} fill="url(#colorExpected)" />
                        <Area type="monotone" dataKey="actual" name="Actual (Won)" stroke="#82ca9d" fillOpacity={1} fill="url(#colorActual)" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <Card className={`shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'border-neutral-100'}`}>
            <CardHeader>
                <CardTitle className={`text-lg flex items-center gap-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                    <Calendar className="w-5 h-5 text-orange-500" /> Average Sales Cycle Length (Days)
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesCycleData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e5e7eb'} />
                        <XAxis dataKey="name" stroke={theme === 'dark' ? '#94a3b8' : '#666'} />
                        <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#666'} />
                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', color: theme === 'dark' ? '#fff' : '#000', border: 'none' }} />
                        <Bar dataKey="avgDays" name="Avg Days" fill="#f97316" radius={[4, 4, 0, 0]} barSize={50} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>

      <Card className={`shadow-sm overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'border-neutral-100'}`}>
          <CardHeader>
              <CardTitle className={`text-lg flex items-center gap-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                  <TableIcon className="w-5 h-5 text-neutral-500" /> Filtered Opportunities Details
              </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
              <Table>
                  <TableHeader>
                      <TableRow className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : ''}>
                          <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Client Name</TableHead>
                          <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Product</TableHead>
                          <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Stage</TableHead>
                          <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Value</TableHead>
                          <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Probability</TableHead>
                          <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Close Date</TableHead>
                          <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Rep</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {filteredData.slice(0, 10).map((o) => (
                          <TableRow key={o.id} className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-700/50' : ''}>
                              <TableCell className={`font-medium max-w-[150px] truncate ${theme === 'dark' ? 'text-white' : ''}`} title={o.lead_name}>{o.lead_name}</TableCell>
                              <TableCell className={`max-w-[120px] truncate ${theme === 'dark' ? 'text-slate-300' : ''}`} title={o.product_type}>{o.product_type}</TableCell>
                              <TableCell>
                                  <Badge variant="outline" className={`font-normal whitespace-nowrap ${theme === 'dark' ? 'bg-slate-900 border-slate-600 text-slate-300' : 'bg-neutral-50'}`}>{o.deal_stage?.split('(')[0]}</Badge>
                              </TableCell>
                              <TableCell className={theme === 'dark' ? 'text-cyan-400 font-mono' : ''}>${o.amount?.toLocaleString()}</TableCell>
                              <TableCell className={theme === 'dark' ? 'text-slate-300' : ''}>{o.probability}%</TableCell>
                              <TableCell className={`whitespace-nowrap ${theme === 'dark' ? 'text-slate-400' : ''}`}>{o.expected_close_date ? moment(o.expected_close_date).format('MMM D, YYYY') : '-'}</TableCell>
                              <TableCell className={`text-xs max-w-[150px] truncate ${theme === 'dark' ? 'text-slate-500' : 'text-neutral-500'}`} title={o.created_by}>{o.created_by}</TableCell>
                          </TableRow>
                      ))}
                      {filteredData.length === 0 && (
                          <TableRow>
                              <TableCell colSpan={7} className={`text-center py-8 ${theme === 'dark' ? 'text-slate-500' : 'text-neutral-500'}`}>No data to display</TableCell>
                          </TableRow>
                      )}
                  </TableBody>
              </Table>
              {filteredData.length > 10 && (
                  <div className={`p-4 text-center text-xs border-t ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-500' : 'bg-neutral-50 border-neutral-100 text-neutral-500'}`}>
                      Showing 10 out of {filteredData.length} opportunities. Download full report to see all.
                  </div>
              )}
          </CardContent>
      </Card>
    </div>
  );
}