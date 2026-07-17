import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  LayoutDashboard, Users, Briefcase, Menu, X, Search, Bell, Zap, BarChart3, LogOut, Settings as SettingsIcon, Sun, Moon, Database, CheckSquare, Sparkles, Brain, Globe, GitFork, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SettingsProvider, useSettings } from '@/components/context/SettingsContext';
import { ActNowProvider } from '@/components/context/ActNowContext';
import { AssistantProvider } from '@/components/context/AssistantContext';
import GlobalSearch from '@/components/layout/GlobalSearch';
import Notifications from '@/components/layout/Notifications';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import QuickActions from '@/components/layout/QuickActions';
import CommandPalette from '@/components/layout/CommandPalette';
import { useEffectivePermissions } from '@/components/hooks/useEffectivePermissions';
import { NAV_MODULE_MAP } from '@/lib/permissionModules';

function LayoutContent({ children, currentPageName }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const { branding, theme, toggleTheme } = useSettings();
  // Phase 3C.1 presentation layer: hide navigation for modules with can_view=false.
  // This is UX only — server-enforced authorization arrives in Phase 3C.2.
  const { canView } = useEffectivePermissions();
  
  // Navigation Groups
  const navigationGroups = [
    {
      title: 'Sales',
      items: [
        { name: 'Dashboard', path: 'Dashboard', icon: LayoutDashboard, color: 'cyan' },
        { name: 'Leads', path: 'Leads', icon: Users, color: 'purple' },
        { name: 'Opportunities', path: 'Opportunities', icon: Briefcase, color: 'pink' },
        { name: 'Act Now', path: 'ActNow', icon: Brain, color: 'orange' },
        { name: 'Tasks', path: 'Tasks', icon: CheckSquare, color: 'red' },
        { name: 'Reports', path: 'Reports', icon: BarChart3, color: 'emerald' },
        { name: 'Automations', path: 'Automations', icon: Zap, color: 'indigo' },
        { name: 'Galaxy', path: 'SalesGalaxy', icon: Globe, color: 'amber' },
      ]
    },
    {
      title: 'Clients',
      items: [
        { name: 'CS Management', path: 'CSManagement', icon: Sparkles, color: 'blue' },
      ]
    },
    {
      title: 'Marketing',
      items: [
        { name: 'Sequences', path: 'MarketingSequences', icon: GitFork, color: 'blue' },
        { name: 'Templates', path: 'MarketingTemplates', icon: Mail, color: 'purple' }
      ]
    }
  ];

  const navigation = navigationGroups.flatMap(group => group.items);

  // Dark Mode Color Configurations
  const darkColors = {
      cyan: { active: 'bg-cyan-500/15 text-cyan-400 shadow-cyan-500/10', icon: 'text-cyan-400', indicator: 'bg-cyan-400 shadow-cyan-400/50', hover: 'hover:text-cyan-400' },
      blue: { active: 'bg-blue-500/15 text-blue-400 shadow-blue-500/10', icon: 'text-blue-400', indicator: 'bg-blue-400 shadow-blue-400/50', hover: 'hover:text-blue-400' },
      purple: { active: 'bg-purple-500/15 text-purple-400 shadow-purple-500/10', icon: 'text-purple-400', indicator: 'bg-purple-400 shadow-purple-400/50', hover: 'hover:text-purple-400' },
      pink: { active: 'bg-pink-500/15 text-pink-400 shadow-pink-500/10', icon: 'text-pink-400', indicator: 'bg-pink-400 shadow-pink-400/50', hover: 'hover:text-pink-400' },
      orange: { active: 'bg-orange-500/15 text-orange-400 shadow-orange-500/10', icon: 'text-orange-400', indicator: 'bg-orange-400 shadow-orange-400/50', hover: 'hover:text-orange-400' },
      red: { active: 'bg-red-500/15 text-red-400 shadow-red-500/10', icon: 'text-red-400', indicator: 'bg-red-400 shadow-red-400/50', hover: 'hover:text-red-400' },
      emerald: { active: 'bg-emerald-500/15 text-emerald-400 shadow-emerald-500/10', icon: 'text-emerald-400', indicator: 'bg-emerald-400 shadow-emerald-400/50', hover: 'hover:text-emerald-400' },
      indigo: { active: 'bg-indigo-500/15 text-indigo-400 shadow-indigo-500/10', icon: 'text-indigo-400', indicator: 'bg-indigo-400 shadow-indigo-400/50', hover: 'hover:text-indigo-400' },
      amber: { active: 'bg-amber-500/15 text-amber-400 shadow-amber-500/10', icon: 'text-amber-400', indicator: 'bg-amber-400 shadow-amber-400/50', hover: 'hover:text-amber-400' },
  };

  // Dynamic Colors based on branding
  // New "Clean Luxury Red" styling
  const activeClass = `bg-red-50/50 text-red-600 font-semibold`;

  // Custom Deep Theme for Dark Mode
  // Background: #0B1121 (Very dark blue/slate)
  // Panel: #151E32 (Slightly lighter)
  // Accent: Emerald/Teal

  return (
    <div className={`min-h-screen font-heebo flex transition-colors duration-300 relative overflow-hidden ${theme === 'dark' ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-neutral-900'}`} dir="ltr">

      {/* Ambient Background Blobs for Liquid Glass Effect - Enhanced */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          {/* Primary Blob */}
          <div className={`absolute top-[-10%] right-[-5%] w-[600px] md:w-[900px] h-[600px] md:h-[900px] rounded-full blur-[80px] md:blur-[140px] opacity-40 mix-blend-screen animate-pulse ${theme === 'dark' ? 'bg-indigo-600' : 'bg-rose-400'}`} style={{ animationDuration: '8s' }} />

          {/* Secondary Blob - Offset */}
          <div className={`absolute bottom-[-10%] left-[-10%] w-[500px] md:w-[800px] h-[500px] md:h-[800px] rounded-full blur-[70px] md:blur-[130px] opacity-30 mix-blend-screen ${theme === 'dark' ? 'bg-cyan-600' : 'bg-blue-400'}`} />

          {/* Tertiary Floating Blob */}
          <div className={`absolute top-[30%] left-[20%] w-[400px] md:w-[600px] h-[400px] md:h-[600px] rounded-full blur-[60px] md:blur-[120px] opacity-25 mix-blend-screen animate-pulse ${theme === 'dark' ? 'bg-purple-600' : 'bg-violet-400'}`} style={{ animationDuration: '12s' }} />

          {/* Noise Texture Overlay for realism */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      </div>
      <CommandPalette />

      {/* Global Scrollbar Styles */}
      <style>{`
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: ${theme === 'dark' ? '#1E293B' : '#cbd5e1'};
            border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: ${theme === 'dark' ? '#334155' : '#94a3b8'};
        }
      `}</style>

      {/* Sidebar / Drawer - Enhanced Liquid Glass (Optimized Blur for Mobile) */}
      <aside className={`
        fixed inset-0 z-[60] transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:w-72 lg:border-r lg:shadow-2xl backdrop-blur-lg md:backdrop-blur-2xl
        ${theme === 'dark' 
          ? 'bg-[#0B1121]/80 md:bg-[#0B1121]/60 text-slate-200 border-white/10 shadow-black/40 supports-[backdrop-filter]:bg-[#0B1121]/40' 
          : 'bg-white/95 backdrop-blur-3xl md:bg-gradient-to-br md:from-blue-100/40 md:via-white/60 md:to-pink-100/40 text-slate-900 border-white/20 shadow-xl shadow-indigo-100/10'}
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full relative z-10">
            {/* Mobile Close Button - Absolute Top Right */}
            <div className="absolute top-4 right-4 lg:hidden z-10">
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="h-10 w-10 rounded-full bg-neutral-100 text-neutral-500">
                    <X className="w-6 h-6" />
                </Button>
            </div>

            {/* Logo Area */}
            <div className={`p-6 lg:p-6 border-b flex flex-col items-center lg:items-start mt-10 lg:mt-0 ${theme === 'dark' ? 'border-[#1E293B]' : 'border-neutral-50'}`}>
                <Link to={createPageUrl('Dashboard')} onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3 text-2xl lg:text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity">
                    <span className="hidden lg:inline truncate">{branding.companyName}</span>
                </Link>
                <p className="lg:hidden text-xl font-bold mt-4">{branding.companyName}</p>
                <p className={`text-sm mt-2 font-medium tracking-wide ${theme === 'dark' ? 'text-emerald-400' : 'text-neutral-500 opacity-80'}`}>MDX CRM</p>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
                {navigationGroups.map((group, idx) => (
                  <div key={idx} className={group.className || ''}>
                    <h3 className={`px-4 mb-3 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-neutral-400'}`}>
                      {group.title}
                    </h3>
                    <div className="space-y-1">
                      {group.items.filter((it) => { const _mk = NAV_MODULE_MAP[it.path]; return !_mk || canView(_mk); }).length === 0 ? (
                        <div className={`px-4 py-2 text-sm italic ${theme === 'dark' ? 'text-slate-600' : 'text-neutral-400'}`}>
                          Coming soon
                        </div>
                      ) : (
                        group.items.filter((it) => { const _mk2 = NAV_MODULE_MAP[it.path]; return !_mk2 || canView(_mk2); }).map((item) => {
                          const isActive = currentPageName === item.path;
                          const themeColor = darkColors[item.color] || darkColors.emerald;

                          return (
                              <Link
                              key={item.path}
                              to={createPageUrl(item.path)}
                              onClick={() => setIsSidebarOpen(false)}
                              className={`
                                  group flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 relative overflow-hidden
                                  ${isActive 
                                  ? theme === 'dark' 
                                    ? `${themeColor.active} font-bold shadow-sm` 
                                    : 'bg-gradient-to-r from-blue-500/10 to-rose-500/10 text-indigo-700 font-bold shadow-sm border border-white/50 backdrop-blur-md'
                                  : theme === 'dark'
                                    ? `text-slate-400 hover:bg-[#1E293B] ${themeColor.hover}`
                                    : 'text-slate-700 hover:bg-white/50 hover:text-indigo-600 transition-all'}
                              `}
                              >
                              <item.icon className={`w-5 h-5 transition-colors ${
                                isActive 
                                  ? theme === 'dark' ? themeColor.icon : 'text-red-700'
                                  : theme === 'dark' ? `text-slate-500 group-${themeColor.hover}` : 'text-neutral-400 group-hover:text-red-600'
                              }`} />
                              <span className="relative z-10">{item.name}</span>
                              {isActive && <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full ${theme === 'dark' ? `${themeColor.indicator} shadow-lg` : 'bg-gradient-to-b from-blue-500 to-rose-500'}`} />}
                              </Link>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
            </nav>

            {/* Footer / Settings */}
            <div className={`p-6 lg:p-4 border-t ${theme === 'dark' ? 'border-[#1E293B]' : 'border-neutral-50'}`}>
                <Link
                    to={createPageUrl('Settings')}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`
                        flex items-center gap-4 lg:gap-3 px-6 lg:px-4 py-4 lg:py-3 text-base lg:text-sm font-medium rounded-2xl lg:rounded-xl transition-all duration-200 group
                        ${currentPageName === 'Settings' 
                          ? theme === 'dark' 
                            ? 'bg-white/10 text-white font-bold shadow-sm shadow-white/5' 
                            : 'bg-red-50 text-red-700 font-bold'
                          : theme === 'dark'
                            ? 'text-slate-400 hover:bg-[#1E293B] hover:text-white'
                            : 'text-neutral-600 hover:bg-red-50 hover:text-red-600 bg-neutral-50/30 lg:bg-transparent'}
                    `}
                >
                    <SettingsIcon className={`w-6 h-6 lg:w-5 lg:h-5 transition-colors ${
                        currentPageName === 'Settings' 
                        ? theme === 'dark' ? 'text-white' : 'text-red-700'
                        : theme === 'dark' ? 'text-slate-500 group-hover:text-white' : 'text-neutral-400'
                    }`} />
                    System Settings
                    {currentPageName === 'Settings' && <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full ${theme === 'dark' ? 'bg-white shadow-lg shadow-white/30' : 'hidden'}`} />}
                </Link>
                <button
                    onClick={toggleTheme}
                    className={`mt-3 flex items-center gap-3 px-6 lg:px-4 py-3 text-sm font-medium rounded-xl transition-all w-full ${
                        theme === 'dark' 
                            ? 'text-emerald-400 hover:bg-[#1E293B]' 
                            : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen z-10 relative">
        {/* Mobile Header */}
        <header className={`lg:hidden backdrop-blur-xl border-b px-4 h-16 flex items-center justify-between sticky top-0 z-40 transition-all duration-200 ${
            theme === 'dark' 
                ? 'bg-[#151E32]/70 border-white/5' 
                : 'bg-white/70 border-white/40'
        }`}>
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} className={theme === 'dark' ? 'hover:bg-[#1E293B]' : 'hover:bg-neutral-100 -ml-2'}>
                    <Menu className={`w-6 h-6 ${theme === 'dark' ? 'text-white' : 'text-neutral-700'}`} />
                </Button>
                <span className="font-bold text-lg">{branding.companyName}</span>
            </div>
            <div className="flex items-center gap-2">
               <Notifications />
               {branding.logoUrl && (
                 <Link to={createPageUrl('Dashboard')}>
                   <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 object-contain rounded-full" />
                 </Link>
               )}
            </div>
        </header>

        {/* Topbar Desktop - Enhanced Liquid Glass */}
        <header className={`hidden lg:flex backdrop-blur-xl border-b h-20 items-center justify-between px-8 sticky top-0 z-30 transition-all duration-300 ${
            theme === 'dark' 
                ? 'bg-[#0B1121]/40 border-white/10 shadow-lg shadow-black/5' 
                : 'bg-white/40 border-white/60 shadow-sm'
        }`}>
            <h1 className={`text-2xl font-bold ${
                theme === 'dark' 
                    ? (currentPageName === 'Settings' 
                        ? 'text-white' 
                        : (navigation.find(n => n.path === currentPageName)?.color 
                            ? darkColors[navigation.find(n => n.path === currentPageName).color].icon 
                            : 'text-emerald-400'))
                    : 'text-neutral-800'
            }`}>
                {navigation.find(n => n.path === currentPageName)?.name || (currentPageName === 'Settings' ? 'Settings' : 'Overview')}
            </h1>
            <div className="flex items-center gap-2 md:gap-4">
                <div className="hidden md:block">
                  <GlobalSearch />
                </div>
                <button
                    onClick={toggleTheme}
                    className={`p-2 rounded-lg transition-colors ${
                        theme === 'dark' 
                            ? 'hover:bg-[#1E293B] text-emerald-400' 
                            : 'hover:bg-neutral-100 text-neutral-600'
                    }`}
                >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <Notifications />
            </div>
        </header>

        {/* Page Content Scrollable Area - Transparent for blobs */}
        <main className={`flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth transition-colors duration-300 bg-transparent`}>
            <div className="max-w-7xl mx-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentPageName}
                        initial={{ opacity: 0, y: 10, scale: 0.98, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -10, scale: 0.98, filter: 'blur(10px)' }}
                        transition={{ 
                            type: "spring", 
                            stiffness: 100, 
                            damping: 20, 
                            mass: 0.5,
                            duration: 0.4
                        }}
                        className="min-h-full"
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </div>
        </main>
        
        <QuickActions />
        <MobileBottomNav activePage={currentPageName} />
        </div>

        {/* Overlay for Mobile */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  );
}

export default function Layout(props) {
  return (
    <SettingsProvider>
      <ActNowProvider>
          <AssistantProvider>
              <LayoutContent {...props} />
          </AssistantProvider>
      </ActNowProvider>
    </SettingsProvider>
  );
}