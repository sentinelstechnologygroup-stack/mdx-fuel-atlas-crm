import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Target, AlertCircle } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ForecastWidget({ opportunities, timeRange, periodTarget = 500000 }) {
    const { theme, branding } = useSettings();

    const { wonRevenue, weightedPipeline, pipelineCoverage, gapToQuota } = useMemo(() => {
        const won = opportunities.filter(o => o.deal_stage === 'Closed Won').reduce((acc, o) => acc + (o.amount || 0), 0);
        
        const open = opportunities.filter(o => !['Closed Won', 'Closed Lost'].includes(o.deal_stage));
        const weighted = open.reduce((acc, o) => acc + ((o.amount || 0) * (o.probability || 0) / 100), 0);
        
        const totalForecast = won + weighted;
        const gap = Math.max(0, periodTarget - won);
        const coverage = gap > 0 ? (open.reduce((acc, o) => acc + (o.amount || 0), 0) / gap).toFixed(1) : '∞';

        return { wonRevenue: won, weightedPipeline: weighted, pipelineCoverage: coverage, gapToQuota: gap };
    }, [opportunities, periodTarget]);

    const attainmentPercent = Math.min(100, Math.round((wonRevenue / periodTarget) * 100));
    const forecastPercent = Math.min(100, Math.round(((wonRevenue + weightedPipeline) / periodTarget) * 100));

    const isDark = theme === 'dark';

    return (
        <Card className={`h-full border-none shadow-none bg-transparent`}>
            <CardHeader className="px-0 pt-0">
                <CardTitle className={`text-lg font-bold flex items-center justify-between ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <Link to={createPageUrl('Opportunities')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <Target className="w-5 h-5 text-indigo-500" />
                        Forecast vs Quota
                    </Link>
                    <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Target: {branding.currency}{periodTarget.toLocaleString()}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="px-0 space-y-6">
                
                {/* Main Attainment Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Attainment</span>
                        <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{attainmentPercent}%</span>
                    </div>
                    <div className="relative h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        {/* Won Revenue (Solid) */}
                        <div 
                            className="absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-500"
                            style={{ width: `${attainmentPercent}%` }}
                        />
                        {/* Weighted Pipeline (Striped/Lighter) */}
                        <div 
                            className="absolute top-0 h-full bg-indigo-300/50 dark:bg-indigo-500/30 transition-all duration-500"
                            style={{ left: `${attainmentPercent}%`, width: `${forecastPercent - attainmentPercent}%` }}
                        />
                        {/* Marker for Target */}
                        <div className="absolute top-0 bottom-0 w-0.5 bg-black dark:bg-white z-10" style={{ left: '100%' }} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>{branding.currency}{wonRevenue.toLocaleString()} Won</span>
                        <span>Forecast: {branding.currency}{(wonRevenue + weightedPipeline).toLocaleString()}</span>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <div className="text-xs text-slate-500 mb-1">Pipeline Coverage</div>
                        <div className={`text-2xl font-bold ${parseFloat(pipelineCoverage) < 3 ? 'text-orange-500' : 'text-emerald-500'}`}>
                            {pipelineCoverage}x
                        </div>
                        <div className="text-[10px] text-slate-400">Target: 3.0x</div>
                    </div>
                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <div className="text-xs text-slate-500 mb-1">Gap to Quota</div>
                        <div className={`text-2xl font-bold ${gapToQuota > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-emerald-500'}`}>
                            {branding.currency}{gapToQuota.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">{gapToQuota > 0 ? 'To Go' : 'Crushed it!'}</div>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}