import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";

export default function ClientDashboard({ clients }) {
    const { theme } = useSettings();
    const isDark = theme === 'dark';

    const stats = {
        totalClients: clients.length,
        totalRevenue: clients.reduce((acc, c) => acc + (c.initial_amount || 0), 0),
        avgHealth: clients.length > 0 ? Math.round(clients.reduce((acc, c) => acc + (c.health_score || 0), 0) / clients.length) : 0,
        onboarding: clients.filter(c => c.onboarding_status === 'In Progress').length,
        atRisk: clients.filter(c => c.health_score < 60).length
    };

    const cards = [
        { title: "Total Clients", value: stats.totalClients, icon: Users, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/20" },
        { title: "Total ARR/Revenue", value: `$${(stats.totalRevenue / 1000000).toFixed(1)}M`, icon: TrendingUp, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/20" },
        { title: "Avg Health Score", value: `${stats.avgHealth}%`, icon: CheckCircle, color: stats.avgHealth > 80 ? "text-green-500" : "text-yellow-500", bg: stats.avgHealth > 80 ? "bg-green-100 dark:bg-green-900/20" : "bg-yellow-100 dark:bg-yellow-900/20" },
        { title: "In Onboarding", value: stats.onboarding, icon: Users, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/20" },
        { title: "At Risk", value: stats.atRisk, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/20" }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {cards.map((stat, index) => (
                <Card key={index} className={`border backdrop-blur-md shadow-lg transition-all hover:scale-[1.02] duration-300 ${isDark ? 'bg-slate-800/60 border-white/5 text-white' : 'bg-white/60 border-white/40 text-slate-900'}`}>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{stat.title}</p>
                            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{stat.value}</p>
                        </div>
                        <div className={`p-2 rounded-2xl backdrop-blur-sm ${stat.bg} bg-opacity-50`}>
                            <stat.icon className={`w-5 h-5 ${stat.color}`} />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}