import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DollarSign, Trophy, Target, TrendingUp } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";

const COLORS = ['#ef4444', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function SalesPerformance({ leads, opportunities, timeRange }) {
  const { theme, pipelineStages } = useSettings();

  const getStageColor = (stageName) => {
    const stage = pipelineStages?.find(s => s.label === stageName || s.id === stageName || s.label?.startsWith(stageName));
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
    };

    return colorMap[colorClass] || '#8884d8';
  };
  
  const stats = useMemo(() => {
    const closedWon = opportunities.filter(o => o.deal_stage?.includes("Won") || o.deal_stage?.includes("בהצלחה"));
    const totalRevenue = closedWon.reduce((sum, o) => sum + (o.amount || 0), 0);
    const avgDealSize = closedWon.length > 0 ? totalRevenue / closedWon.length : 0;
    
    const pipelineValue = opportunities
      .filter(o => !o.deal_stage?.includes("Won") && !o.deal_stage?.includes("Lost"))
      .reduce((sum, o) => sum + (o.amount || 0), 0);

    return {
      totalRevenue,
      closedCount: closedWon.length,
      avgDealSize,
      pipelineValue
    };
  }, [opportunities, timeRange]);

  const productData = useMemo(() => {
    const counts = {};
    opportunities.forEach(o => {
      const prod = o.product_type || "Other";
      counts[prod] = (counts[prod] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [opportunities]);

  const stageData = useMemo(() => {
    const counts = {};
    opportunities.forEach(o => {
      const stageName = o.deal_stage?.split('(')[0]?.trim() || "Unknown";
      counts[stageName] = (counts[stageName] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ 
      name, 
      value,
      fill: getStageColor(name)
    }));
  }, [opportunities, pipelineStages]);

  const formatCurrency = (val) => `$${(val || 0).toLocaleString()}`;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${theme === 'dark' ? 'text-emerald-200' : ''}`}>Closed Revenue</CardTitle>
            <DollarSign className={`h-4 w-4 ${theme === 'dark' ? 'text-emerald-400 drop-shadow-sm' : 'text-green-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-xl md:text-2xl font-bold truncate ${theme === 'dark' ? 'text-emerald-400 drop-shadow-sm' : 'text-green-600'}`} title={formatCurrency(stats.totalRevenue)}>{formatCurrency(stats.totalRevenue)}</div>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Total successfully closed deals</p>
          </CardContent>
        </Card>

        <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${theme === 'dark' ? 'text-yellow-200' : ''}`}>Closed Deals</CardTitle>
            <Trophy className={`h-4 w-4 ${theme === 'dark' ? 'text-yellow-400 drop-shadow-sm' : 'text-yellow-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-yellow-400' : ''}`}>{stats.closedCount}</div>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Number of deals in Won status</p>
          </CardContent>
        </Card>

        <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${theme === 'dark' ? 'text-red-200' : ''}`}>Average Deal Size</CardTitle>
            <Target className={`h-4 w-4 ${theme === 'dark' ? 'text-red-400 drop-shadow-sm' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-xl md:text-2xl font-bold truncate ${theme === 'dark' ? 'text-red-400' : ''}`}>{formatCurrency(stats.avgDealSize)}</div>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Average for closed deal</p>
          </CardContent>
        </Card>

        <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${theme === 'dark' ? 'text-purple-200' : ''}`}>Open Pipeline Value</CardTitle>
            <TrendingUp className={`h-4 w-4 ${theme === 'dark' ? 'text-purple-400 drop-shadow-sm' : 'text-purple-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-xl md:text-2xl font-bold truncate ${theme === 'dark' ? 'text-purple-400' : ''}`}>{formatCurrency(stats.pipelineValue)}</div>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Potential of open deals</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
          <CardHeader>
            <CardTitle className={theme === 'dark' ? 'text-white' : ''}>Product Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {productData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', color: theme === 'dark' ? '#fff' : '#000', border: 'none' }} />
                <Legend wrapperStyle={{ color: theme === 'dark' ? '#9ca3af' : '#666' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
          <CardHeader>
            <CardTitle className={theme === 'dark' ? 'text-white' : ''}>Opportunities by Stage</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} layout="vertical" margin={{ left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                <XAxis type="number" stroke={theme === 'dark' ? '#9ca3af' : '#666'} />
                <YAxis dataKey="name" type="category" width={100} style={{ fontSize: '10px' }} stroke={theme === 'dark' ? '#9ca3af' : '#666'} />
                <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', color: theme === 'dark' ? '#fff' : '#000', border: 'none' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Count">
                  {stageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}