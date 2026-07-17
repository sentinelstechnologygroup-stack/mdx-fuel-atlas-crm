import React from "react";
import { Clock, User as UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSettings } from "@/components/context/SettingsContext";
import moment from "moment";

export default function LastTouchInfo({ entity, entityType = "Lead" }) {
    const { theme } = useSettings();
    const { data: updatedByUser } = useQuery({
        queryKey: ['user', entity?.updated_by],
        queryFn: async () => {
            if (!entity?.updated_by) return null;
            const users = await base44.entities.User.list();
            return users.find(u => u.email === entity.updated_by);
        },
        enabled: !!entity?.updated_by
    });

    if (!entity?.updated_date) return null;

    const displayName = updatedByUser?.full_name || entity?.updated_by || "Unknown";
    const timeAgo = moment(entity.updated_date).fromNow();
    const fullDate = moment(entity.updated_date).format("DD/MM/YYYY HH:mm");

    return (
        <div className={`border rounded-xl p-4 flex items-center justify-between transition-colors ${
            theme === 'dark' 
                ? 'bg-slate-900 border-slate-700' 
                : 'bg-slate-50 border-slate-200'
        }`}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${theme === 'dark' ? 'bg-cyan-950/50 border border-cyan-900/50' : 'bg-blue-100'}`}>
                    <Clock className={`w-4 h-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`} />
                </div>
                <div>
                    <div className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Last Touch</div>
                    <div className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{timeAgo}</div>
                    <div className={`text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{fullDate}</div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant="outline" className={`font-medium flex items-center gap-1.5 ${
                    theme === 'dark' 
                        ? 'bg-slate-800 border-slate-600 text-slate-300' 
                        : 'bg-white border-slate-200 text-slate-700'
                }`}>
                    <UserIcon className="w-3 h-3" />
                    {displayName}
                </Badge>
            </div>
        </div>
    );
}