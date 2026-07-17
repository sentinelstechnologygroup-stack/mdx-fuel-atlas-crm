import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ClientDashboard from "@/components/cs/ClientDashboard";
import ClientList from "@/components/cs/ClientList";
import ClientDetails from "@/components/cs/ClientDetails";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/components/context/SettingsContext";

export default function CSManagementPage() {
    const { theme } = useSettings();
    const isDark = theme === 'dark';
    const [selectedClient, setSelectedClient] = useState(null);
    const queryClient = useQueryClient();

    const { data: clients, isLoading } = useQuery({
        queryKey: ['clients'],
        queryFn: () => base44.entities.Client.list(),
        initialData: []
    });

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <div className={`min-h-screen p-6 ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
            <h1 className="text-3xl font-bold mb-6">Customer Success Hub</h1>
            
            <ClientDashboard clients={clients} />
            
            <ClientList 
                clients={clients} 
                onSelectClient={setSelectedClient} 
            />

            <ClientDetails 
                client={selectedClient} 
                open={!!selectedClient} 
                onClose={() => setSelectedClient(null)} 
            />
        </div>
    );
}