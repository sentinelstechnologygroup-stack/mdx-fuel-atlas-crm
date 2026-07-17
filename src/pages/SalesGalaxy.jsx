import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import GalaxyScene from '@/components/galaxy/GalaxyScene';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useSettings } from "@/components/context/SettingsContext";

export default function SalesGalaxy() {
    const { theme } = useSettings();
    
    const { data: opportunities, isLoading } = useQuery({
        queryKey: ['opportunities'],
        queryFn: () => base44.entities.Opportunity.list(null, 1000),
        initialData: []
    });

    return (
        <div className="w-full h-screen overflow-hidden bg-black relative">
            {/* Background Gradient for depth */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/20 via-black to-black pointer-events-none z-0"></div>

            {/* Back Button */}
            <div className="absolute top-6 right-6 z-50">
                <Link to={createPageUrl('Dashboard')}>
                    <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white rounded-full h-12 w-12 p-0 border border-white/10 backdrop-blur-sm">
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                </Link>
            </div>

            {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-50">
                    <Loader2 className="w-12 h-12 animate-spin text-amber-500 mb-4" />
                    <p className="font-mono text-sm tracking-widest uppercase animate-pulse">Initializing Galaxy Engine...</p>
                </div>
            ) : (
                <div className="relative z-10 w-full h-full">
                    <GalaxyScene opportunities={opportunities} />
                </div>
            )}
        </div>
    );
}