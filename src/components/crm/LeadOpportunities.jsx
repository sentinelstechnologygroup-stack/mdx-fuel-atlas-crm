import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/components/context/SettingsContext";

export default function LeadOpportunities({ lead, theme }) {
    const { data: opportunities } = useQuery({
        queryKey: ['lead_opportunities', lead?.id],
        queryFn: () => base44.entities.Opportunity.filter({ lead_id: lead.id }, '-created_date', 50),
        enabled: !!lead?.id
    });

    if (!opportunities || opportunities.length === 0) {
        return (
            <div className={`text-center py-10 text-slate-400 border-2 border-dashed rounded-xl ${theme === 'dark' ? 'border-slate-700' : ''}`}>
                <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No open opportunities for this lead</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {opportunities.map((opp) => (
                <div key={opp.id} className={`p-4 border rounded-xl shadow-sm flex justify-between items-center transition-colors ${
                    theme === 'dark' 
                        ? 'bg-slate-800 border-slate-700 hover:border-cyan-500' 
                        : 'bg-white border-slate-200 hover:border-red-200'
                }`}>
                    <div>
                        <h4 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{opp.product_type}</h4>
                        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Stage: {opp.deal_stage}</p>
                    </div>
                    <div className="text-left">
                        <div className={`font-mono font-bold ${theme === 'dark' ? 'text-cyan-400' : 'text-red-700'}`}>${opp.amount?.toLocaleString()}</div>
                        <Badge variant="outline" className={`mt-1 ${theme === 'dark' ? 'border-slate-600 text-slate-300' : ''}`}>{opp.probability}% Probability</Badge>
                    </div>
                </div>
            ))}
        </div>
    );
}