import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from "@/components/context/SettingsContext";

export default function AddWidgetDialog({ open, onOpenChange, onSave }) {
    const { theme } = useSettings();
    const [formData, setFormData] = useState({
        title: '',
        type: 'bar_chart',
        entity_type: 'Opportunity',
        xAxis: ''
    });

    const entityFields = {
        'Opportunity': ['deal_stage', 'product_type', 'main_pain_point', 'source_year'],
        'Lead': ['lead_status', 'source_year', 'city', 'lead_temperature'],
        'Task': ['status', 'priority', 'assigned_to'],
        'Activity': ['type', 'status']
    };

    const handleSave = () => {
        if (!formData.title || !formData.xAxis) return;
        
        onSave({
            name: formData.title,
            type: formData.type,
            entity_type: formData.entity_type,
            config: {
                xAxis: formData.xAxis,
                aggregation: 'count'
            },
            show_on_dashboard: true
        });
        onOpenChange(false);
        setFormData({ title: '', type: 'bar_chart', entity_type: 'Opportunity', xAxis: '' });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`sm:max-w-[500px] ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white'}`}>
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Add New Widget</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="title" className={theme === 'dark' ? 'text-slate-300' : ''}>Title</Label>
                        <Input
                            id="title"
                            placeholder="E.g. Sales by Stage"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label className={theme === 'dark' ? 'text-slate-300' : ''}>Data Source</Label>
                            <Select 
                                value={formData.entity_type} 
                                onValueChange={(val) => setFormData({ ...formData, entity_type: val, xAxis: '' })}
                            >
                                <SelectTrigger className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                                    <SelectItem value="Opportunity">Opportunities</SelectItem>
                                    <SelectItem value="Lead">Leads</SelectItem>
                                    <SelectItem value="Task">Tasks</SelectItem>
                                    <SelectItem value="Activity">Activities</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className={theme === 'dark' ? 'text-slate-300' : ''}>Chart Type</Label>
                            <Select 
                                value={formData.type} 
                                onValueChange={(val) => setFormData({ ...formData, type: val })}
                            >
                                <SelectTrigger className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                                    <SelectItem value="bar_chart">Bar Chart</SelectItem>
                                    <SelectItem value="pie_chart">Pie Chart</SelectItem>
                                    <SelectItem value="line_chart">Line Chart</SelectItem>
                                    <SelectItem value="kpi_card">KPI Card</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label className={theme === 'dark' ? 'text-slate-300' : ''}>Group By (X Axis)</Label>
                        <Select 
                            value={formData.xAxis} 
                            onValueChange={(val) => setFormData({ ...formData, xAxis: val })}
                        >
                            <SelectTrigger className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                                <SelectValue placeholder="Select Field..." />
                            </SelectTrigger>
                            <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                                {entityFields[formData.entity_type]?.map(field => (
                                    <SelectItem key={field} value={field}>
                                        {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : ''}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} className="bg-white text-slate-900 hover:bg-slate-100">
                        Save Widget
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}