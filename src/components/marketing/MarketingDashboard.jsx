import React, { useState } from 'react';
import { 
    Users, Mail, MessageSquare, CalendarCheck, TrendingUp, 
    AlertTriangle, PauseCircle, PlayCircle, MoreHorizontal,
    ArrowRight, Filter, Download, Plus
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useSettings } from '@/components/context/SettingsContext';

export default function MarketingDashboard() {
    const navigate = useNavigate();
    const { theme } = useSettings();

    // Mock Data
    const kpiData = [
        { title: "Active Prospects", value: "1,250", icon: Users, color: "text-blue-500", bg: "bg-blue-100" },
        { title: "Engagement Rate", value: "34%", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-100" },
        { title: "Meetings Booked", value: "42", icon: CalendarCheck, color: "text-purple-500", bg: "bg-purple-100" },
        { title: "Pipeline Generated", value: "$1.2M", icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-100" },
    ];

    const funnelData = [
        { name: 'Sent', value: 5000, fill: '#94a3b8' },
        { name: 'Opened', value: 2250, fill: '#60a5fa' },
        { name: 'Replied', value: 600, fill: '#818cf8' },
        { name: 'Booked', value: 150, fill: '#34d399' },
    ];

    const sequences = [
        { id: 1, name: "SaaS CEO Cold Outreach", owner: "Sarah J.", persona: "CEO", replyRate: "12%", booked: 15, status: "Active" },
        { id: 2, name: "Webinar Follow-up", owner: "Mike T.", persona: "Marketing VP", replyRate: "8%", booked: 5, status: "Active" },
        { id: 3, name: "Q4 Closing Push", owner: "Sarah J.", persona: "Founder", replyRate: "4%", booked: 2, status: "Paused" },
        { id: 4, name: "Lost Leads Reactivation", owner: "John D.", persona: "Any", replyRate: "2%", booked: 0, status: "Active" },
    ];

    const negativeSentiments = [
        { id: 1, text: "Stop emailing me immediately.", email: "alex@corp.com", date: "2 mins ago" },
        { id: 2, text: "Unsubscribe", email: "lisa@studio.io", date: "1 hour ago" },
        { id: 3, text: "Not interested, remove me.", email: "jim@tech.net", date: "4 hours ago" },
    ];

    const cardClass = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900';
    const subTextClass = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Marketing Performance</h1>
                    <p className={subTextClass}>Revenue-focused overview of your campaigns</p>
                </div>
                <div className="flex gap-2">
                     <Button variant="outline" className={theme === 'dark' ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700 hover:text-white' : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50 hover:text-slate-900'}>
                        <Download className="w-4 h-4 mr-2" /> Export Report
                    </Button>
                    <Button onClick={() => navigate(createPageUrl('SequenceBuilder'))} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-5 h-5 mr-2" /> Create Sequence
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {kpiData.map((kpi, index) => (
                    <Card key={index} className={`${cardClass} shadow-sm hover:shadow-md transition-shadow`}>
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className={`text-sm font-medium ${subTextClass}`}>{kpi.title}</p>
                                <p className={`text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{kpi.value}</p>
                            </div>
                            <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-opacity-20' : ''} ${kpi.bg}`}>
                                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Funnel Fallout Chart */}
                <Card className={`lg:col-span-2 ${cardClass}`}>
                    <CardHeader>
                        <CardTitle className={theme === 'dark' ? 'text-white' : ''}>Funnel Fallout</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                                <XAxis type="number" tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12, fill: theme === 'dark' ? '#94a3b8' : '#64748b'}} />
                                <Tooltip 
                                    cursor={{fill: 'transparent'}} 
                                    contentStyle={{ 
                                        backgroundColor: theme === 'dark' ? '#1e293b' : '#fff',
                                        borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                                        color: theme === 'dark' ? '#fff' : '#000'
                                    }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32} label={{ position: 'right', fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Negative Sentiment Watchlist */}
                <Card className={cardClass}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-red-600 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> Negative Sentiment
                        </CardTitle>
                        <Badge variant="outline" className={`bg-red-50 text-red-600 border-red-200 ${theme === 'dark' ? 'bg-red-900/20 border-red-800' : ''}`}>Risk Watch</Badge>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {negativeSentiments.map((item) => (
                                <div key={item.id} className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50/50 border-red-100'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-red-400' : 'text-red-800'}`}>{item.email}</span>
                                        <span className="text-[10px] text-red-400">{item.date}</span>
                                    </div>
                                    <p className={`text-sm italic ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>"{item.text}"</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Sequence Leaderboard */}
            <Card className={cardClass}>
                <CardHeader>
                    <CardTitle className={theme === 'dark' ? 'text-white' : ''}>Sequence Leaderboard</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className={`${theme === 'dark' ? 'bg-slate-900/50 text-slate-400' : 'bg-slate-50 text-slate-500'} uppercase font-semibold`}>
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg">Sequence Name</th>
                                    <th className="px-4 py-3">Owner</th>
                                    <th className="px-4 py-3">Target Persona</th>
                                    <th className="px-4 py-3">Reply Rate</th>
                                    <th className="px-4 py-3">Meetings</th>
                                    <th className="px-4 py-3 text-right rounded-r-lg">Action</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'}`}>
                                {sequences.map((seq) => (
                                    <tr key={seq.id} className={theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50/50'}>
                                        <td className={`px-4 py-3 font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{seq.name}</td>
                                        <td className={`px-4 py-3 ${subTextClass}`}>{seq.owner}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant="secondary" className={theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}>{seq.persona}</Badge>
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-emerald-600">{seq.replyRate}</td>
                                        <td className="px-4 py-3 font-semibold text-purple-600">{seq.booked}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className={seq.status === 'Active' ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"}
                                            >
                                                {seq.status === 'Active' ? <PauseCircle className="w-4 h-4 mr-1" /> : <PlayCircle className="w-4 h-4 mr-1" />}
                                                {seq.status === 'Active' ? 'Pause' : 'Resume'}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}