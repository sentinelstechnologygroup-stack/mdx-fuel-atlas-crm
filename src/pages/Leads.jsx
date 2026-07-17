import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, Phone, MoreHorizontal, ArrowLeft, Upload, Filter, User, MessageCircle, Users, Activity, CheckCircle2, Pencil, Briefcase, Tag, ArrowUp, ArrowDown, ArrowUpDown, Trash2, LayoutGrid, List as ListIcon, Sparkles, Eye 
} from "lucide-react";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import LeadForm from "@/components/crm/LeadForm";
import LeadsKanban from "@/components/crm/LeadsKanban";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { processAutomation } from "@/components/automation/rulesEngine";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { InlineEdit } from "@/components/ui/InlineEdit";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/components/context/SettingsContext";
import AiLeadImport from "@/components/crm/AiLeadImport";
import { usePermissions } from '@/components/hooks/usePermissions';
import SmartFilterBar from "@/components/common/SmartFilterBar";
import { useUrlFilters } from '@/components/hooks/useUrlFilters';

import { useLocation } from "react-router-dom";

export default function LeadsPage() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { leadStatuses, theme } = useSettings();
  const location = useLocation();
  
  // Custom statuses to match LeadForm exactly - with Neon support for Dark Mode
  const displayStatuses = useMemo(() => {
    if (theme === 'dark') {
      return [
        { value: "New", label: "New", color: "bg-cyan-950/40 text-cyan-300 border-cyan-800 ring-1 ring-cyan-500/50 shadow-[0_0_8px_rgba(34,211,238,0.2)]" },
        { value: "Attempting Contact", label: "Attempting Contact", mobileLabel: "Attempting", color: "bg-violet-950/40 text-violet-300 border-violet-800 ring-1 ring-violet-500/50 shadow-[0_0_8px_rgba(167,139,250,0.2)]" },
        { value: "Contacted - Qualifying", label: "Qualifying", color: "bg-fuchsia-950/40 text-fuchsia-300 border-fuchsia-800 ring-1 ring-fuchsia-500/50 shadow-[0_0_8px_rgba(232,121,249,0.2)]" },
        { value: "Sales Ready", label: "Sales Ready", color: "bg-yellow-950/40 text-yellow-300 border-yellow-800 ring-1 ring-yellow-500/50 shadow-[0_0_8px_rgba(250,204,21,0.2)]" },
        { value: "Converted", label: "Converted", color: "bg-emerald-950/40 text-emerald-300 border-emerald-800 ring-1 ring-emerald-500/50 shadow-[0_0_8px_rgba(52,211,153,0.2)]" },
        { value: "Lost / Unqualified", label: "Lost / Unqualified", color: "bg-slate-900/50 text-slate-500 border-slate-800" }
      ];
    }
    return [
      { value: "New", label: "New", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
      { value: "Attempting Contact", label: "Attempting Contact", mobileLabel: "Attempting", color: "bg-violet-50 text-violet-700 border-violet-200" },
      { value: "Contacted - Qualifying", label: "Qualifying", color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
      { value: "Sales Ready", label: "Sales Ready", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
      { value: "Converted", label: "Converted", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      { value: "Lost / Unqualified", label: "Lost / Unqualified", color: "bg-slate-100 text-slate-500 border-slate-200" }
    ];
  }, [theme]);
  
  
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [viewMode, setViewMode] = useState('kanban'); // Default to kanban view
  
  // Smart Filters with URL Sync
  const { view: activeView, setView: setActiveView, filters: activeFilters, setFilters: setActiveFilters, setViewState, search, setSearch } = useUrlFilters('all');
  
  const [sortConfig, setSortConfig] = useState({ key: 'created_date', direction: 'desc' });
  const [showAiImport, setShowAiImport] = useState(false);

  // Check for action=new or action=ai-import in URL
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'new') {
        setEditingLead(null);
        setShowLeadForm(true);
        // Clean URL
        window.history.replaceState({}, '', location.pathname);
    } else if (params.get('action') === 'ai-import') {
        setShowAiImport(true);
        // Clean URL
        window.history.replaceState({}, '', location.pathname);
    }
  }, [location]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };


  const queryClient = useQueryClient();

  // שליפת נתונים
  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list(),
    initialData: []
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  const { data: activities } = useQuery({
    queryKey: ['activities'],
    queryFn: () => base44.entities.Activity.list(),
    initialData: []
  });

  // Get last activity date for each lead
  const getLastActivityDate = (leadId) => {
    const leadActivities = activities.filter(a => a.lead_id === leadId);
    if (!leadActivities.length) return null;
    const sorted = leadActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
    return sorted[0]?.date;
  };

  const uniqueTags = useMemo(() => {
    const tags = new Set();
    leads.forEach((lead) => {
      if (lead.tags && Array.isArray(lead.tags)) {
        lead.tags.forEach((tag) => tags.add(tag));
      }
    });
    return Array.from(tags);
  }, [leads]);

  // Schema for SmartFilterBar
  const filterSchema = useMemo(() => [
    { 
        key: 'status', 
        label: 'Status', 
        type: 'select', 
        options: leadStatuses.map(s => ({ label: s.label, value: s.value })) 
    },
    { 
        key: 'tag', 
        label: 'Tag', 
        type: 'select', 
        options: uniqueTags.map(t => ({ label: t, value: t })) 
    },
    {
        key: 'source_year',
        label: 'Year',
        type: 'select',
        options: ['2023', '2024', '2025'].map(y => ({ label: y, value: y }))
    },
    { key: 'city', label: 'City', type: 'text' }
  ], [leadStatuses, uniqueTags]);

  const actionRequiredCount = useMemo(() => {
      return leads.filter(l => l.lead_status === 'Attempting Contact').length;
  }, [leads]);

  const views = [
      { id: 'all', label: 'All Leads' },
      { id: 'new', label: 'New Today' },
      { id: 'my_leads', label: 'My Leads' },
      { id: 'requires_action', label: (
          <span className="flex items-center gap-2">
             Action Required 
             {actionRequiredCount > 0 && <span className="flex h-2 w-2 rounded-full bg-red-500" />}
          </span>
      ) },
  ];

  const handleViewChange = (viewId) => {
      // Use atomic update to prevent race conditions between view and filters
      const newFilters = {};
      if (viewId === 'new') newFilters.status = 'New';
      if (viewId === 'requires_action') newFilters.status = 'Attempting Contact';
      
      setViewState(viewId, newFilters);
  };

  // חישוב סטטיסטיקות
  const stats = useMemo(() => {
    const total = leads.length;
    const convertedCount = leads.filter((l) => l.lead_status.includes('Converted')).length;
    const conversionRate = total > 0 ? (convertedCount / total * 100).toFixed(1) : 0;
    return { total, conversionRate };
  }, [leads]);

  // מוטציות (פעולות שרת)
  const createLead = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: async (data) => {
      queryClient.invalidateQueries(['leads']);
      // No automatic close - handled by handlers
      processAutomation('Lead', 'create', data);

      // Create notification
      try {
          // In a real app, you'd fetch the admin email or iterate relevant users
          const currentUser = await base44.auth.me();
          await base44.entities.Notification.create({
              title: 'ליד חדש התקבל',
              message: `${data.full_name} - ${data.phone_number}`,
              type: 'lead',
              related_entity_type: 'Lead',
              related_entity_id: data.id,
              user_email: currentUser.email, // Notify self for now, should be 'admin' or logic
              is_read: false
          });
      } catch (e) { console.error("Failed to create notification", e); }
    }
  });

  const updateLead = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['leads']);
      const previousLeads = queryClient.getQueryData(['leads']);

      // Optimistically update
      queryClient.setQueryData(['leads'], (old) => {
        return old.map((lead) => 
          lead.id === id ? { ...lead, ...data, updated_date: new Date().toISOString() } : lead
        );
      });

      return { previousLeads };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['leads'], context.previousLeads);
      alert("Failed to update lead");
    },
    onSettled: () => {
      queryClient.invalidateQueries(['leads']);
    }
  });

  const deleteLead = useMutation({
    mutationFn: (id) => base44.entities.Lead.update(id, { is_deleted: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads']);
      alert("הליד הועבר לארכיון בהצלחה (מחיקה רכה)");
    }
  });

  const convertToOpportunity = useMutation({
    mutationFn: async (leadData) => {
      await base44.entities.Lead.update(leadData.id, { lead_status: "Converted" });
      return await base44.entities.Opportunity.create({
        lead_id: leadData.id,
        lead_name: leadData.full_name,
        phone_number: leadData.phone_number,
        email: leadData.email,
        product_type: "Reverse Mortgage",
        deal_stage: "New (חדש)",
        probability: 10
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['opportunities']);
      queryClient.invalidateQueries(['leads']);
      processAutomation('Opportunity', 'create', data);
      alert("🎉 הליד הפך להזדמנות בהצלחה!");
    }
  });

  // Filter Logic
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Soft Delete
      if (lead.is_deleted) return false;

      // 2. RLS
      if (currentUser && currentUser.role !== 'admin') {
         const isCreator = lead.created_by === currentUser.email;
         const isAssigned = lead.assigned_to === currentUser.email;
         if (!isCreator && !isAssigned) return false;
      }

      // 3. View Logic
      if (activeView === 'my_leads') {
          if (lead.assigned_to !== currentUser?.email) return false;
      }
      if (activeView === 'new') {
           // Simple "New" status check for now, ideally check created_date === today
           // if (lead.lead_status !== 'New') return false; 
           // Better: Created Today
           const isToday = new Date(lead.created_date).toDateString() === new Date().toDateString();
           if (!isToday) return false;
      }

      // 4. Smart Filters
      if (activeFilters.status && lead.lead_status !== activeFilters.status) return false;
      if (activeFilters.tag && (!lead.tags || !lead.tags.includes(activeFilters.tag))) return false;
      if (activeFilters.source_year && String(lead.source_year) !== activeFilters.source_year) return false;
      if (activeFilters.city && (!lead.city || !lead.city.toLowerCase().includes(activeFilters.city.toLowerCase()))) return false;

      // 5. Search
      const searchTerm = search.toLowerCase().trim();
      if (searchTerm) {
          const matchesName = (lead.full_name || "").toLowerCase().includes(searchTerm);
          const matchesPhone = (lead.phone_number || "").includes(searchTerm);
          if (!matchesName && !matchesPhone) return false;
      }

      return true;
    }).sort((a, b) => {
      if (!sortConfig.key) return b.id - a.id; // Default sort by ID descending

      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle null/undefined
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Specific handling for numbers if needed, but currently fields are strings/mixed
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [leads, currentUser, activeView, activeFilters, search, sortConfig]);

  return (
    <div className={`flex flex-col transition-colors duration-300 ${viewMode === 'kanban' ? 'min-h-[calc(100dvh-100px)] md:h-[calc(100vh-140px)]' : 'min-h-full pb-24 md:pb-0'} ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      
      {/* Smart Filter Bar & Actions */}
      <div className="mb-6 z-40 relative">
        <SmartFilterBar 
            views={views}
            activeView={activeView}
            onViewChange={handleViewChange}
            schema={filterSchema}
            filters={activeFilters}
            onFilterChange={setActiveFilters}
            search={search}
            onSearchChange={setSearch}
        >
            {canCreate && (
            <div className="flex gap-2">
                <Button 
                    onClick={() => setShowAiImport(true)}
                    size="sm"
                    className={`h-8 rounded-lg border border-transparent bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-purple-600 hover:from-purple-500/20 hover:to-blue-500/20 ${
                        theme === 'dark' ? 'text-purple-300' : ''
                    }`}
                >
                    <Sparkles className="w-3.5 h-3.5 md:mr-2" />
                    <span className="hidden md:inline text-xs font-medium">AI Import</span>
                </Button>
                <Button size="sm" onClick={() => setShowLeadForm(true)} className={`h-8 rounded-lg shadow-lg shadow-indigo-500/20 ${
                    theme === 'dark' 
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}>
                    <Plus className="w-4 h-4 md:mr-1" />
                    <span className="hidden md:inline text-xs font-medium">New</span>
                </Button>
            </div>
            )}
        </SmartFilterBar>
      </div>

      {/* Stats Header (New!) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 mb-6">
           <div className={`p-4 rounded-2xl border flex items-center gap-3 shadow-lg backdrop-blur-xl transition-colors ${
               theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'
           }`}>
              <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}><Users className="w-5 h-5"/></div>
              <div>
                  <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Total Leads</div>
                  <div className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{stats.total}</div>
              </div>
           </div>
           <div className={`p-4 rounded-2xl border flex items-center gap-3 shadow-lg backdrop-blur-xl transition-colors ${
               theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'
           }`}>
              <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'}`}><CheckCircle2 className="w-5 h-5"/></div>
              <div>
                  <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Converted</div>
                  <div className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{stats.conversionRate}%</div>
              </div>
           </div>
           <div className={`p-4 rounded-2xl border flex items-center gap-3 shadow-lg backdrop-blur-xl transition-colors ${
               theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'
           }`}>
              <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}><Activity className="w-5 h-5"/></div>
              <div>
                  <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Active</div>
                  <div className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{leads.filter((l) => !l.lead_status.includes('Converted')).length}</div>
              </div>
           </div>
           <div className="flex items-center justify-end gap-2">
             <div className={`p-1 rounded-xl border shadow-sm flex gap-1 h-fit transition-colors ${
                 theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-neutral-200'
             }`}>
                 <Button variant="ghost" size="sm" onClick={() => setViewMode('kanban')} className={viewMode === 'kanban' 
                     ? theme === 'dark' ? 'bg-slate-700 text-cyan-400 shadow-sm' : 'bg-neutral-100 text-neutral-900 shadow-sm'
                     : theme === 'dark' ? 'text-slate-400 hover:text-cyan-400' : 'text-neutral-500'}>
                     <LayoutGrid className="w-4 h-4 mr-2" /> Board
                 </Button>
                 <Button variant="ghost" size="sm" onClick={() => setViewMode('list')} className={viewMode === 'list' 
                     ? theme === 'dark' ? 'bg-slate-700 text-cyan-400 shadow-sm' : 'bg-neutral-100 text-neutral-900 shadow-sm'
                     : theme === 'dark' ? 'text-slate-400 hover:text-cyan-400' : 'text-neutral-500'}>
                     <ListIcon className="w-4 h-4 mr-2" /> List
                 </Button>
             </div>
           </div>
      </div>

      {/* --- תצוגת קאנבן --- */}
      {viewMode === 'kanban' && (
        <div className="h-[75vh] md:h-auto md:flex-1 md:min-h-0 w-full overflow-hidden">
            <LeadsKanban 
                leads={filteredLeads} 
                statuses={displayStatuses}
                activities={activities}
                onStatusChange={(id, status) => updateLead.mutate({ id, data: { lead_status: status } })}
                onEdit={(lead) => { setEditingLead(lead); setShowLeadForm(true); }}
                onDelete={(id) => { if (window.confirm('למחוק ליד?')) deleteLead.mutate(id); }}
                onConvert={(lead) => convertToOpportunity.mutate(lead)}
            />
        </div>
      )}

      {/* --- תצוגת רשימה (דסקטופ + מובייל) --- */}
      {viewMode === 'list' && (
        <div className="space-y-6">
      {/* --- תצוגת דסקטופ (טבלה) --- */}
      <div className={`hidden md:block rounded-xl border shadow-lg overflow-hidden transition-colors backdrop-blur-xl ${
        theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'
      }`}>
         <div className={`grid grid-cols-12 gap-4 px-6 py-3 border-b text-xs font-bold uppercase tracking-wide select-none transition-colors ${
           theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
         }`}>
            <div className="col-span-3 text-left flex items-center gap-1 cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('full_name')}>
                Client
                {sortConfig.key === 'full_name' ?
            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" /> :
            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-30 hover:opacity-100" />}
            </div>
            <div className="col-span-2 text-left flex items-center gap-1 cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('lead_status')}>
                Status
                {sortConfig.key === 'lead_status' ?
            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" /> :
            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-30 hover:opacity-100" />}
            </div>
            <div className="col-span-2 text-left flex items-center gap-1 cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('phone_number')}>
                Contact Info
                {sortConfig.key === 'phone_number' ?
            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" /> :
            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-30 hover:opacity-100" />}
            </div>
            <div className="col-span-2 text-left flex items-center gap-1 cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('created_date')}>
                Created Date
                {sortConfig.key === 'created_date' ?
            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" /> :
            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-30 hover:opacity-100" />}
            </div>
            <div className="col-span-1 text-left flex items-center gap-1 cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('source_year')}>
                Year
                {sortConfig.key === 'source_year' ?
            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" /> :
            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-30 hover:opacity-100" />}
            </div>
            <div className="col-span-2 text-right pr-4">Actions</div>
        </div>

        <div className={`divide-y transition-colors ${
          theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'
        }`}>
            {isLoading ? <div className={`p-10 text-center ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>טוען נתונים...</div> :
          filteredLeads.map((lead) =>
          <div key={lead.id} className={`grid grid-cols-12 gap-4 px-6 py-3 items-center transition-colors group ${
            theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50/80'
          }`}>
                    <div className="col-span-3 flex items-center gap-3">
                         <LeadAvatar lead={lead} className="w-10 h-10 flex-shrink-0" />
                         <div className="flex-1">
                            <Link to={`${createPageUrl('LeadDetails')}?leadId=${lead.id}`} className={`font-bold transition-colors ${
                              theme === 'dark' ? 'text-white hover:text-cyan-400' : 'text-slate-800 hover:text-red-600'
                            }`}>
                                {lead.full_name}
                            </Link>
                            <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{lead.city}</div>
                            {getLastActivityDate(lead.id) && (
                              <div className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5">
                                ✓ Last Activity: {new Date(getLastActivityDate(lead.id)).toLocaleDateString('en-US')}
                              </div>
                            )}
                            {lead.tags && lead.tags.length > 0 &&
                    <div className="flex flex-wrap gap-1 mt-1">
                                    {lead.tags.map((tag, i) =>
                    <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded border border-slate-200">{tag}</span>
                    )}
                                </div>
                    }
                         </div>
                    </div>
                    <div className="col-span-2">
                        <StatusBadge lead={lead} statuses={displayStatuses} updateLead={updateLead} convert={convertToOpportunity} />
                    </div>
                    <div className={`col-span-2 text-sm flex items-center gap-2 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-600'}`}>
                        <Phone className={`w-4 h-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-slate-400'}`} />
                        <InlineEdit 
                          value={lead.phone_number} 
                          type="tel" 
                          className={`font-mono ${theme === 'dark' ? 'text-slate-100 font-medium' : 'text-slate-800'}`} 
                          onSave={(v) => updateLead.mutate({ id: lead.id, data: { phone_number: v } })} 
                        />
                        {lead.phone_number && <WhatsAppBtn phone={lead.phone_number} />}
                    </div>
                    <div className={`col-span-2 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {lead.created_date ? new Date(lead.created_date).toLocaleDateString('en-US') : '-'}
                        <br/>
                        <span className="text-[10px] opacity-70">{lead.created_date ? new Date(lead.created_date).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                    </div>
                    <div className={`col-span-1 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                        {lead.source_year}
                    </div>
                    <div className="col-span-2 flex justify-end gap-1">
                        <div className="flex items-center justify-end gap-1">
                            {canDelete && (
                                <Button variant="ghost" size="sm" onClick={() => {
                        if (window.confirm('Are you sure you want to delete this lead? This action cannot be undone.')) deleteLead.mutate(lead.id);
                        }} className="h-8 px-2 text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete Lead">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => {setEditingLead(lead);setShowLeadForm(true);}} className="h-8 px-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50" title={canEdit ? "Edit Lead" : "View Lead"}>
                                {canEdit ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            {canEdit && (lead.lead_status === 'Converted' ?
                        <div className="h-8 px-2 flex items-center justify-center text-emerald-600" title="Converted to Opportunity">
                                    <CheckCircle2 className="w-5 h-5 fill-emerald-100" />
                                </div> :

                        <Button variant="ghost" size="sm" onClick={() => convertToOpportunity.mutate(lead)} className="h-8 px-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" title="Convert to Opportunity">
                                    <CheckCircle2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
          )}
        </div>
      </div>

      {/* --- תצוגת מובייל (כרטיסים) --- */}
      <div className="md:hidden space-y-4">
         {filteredLeads.map((lead) =>
        <div key={lead.id} className={`p-4 rounded-xl shadow-lg border flex flex-col gap-3 transition-colors backdrop-blur-xl ${
          theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'
        }`}>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <LeadAvatar lead={lead} className="w-12 h-12 flex-shrink-0" />
                        <div>
                            <Link to={`${createPageUrl('LeadDetails')}?leadId=${lead.id}`} className={`font-bold text-lg transition-colors block ${
                              theme === 'dark' ? 'text-white hover:text-cyan-400' : 'text-slate-900 hover:text-red-600'
                            }`}>
                                {lead.full_name}
                            </Link>
                            <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{lead.city}</div>
                            {getLastActivityDate(lead.id) && (
                              <div className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                                ✓ פעילות אחרונה: {new Date(getLastActivityDate(lead.id)).toLocaleDateString('he-IL')}
                              </div>
                            )}
                            {lead.tags && lead.tags.length > 0 &&
                    <div className="flex flex-wrap gap-1 mt-1">
                                    {lead.tags.map((tag, i) =>
                    <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded border border-slate-200">{tag}</span>
                    )}
                                </div>
                    }
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                if (window.confirm('האם אתה בטוח שברצונך למחוק ליד זה?')) deleteLead.mutate(lead.id);
              }} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {setEditingLead(lead);setShowLeadForm(true);}} className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                            <Pencil className="w-4 h-4" />
                        </Button>
                        {lead.lead_status === 'Converted' ?
              <div className="h-8 w-8 flex items-center justify-center text-emerald-600">
                                <CheckCircle2 className="w-5 h-5 fill-emerald-100" />
                            </div> :

              <Button variant="ghost" size="icon" onClick={() => convertToOpportunity.mutate(lead)} className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50">
                                <CheckCircle2 className="w-4 h-4" />
                            </Button>
              }
                    </div>
                    </div>

                    <div className={`p-3 rounded-lg flex items-center justify-between border transition-colors ${
                      theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'
                    }`}>
                     <InlineEdit 
                        value={lead.phone_number} 
                        type="tel" 
                        className={`font-mono font-medium ${theme === 'dark' ? 'text-slate-100' : 'text-slate-700'}`} 
                        onSave={(v) => updateLead.mutate({ id: lead.id, data: { phone_number: v } })} 
                     />
                     {lead.phone_number && <WhatsAppBtn phone={lead.phone_number} />}
                    </div>

                    <div className="flex items-center justify-between mt-1">
                    <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{lead.source_year}</span>
                    </div>
            </div>
        )}
      </div>
      </div>
      )}

      {/* Smart Slide-Over (Sheet) */}
      <Dialog open={showLeadForm} onOpenChange={(open) => {setShowLeadForm(open);if (!open) setEditingLead(null);}}>
        <DialogContent className={`fixed right-0 top-0 left-auto translate-x-0 translate-y-0 h-full w-full sm:w-[550px] max-w-none p-0 border-l shadow-2xl transition-all duration-300 gap-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right sm:rounded-none ${
            theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {editingLead ? 'Edit Lead' : 'Create New Lead'}
                </h2>
                {/* Close button is automatically added by DialogContent usually, but we can add custom header controls here if needed */}
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <LeadForm
            lead={editingLead}
            onSaveAndClose={(data) => {
              const wasConverted = editingLead?.lead_status === 'Converted';
              const isNowConverted = data.lead_status === 'Converted';
              
              if (isNowConverted && !wasConverted) {
                // המרה חדשה - צריך ליצור הזדמנות
                if (editingLead) {
                  convertToOpportunity.mutate({ ...editingLead, ...data });
                } else {
                  // ליד חדש שנוצר כבר כ-Converted
                  createLead.mutate(data);
                }
              } else {
                // עדכון רגיל או יצירה רגילה
                editingLead ? updateLead.mutate({ id: editingLead.id, data }) : createLead.mutate(data);
              }
              setShowLeadForm(false);
              setEditingLead(null);
            }}
            onSaveAndStay={(data) => {
              const wasConverted = editingLead?.lead_status === 'Converted';
              const isNowConverted = data.lead_status === 'Converted';
              
              if (isNowConverted && !wasConverted && editingLead) {
                // המרה חדשה - צריך ליצור הזדמנות ולהישאר בתיק
                convertToOpportunity.mutate({ ...editingLead, ...data });
              } else if (editingLead) {
                // עדכון רגיל
                updateLead.mutate({ id: editingLead.id, data });
              }
            }}
            onCancel={() => { setShowLeadForm(false); setEditingLead(null); }}
            isSubmitting={createLead.isPending || updateLead.isPending} />
            </div>
        </DialogContent>
      </Dialog>

      {/* דיאלוג ייבוא AI */}
      <AiLeadImport 
        open={showAiImport}
        onOpenChange={setShowAiImport}
        onLeadCreated={(leadData) => createLead.mutate(leadData)}
      />
    </div>
  );
}

// קומפוננטות עזר קטנות
function StatCard({ icon: Icon, label, value, color }) {
  const { theme } = useSettings();
  return (
    <Card className={`border shadow-lg backdrop-blur-xl transition-colors overflow-hidden ${
      theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'
    }`}>
            <CardContent className="p-4 flex flex-row items-center justify-start gap-4 text-left h-full">
                <div className={`p-3 rounded-xl flex-shrink-0 ${color}`}><Icon className="w-5 h-5" /></div>
                <div className="min-w-0">
                    <p className={`text-xs md:text-sm font-medium truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
                    <p className={`text-lg md:text-2xl font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{value}</p>
                </div>
            </CardContent>
        </Card>);
}

function WhatsAppBtn({ phone }) {
  const cleanNum = phone.replace(/\D/g, '').replace(/^0/, '');
  return (
    <Button
      size="icon" variant="ghost" className="h-7 w-7 text-green-600 bg-green-50 hover:bg-green-100 rounded-full"
      onClick={() => window.open(`https://wa.me/972${cleanNum}`, '_blank')}>

            <MessageCircle className="w-4 h-4" />
        </Button>);

}

function StatusBadge({ lead, statuses, updateLead, convert }) {
  return (
    <InlineEdit
      type="select"
      value={lead.lead_status}
      options={statuses}
      onSave={(val) => val === 'Converted' ? convert.mutate(lead) : updateLead.mutate({ id: lead.id, data: { lead_status: val } })}
      formatDisplay={(val) => {
        const s = statuses.find((o) => o.value === val);
        const isRevival = val === 'revival_2023' || s?.label?.includes('החייאה');
        return <Badge variant="outline" className={`${isRevival ? 'text-red-600 font-bold border-red-200 bg-red-50' : s?.color?.replace('font-medium', '') || 'bg-slate-100 text-slate-900 font-normal'} border-0 px-3 py-1 w-full justify-start`}>{s?.label || val}</Badge>;
      }} />);
}

function LeadAvatar({ lead, className }) {
  const { theme } = useSettings();
  const score = lead.ai_quality_score || 0;
  const temp = lead.lead_temperature || 'Cold';
  
  const isHot = temp === 'Hot' || score >= 80;
  const isWarm = temp === 'Warm' || (score >= 50 && score < 80);
  
  // Dynamic glow color
  const glowColor = isHot ? 'bg-red-500' : isWarm ? 'bg-amber-400' : 'bg-blue-400';
  const ringColor = isHot ? 'ring-red-500' : isWarm ? 'ring-amber-400' : 'ring-blue-200';
  
  return (
    <div className={`relative group ${className}`}>
      {/* Pulse Effect for Hot/Warm */}
      {(isHot || isWarm) && (
        <span className={`absolute -inset-1 rounded-full opacity-30 animate-pulse blur-sm ${glowColor}`}></span>
      )}
      
      {/* Avatar Circle */}
      <div className={`w-full h-full rounded-full flex items-center justify-center font-bold text-sm relative z-10 transition-all border-2 ${
        theme === 'dark' 
          ? `bg-slate-800 text-white ${isHot ? 'border-red-500/50' : 'border-slate-700'}` 
          : `bg-white text-slate-700 ${isHot ? 'border-red-200' : 'border-slate-200'}`
      }`}>
        {lead.full_name?.charAt(0)}
      </div>

      {/* Status Dot */}
      <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 rounded-full z-20 ${
          theme === 'dark' ? 'border-slate-900' : 'border-white'
      } ${glowColor}`}></span>
      
      {/* Tooltip for AI Score (Optional) */}
      {score > 0 && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-30 pointer-events-none">
              Score: {score}
          </div>
      )}
    </div>
  );
}