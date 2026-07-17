import React, { useState } from 'react';
import { useSettings } from '@/components/context/SettingsContext';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, X } from "lucide-react";

export default function PipelineSettings() {
    const { pipelineStages, saveSettings, isLoading, theme } = useSettings();
    const [localStages, setLocalStages] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    React.useEffect(() => {
        if (pipelineStages) setLocalStages(JSON.parse(JSON.stringify(pipelineStages)));
    }, [pipelineStages]);

    const handleSave = () => {
        setIsSaving(true);
        saveSettings({
            pipeline_stages: localStages
        }, {
            onSuccess: () => {
                setIsSaving(false);
            }
        });
    };

    const updateLocalStage = (index, field, value) => {
        const newStages = [...localStages];
        newStages[index][field] = value;
        setLocalStages(newStages);
    };

    if (isLoading) return <div className="p-10 text-center text-slate-400">Loading stages...</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end">
                <div>
                     <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Pipeline Stages</h2>
                     <p className={`${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'} text-sm`}>Define the stages a lead goes through until closing</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="bg-slate-900 text-white">
                    {isSaving ? "Saving..." : "Save Changes"}
                    <Save className="w-4 h-4 ml-2" />
                </Button>
            </div>

            <div className="space-y-4">
                {localStages.map((stage, index) => (
                    <Card key={index} className={`overflow-hidden shadow-sm hover:shadow-md transition-shadow ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className={`h-1 w-full ${stage.color}`}></div>
                        <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                                <div className={`w-8 h-8 rounded-full ${stage.light} flex items-center justify-center font-bold text-sm shrink-0`}>
                                    {index + 1}
                                </div>
                                
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-600 dark:text-slate-400">Stage Name</Label>
                                        <Input 
                                            value={stage.label} 
                                            onChange={(e) => updateLocalStage(index, 'label', e.target.value)}
                                            className={`h-9 font-medium ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : ''}`}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-600 dark:text-slate-400">Automated Tasks (Checklist)</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {stage.checklist?.map((item, i) => (
                                                <Badge key={i} variant="secondary" className={`font-normal flex gap-1 items-center ${theme === 'dark' ? 'bg-slate-900 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                    {item.text}
                                                    <button 
                                                        onClick={() => {
                                                            const newStages = [...localStages];
                                                            newStages[index].checklist.splice(i, 1);
                                                            setLocalStages(newStages);
                                                        }}
                                                        className="hover:text-red-500 transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                            <Button 
                                                variant="ghost" size="sm" className={`h-6 text-xs px-2 border border-dashed hover:text-blue-600 ${theme === 'dark' ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500'}`}
                                                onClick={() => {
                                                    const text = prompt("Enter task name:");
                                                    if (text) {
                                                        const newStages = [...localStages];
                                                        if (!newStages[index].checklist) newStages[index].checklist = [];
                                                        newStages[index].checklist.push({ id: Date.now().toString(), text });
                                                        setLocalStages(newStages);
                                                    }
                                                }}
                                            >
                                                <Plus className="w-3 h-3 mr-1" /> Add
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}