import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSettings } from '@/components/context/SettingsContext';
import { ArrowRight, Building2, Users, Activity, GitMerge, Tags, CheckSquare, PenTool, Puzzle, User, Bell, Lock } from "lucide-react";

export default function SettingsOverview({ menuGroups, onNavigate }) {
    const { theme } = useSettings();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Settings Dashboard</h2>
                <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Manage your organization, team, and personal preferences from one central hub.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {menuGroups.flatMap(group => group.items).map((item) => (
                    <Card 
                        key={item.id} 
                        className={`cursor-pointer group hover:shadow-lg transition-all duration-300 border ${
                            theme === 'dark' 
                                ? 'bg-slate-800 border-slate-700 hover:border-cyan-500/50' 
                                : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                        onClick={() => onNavigate(item.id)}
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className={`text-lg font-bold ${theme === 'dark' ? 'text-slate-100 group-hover:text-cyan-400' : 'text-slate-900 group-hover:text-slate-700'}`}>
                                {item.label}
                            </CardTitle>
                            <item.icon className={`h-5 w-5 ${theme === 'dark' ? 'text-slate-500 group-hover:text-cyan-400' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        </CardHeader>
                        <CardContent>
                            <p className={`text-sm mb-4 line-clamp-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                {getItemDescription(item.id)}
                            </p>
                            <div className={`text-xs font-semibold flex items-center gap-1 ${theme === 'dark' ? 'text-cyan-500/0 group-hover:text-cyan-400' : 'text-slate-900/0 group-hover:text-slate-900'} transition-all`}>
                                Configure <ArrowRight className="w-3 h-3" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function getItemDescription(id) {
    switch(id) {
        case 'organization': return "Manage company details, branding, logo, and primary currency.";
        case 'team': return "View team members and manage user access levels.";
        case 'audit': return "View system logs and track changes across the platform.";
        case 'user_management': return "Admin controls for user permissions and approvals.";
        case 'pipeline': return "Customize sales pipeline stages and automated checklists.";
        case 'tags': return "Manage global system tags for leads and opportunities.";
        case 'onboarding': return "Configure onboarding templates and tasks for new clients.";
        case 'custom_fields': return "Add custom data fields to leads and opportunities.";
        case 'integrations': return "Connect external services like Google, Slack, and Hubspot.";
        case 'profile': return "Update your personal profile information and password.";
        case 'notifications': return "Manage email alerts and system notifications.";
        default: return "Configure settings for this section.";
    }
}