import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, GripHorizontal, Minus, Maximize2 } from 'lucide-react';
import SalesAssistantChat from './SalesAssistantChat';
import { useSettings } from '@/components/context/SettingsContext';
import { ATLAS } from './atlasConfig';
import { Button } from '@/components/ui/button';

export default function SalesAssistantDialog({ open, onOpenChange }) {
    const { theme } = useSettings();
    const constraintsRef = useRef(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Check mobile
    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Reset minimized state when opened
    React.useEffect(() => {
        if (open) setIsMinimized(false);
    }, [open]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Constraints container for drag - covers screen but passes clicks */}
                    <div ref={constraintsRef} className="fixed inset-0 z-[100] pointer-events-none" />
                    
                    <motion.div
                        initial={{ 
                            opacity: 0, 
                            scale: 0.9, 
                            y: isMobile ? "-45%" : 20, 
                            x: isMobile ? "-50%" : 0 
                        }}
                        animate={{ 
                            opacity: 1, 
                            scale: 1, 
                            y: isMobile ? "-50%" : 0, 
                            x: isMobile ? "-50%" : 0,
                            height: isMinimized ? 80 : (isMobile ? '65vh' : 600),
                            width: isMinimized ? (isMobile ? '90vw' : 300) : (isMobile ? '85vw' : 450),
                            transition: { type: "spring", damping: 25, stiffness: 300 }
                        }}
                        exit={{ 
                            opacity: 0, 
                            scale: 0.9, 
                            y: isMobile ? "-45%" : 20,
                            x: isMobile ? "-50%" : 0 
                        }}
                        drag={!isMobile}
                        dragConstraints={constraintsRef}
                        dragElastic={0.1}
                        dragMomentum={false}
                        className={`fixed ${isMobile ? 'top-1/2 -translate-y-1/2' : 'bottom-0'} md:top-auto md:bottom-24 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:translate-y-0 md:right-8 z-[101] max-w-[100vw] rounded-[2rem] overflow-hidden flex flex-col pointer-events-auto backdrop-blur-2xl border shadow-2xl ${
                            theme === 'dark' 
                                ? 'bg-[#0B1121]/60 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]' 
                                : 'bg-white/60 border-white/40 shadow-[0_8px_32px_rgba(31,38,135,0.15)]'
                        }`}
                        style={{
                            // Liquid glass reflections
                            boxShadow: theme === 'dark' 
                                ? '0 0 50px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)'
                                : '0 8px 32px rgba(31,38,135,0.15), inset 0 0 0 1px rgba(255,255,255,0.4)'
                        }}
                    >
                        {/* Glass Header */}
                        <div 
                            className={`px-6 py-4 flex items-center justify-between cursor-move shrink-0 h-20 ${
                                theme === 'dark' ? 'bg-white/5 border-b border-white/5' : 'bg-white/30 border-b border-white/20'
                            }`}
                            onDoubleClick={() => setIsMinimized(!isMinimized)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center text-white shadow-lg backdrop-blur-md transition-colors ${
                                    theme === 'dark' 
                                        ? 'bg-gradient-to-br from-indigo-500/80 to-purple-600/80 shadow-indigo-500/20' 
                                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30'
                                }`}>
                                    <Bot className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className={`font-bold text-xl leading-tight tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                                        {ATLAS.displayName}
                                    </h2>
                                    <p className={`text-[10px] font-medium leading-tight ${theme === 'dark' ? 'text-indigo-400/70' : 'text-indigo-500/70'}`}>
                                        {ATLAS.providerAttribution}
                                    </p>
                                    <AnimatePresence mode="wait">
                                        <motion.p 
                                            key={isMinimized ? 'min' : 'full'}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`text-xs font-medium ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`}
                                        >
                                            {isMinimized ? 'Click to expand' : 'Online & Ready'}
                                        </motion.p>
                                    </AnimatePresence>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => setIsMinimized(!isMinimized)}
                                    className={`rounded-full h-8 w-8 hover:bg-white/20 transition-colors ${
                                        theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                                    }`}
                                >
                                    {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                </Button>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => onOpenChange(false)}
                                    className={`rounded-full h-8 w-8 hover:bg-red-500/20 hover:text-red-500 transition-colors ${
                                        theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                                    }`}
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Content */}
                        <motion.div 
                            className="flex-1 overflow-hidden relative"
                            animate={{ opacity: isMinimized ? 0 : 1 }}
                            transition={{ duration: 0.2 }}
                            style={{ pointerEvents: isMinimized ? 'none' : 'auto' }}
                        >
                            {/* Ambient liquid blobs inside */}
                            <div className={`absolute top-[-20%] left-[-20%] w-[300px] h-[300px] rounded-full blur-[80px] opacity-30 pointer-events-none animate-pulse ${
                                theme === 'dark' ? 'bg-indigo-600' : 'bg-indigo-300'
                            }`} />
                            <div className={`absolute bottom-[-20%] right-[-20%] w-[300px] h-[300px] rounded-full blur-[80px] opacity-30 pointer-events-none animate-pulse ${
                                theme === 'dark' ? 'bg-purple-600' : 'bg-purple-300'
                            }`} style={{ animationDelay: '2s' }} />
                            
                            <SalesAssistantChat />
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}