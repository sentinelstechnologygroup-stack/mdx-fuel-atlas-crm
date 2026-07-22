import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, UserPlus, Briefcase, CheckSquare, Mail, X, 
    Sparkles, MessageSquare, Brain, Bot 
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSettings } from '@/components/context/SettingsContext';
import { useAssistant } from '@/components/context/AssistantContext';
import { ATLAS } from '@/components/ai/atlasConfig';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function QuickActions() {
    const [isOpen, setIsOpen] = useState(false);
    const { theme, branding } = useSettings();
    const navigate = useNavigate();
    const { openAssistant } = useAssistant();

    const actions = [
        { 
            label: `Ask ${ATLAS.displayName}`,
            icon: Bot, 
            // Neon Cyan - Super Bright
            neonClass: 'text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,1)] filter',
            borderClass: 'border-cyan-300/80',
            glowClass: 'shadow-[0_0_30px_rgba(34,211,238,0.5),inset_0_0_20px_rgba(34,211,238,0.2)]',
            bgClass: 'bg-cyan-400/20',
            lightClass: 'text-cyan-600',
            onClick: () => openAssistant() 
        },
        { 
            label: 'Atlas AI Engine',
            icon: Brain, 
            // Neon Violet - Super Bright
            neonClass: 'text-violet-300 drop-shadow-[0_0_10px_rgba(167,139,250,1)] filter',
            borderClass: 'border-violet-300/80',
            glowClass: 'shadow-[0_0_30px_rgba(167,139,250,0.5),inset_0_0_20px_rgba(167,139,250,0.2)]',
            bgClass: 'bg-violet-400/20',
            lightClass: 'text-violet-600',
            onClick: () => navigate(createPageUrl('ActNow')) 
        },
        { 
            label: 'Import AI Lead', 
            icon: Sparkles, 
            // Neon Pink - Super Bright
            neonClass: 'text-fuchsia-300 drop-shadow-[0_0_10px_rgba(232,121,249,1)] filter',
            borderClass: 'border-fuchsia-300/80',
            glowClass: 'shadow-[0_0_30px_rgba(232,121,249,0.5),inset_0_0_20px_rgba(232,121,249,0.2)]',
            bgClass: 'bg-fuchsia-400/20',
            lightClass: 'text-fuchsia-600',
            onClick: () => navigate(createPageUrl('Leads') + '?action=ai-import') 
        },
        { 
            label: 'New Task', 
            icon: CheckSquare, 
            // Neon Emerald/Lime - Super Bright
            neonClass: 'text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,1)] filter',
            borderClass: 'border-emerald-300/80',
            glowClass: 'shadow-[0_0_30px_rgba(52,211,153,0.5),inset_0_0_20px_rgba(52,211,153,0.2)]',
            bgClass: 'bg-emerald-400/20',
            lightClass: 'text-emerald-600',
            onClick: () => navigate(createPageUrl('Tasks') + '?action=new') 
        },
        { 
            label: 'Send Campaign', 
            icon: Mail, 
            // Neon Purple - Super Bright
            neonClass: 'text-purple-300 drop-shadow-[0_0_10px_rgba(192,132,252,1)] filter',
            borderClass: 'border-purple-300/80',
            glowClass: 'shadow-[0_0_30px_rgba(192,132,252,0.5),inset_0_0_20px_rgba(192,132,252,0.2)]',
            bgClass: 'bg-purple-400/20',
            lightClass: 'text-purple-600',
            onClick: () => navigate(createPageUrl('SequenceBuilder')) 
        },
        { 
            label: 'New Opportunity', 
            icon: Briefcase, 
            // Neon Amber - Super Bright
            neonClass: 'text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,1)] filter',
            borderClass: 'border-amber-300/80',
            glowClass: 'shadow-[0_0_30px_rgba(251,191,36,0.5),inset_0_0_20px_rgba(251,191,36,0.2)]',
            bgClass: 'bg-amber-400/20',
            lightClass: 'text-amber-600',
            onClick: () => navigate(createPageUrl('Opportunities') + '?action=new') 
        },
        { 
            label: 'Add Lead', 
            icon: UserPlus, 
            // Neon Blue - Super Bright
            neonClass: 'text-blue-300 drop-shadow-[0_0_10px_rgba(96,165,250,1)] filter',
            borderClass: 'border-blue-300/80',
            glowClass: 'shadow-[0_0_30px_rgba(96,165,250,0.5),inset_0_0_20px_rgba(96,165,250,0.2)]',
            bgClass: 'bg-blue-400/20',
            lightClass: 'text-blue-600',
            onClick: () => navigate(createPageUrl('Leads') + '?action=new') 
        },
    ];

    return (
        <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-6 hidden md:flex">
            {/* Ambient Glow for Main Button */}
            <div className={`absolute bottom-0 right-0 w-32 h-32 rounded-full blur-[60px] pointer-events-none transition-opacity duration-500 ${
                isOpen ? 'opacity-40' : 'opacity-0'
            } ${theme === 'dark' ? 'bg-cyan-500' : 'bg-red-500'}`} />

            <AnimatePresence>
                {isOpen && (
                    <div className="flex flex-col gap-4 items-end mb-2 relative z-10">
                        {actions.map((action, index) => (
                            <motion.div
                                key={action.label}
                                initial={{ opacity: 0, y: 40, scale: 0.5, filter: "blur(10px)" }}
                                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                                exit={{ opacity: 0, y: 20, scale: 0.8, filter: "blur(5px)" }}
                                transition={{ 
                                    type: "spring", 
                                    damping: 20, 
                                    stiffness: 300, 
                                    delay: (actions.length - index) * 0.05 
                                }}
                                className="flex items-center gap-4 group"
                            >
                                {/* Glass Label */}
                                <span className={`text-sm font-semibold px-4 py-2 rounded-2xl shadow-lg backdrop-blur-xl border transition-all duration-300 transform group-hover:-translate-x-1 ${
                                    theme === 'dark' 
                                      ? 'bg-[#0B1121]/40 text-white border-white/10 shadow-black/20' 
                                      : 'bg-white/40 text-slate-800 border-white/40 shadow-slate-200/20'
                                }`}>
                                    {action.label}
                                </span>

                                {/* Glass Action Button */}
                                <Button
                                    size="icon"
                                    onClick={() => {
                                        action.onClick();
                                        setIsOpen(false);
                                    }}
                                    className={`h-14 w-14 rounded-[1.2rem] backdrop-blur-3xl transition-all duration-300 group-hover:scale-110 relative overflow-visible ${
                                        theme === 'dark' 
                                            ? `bg-[#0B1121]/80 ${action.borderClass} border-2 ${action.glowClass}` 
                                            : `bg-white border-2 border-slate-100 shadow-xl`
                                    }`}
                                >
                                    {/* Inner Color Background */}
                                    <div className={`absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity duration-500 ${action.bgClass}`} />
                                    
                                    {/* Icon with specific neon color */}
                                    <action.icon className={`w-6 h-6 relative z-10 ${
                                        theme === 'dark' 
                                            ? action.neonClass 
                                            : action.lightClass
                                    }`} />
                                </Button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>

            {/* Main Toggle Button - Liquid Glass */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    h-20 w-20 rounded-[2rem] shadow-2xl flex items-center justify-center transition-all duration-500 backdrop-blur-2xl border relative overflow-hidden z-20 group
                    ${isOpen ? 'rotate-[135deg] rounded-full' : ''}
                    ${theme === 'dark' 
                        ? 'bg-[#0B1121]/60 border-white/10 shadow-[0_0_40px_rgba(34,211,238,0.3)] hover:shadow-[0_0_60px_rgba(34,211,238,0.5)]' 
                        : 'bg-white/60 border-white/40 shadow-[0_8px_32px_rgba(220,38,38,0.25)] hover:shadow-[0_12px_40px_rgba(220,38,38,0.35)]'}
                `}
            >
                {/* Liquid Background Gradient */}
                <div className={`absolute inset-0 opacity-80 transition-opacity duration-500 ${
                    theme === 'dark' 
                        ? 'bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-purple-500/20' 
                        : 'bg-gradient-to-br from-red-500/20 via-orange-500/10 to-amber-500/20'
                }`} />

                {/* Inner Highlight Blob */}
                <div className={`absolute -top-10 -left-10 w-20 h-20 rounded-full blur-xl opacity-40 transition-transform duration-700 group-hover:scale-150 ${
                    theme === 'dark' ? 'bg-cyan-400' : 'bg-red-400'
                }`} />

                <Plus className={`w-10 h-10 transition-all duration-500 relative z-10 ${
                    isOpen ? 'rotate-90 scale-90' : ''
                } ${
                    theme === 'dark' ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-red-600 drop-shadow-[0_2px_4px_rgba(220,38,38,0.3)]'
                }`} />
            </motion.button>
        </div>
    );
}