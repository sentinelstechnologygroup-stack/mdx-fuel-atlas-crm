import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useSettings } from '@/components/context/SettingsContext';

export default function AuditLogSettings() {
    const { theme } = useSettings();
    const [searchTerm, setSearchTerm] = useState("");
    
    // In a real scenario, we would use backend filtering, but for now fetching all (usually limited by default)
    const { data: logs, isLoading } = useQuery({
        queryKey: ['audit_logs'],
        queryFn: () => base44.entities.AuditLog.list('-timestamp', 50),
        initialData: []
    });

    const filteredLogs = logs.filter(log => 
        (log.user_email && log.user_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.action && log.action.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.entity && log.entity.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                <CardHeader>
                    <CardTitle className={theme === 'dark' ? 'text-white' : ''}>System Audit Log</CardTitle>
                    <CardDescription className={theme === 'dark' ? 'text-slate-400' : ''}>Track changes and actions performed in the system</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                                placeholder="Search by user, action or entity..." 
                                className={`pl-10 ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : ''}`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={`rounded-md border ${theme === 'dark' ? 'border-slate-700' : ''}`}>
                        <Table>
                            <TableHeader>
                                <TableRow className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : ''}>
                                    <TableHead className="text-left w-[180px] text-slate-700 dark:text-slate-300">Date & Time</TableHead>
                                    <TableHead className="text-left text-slate-700 dark:text-slate-300">User</TableHead>
                                    <TableHead className="text-left text-slate-700 dark:text-slate-300">Action</TableHead>
                                    <TableHead className="text-left text-slate-700 dark:text-slate-300">Entity</TableHead>
                                    <TableHead className="text-left text-slate-700 dark:text-slate-300">Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className={`text-center py-8 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                            No records found
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLogs.map((log) => (
                                    <TableRow key={log.id} className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-700/50' : ''}>
                                        <TableCell className="text-slate-600 dark:text-slate-400 font-mono text-xs">
                                            {log.timestamp ? format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm') : '-'}
                                        </TableCell>
                                        <TableCell className={`font-medium ${theme === 'dark' ? 'text-slate-200' : ''}`}>{log.user_email}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${theme === 'dark' ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                                                {log.action}
                                            </span>
                                        </TableCell>
                                        <TableCell className={theme === 'dark' ? 'text-slate-300' : ''}>{log.entity} #{log.entity_id}</TableCell>
                                        <TableCell className={`max-w-xs truncate text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} title={log.details}>
                                            {log.details}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}