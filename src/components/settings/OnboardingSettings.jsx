import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Edit2, CheckSquare } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";

export default function OnboardingSettings() {
    const { theme } = useSettings();
    const isDark = theme === 'dark';
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState(null);
    const [newItemText, setNewItemText] = useState("");

    const { data: templates, isLoading } = useQuery({
        queryKey: ['onboarding_templates'],
        queryFn: () => base44.entities.OnboardingTemplate.list(),
        initialData: []
    });

    const createTemplateMutation = useMutation({
        mutationFn: (data) => base44.entities.OnboardingTemplate.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['onboarding_templates']);
            setIsEditing(false);
            setCurrentTemplate(null);
        }
    });

    const updateTemplateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.OnboardingTemplate.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['onboarding_templates']);
            setIsEditing(false);
            setCurrentTemplate(null);
        }
    });

    const deleteTemplateMutation = useMutation({
        mutationFn: (id) => base44.entities.OnboardingTemplate.delete(id),
        onSuccess: () => queryClient.invalidateQueries(['onboarding_templates'])
    });

    const handleSave = () => {
        if (!currentTemplate.title) return alert("Please enter a title");
        
        if (currentTemplate.id) {
            updateTemplateMutation.mutate({ id: currentTemplate.id, data: currentTemplate });
        } else {
            createTemplateMutation.mutate(currentTemplate);
        }
    };

    const [newItemPhase, setNewItemPhase] = useState("General");
    const [newItemAssignee, setNewItemAssignee] = useState("CSM");
    const [newItemDueDays, setNewItemDueDays] = useState(0);

    const handleAddItem = () => {
        if (!newItemText.trim()) return;
        const newItem = {
            text: newItemText.trim(),
            phase: newItemPhase,
            default_assignee: newItemAssignee,
            relative_due_days: parseInt(newItemDueDays)
        };
        setCurrentTemplate({
            ...currentTemplate,
            items: [...(currentTemplate.items || []), newItem]
        });
        setNewItemText("");
    };

    const handleRemoveItem = (index) => {
        const newItems = [...currentTemplate.items];
        newItems.splice(index, 1);
        setCurrentTemplate({ ...currentTemplate, items: newItems });
    };

    if (isEditing) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {currentTemplate.id ? 'Edit Template' : 'New Template'}
                    </h2>
                    <Button variant="outline" onClick={() => { setIsEditing(false); setCurrentTemplate(null); }}>
                        Cancel
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>Template Title</Label>
                        <Input 
                            value={currentTemplate.title || ''} 
                            onChange={(e) => setCurrentTemplate({...currentTemplate, title: e.target.value})}
                            placeholder="e.g. SMB Standard Onboarding"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Product Type</Label>
                        <Select 
                            value={currentTemplate.product_type} 
                            onValueChange={(val) => setCurrentTemplate({...currentTemplate, product_type: val})}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Product" />
                            </SelectTrigger>
                            <SelectContent>
                                {['Consulting', 'Service', 'Product', 'Software', 'Other'].map(p => (
                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Customer Segment</Label>
                        <Select 
                            value={currentTemplate.customer_segment} 
                            onValueChange={(val) => setCurrentTemplate({...currentTemplate, customer_segment: val})}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Segment" />
                            </SelectTrigger>
                            <SelectContent>
                                {['SMB', 'Mid-Market', 'Enterprise', 'Key Account'].map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Card className={isDark ? 'bg-slate-800 border-slate-700' : ''}>
                    <CardHeader>
                        <CardTitle className="text-sm">Checklist Items</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-12 gap-2 items-end bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border">
                            <div className="col-span-5 space-y-1">
                                <Label className="text-xs">Task Name</Label>
                                <Input 
                                    value={newItemText}
                                    onChange={(e) => setNewItemText(e.target.value)}
                                    placeholder="Add new task..."
                                />
                            </div>
                            <div className="col-span-3 space-y-1">
                                <Label className="text-xs">Phase</Label>
                                <Input 
                                    value={newItemPhase}
                                    onChange={(e) => setNewItemPhase(e.target.value)}
                                    placeholder="Phase"
                                />
                            </div>
                            <div className="col-span-2 space-y-1">
                                <Label className="text-xs">Assignee</Label>
                                <Select value={newItemAssignee} onValueChange={setNewItemAssignee}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CSM">CSM</SelectItem>
                                        <SelectItem value="Client">Client</SelectItem>
                                        <SelectItem value="Technical Support">Tech Support</SelectItem>
                                        <SelectItem value="Sales">Sales</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-1 space-y-1">
                                <Label className="text-xs">Days</Label>
                                <Input 
                                    type="number"
                                    value={newItemDueDays}
                                    onChange={(e) => setNewItemDueDays(e.target.value)}
                                />
                            </div>
                            <div className="col-span-1">
                                <Button onClick={handleAddItem} size="icon" className="w-full"><Plus className="w-4 h-4" /></Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {(currentTemplate.items || []).map((item, idx) => (
                                <div key={idx} className={`p-3 rounded-lg flex justify-between items-center ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                                    <div className="grid grid-cols-12 gap-4 w-full items-center">
                                        <span className="col-span-5 font-medium text-sm">{typeof item === 'object' ? item.text : item}</span>
                                        <span className="col-span-3 text-xs text-slate-500">{typeof item === 'object' ? item.phase : '-'}</span>
                                        <span className="col-span-2 text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 w-fit">
                                            {typeof item === 'object' ? item.default_assignee : '-'}
                                        </span>
                                        <span className="col-span-1 text-xs text-slate-400">
                                            +{typeof item === 'object' ? item.relative_due_days : 0}d
                                        </span>
                                        <div className="col-span-1 text-right">
                                            <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-600 h-8 w-8 p-0">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!currentTemplate.items || currentTemplate.items.length === 0) && (
                                <p className="text-center text-slate-500 py-4 text-sm">No items added yet</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Save Template</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Onboarding Templates</h2>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Define standard checklists based on segment and product</p>
                </div>
                <Button onClick={() => { setCurrentTemplate({ items: [] }); setIsEditing(true); }}>
                    <Plus className="w-4 h-4 mr-2" /> New Template
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map(template => (
                    <Card key={template.id} className={`relative group ${isDark ? 'bg-slate-800 border-slate-700' : 'hover:shadow-md transition-shadow'}`}>
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-base font-bold">{template.title}</CardTitle>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setCurrentTemplate(template); setIsEditing(true); }}>
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => {
                                        if(confirm('Delete template?')) deleteTemplateMutation.mutate(template.id);
                                    }}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex gap-2 text-xs mt-1">
                                {template.customer_segment && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{template.customer_segment}</span>}
                                {template.product_type && <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">{template.product_type}</span>}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1">
                                {(template.items || []).slice(0, 3).map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-500">
                                        <CheckSquare className="w-3 h-3" />
                                        <span className="truncate">{typeof item === 'object' ? item.text : item}</span>
                                    </div>
                                ))}
                                {(template.items || []).length > 3 && (
                                    <p className="text-xs text-slate-400 pl-5">+{template.items.length - 3} more items</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {templates.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-500 border-2 border-dashed rounded-xl">
                        No templates found. Create your first onboarding checklist template.
                    </div>
                )}
            </div>
        </div>
    );
}