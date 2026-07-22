import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LayoutDashboard, Users, Briefcase, Plus, Menu, Sparkles, Brain, Bot } from 'lucide-react';
import { useAssistant } from '@/components/context/AssistantContext';
import { ATLAS } from '@/components/ai/atlasConfig';
import { Button } from "@/components/ui/button";
import { useSettings } from "@/components/context/SettingsContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator } from
"@/components/ui/dropdown-menu";

export default function MobileBottomNav({ activePage }) {
  const location = useLocation();
  const { theme } = useSettings();
  const { openAssistant } = useAssistant();
  // Use activePage prop if available, otherwise fallback to URL parsing (handling trailing slashes)
  const urlPath = location.pathname.replace(/\/$/, '').split('/').pop() || 'Dashboard';
  const currentPath = activePage || urlPath;
  const [showAiImport, setShowAiImport] = React.useState(false);

  const isActive = (path) => currentPath === path;
  
  // Removed simple classes to use inline gradient logic

  return (
    <div className={`fixed bottom-0 left-0 right-0 border-t h-[calc(4rem+env(safe-area-inset-bottom))] px-6 flex items-start pt-3 justify-between z-50 lg:hidden transition-all duration-300 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:backdrop-blur-2xl ${
        theme === 'dark' 
        ? 'bg-[#0B1121]/80 border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.4)]' 
        : 'bg-white/80 border-white/50 shadow-[0_-8px_30px_rgba(0,0,0,0.05)]'
    }`}>
            <Link to={createPageUrl('Dashboard')} className={`flex flex-col items-center justify-center p-1 rounded-lg transition-all ${isActive('Dashboard') ? (theme === 'dark' ? 'bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.4)]' : 'bg-red-50') : ''}`}>
                <LayoutDashboard className={`w-6 h-6 ${isActive('Dashboard') ? (theme === 'dark' ? 'text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]' : 'text-red-700') : (theme === 'dark' ? 'text-slate-500' : 'text-slate-400')}`} />
                <span className={`text-[10px] font-bold ${isActive('Dashboard') ? (theme === 'dark' ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-red-700') : (theme === 'dark' ? 'text-slate-500' : 'text-slate-400')}`}>Dashboard</span>
            </Link>

            <Link to={createPageUrl('Leads')} className={`flex flex-col items-center justify-center p-1 rounded-lg transition-all ${isActive('Leads') ? (theme === 'dark' ? 'bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'bg-red-50') : ''}`}>
                <Users className={`w-6 h-6 ${isActive('Leads') ? (theme === 'dark' ? 'text-indigo-400 drop-shadow-[0_0_12px_rgba(129,140,248,0.8)]' : 'text-red-700') : (theme === 'dark' ? 'text-slate-500' : 'text-slate-400')}`} />
                <span className={`text-[10px] font-bold ${isActive('Leads') ? (theme === 'dark' ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'text-red-700') : (theme === 'dark' ? 'text-slate-500' : 'text-slate-400')}`}>Leads</span>
            </Link>

            {/* Center FAB for Quick Actions - Liquid Glass Style */}
            <div className="relative -top-6">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button className={`w-16 h-16 rounded-[1.5rem] shadow-2xl flex items-center justify-center p-0 transition-all duration-300 backdrop-blur-2xl border-2 relative overflow-hidden group ${
                            theme === 'dark'
                            ? 'bg-[#0B1121]/80 border-cyan-400/30 shadow-[0_0_30px_rgba(34,211,238,0.4)]'
                            : 'bg-white/80 border-white/60 shadow-[0_8px_32px_rgba(220,38,38,0.25)]'
                        }`}>
                            {/* Inner Liquid Gradient */}
                            <div className={`absolute inset-0 opacity-60 ${
                                theme === 'dark' 
                                    ? 'bg-gradient-to-br from-cyan-500/30 via-blue-500/20 to-purple-500/30' 
                                    : 'bg-gradient-to-br from-red-500/20 via-orange-500/20 to-amber-500/20'
                            }`} />
                            
                            {/* Icon */}
                            <Plus className={`w-8 h-8 relative z-10 transition-transform duration-300 group-hover:rotate-90 ${
                                theme === 'dark' 
                                    ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' 
                                    : 'text-red-600 drop-shadow-[0_2px_4px_rgba(220,38,38,0.2)]'
                            }`} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" side="top" className={`mb-4 w-60 p-2 ${theme === 'dark' ? 'bg-slate-900/95 border-slate-700 text-slate-200 backdrop-blur-xl' : 'bg-white/95 backdrop-blur-xl border-slate-200'}`}>
                        <DropdownMenuItem asChild>
                             <button 
                                 onClick={() => openAssistant()} 
                                 className={`cursor-pointer flex items-center gap-3 w-full p-2.5 rounded-lg font-medium transition-all ${theme === 'dark' ? 'text-indigo-300 hover:bg-indigo-500/10' : 'text-indigo-600 hover:bg-indigo-50'}`}
                             >
                                <Bot className="w-5 h-5" /> Ask {ATLAS.displayName}
                             </button>
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator className={theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'} />
                        
                        <DropdownMenuItem asChild>
                             <Link to={createPageUrl('ActNow')} className={`cursor-pointer flex items-center gap-3 w-full p-2.5 rounded-lg font-medium transition-all ${
                                 theme === 'dark' 
                                 ? 'text-cyan-400 hover:bg-cyan-500/10' 
                                 : 'text-cyan-600 hover:bg-cyan-50'
                             }`}>
                                <Brain className="w-5 h-5" /> Atlas AI Engine
                             </Link>
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator className={theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'} />
                        
                        <DropdownMenuItem asChild>
                             <Link to={`${createPageUrl('Leads')}?action=new`} className={`cursor-pointer flex items-center gap-3 w-full p-2.5 rounded-lg font-medium transition-all ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-50 text-slate-700'}`}>
                                <Users className="w-5 h-5 opacity-70" /> New Lead
                             </Link>
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem asChild>
                             <Link to={`${createPageUrl('Opportunities')}?action=new`} className={`cursor-pointer flex items-center gap-3 w-full p-2.5 rounded-lg font-medium transition-all ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-50 text-slate-700'}`}>
                                <Briefcase className="w-5 h-5 opacity-70" /> New Opportunity
                             </Link>
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator className={theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'} />
                        
                        <DropdownMenuItem asChild>
                             <Link to={`${createPageUrl('Leads')}?action=ai-import`} className={`cursor-pointer flex items-center gap-3 w-full p-2.5 rounded-lg font-medium transition-all ${theme === 'dark' ? 'text-purple-300 hover:bg-purple-500/10' : 'text-purple-600 hover:bg-purple-50'}`}>
                                <Sparkles className="w-5 h-5" /> Import AI Lead
                             </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Link to={createPageUrl('Opportunities')} className={`flex flex-col items-center justify-center p-1 rounded-lg transition-all ${isActive('Opportunities') ? (theme === 'dark' ? 'bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-red-50') : ''}`}>
                <Briefcase className={`w-6 h-6 ${isActive('Opportunities') ? (theme === 'dark' ? 'text-purple-400 drop-shadow-[0_0_12px_rgba(192,132,252,0.8)]' : 'text-red-700') : (theme === 'dark' ? 'text-slate-500' : 'text-slate-400')}`} />
                <span className={`text-[10px] font-bold ${isActive('Opportunities') ? (theme === 'dark' ? 'text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]' : 'text-red-700') : (theme === 'dark' ? 'text-slate-500' : 'text-slate-400')}`}>Deals</span>
            </Link>

            <Link to={createPageUrl('Settings')} className={`flex flex-col items-center justify-center p-1 rounded-lg transition-all ${isActive('Settings') ? (theme === 'dark' ? 'bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'bg-red-50') : ''}`}>
                <Menu className={`w-6 h-6 ${isActive('Settings') ? (theme === 'dark' ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]' : 'text-red-700') : (theme === 'dark' ? 'text-slate-500' : 'text-slate-400')}`} />
                <span className={`text-[10px] font-bold ${isActive('Settings') ? (theme === 'dark' ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-red-700') : (theme === 'dark' ? 'text-slate-500' : 'text-slate-400')}`}>Settings</span>
            </Link>
        </div>);

}