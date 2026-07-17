import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { useSettings } from '@/components/context/SettingsContext';

export default function SecurityInfoModal() {
    const [isOpen, setIsOpen] = useState(false);
    const { theme } = useSettings();

    useEffect(() => {
        // Open the modal automatically when the component mounts
        const timer = setTimeout(() => setIsOpen(true), 500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className={`max-w-md border-0 shadow-2xl overflow-hidden p-0 rounded-2xl [&>button]:hidden ${
                theme === 'dark' ? 'bg-slate-900 text-white ring-1 ring-white/10' : 'bg-white text-slate-900 ring-1 ring-black/5'
            }`}>
                {/* Header Graphic Area */}
                <div className={`h-32 w-full relative flex items-center justify-center overflow-hidden ${
                    theme === 'dark' 
                    ? 'bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950' 
                    : 'bg-gradient-to-br from-indigo-50 via-white to-blue-50'
                }`}>
                     {/* Abstract Background Shapes */}
                     <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                     <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                     
                     {/* Lock Icon */}
                     <div className={`relative z-10 p-4 rounded-2xl border backdrop-blur-md shadow-xl ${
                         theme === 'dark' 
                         ? 'bg-white/5 border-white/10 text-indigo-300' 
                         : 'bg-white/60 border-white/50 text-indigo-600'
                     }`}>
                         <ShieldCheck className="w-12 h-12" />
                     </div>
                </div>

                <div className="p-6 relative">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-center mb-2">
                            Security & Data Privacy
                        </DialogTitle>
                        <DialogDescription className={`text-center text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            Why you might see empty data
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-6 space-y-4">
                        <div className={`p-4 rounded-xl text-sm leading-relaxed ${
                            theme === 'dark' ? 'bg-slate-800/50 text-slate-300' : 'bg-slate-50 text-slate-600'
                        }`}>
                            <p className="mb-2 font-medium">
                                <Lock className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                                Demo Security Protocols
                            </p>
                            <p>
                                Some dashboard widgets may appear empty because this is a secured demo environment.
                                We restrict real-time data access to protect user privacy.
                            </p>
                        </div>
                        
                        <div className="text-sm space-y-2">
                            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                                In the full version, you will have access to:
                            </p>
                            <ul className={`space-y-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                <li className="flex items-start gap-2">
                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    <span>Complete data visualization & live metrics</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    <span>Full gallery of analytics charts & reports</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    <span>Customizable widgets with drag-and-drop</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="mt-8">
                        <Button 
                            className="w-full rounded-xl py-6 text-base font-semibold shadow-lg shadow-indigo-500/20" 
                            onClick={() => setIsOpen(false)}
                        >
                            Continue Exploring <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
                
            </DialogContent>
        </Dialog>
    );
}