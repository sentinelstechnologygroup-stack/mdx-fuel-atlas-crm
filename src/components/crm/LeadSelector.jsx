import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, Loader2, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { useSettings } from "@/components/context/SettingsContext";

export default function LeadSelector({ onSelect }) {
    const { theme } = useSettings();
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    const { data: leads, isLoading } = useQuery({
        queryKey: ['lead-search', debouncedSearch],
        queryFn: async () => {
            // If search is empty, return recent leads
            if (!debouncedSearch) return base44.entities.Lead.list('created_date', 10);
            
            // Filter locally if regex not supported or list all
            const all = await base44.entities.Lead.list();
            return all.filter(l => 
                l.full_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                l.phone_number?.includes(debouncedSearch)
            ).slice(0, 10);
        },
        enabled: true
    });

    return (
        <div className={`space-y-3 p-4 rounded-xl border mb-6 transition-colors ${
            theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
        }`}>
            <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-full ${theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'}`}>
                    <User className={`w-4 h-4 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
                </div>
                <h3 className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Select Lead to Link (Required)</h3>
            </div>
            
            <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                <Input 
                    placeholder="Search by name or phone..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`pl-9 transition-colors ${
                        theme === 'dark' 
                            ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500' 
                            : 'bg-white border-slate-200'
                    }`}
                />
            </div>

            <div className={`space-y-2 max-h-60 overflow-y-auto custom-scrollbar`}>
                {isLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                ) : leads?.length > 0 ? (
                    leads.map(lead => (
                        <Card 
                            key={lead.id} 
                            className={`p-3 cursor-pointer transition-all flex justify-between items-center group border ${
                                theme === 'dark' 
                                    ? 'bg-slate-900 border-slate-700 hover:border-cyan-500 hover:bg-slate-800' 
                                    : 'bg-white border-slate-200 hover:border-red-300'
                            }`}
                            onClick={() => onSelect(lead)}
                        >
                            <div>
                                <div className={`font-bold text-sm transition-colors ${
                                    theme === 'dark' ? 'text-white group-hover:text-cyan-400' : 'text-slate-800 group-hover:text-red-700'
                                }`}>{lead.full_name}</div>
                                <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {lead.phone_number} • {lead.city || 'No city'}
                                </div>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                                <Check className={`w-4 h-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-green-600'}`} />
                            </Button>
                        </Card>
                    ))
                ) : (
                    <div className={`text-center text-xs py-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>No results found</div>
                )}
            </div>
        </div>
    );
}