import React, { useState, useMemo } from 'react';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import OrganizationSettings from '@/components/settings/OrganizationSettings';
import ProfileSettings from '@/components/settings/ProfileSettings';
import PipelineSettings from '@/components/settings/PipelineSettings';
import TagSettings from '@/components/settings/TagSettings';
import TeamSettings from '@/components/settings/TeamSettings';
import CustomFieldSettings from '@/components/settings/CustomFieldSettings';
import IntegrationSettings from '@/components/settings/IntegrationSettings';
import AuditLogSettings from '@/components/settings/AuditLogSettings';
import UserManagement from '@/components/settings/UserManagement';
import OnboardingSettings from '@/components/settings/OnboardingSettings';
import SettingsOverview from '@/components/settings/SettingsOverview';
import { useSettings } from '@/components/context/SettingsContext';
import { usePermissions } from '@/components/hooks/usePermissions';
import { Input } from "@/components/ui/input";
import { 
    Building2, GitMerge, Tags, Bell, User, Shield, 
    Database, Users, Puzzle, Activity, PenTool, Lock, CheckSquare, Search, ArrowLeft, LayoutGrid
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const { theme } = useSettings();
  const { isAdminTier, isSupervisor, isSalesperson, isViewerSupport } = usePermissions();

  // Phase 3B visibility rules:
  //  - Super Admin / Administrator: all system configuration
  //  - Supervisor: Team & Users (read-only team-scoped) + personal
  //  - Salesperson / Viewer-Support: personal profile + notifications only
  // System configuration is never exposed to Salespeople or Viewer/Support.
  const menuGroups = useMemo(() => [
    {
        title: "General",
        items: [
            ...(isAdminTier ? [{ id: "organization", label: "Organization Settings", icon: Building2 }] : []),
            ...(isAdminTier || isSupervisor ? [{ id: "team", label: "Team & Users", icon: Users }] : []),
            ...(isAdminTier ? [{ id: "user_management", label: "Permissions & Roles", icon: Lock }] : []),
            ...(isAdminTier ? [{ id: "audit", label: "Audit Log", icon: Activity }] : []),
        ]
    },
    {
        title: "System Settings",
        items: [
            ...(isAdminTier ? [{ id: "pipeline", label: "Pipeline Stages", icon: GitMerge }] : []),
            ...(isAdminTier ? [{ id: "tags", label: "System Tags", icon: Tags }] : []),
            ...(isAdminTier ? [{ id: "onboarding", label: "Onboarding Templates", icon: CheckSquare }] : []),
            ...(isAdminTier ? [{ id: "custom_fields", label: "Custom Fields", icon: PenTool }] : []),
            ...(isAdminTier ? [{ id: "integrations", label: "Integrations", icon: Puzzle }] : []),
        ]
    },
    {
        title: "Personal",
        items: [
            { id: "profile", label: "My Profile", icon: User },
            { id: "notifications", label: "Notifications", icon: Bell },
        ]
    }
  ], [isAdminTier, isSupervisor]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return menuGroups;
    
    return menuGroups.map(group => ({
      ...group,
      items: group.items.filter(item => 
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(group => group.items.length > 0);
  }, [menuGroups, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto pb-20" dir="ltr">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400' : 'text-slate-900'}`}>
                    {activeTab === 'overview' ? 'Settings Hub' : 'System Settings'}
                </h1>
                <p className={`mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    {activeTab === 'overview' 
                        ? 'Central control panel for your organization and preferences' 
                        : 'Configure your workspace and preferences'}
                </p>
            </div>
            
            <div className="relative w-full md:w-80">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                <Input 
                    placeholder="Find a setting..." 
                    className={`pl-10 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white'}`}
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (activeTab === 'overview' && e.target.value) {
                            // optional: could auto-switch view or just filter the cards in overview
                        }
                    }}
                />
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 min-h-[600px]">
            {/* Sidebar Menu */}
            <aside className="w-full lg:w-64 flex-shrink-0">
                <nav className="flex flex-col gap-6">
                    <div className="space-y-1">
                         <button
                            onClick={() => setActiveTab("overview")}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left w-full
                                ${activeTab === "overview"
                                    ? theme === 'dark'
                                        ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 shadow-sm border border-cyan-500/30 font-bold"
                                        : "bg-slate-900 text-white shadow-sm font-bold"
                                    : theme === 'dark'
                                        ? "text-slate-100 hover:bg-slate-800"
                                        : "text-slate-700 hover:bg-slate-100"
                                }`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            <span>Dashboard Overview</span>
                        </button>
                    </div>

                    {filteredGroups.map((group, idx) => (
                        <div key={idx} className="space-y-1">
                            <h3 className={`px-2 text-xs font-semibold uppercase tracking-wider mb-2 ${
                                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                                {group.title}
                            </h3>
                            <div className="flex flex-col gap-1">
                                {group.items.map((item) => {
                                    const isActive = activeTab === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveTab(item.id)}
                                            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left w-full
                                                ${isActive 
                                                    ? theme === 'dark'
                                                        ? "bg-slate-700 text-cyan-400 shadow-sm border border-cyan-500/30 font-bold"
                                                        : "bg-white text-slate-900 shadow-sm border border-slate-200 font-bold"
                                                    : theme === 'dark'
                                                        ? "text-slate-100 hover:bg-slate-800 hover:text-cyan-400"
                                                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                                }`}
                                        >
                                            <item.icon className={`w-4 h-4 ${isActive ? (theme === 'dark' ? 'text-cyan-400' : 'text-slate-900') : (theme === 'dark' ? 'text-slate-200' : 'text-slate-600')}`} />
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
                
                <div className={`mt-8 mx-2 p-4 rounded-xl border ${theme === 'dark' ? 'bg-purple-500/10 border-purple-500/20' : 'bg-purple-50 border-purple-100'}`}>
                    <div className={`flex items-center gap-2 font-bold text-sm mb-2 ${theme === 'dark' ? 'text-purple-300' : 'text-purple-900'}`}>
                        <Shield className="w-4 h-4" />
                        Security
                    </div>
                    <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-purple-200/70' : 'text-purple-700/80'}`}>
                        Role, account-status, ownership, and transfer actions are recorded in the audit log. Not every setting change is automatically logged.
                    </p>
                </div>
            </aside>

            {/* Content Area */}
            <main className={`flex-1 rounded-xl shadow-sm border p-4 md:p-8 min-h-[500px] transition-colors ${
                theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
            }`}>
                {activeTab === "overview" && (
                    <SettingsOverview 
                        menuGroups={filteredGroups} 
                        onNavigate={(id) => {
                            setActiveTab(id);
                            setSearchQuery(""); // clear search on nav
                        }} 
                    />
                )}
                
                {activeTab !== "overview" && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="mb-6 flex items-center gap-2 lg:hidden">
                            <Button variant="ghost" size="sm" onClick={() => setActiveTab("overview")}>
                                <ArrowLeft className="w-4 h-4 mr-1" /> Back
                            </Button>
                        </div>
                        
                        {activeTab === "organization" && <OrganizationSettings />}
                        {activeTab === "profile" && <ProfileSettings />}
                        {activeTab === "pipeline" && <PipelineSettings />}
                        {activeTab === "tags" && <TagSettings />}
                        {activeTab === "onboarding" && <OnboardingSettings />}
                        {activeTab === "custom_fields" && <CustomFieldSettings />}
                        {activeTab === "integrations" && <IntegrationSettings />}
                        {activeTab === "team" && <TeamSettings />}
                        {activeTab === "audit" && <AuditLogSettings />}
                        {activeTab === "notifications" && <NotificationSettings />}
                        {activeTab === "user_management" && isAdminTier && <UserManagement />}
                    </div>
                )}
            </main>
        </div>
    </div>
  );
}