import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Crown } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function LeaderboardWidget({ opportunities }) {
    const { theme, branding } = useSettings();
    const isDark = theme === 'dark';

    const leaderboard = useMemo(() => {
        const stats = {};
        
        opportunities.forEach(opp => {
            const agent = opp.assigned_to || 'Unassigned';
            if (!stats[agent]) {
                stats[agent] = { name: agent, revenue: 0, deals: 0, pipeline: 0 };
            }
            
            if (opp.deal_stage === 'Closed Won') {
                stats[agent].revenue += (opp.amount || 0);
                stats[agent].deals += 1;
            } else if (!['Closed Lost'].includes(opp.deal_stage)) {
                stats[agent].pipeline += (opp.amount || 0);
            }
        });

        return Object.values(stats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5); // Top 5
    }, [opportunities]);

    const getRankIcon = (index) => {
        if (index === 0) return <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />;
        if (index === 1) return <Medal className="w-5 h-5 text-slate-400 fill-slate-400" />;
        if (index === 2) return <Medal className="w-5 h-5 text-amber-700 fill-amber-700" />;
        return <span className={`text-sm font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>#{index + 1}</span>;
    };

    return (
        <Card className="h-full border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <CardTitle className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Top Performers
                </CardTitle>
            </CardHeader>
            <CardContent className="px-0 space-y-3">
                {leaderboard.length === 0 ? (
                    <div className="text-center text-slate-500 py-8">No closed deals yet</div>
                ) : (
                    leaderboard.map((agent, index) => (
                        <Link 
                            to={`${createPageUrl('Opportunities')}?view=won`}
                            key={agent.name}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer ${
                                isDark ? 'bg-slate-800/40 hover:bg-slate-800/80 hover:scale-[1.02]' : 'bg-slate-50 hover:bg-slate-100 hover:scale-[1.02]'
                            }`}
                        >
                            <div className="w-8 flex justify-center">{getRankIcon(index)}</div>
                            <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-700">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.name}`} />
                                <AvatarFallback>{agent.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                    {agent.name.split('@')[0]}
                                </p>
                                <p className="text-xs text-slate-500">{agent.deals} Deals Won</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-sm font-bold font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    {branding.currency}{(agent.revenue / 1000000).toFixed(1)}M
                                </p>
                                <p className="text-xs text-slate-500">
                                    Pipe: {branding.currency}{(agent.pipeline / 1000000).toFixed(1)}M
                                </p>
                            </div>
                        </Link>
                    ))
                )}
            </CardContent>
        </Card>
    );
}