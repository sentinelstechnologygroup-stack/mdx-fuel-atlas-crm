import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Plus, Mail, MessageSquare, Edit2, Trash2, LayoutTemplate, Filter, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from '@/components/context/SettingsContext';

const MOCK_TEMPLATES = [
  {
    "id": "t_001",
    "name": "Enterprise Value Prop (Optimized)",
    "subject_line": "Reducing your cloud spend by 12% in Q4",
    "body_content": "Hi {{First_Name}},\n\nI noticed {{Company_Name}} is expanding its infrastructure. Most CTOs I speak with are struggling to balance scaling costs with performance.\n\nWe helped Acme Corp cut AWS spend by 12% in under 30 days without downtime.\n\nAre you open to a 10-minute technical review next Tuesday?",
    "ai_resonance_score": 92,
    "status_color": "green", 
    "tone_analysis": "Professional, Data-Driven",
    "channel": "EMAIL",
    "created_date": new Date().toISOString()
  },
  {
    "id": "t_002",
    "name": "Generic Follow Up (Needs Work)",
    "subject_line": "Just checking in...",
    "body_content": "Hi {{First_Name}},\n\nI am just bumping this to the top of your inbox.\n\nDid you see my last email? I would love to hop on a quick call and see if there are any synergies we can explore.\n\nBest,\n[My Name]",
    "ai_resonance_score": 35,
    "status_color": "red",
    "tone_analysis": "Passive, Generic",
    "channel": "EMAIL",
    "created_date": new Date().toISOString()
  },
  {
    "id": "t_003",
    "name": "Intro - SaaS Founders",
    "subject_line": "Question about your sales process",
    "body_content": "Hey {{First_Name}},\n\nSaw you guys are growing fast. Congrats!<br/><br/>I wanted to reach out and see if you need help with your CRM. We have a great tool that is super cheap and easy to use.\n\nLet me know?",
    "ai_resonance_score": 55,
    "status_color": "yellow",
    "tone_analysis": "Too Casual, Vague",
    "channel": "SMS",
    "created_date": new Date().toISOString()
  }
];

export default function MarketingTemplates() {
    const navigate = useNavigate();
    const { theme } = useSettings();

    const [selectedUser, setSelectedUser] = React.useState('all');

    const { data: dbTemplates = [], isLoading } = useQuery({
        queryKey: ['marketing_templates'],
        queryFn: () => base44.entities.MarketingTemplate.list(),
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => base44.entities.User.list(),
    });

    const templates = [...MOCK_TEMPLATES, ...dbTemplates].filter(t => {
        if (selectedUser === 'all') return true;
        if (t.id.startsWith('t_')) return false; 
        return t.created_by === selectedUser;
    });

    // Theme Variables
    const textMain = theme === 'dark' ? 'text-white' : 'text-slate-900';
    const textSub = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';
    const emptyStateBg = theme === 'dark' ? 'bg-[#0f172a]/50 border-slate-700' : 'bg-slate-50 border-slate-200';
    const cardBg = theme === 'dark' ? 'bg-[#1e293b] border-slate-700' : 'bg-white hover:shadow-md';
    const cardText = theme === 'dark' ? 'text-slate-200' : 'text-slate-800';
    const iconBg = theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100';

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className={`text-3xl font-bold ${textMain}`}>Marketing Templates</h1>
                    <p className={textSub}>Manage your email and message templates.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-[200px]">
                        <Select value={selectedUser} onValueChange={setSelectedUser}>
                            <SelectTrigger className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}>
                                <User className="w-4 h-4 mr-2 opacity-50" />
                                <SelectValue placeholder="Filter by user" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                {users.map(u => (
                                    <SelectItem key={u.id} value={u.email}>{u.full_name || u.email}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={() => navigate(createPageUrl('TemplateEditor'))} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" /> New Template
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className={`text-center py-12 ${textSub}`}>Loading templates...</div>
            ) : templates.length === 0 ? (
                <div className={`text-center py-24 border-2 border-dashed rounded-2xl ${emptyStateBg} transition-colors duration-300`}>
                    <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-300 shadow-sm'}`}>
                         <LayoutTemplate className="w-8 h-8" />
                    </div>
                    <h3 className={`text-xl font-bold mb-2 ${textMain}`}>No templates yet</h3>
                    <p className={`max-w-md mx-auto mb-8 ${textSub}`}>Create your first smart template to start engaging leads with AI-optimized content.</p>
                    <Button onClick={() => navigate(createPageUrl('TemplateEditor'))} variant="outline" className={theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white' : ''}>
                        <Plus className="w-4 h-4 mr-2" /> Create Template
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map((template) => (
                        <Card key={template.id} className={`${cardBg} transition-all cursor-pointer group border shadow-sm hover:shadow-lg`} onClick={() => navigate(`${createPageUrl('TemplateEditor')}?id=${template.id}`)}>
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-2 rounded-lg ${template.channel === 'SMS' ? (theme === 'dark' ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-600') : (theme === 'dark' ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-600')}`}>
                                        {template.channel === 'SMS' ? <MessageSquare className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                                    </div>
                                    <Badge variant="outline" className={
                                        (template.ai_resonance_score || 0) > 70 ? (theme === 'dark' ? "bg-emerald-900/30 text-emerald-300 border-emerald-800" : "bg-emerald-50 text-emerald-600 border-emerald-200") :
                                        (template.ai_resonance_score || 0) > 40 ? (theme === 'dark' ? "bg-amber-900/30 text-amber-300 border-amber-800" : "bg-amber-50 text-amber-600 border-amber-200") :
                                        (theme === 'dark' ? "bg-red-900/30 text-red-300 border-red-800" : "bg-red-50 text-red-600 border-red-200")
                                    }>
                                        Score: {template.ai_resonance_score || 0}
                                    </Badge>
                                </div>
                                <h3 className={`font-bold text-lg mb-2 truncate group-hover:text-blue-500 transition-colors ${textMain}`}>{template.name}</h3>
                                <p className={`text-sm line-clamp-2 mb-4 h-10 ${textSub}`}>{template.subject_line || "No subject"}</p>
                                <div className={`flex items-center justify-between text-xs mt-auto pt-4 border-t ${theme === 'dark' ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
                                    <span>{new Date(template.created_date).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-1 group-hover:text-blue-500 transition-colors">
                                        Edit <Edit2 className="w-3 h-3" />
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}