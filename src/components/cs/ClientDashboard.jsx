import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { atlas } from "@/api/atlasClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";

export default function ClientDashboard({ clients }) {
    const { theme } = useSettings();
    const isDark = theme === 'dark';

    const stats = {
        totalClients: clients.length,
        totalGallons: clients.reduce((acc, c) => acc + (Number(c.estimated_monthly_gallons) || 0), 0),
        tankAccounts: clients.filter(c => c.tank_rental === 'Yes' || Number(c.number_of_tanks) > 0).length,
        creditPending: clients.filter(c => ['Not Submitted', 'Pending', 'On Hold'].includes(c.credit_status)).length,
        activeAccounts: clients.filter(c => ['Active', 'Prospect'].includes(c.customer_status || c.customer_segment)).length
    };

    const cards = [
        { title: "Customer Accounts", value: stats.totalClients, icon: Users, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/20" },
        { title: "Open Fuel Volume", value: `${stats.totalGallons.toLocaleString()} gal/mo`, icon: TrendingUp, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/20" },
        { title: "Active / Prospect", value: stats.activeAccounts, icon: CheckCircle, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/20" },
        { title: "Tank Accounts", value: stats.tankAccounts, icon: Users, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/20" },
        { title: "Credit Pending", value: stats.creditPending, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/20" }
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
