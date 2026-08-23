import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { atlas } from "@/api/atlasClient";
import ClientDashboard from "@/components/cs/ClientDashboard";
import ClientList from "@/components/cs/ClientList";
import ClientDetails from "@/components/cs/ClientDetails";
import { Loader2, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/components/context/SettingsContext";

export default function CSManagementPage() {
    const { theme } = useSettings();
    const isDark = theme === 'dark';
    const [selectedClient, setSelectedClient] = useState(null);
    const { data: clients = [], isLoading, isError, refetch } = useQuery({
        queryKey: ['clients'],
        queryFn: () => atlas.entities.Client.list(),
        initialData: []
    });

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <div className={`min-h-screen p-6 ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
            <h1 className="text-3xl font-bold mb-6">Customer Success Hub</h1>

            {isError && (
                <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>Customer records could not be loaded. Check your access and try again.</span>
                    <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
                </div>
            )}

            {!isError && clients.length === 0 && (
                <div className="mb-6 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                    <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <h2 className="text-lg font-semibold">No customers yet</h2>
                    <p className="mt-1 text-sm text-slate-500">Customers appear here automatically when an opportunity is marked Closed Won.</p>
                </div>
            )}
            
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
