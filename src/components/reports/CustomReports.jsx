import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Download, Trash2, FileText } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";

// Helper to export to CSV
const exportToCSV = (data, filename) => {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(fieldName => {
            let val = row[fieldName];
            if (val === null || val === undefined) val = '';
            val = String(val).replace(/"/g, '""');
            if (val.includes(',')) val = `"${val}"`;
            return val;
        }).join(','))
    ].join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
};

export default function CustomReports() {
    const { theme } = useSettings();
    const [isCreating, setIsCreating] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const queryClient = useQueryClient();

    // Fetch saved reports
    const { data: savedReports, isLoading: loadingReports } = useQuery({
        queryKey: ['report_configs'],
        queryFn: () => base44.entities.ReportConfig.filter({ type: 'table' }),
        initialData: []
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.ReportConfig.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['report_configs']);
            if (selectedReport?.id) setSelectedReport(null);
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Custom Reports</h2>
                <Button onClick={() => setIsCreating(true)} className="bg-red-600 hover:bg-red-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Report
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Sidebar: Saved Reports List */}
                <Card className={`md:col-span-1 h-fit ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}`}>
                    <CardHeader>
                        <CardTitle className={`text-lg ${theme === 'dark' ? 'text-white' : ''}`}>My Reports</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {loadingReports ? <Loader2 className="animate-spin mx-auto" /> : 
                        savedReports.length === 0 ? <p className="text-sm text-slate-400">No saved reports</p> :
                        savedReports.map(report => (
                            <div 
                                key={report.id} 
                                onClick={() => setSelectedReport(report)}
                                className={`p-3 rounded-lg cursor-pointer border transition-colors flex justify-between items-center group ${
                                    selectedReport?.id === report.id 
                                        ? (theme === 'dark' ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-red-50 border-red-200 text-red-700')
                                        : (theme === 'dark' ? 'hover:bg-slate-700 border-transparent text-slate-300' : 'hover:bg-slate-50 border-transparent')
                                }`}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText className="w-4 h-4 flex-shrink-0" />
                                    <span className="truncate text-sm font-medium">{report.name}</span>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if(confirm('Delete this report?')) deleteMutation.mutate(report.id);
                                    }}
                                >
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Main Content: Report Viewer or Creator */}
                <Card className={`md:col-span-3 min-h-[500px] ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}`}>
                    <CardContent className="p-6">
                        {isCreating ? (
                            <ReportEditor 
                                onCancel={() => setIsCreating(false)} 
                                onSave={() => {
                                    setIsCreating(false);
                                    queryClient.invalidateQueries(['report_configs']);
                                }} 
                            />
                        ) : selectedReport ? (
                            <ReportViewer report={selectedReport} />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
                                <FileText className="w-16 h-16 mb-4 opacity-20" />
                                <p>Select a report from the list or create a new one</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function ReportEditor({ onCancel, onSave }) {
    const { theme } = useSettings();
    const [config, setConfig] = useState({
        name: "",
        type: "table",
        entity_type: "Lead",
        config: { fields: [] }
    });
    const [schema, setSchema] = useState(null);

    useEffect(() => {
        async function fetchSchema() {
            try {
                let s = null;
                try {
                    s = await base44.entities[config.entity_type].schema();
                } catch (err) {}

                if (!s || !s.properties || Object.keys(s.properties).length === 0) {
                    try {
                        const items = await base44.entities[config.entity_type].list(1);
                        if (items && items.length > 0) {
                            const props = {};
                            Object.keys(items[0]).forEach(key => {
                                props[key] = { description: key };
                            });
                            s = { properties: props };
                        }
                    } catch (e) {}
                }
                setSchema(s);
            } catch (e) {}
        }
        fetchSchema();
    }, [config.entity_type]);

    const saveMutation = useMutation({
        mutationFn: (data) => base44.entities.ReportConfig.create(data),
        onSuccess: onSave
    });

    const toggleField = (field) => {
        const current = config.config.fields || [];
        const next = current.includes(field) ? current.filter(f => f !== field) : [...current, field];
        setConfig({ ...config, config: { ...config.config, fields: next } });
    };

    const availableFields = schema ? Object.keys(schema.properties) : [];

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className={`flex justify-between items-center border-b pb-4 ${theme === 'dark' ? 'border-slate-700' : ''}`}>
                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : ''}`}>Create New Report</h3>
                <Button variant="ghost" onClick={onCancel} className={theme === 'dark' ? 'text-slate-300 hover:text-white hover:bg-slate-700' : ''}>Cancel</Button>
            </div>

            <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className={theme === 'dark' ? 'text-slate-300' : ''}>Report Name</Label>
                        <Input 
                            value={config.name} 
                            onChange={e => setConfig({...config, name: e.target.value})} 
                            placeholder="E.g., New leads this week" 
                            className={theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500' : ''}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className={theme === 'dark' ? 'text-slate-300' : ''}>Source Entity</Label>
                        <Select value={config.entity_type} onValueChange={v => setConfig({...config, entity_type: v, config: { fields: [] }})}>
                            <SelectTrigger className={theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : ''}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                                <SelectItem value="Lead">Leads</SelectItem>
                                <SelectItem value="Opportunity">Opportunities</SelectItem>
                                <SelectItem value="Task">Tasks</SelectItem>
                                <SelectItem value="Activity">Activities</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className={theme === 'dark' ? 'text-slate-300' : ''}>Fields to Display (Select at least one)</Label>
                    <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border rounded-lg max-h-60 overflow-y-auto ${theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50'}`}>
                        {availableFields.map(field => (
                            <div key={field} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={field} 
                                    checked={config.config.fields?.includes(field)}
                                    onCheckedChange={() => toggleField(field)}
                                    className={theme === 'dark' ? 'border-slate-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600' : ''}
                                />
                                <Label htmlFor={field} className={`text-sm cursor-pointer font-normal ${theme === 'dark' ? 'text-slate-300' : ''}`}>
                                    {schema?.properties[field]?.description || field}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button 
                        onClick={() => saveMutation.mutate(config)} 
                        disabled={!config.name || config.config.fields?.length === 0 || saveMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save & Create Report
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ReportViewer({ report }) {
    const { theme } = useSettings();
    const { data, isLoading } = useQuery({
        queryKey: ['report_data', report.id],
        queryFn: () => base44.entities[report.entity_type].list(),
    });

    if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

    const fields = report.config.fields || [];
    const displayData = data?.map(item => {
        const row = {};
        fields.forEach(f => row[f] = item[f]);
        return row;
    }) || [];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : ''}`}>{report.name}</h3>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Source: {report.entity_type} | {displayData.length} records</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.print()} className={theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white' : ''}>
                        Print PDF
                    </Button>
                    <Button variant="outline" onClick={() => exportToCSV(displayData, report.name)} className={theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white' : ''}>
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className={theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}>
                            <TableRow className={theme === 'dark' ? 'border-slate-700' : ''}>
                                {fields.map(f => <TableHead key={f} className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>{f}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayData.slice(0, 50).map((row, i) => (
                                <TableRow key={i} className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-700/50' : ''}>
                                    {fields.map(f => <TableCell key={f} className={theme === 'dark' ? 'text-slate-300' : ''}>{String(row[f] || '-')}</TableCell>)}
                                </TableRow>
                            ))}
                            {displayData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={fields.length} className={`text-center py-8 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                                        No data to display
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            {displayData.length > 50 && <p className={`text-xs text-center mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Showing first 50 records</p>}
        </div>
    );
}