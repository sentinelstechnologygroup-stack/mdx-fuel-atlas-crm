import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useActNow } from "@/components/context/ActNowContext";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, Brain, Target, ArrowRight, Zap, MessageSquare, Phone, CheckSquare, X } from 'lucide-react';
import TaskForm from "@/components/tasks/TaskForm";
import { useSettings } from '@/components/context/SettingsContext';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from 'react-markdown';

export default function ActNowPage() {
    const { theme } = useSettings();
    const [analyzing, setAnalyzing] = useState(false);
    const { suggestions: insights, setSuggestions: setInsights } = useActNow();
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [taskDefaults, setTaskDefaults] = useState(null);
    const queryClient = useQueryClient();

    // Fetch data for analysis
    const { data: leads } = useQuery({ 
        queryKey: ['leads-act-now'], 
        queryFn: () => base44.entities.Lead.list(),
        staleTime: 1000 * 60 * 5
    });

    const { data: opportunities } = useQuery({ 
        queryKey: ['opportunities-act-now'], 
        queryFn: () => base44.entities.Opportunity.list(),
        staleTime: 1000 * 60 * 5
    });

    const handleCreateTask = (item) => {
        setTaskDefaults({
            title: `Act now task: ${item.target}`,
            description: item.how,
            priority: (item.priority === 'Critical' || item.priority === 'High') ? 'high' : 'medium',
            due_date: new Date().toISOString().split('T')[0],
            related_lead_id: item.type === 'Lead' ? item.id : undefined,
            related_opportunity_id: item.type === 'Opportunity' ? item.id : undefined
        });
        setShowTaskForm(true);
    };

    const handleTaskSubmit = async (data) => {
        try {
            await base44.entities.Task.create(data);
            queryClient.invalidateQueries(['tasks']);
            alert("Task created successfully!");
            setShowTaskForm(false);
            setTaskDefaults(null);
        } catch (error) {
            console.error("Failed to create task", error);
            alert("Failed to create task: " + (error.message || "Unknown error"));
        }
    };



    const handleMagicButton = async () => {
        if (!leads || !opportunities) return;
        setAnalyzing(true);
        setInsights(null);

        try {
            // Prepare context data (limit to avoid token limits if necessary, but sending relevant fields)
            const openOpps = opportunities.filter(o => !['Closed Won', 'Closed Lost'].includes(o.deal_stage));
            const activeLeads = leads.filter(l => !['Converted', 'Lost / Unqualified'].includes(l.lead_status));

            const contextData = {
                opportunities: openOpps.slice(0, 20).map(o => ({
                    id: o.id,
                    lead_name: o.lead_name,
                    amount: o.amount,
                    stage: o.deal_stage,
                    probability: o.probability,
                    last_updated: o.updated_date,
                    product: o.product_type
                })),
                leads: activeLeads.slice(0, 20).map(l => ({
                    id: l.id,
                    name: l.full_name,
                    status: l.lead_status,
                    temperature: l.lead_temperature,
                    last_contact: l.last_contact_date,
                    source: l.source_year
                }))
            };

            const prompt = `
                You are an expert AI Sales Director. Analyze the following Leads and Opportunities data.
                Identify the top 3-5 targets that the user should "Attack" (contact) IMMEDIATELY to drive revenue.
                
                Focus on:
                1. High value opportunities near closing.
                2. Warm leads that haven't been contacted recently.
                3. "Low hanging fruit" - easy wins.

                For each recommendation, provide:
                1. "id": The ID of the lead or opportunity.
                2. "target": Name of the lead/opportunity.
                3. "type": "Opportunity" or "Lead".
                4. "priority": "High" or "Critical".
                5. "why": A concise, punchy explanation of why this is urgent (e.g., "Deal worth $50k is stalling in Negotiation").
                6. "how": A specific, actionable "Attack Plan" (e.g., "Call now and offer X to close by Friday").
                
                Return a JSON object with a property "recommendations" which is an array of these objects.
                Data: ${JSON.stringify(contextData)}
            `;

            const res = await base44.integrations.Core.InvokeLLM({
                prompt: prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        recommendations: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                    target: { type: "string" },
                                    type: { type: "string" },
                                    priority: { type: "string" },
                                    why: { type: "string" },
                                    how: { type: "string" }
                                }
                            }
                        }
                    }
                }
            });

            if (res && res.recommendations) {
                // Validate and hydrate recommendations to ensure IDs and Names match real data
                const validatedInsights = res.recommendations.map(rec => {
                    let realRecord = null;
                    
                    // 1. Try to match by ID first (Priority)
                    if (rec.type === 'Lead') {
                        realRecord = leads.find(l => l.id === rec.id);
                    } else if (rec.type === 'Opportunity') {
                        realRecord = opportunities.find(o => o.id === rec.id);
                    }

                    // If found by ID, correct the name to ensure consistency
                    if (realRecord) {
                         const realName = rec.type === 'Lead' ? realRecord.full_name : (realRecord.lead_name || "Unknown Opportunity");
                         return { ...rec, target: realName };
                    }

                    // 2. If ID match failed, try to match by Name (Fallback)
                    // This handles cases where LLM hallucinated the ID but got the name right
                    if (!realRecord) {
                        if (rec.type === 'Lead') {
                            realRecord = leads.find(l => l.full_name && l.full_name.toLowerCase() === rec.target.toLowerCase());
                        } else if (rec.type === 'Opportunity') {
                            realRecord = opportunities.find(o => o.lead_name && o.lead_name.toLowerCase() === rec.target.toLowerCase());
                        }
                        
                        // If found by Name, correct the ID
                        if (realRecord) {
                            return { ...rec, id: realRecord.id };
                        }
                    }

                    // 3. If neither found, it might be a hallucination or stale data
                    // We keep it as is, but it might result in a broken link
                    return rec;
                });

                setInsights(validatedInsights);
            }

        } catch (error) {
            console.error("AI Analysis failed:", error);
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            {/* Header Section */}
            <div className="text-center space-y-4 py-10">
                <div className={`inline-flex items-center justify-center p-4 rounded-full mb-4 ${
                    theme === 'dark' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-50 text-red-600'
                }`}>
                    <Brain className="w-12 h-12" />
                </div>
                <h1 className={`text-4xl md:text-5xl font-extrabold tracking-tight ${
                    theme === 'dark' ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400' : 'text-slate-900'
                }`}>
                    Act Now Engine
                </h1>
                <p className={`text-xl max-w-2xl mx-auto ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    Press the magic button to let AI analyze your pipeline and tell you exactly who to contact, why, and how to close them today.
                </p>

                <div className="pt-8">
                    <Button 
                        size="lg"
                        onClick={handleMagicButton}
                        disabled={analyzing || !leads}
                        className={`relative group overflow-hidden rounded-full px-12 py-8 text-xl font-bold transition-all transform hover:scale-105 ${
                            analyzing ? 'opacity-80 cursor-not-allowed' : ''
                        } ${
                            theme === 'dark' 
                            ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:shadow-[0_0_40px_rgba(34,211,238,0.5)] text-white' 
                            : 'bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 hover:shadow-xl text-white'
                        }`}
                    >
                        {analyzing ? (
                            <div className="flex items-center gap-3">
                                <Sparkles className="w-6 h-6 animate-spin" />
                                Analyzing Pipeline...
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <Sparkles className="w-6 h-6 animate-pulse" />
                                ACTIVATE AI ENGINE
                            </div>
                        )}
                    </Button>
                </div>
            </div>

            {/* Results Section */}
            {insights && insights.length > 0 && (
                <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h2 className={`text-2xl font-bold ml-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            Top Priority Targets
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {insights.map((item, idx) => (
                            <Card key={idx} className={`border-l-4 transition-all hover:-translate-y-1 hover:shadow-lg ${
                                theme === 'dark' 
                                ? 'bg-slate-800 border-slate-700 border-l-cyan-400' 
                                : 'bg-white border-slate-200 border-l-red-500'
                            }`}>
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className={`${
                                            item.priority === 'Critical' 
                                            ? 'bg-red-100 text-red-700 border-red-200' 
                                            : 'bg-amber-100 text-amber-700 border-amber-200'
                                        }`}>
                                            {item.priority}
                                        </Badge>
                                        <Badge variant="secondary" className="opacity-70">{item.type}</Badge>
                                    </div>
                                    <CardTitle className={`text-xl ${item.id ? 'hover:underline' : ''} ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                        {item.id ? (
                                            <Link 
                                                to={
                                                    item.type === 'Lead' 
                                                    ? `${createPageUrl('LeadDetails')}?leadId=${item.id}` 
                                                    : `${createPageUrl('Opportunities')}?opportunityId=${item.id}`
                                                }
                                            >
                                                {item.target}
                                            </Link>
                                        ) : (
                                            <span>{item.target}</span>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                                        <div className={`flex items-center gap-2 mb-1 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500 opacity-70'}`}>
                                            <Target className="w-3 h-3" /> Why Attack?
                                        </div>
                                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                                            {item.why}
                                        </p>
                                    </div>
                                    
                                    <div className={`p-3 rounded-lg ${
                                        theme === 'dark' ? 'bg-cyan-900/20 border border-cyan-500/20' : 'bg-red-50 border border-red-100'
                                    }`}>
                                        <div className={`flex items-center gap-2 mb-1 text-xs font-bold uppercase tracking-wider ${
                                            theme === 'dark' ? 'text-cyan-400' : 'text-red-600'
                                        }`}>
                                            <Zap className="w-3 h-3" /> How To Attack
                                        </div>
                                        <p className={`text-sm font-medium ${theme === 'dark' ? 'text-cyan-100' : 'text-slate-800'}`}>
                                            "{item.how}"
                                        </p>
                                    </div>

                                    <div className="pt-2">
                                        <Button 
                                            size="sm" 
                                            className={`w-full gap-2 ${theme === 'dark' ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                                            onClick={() => handleCreateTask(item)}
                                        >
                                            <CheckSquare className="w-4 h-4" /> Create Task Now
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
            
            {!insights && !analyzing && leads && (
                <div className={`text-center py-12 rounded-2xl border border-dashed ${
                    theme === 'dark' ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50/50'
                }`}>
                    <p className="text-slate-500">Ready to analyze {leads.length} leads and {opportunities ? opportunities.length : 0} opportunities</p>
                </div>
            )}
            
            {analyzing && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     {[1, 2, 3].map((i) => (
                        <div key={i} className="h-64 rounded-xl overflow-hidden relative">
                             <Skeleton className="h-full w-full" />
                        </div>
                     ))}
                </div>
            )}

            <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
                <DialogContent className={`max-w-lg ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : ''}`} dir="ltr">
                    <DialogHeader>
                        <div className="flex justify-between items-center">
                            <DialogTitle>Create Task</DialogTitle>
                            <Button variant="ghost" size="icon" onClick={() => setShowTaskForm(false)} className={`text-slate-400 ${theme === 'dark' ? 'hover:text-white hover:bg-slate-800' : 'hover:text-slate-600'}`}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </DialogHeader>
                    {showTaskForm && (
                        <TaskForm
                            task={taskDefaults}
                            onSubmit={handleTaskSubmit}
                            onCancel={() => setShowTaskForm(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}