import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CheckSquare, Phone, CalendarDays, ListTodo, X, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/components/context/SettingsContext";

export default function ActivityReport({ tasks, activities, leads, users, timeRange }) {
  const { theme } = useSettings();
  const [selectedType, setSelectedType] = useState(null);

  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [activities]);
  
  const stats = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const pendingTasks = tasks.filter(t => t.status !== 'done').length;
    const calls = activities.filter(a => a.type === 'Call').length;
    const meetings = activities.filter(a => a.type === 'Meeting').length;
    
    return { completedTasks, pendingTasks, calls, meetings, totalActivities: activities.length };
  }, [tasks, activities]);

  const activityTypeData = useMemo(() => {
    const counts = {};
    const typeMapping = { 'Call': 'Calls', 'Meeting': 'Meetings', 'Email': 'Emails', 'Note': 'Notes', 'SMS': 'SMS', 'Document Collection': 'Documents' };
    
    // Color mapping for distinct activity types
    const colorMapping = {
      'Calls': '#3B82F6',      // Blue
      'Meetings': '#8B5CF6',   // Violet
      'Emails': '#F59E0B',     // Amber
      'Notes': '#64748B',      // Slate
      'SMS': '#EC4899',        // Pink
      'Documents': '#10B981',  // Emerald
      'Other': '#94A3B8'       // Gray
    };

    activities.forEach(a => {
        const type = typeMapping[a.type] || 'Other';
        counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ 
      name, 
      value,
      fill: colorMapping[name] || colorMapping['Other']
    }));
  }, [activities]);

  const getActivitiesByType = (typeName) => {
      const typeMappingReverse = { 'Calls': 'Call', 'Meetings': 'Meeting', 'Emails': 'Email', 'Notes': 'Note', 'SMS': 'SMS', 'Documents': 'Document Collection' };
      const targetType = typeMappingReverse[typeName];
      if (!targetType) return [];
      return sortedActivities.filter(a => a.type === targetType);
  };

  const getUserName = (email) => {
      const u = users?.find(user => user.email === email);
      return u ? u.full_name : email;
  };

  const getLeadName = (leadId) => {
      const l = leads?.find(lead => lead.id === leadId);
      return l ? l.full_name : 'Unknown';
  };

  const getStatusColor = (status) => {
    const s = status || '';
    if (s === 'No Answer') return theme === 'dark' ? "text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.6)]" : "text-red-600";
    if (s === 'Completed' || s === 'Answered') return theme === 'dark' ? "text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.6)]" : "text-emerald-600";
    if (s === 'Left Message') return theme === 'dark' ? "text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.6)]" : "text-amber-600";
    if (s === 'Scheduled') return theme === 'dark' ? "text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.6)]" : "text-blue-600";
    return theme === 'dark' ? "text-slate-200" : "text-slate-700";
  };

  const getStatusBadge = (status) => {
    const s = status || '';
    let className = "";
    
    if (s === 'No Answer') {
        className = theme === 'dark' 
            ? "bg-red-950/40 text-red-300 border-red-800 ring-1 ring-red-500/50 shadow-[0_0_8px_rgba(248,113,113,0.2)]" 
            : "bg-red-100 text-red-700 border-red-200";
    } else if (s === 'Completed' || s === 'Answered') {
        className = theme === 'dark' 
            ? "bg-emerald-950/40 text-emerald-300 border-emerald-800 ring-1 ring-emerald-500/50 shadow-[0_0_8px_rgba(52,211,153,0.2)]"
            : "bg-emerald-100 text-emerald-700 border-emerald-200";
    } else if (s === 'Left Message') {
        className = theme === 'dark'
            ? "bg-amber-950/40 text-amber-300 border-amber-800 ring-1 ring-amber-500/50 shadow-[0_0_8px_rgba(251,191,36,0.2)]"
            : "bg-amber-100 text-amber-700 border-amber-200";
    } else if (s === 'Scheduled') {
        className = theme === 'dark'
            ? "bg-blue-950/40 text-blue-300 border-blue-800 ring-1 ring-blue-500/50 shadow-[0_0_8px_rgba(96,165,250,0.2)]"
            : "bg-blue-100 text-blue-700 border-blue-200";
    } else {
        className = theme === 'dark' ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500";
    }

    return (
        <Badge variant="outline" className={`${className} border`}>
            {s}
        </Badge>
    );
  };

  const groupedActivities = useMemo(() => {
      const groups = {
          'Call': [],
          'Meeting': [],
          'Email': [],
          'SMS': [],
          'Note': [],
          'Other': []
      };
      
      sortedActivities.forEach(act => {
          if (groups[act.type]) {
              groups[act.type].push(act);
          } else {
              groups['Other'].push(act);
          }
      });
      return groups;
  }, [sortedActivities]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : ''}`}>Completed Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : ''}`}>{stats.completedTasks}</div>
          </CardContent>
        </Card>
        
        <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : ''}`}>Open Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : ''}`}>{stats.pendingTasks}</div>
          </CardContent>
        </Card>

        <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : ''}`}>Calls Made</CardTitle>
            <Phone className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : ''}`}>{stats.calls}</div>
          </CardContent>
        </Card>

        <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : ''}`}>Meetings Held</CardTitle>
            <CalendarDays className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : ''}`}>{stats.meetings}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
          <CardHeader>
            <CardTitle className={theme === 'dark' ? 'text-white' : ''}>Activity Type Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityTypeData} onClick={(data) => {
                  if (data && data.activePayload && data.activePayload[0]) {
                      setSelectedType(data.activePayload[0].payload.name);
                  }
              }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="name" stroke={theme === 'dark' ? '#9ca3af' : '#666'} />
                <YAxis stroke={theme === 'dark' ? '#9ca3af' : '#666'} />
                <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', color: theme === 'dark' ? '#fff' : '#000', border: 'none' }} />
                <Bar dataKey="value" name="Count" cursor="pointer">
                  {activityTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
            <CardHeader>
                <CardTitle className={theme === 'dark' ? 'text-white' : ''}>Recent Activities</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 max-h-[260px] overflow-y-auto pr-2">
                    {sortedActivities.slice(0, 5).map((act, i) => {
                        const leadName = getLeadName(act.lead_id);
                        const statusColor = getStatusColor(act.status);
                        
                        return (
                            <div key={i} className={`flex items-center justify-between border-b pb-3 last:border-0 p-1 rounded-lg transition-colors ${theme === 'dark' ? 'border-slate-700 hover:bg-slate-700' : 'hover:bg-slate-50'}`}>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`font-bold text-sm flex items-center gap-1.5 ${statusColor}`}>
                                            {act.type === 'Call' ? <Phone className="w-3.5 h-3.5" /> : 
                                             act.type === 'Meeting' ? <CalendarDays className="w-3.5 h-3.5" /> : 
                                             <ListTodo className="w-3.5 h-3.5" />}
                                            {act.type}
                                        </div>
                                        <span className="text-xs text-slate-400">•</span>
                                        <a 
                                            href={`/LeadDetails?id=${act.lead_id}`}
                                            className={`text-xs font-medium hover:underline cursor-pointer ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                                        >
                                            {leadName}
                                        </a>
                                    </div>
                                    <p className="text-xs text-slate-500 truncate w-40 md:w-56" title={act.summary}>{act.summary}</p>
                                </div>
                                <div className="text-right">
                                    <div className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                        {act.date ? new Date(act.date).toLocaleDateString('en-US') : '-'}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                        {act.date ? new Date(act.date).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'}) : ''}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {activities.length === 0 && <p className="text-center text-slate-500 py-4">No activities to show</p>}
                </div>
            </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedType} onOpenChange={(open) => !open && setSelectedType(null)}>
        <DialogContent className={`max-w-4xl max-h-[80vh] flex flex-col ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : ''}`}>
            <DialogHeader>
                <DialogTitle>Activity Details: {selectedType}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader className={theme === 'dark' ? 'bg-slate-800' : ''}>
                        <TableRow className={theme === 'dark' ? 'border-slate-700' : ''}>
                            <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Date</TableHead>
                            <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Client</TableHead>
                            <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Performed By</TableHead>
                            <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Details</TableHead>
                            <TableHead className={`text-left ${theme === 'dark' ? 'text-slate-400' : ''}`}>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {selectedType && getActivitiesByType(selectedType).map((act) => (
                            <TableRow key={act.id} className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : ''}>
                                <TableCell className={theme === 'dark' ? 'text-slate-300' : ''}>{new Date(act.date).toLocaleDateString('en-US')} {new Date(act.date).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</TableCell>
                                <TableCell className={`font-medium ${theme === 'dark' ? 'text-white' : ''}`}>{getLeadName(act.lead_id)}</TableCell>
                                <TableCell className={theme === 'dark' ? 'text-slate-300' : ''}>{getUserName(act.created_by)}</TableCell>
                                <TableCell className={`max-w-xs truncate ${theme === 'dark' ? 'text-slate-400' : ''}`} title={act.summary}>{act.summary}</TableCell>
                                <TableCell>{getStatusBadge(act.status)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </div>
            </div>
            <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setSelectedType(null)} className={theme === 'dark' ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : ''}>Close</Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* Detailed Activity Log - Grouped by Type */}
      <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
          <CardHeader>
              <CardTitle className={theme === 'dark' ? 'text-white' : ''}>Detailed Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="rounded-md border overflow-hidden">
                  <Table>
                      <TableHeader className={theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}>
                          <TableRow className={theme === 'dark' ? 'border-slate-700' : ''}>
                              <TableHead className={theme === 'dark' ? 'text-slate-400' : ''}>Date</TableHead>
                              <TableHead className={theme === 'dark' ? 'text-slate-400' : ''}>Client</TableHead>
                              <TableHead className={theme === 'dark' ? 'text-slate-400' : ''}>Details</TableHead>
                              <TableHead className={theme === 'dark' ? 'text-slate-400' : ''}>Status</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {['Call', 'Meeting', 'Email', 'SMS', 'Note'].map(type => {
                              const acts = groupedActivities[type];
                              if (!acts || acts.length === 0) return null;
                              
                              return (
                                  <React.Fragment key={type}>
                                      <TableRow className={`hover:bg-transparent ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/50'}`}>
                                          <TableCell colSpan={4} className="font-bold py-2">
                                              <div className="flex items-center gap-2">
                                                  {type === 'Call' && <Phone className="w-4 h-4 text-blue-500" />}
                                                  {type === 'Meeting' && <CalendarDays className="w-4 h-4 text-purple-500" />}
                                                  <span className={theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}>{type}s</span>
                                                  <Badge variant="secondary" className="ml-2">{acts.length}</Badge>
                                              </div>
                                          </TableCell>
                                      </TableRow>
                                      {acts.map(act => (
                                          <TableRow key={act.id} className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-700/50' : ''}>
                                              <TableCell className={theme === 'dark' ? 'text-slate-300' : ''}>
                                                  {new Date(act.date).toLocaleDateString('en-US')}
                                                  <span className="block text-xs text-slate-500">{new Date(act.date).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</span>
                                              </TableCell>
                                              <TableCell className={`font-medium ${theme === 'dark' ? 'text-white' : ''}`}>
                                                  {getLeadName(act.lead_id)}
                                              </TableCell>
                                              <TableCell className={`max-w-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                  {act.summary}
                                              </TableCell>
                                              <TableCell>
                                                  {getStatusBadge(act.status)}
                                              </TableCell>
                                          </TableRow>
                                      ))}
                                  </React.Fragment>
                              );
                          })}
                      </TableBody>
                  </Table>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}