import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, BarChart3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, LineChart as ReLineChart, Line 
} from 'recharts';
import { useSettings } from "@/components/context/SettingsContext";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function CustomDashboard() {
    const { theme } = useSettings();
    const queryClient = useQueryClient();
    const [isAddingWidget, setIsAddingWidget] = useState(false);

    const { data: widgets, isLoading } = useQuery({
        queryKey: ['dashboard_widgets'],
        queryFn: () => base44.entities.ReportConfig.filter({ type: { $in: ['bar_chart', 'pie_chart', 'line_chart', 'kpi_card'] } }),
        initialData: []
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.ReportConfig.delete(id),
        onSuccess: () => queryClient.invalidateQueries(['dashboard_widgets'])
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : ''}`}>Visual Dashboard</h2>
                    <p className={`text-slate-500 ${theme === 'dark' ? 'text-slate-400' : ''}`}>Custom KPIs and Charts</p>
                </div>
                <Button onClick={() => setIsAddingWidget(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Widget
                </Button>
            </div>

            {isLoading ? <Loader2 className="animate-spin mx-auto mt-20" /> :
             widgets.length === 0 ? (
                <div className={`text-center py-20 border-2 border-dashed rounded-xl ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/50'}`}>
                    <BarChart3 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Dashboard Empty</h3>
                    <p className="text-slate-500 mb-6">Add charts and metrics to track important performance indicators</p>
                    <Button onClick={() => setIsAddingWidget(true)}>Add First Widget</Button>
                </div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {widgets.map(widget => (
                        <DashboardWidget 
                            key={widget.id} 
                            config={widget} 
                            onDelete={() => {
                                if(confirm('Delete this widget?')) deleteMutation.mutate(widget.id);
                            }} 
                        />
                    ))}
                </div>
             )}

             <Dialog open={isAddingWidget} onOpenChange={setIsAddingWidget}>
                <DialogContent className={`max-w-2xl ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : ''}`}>
                    <WidgetBuilder onSave={() => {
                        setIsAddingWidget(false);
                        queryClient.invalidateQueries(['dashboard_widgets']);
                    }} onCancel={() => setIsAddingWidget(false)} />
                </DialogContent>
             </Dialog>
        </div>
    );
}

function WidgetBuilder({ onSave, onCancel }) {
    const { theme } = useSettings();
    const [config, setConfig] = useState({
        name: "",
        type: "bar_chart",
        entity_type: "Opportunity",
        config: { groupBy: "", metric: "count" }
    });
    const [schema, setSchema] = useState(null);

    useEffect(() => {
        async function fetchSchema() {
            try {
                let s = null;
                try { s = await base44.entities[config.entity_type].schema(); } catch (err) {}
                if (!s || !s.properties) {
                     const items = await base44.entities[config.entity_type].list(1);
                     if (items && items.length > 0) {
                         const props = {};
                         Object.keys(items[0]).forEach(key => { props[key] = { description: key }; });
                         s = { properties: props };
                     }
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

    const fields = schema ? Object.keys(schema.properties) : [];

    return (
        <div className="space-y-4">
            <DialogHeader>
                <DialogTitle>Add New Widget</DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className={theme === 'dark' ? 'text-slate-300' : ''}>Title</Label>
                    <Input 
                        value={config.name} 
                        onChange={e => setConfig({...config, name: e.target.value})} 
                        placeholder="E.g. Sales by Stage" 
                        className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : ''}
                    />
                </div>
                <div className="space-y-2">
                    <Label className={theme === 'dark' ? 'text-slate-300' : ''}>Chart Type</Label>
                    <Select value={config.type} onValueChange={v => setConfig({...config, type: v})}>
                        <SelectTrigger className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}><SelectValue /></SelectTrigger>
                        <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                            <SelectItem value="bar_chart">Bar Chart</SelectItem>
                            <SelectItem value="pie_chart">Pie Chart</SelectItem>
                            <SelectItem value="line_chart">Line Chart</SelectItem>
                            <SelectItem value="kpi_card">KPI Card</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className={theme === 'dark' ? 'text-slate-300' : ''}>Data Source</Label>
                    <Select value={config.entity_type} onValueChange={v => setConfig({...config, entity_type: v})}>
                        <SelectTrigger className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}><SelectValue /></SelectTrigger>
                        <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                            <SelectItem value="Lead">Leads</SelectItem>
                            <SelectItem value="Opportunity">Opportunities</SelectItem>
                            <SelectItem value="Task">Tasks</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className={theme === 'dark' ? 'text-slate-300' : ''}>Group By (X Axis)</Label>
                    <Select value={config.config.groupBy} onValueChange={v => setConfig({...config, config: {...config.config, groupBy: v}})}>
                        <SelectTrigger className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}><SelectValue placeholder="Select Field..." /></SelectTrigger>
                        <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
                            {fields.map(f => <SelectItem key={f} value={f}>{schema?.properties[f]?.description || f}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={onCancel} className={theme === 'dark' ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : ''}>Cancel</Button>
                <Button onClick={() => saveMutation.mutate(config)} disabled={!config.name || !config.config.groupBy}>
                    {saveMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                    Save Widget
                </Button>
            </div>
        </div>
    );
}

function DashboardWidget({ config, onDelete }) {
    const { theme } = useSettings();
    const { data, isLoading } = useQuery({
        queryKey: ['widget_data', config.id],
        queryFn: async () => {
            const items = await base44.entities[config.entity_type].list();
            const groupBy = config.config.groupBy;
            const groups = {};
            items.forEach(item => {
                const key = String(item[groupBy] || 'Unknown');
                if (!groups[key]) groups[key] = 0;
                groups[key]++;
            });
            return Object.entries(groups).map(([name, value]) => ({ name, value }));
        }
    });

    return (
        <Card className={`h-80 flex flex-col relative group ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className={`text-base font-bold ${theme === 'dark' ? 'text-white' : ''}`}>{config.name}</CardTitle>
                <Button 
                    variant="ghost" size="icon" 
                    className="h-6 w-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                    <Trash2 className="w-3 h-3" />
                </Button>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                {isLoading ? <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div> :
                 data.length === 0 ? <div className="flex h-full items-center justify-center text-slate-400 text-sm">No Data</div> :
                 (
                    <ResponsiveContainer width="100%" height="100%">
                        {config.type === 'bar_chart' ? (
                            <ReBarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e5e7eb'} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke={theme === 'dark' ? '#94a3b8' : '#666'} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} stroke={theme === 'dark' ? '#94a3b8' : '#666'} />
                                <ReTooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', color: theme === 'dark' ? '#fff' : '#000', border: 'none' }} />
                                <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </ReBarChart>
                        ) : config.type === 'pie_chart' ? (
                            <RePieChart>
                                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <ReTooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', color: theme === 'dark' ? '#fff' : '#000', border: 'none' }} />
                            </RePieChart>
                        ) : (
                             <ReLineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e5e7eb'} />
                                <XAxis dataKey="name" stroke={theme === 'dark' ? '#94a3b8' : '#666'} />
                                <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#666'} />
                                <ReTooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', color: theme === 'dark' ? '#fff' : '#000', border: 'none' }} />
                                <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
                            </ReLineChart>
                        )}
                    </ResponsiveContainer>
                 )
                }
            </CardContent>
        </Card>
    );
}