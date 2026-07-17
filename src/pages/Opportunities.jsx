import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, LayoutGrid, List as ListIcon, Phone, Calendar, DollarSign, Briefcase, Trophy, Trash2, Search, ChevronLeft, ChevronRight, Plus, AlertCircle } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";
import { triggerConfetti } from "@/components/utils/confetti";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { processAutomation } from "@/components/automation/rulesEngine";
import OpportunityForm from "@/components/crm/OpportunityForm";
import { InlineEdit } from "@/components/ui/InlineEdit";
import { usePermissions } from '@/components/hooks/usePermissions';
import moment from "moment";
import SmartFilterBar from "@/components/common/SmartFilterBar";
import { useUrlFilters } from '@/components/hooks/useUrlFilters';

export default function OpportunitiesPage() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { pipelineStages, branding, theme } = useSettings();
  const [editingOpp, setEditingOpp] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState('kanban');
  
  // Transition Modal State
  const [transitionData, setTransitionData] = useState(null); // { opp, newStage }
  const [transitionType, setTransitionType] = useState(null); // 'lost', 'meeting'
  const [transitionInput, setTransitionInput] = useState(''); // reason or date
  
  // Smart Filters with URL Sync
  const { view: activeView, setView: setActiveView, filters: activeFilters, setFilters: setActiveFilters, setViewState, search, setSearch } = useUrlFilters('all');

  const queryClient = useQueryClient();
  const location = useLocation();
  
  const activeStages = pipelineStages || [];
  
  // Scroll Logic
  const scrollContainerRef = React.useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      // RTL Logic:
      // Start is Right (scrollLeft approx 0).
      // End is Left (scrollLeft approx -max or max depending on browser).
      // Let's use Math.abs to be safe(r).
      
      const scrollAbs = Math.abs(scrollLeft);
      const maxScroll = scrollWidth - clientWidth;
      
      // If no overflow
      if (scrollWidth <= clientWidth) {
        setShowLeftArrow(false);
        setShowRightArrow(false);
        return;
      }

      // Check if at Start (Right side)
      const isAtStart = scrollAbs < 5; // Tolerance
      // Check if at End (Left side)
      const isAtEnd = scrollAbs >= maxScroll - 5;

      // In LTR:
      // Start (Left) -> Can scroll Right. Show Right Arrow.
      // End (Right) -> Can scroll Left. Show Left Arrow.
      
      setShowLeftArrow(!isAtStart);
      setShowRightArrow(!isAtEnd);
    }
  };

  React.useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [activeStages, viewMode]);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200; // Adjusted for smaller columns
      // In RTL, scrollLeft is usually negative for "Left" direction
      // But scrollBy({ left: -320 }) moves left.
      scrollContainerRef.current.scrollBy({ 
        left: direction === 'left' ? -scrollAmount : scrollAmount, 
        behavior: 'smooth' 
      });
      // Check after scroll (timeout for smooth scroll)
      setTimeout(checkScroll, 300);
    }
  };

  const { data: opportunities, isLoading: isLoadingOpp } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => base44.entities.Opportunity.list(),
    initialData: []
  });

  const { data: leads, isLoading: isLoadingLeads } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list(),
    initialData: []
  });

  const isLoading = isLoadingOpp || isLoadingLeads;

  // Check for action=new or opportunityId in URL
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'new') {
        setEditingOpp(null);
        setShowForm(true);
        window.history.replaceState({}, '', location.pathname);
    } else if (params.get('opportunityId') && opportunities.length > 0) {
        const oppId = params.get('opportunityId');
        const opp = opportunities.find(o => o.id === oppId);
        if (opp) {
            setEditingOpp(opp);
            setShowForm(true);
            window.history.replaceState({}, '', location.pathname);
        }
    }
  }, [location, opportunities]);

  // --- Statistics Logic (New!) ---
  const stats = useMemo(() => {
    const totalPipeline = opportunities.reduce((acc, o) => acc + (o.loan_amount_requested || 0), 0);
    const totalDeals = opportunities.length;
    const wonDeals = opportunities.filter(o => o.deal_stage.includes('Won')).length;
    const activeDeals = opportunities.filter(o => !o.deal_stage.includes('Won') && !o.deal_stage.includes('Lost')).length;
    
    return { totalPipeline, totalDeals, wonDeals, activeDeals };
  }, [opportunities]);

  // Filter Schema
  const filterSchema = useMemo(() => [
    { 
        key: 'deal_stage', 
        label: 'Stage', 
        type: 'select', 
        options: (pipelineStages || []).map(s => ({ label: s.label, value: s.id })) 
    },
    { 
        key: 'product_type', 
        label: 'Product', 
        type: 'select', 
        options: ['Consulting', 'Service', 'Product', 'Software', 'Other'].map(p => ({ label: p, value: p })) 
    },
    { key: 'amount', label: 'Value >', type: 'number' } // Simple text input for now
  ], [pipelineStages]);

  const views = [
      { id: 'all', label: 'All Deals' },
      { id: 'pipeline', label: 'Active Pipeline' },
      { id: 'won', label: 'Closed Won' },
      { id: 'lost', label: 'Closed Lost' }
  ];

  const handleViewChange = (viewId) => {
      setViewState(viewId, {});
  };

  const createOppMutation = useMutation({
    mutationFn: (data) => base44.entities.Opportunity.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['opportunities']);
      setShowForm(false);
      processAutomation('Opportunity', 'create', data);
      setEditingOpp(null);
      alert("Opportunity created successfully");
    }
  });

  const updateOppMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Opportunity.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries(['opportunities']);
      const previousOpps = queryClient.getQueryData(['opportunities']);

      queryClient.setQueryData(['opportunities'], (old) => {
        return old.map((opp) => 
          opp.id === id ? { ...opp, ...data, updated_date: new Date().toISOString() } : opp
        );
      });

      return { previousOpps };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['opportunities'], context.previousOpps);
      alert("Failed to update opportunity");
    },
    onSettled: (data) => {
      queryClient.invalidateQueries(['opportunities']);
      if (data) {
          // Only trigger side effects like automation on success
          // We can't do this in onMutate easily
          // Note: editingOpp might be stale here, but fine for now
      }
    }
  });

  const deleteOppMutation = useMutation({
    mutationFn: (id) => base44.entities.Opportunity.delete(id),
    onSuccess: () => {
        queryClient.invalidateQueries(['opportunities']);
        alert("Opportunity deleted successfully");
    }
  });

  const executeStageChange = (opp, newStage, additionalData = {}) => {
      // Merge custom_data if it exists in additionalData to avoid overwriting
      const updatedCustomData = { 
          ...(opp.custom_data || {}), 
          ...(additionalData.custom_data || {}) 
      };
      
      const finalData = { 
          ...opp, 
          deal_stage: newStage, 
          ...additionalData,
          custom_data: updatedCustomData
      };

      updateOppMutation.mutate({
        id: opp.id,
        data: finalData
      });

      if (newStage.includes('Closed Won')) {
          // Trigger Automation
          base44.functions.invoke('convertOpportunityToClient', { opportunityId: opp.id });
          
          triggerConfetti();
          // Custom Toast Logic
          const toastEl = document.createElement('div');
          toastEl.className = "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-neutral-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in duration-300 flex items-center gap-3";
          toastEl.innerHTML = `<span class="text-2xl">🎉</span> <div><div class="font-bold">Congratulations!</div><div class="text-sm opacity-90">Another deal closed successfully!</div></div>`;
          document.body.appendChild(toastEl);
          setTimeout(() => {
              toastEl.classList.add('opacity-0', 'transition-opacity');
              setTimeout(() => document.body.removeChild(toastEl), 500);
          }, 3000);
      }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStage = destination.droppableId;
    const opp = opportunities.find(o => o.id === draggableId);
    
    if (opp && opp.deal_stage !== newStage) {
        // 1. Check for Closed Lost -> Reason Modal
        if (newStage === 'Closed Lost') {
            setTransitionData({ opp, newStage });
            setTransitionType('lost');
            setTransitionInput('');
            return;
        }

        // 2. Check for Meeting Scheduled -> Date Modal
        // Note: 'Meeting Scheduled' isn't in default stages, but user requested this specific flow.
        // We'll also apply it to 'Discovery' as that's often when meetings happen, for better UX.
        if (newStage === 'Meeting Scheduled' || newStage === 'Discovery') {
            setTransitionData({ opp, newStage });
            setTransitionType('meeting');
            // Default to tomorrow 10am
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(10, 0, 0, 0);
            setTransitionInput(moment(tomorrow).format('YYYY-MM-DDTHH:mm'));
            return;
        }

        // 3. Default Transition
        executeStageChange(opp, newStage);
    }
  };

  const handleTransitionSubmit = () => {
      if (!transitionData) return;
      
      const { opp, newStage } = transitionData;
      let additionalData = {};

      if (transitionType === 'lost') {
          if (!transitionInput.trim()) {
              alert("Please provide a reason for losing this deal.");
              return;
          }
          additionalData = {
              custom_data: { loss_reason: transitionInput }
          };
      } else if (transitionType === 'meeting') {
           if (!transitionInput) {
              alert("Please select a date and time.");
              return;
          }
          additionalData = {
              next_task: `Meeting on ${moment(transitionInput).format('MMM Do h:mm A')}`,
              custom_data: { next_meeting_date: transitionInput }
          };
      }

      executeStageChange(opp, newStage, additionalData);
      setTransitionData(null);
      setTransitionType(null);
      setTransitionInput('');
  };

  // Filter Logic
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(opp => {
        // 1. View Logic
        if (activeView === 'pipeline') {
            if (opp.deal_stage?.includes('Won') || opp.deal_stage?.includes('Lost')) return false;
        }
        if (activeView === 'won' && !opp.deal_stage?.includes('Won')) return false;
        if (activeView === 'lost' && !opp.deal_stage?.includes('Lost')) return false;

        // 2. Smart Filters
        if (activeFilters.deal_stage && opp.deal_stage !== activeFilters.deal_stage) return false;
        if (activeFilters.product_type && opp.product_type !== activeFilters.product_type) return false;
        if (activeFilters.amount && Number(opp.amount) < Number(activeFilters.amount)) return false;

        // 3. Search
        const term = search.toLowerCase().trim();
        if (term) {
            const leadName = (opp.lead_name || '').toLowerCase();
            const phone = (opp.phone_number || '').replace(/\D/g, '');
            const searchPhone = term.replace(/\D/g, '');
            const email = (opp.email || '').toLowerCase();
            const product = (opp.product_type || '').toLowerCase();
            
            const matches = leadName.includes(term) || 
                   phone.includes(searchPhone) || 
                   email.includes(term) ||
                   product.includes(term);
            if (!matches) return false;
        }

        return true;
    });
  }, [opportunities, search, activeView, activeFilters]);

  const getStageOpportunities = (stageId) => filteredOpportunities.filter(o => o.deal_stage === stageId);
  const calculateTotal = (stageId) => getStageOpportunities(stageId).reduce((acc, curr) => acc + (curr.loan_amount_requested || 0), 0);

  if (isLoading) return <div className="flex justify-center h-96 items-center"><Loader2 className="animate-spin w-8 h-8 text-teal-600" /></div>;

  return (
    <div className={`flex flex-col transition-colors duration-300 ${viewMode === 'kanban' ? 'h-[calc(100vh-140px)]' : 'h-full'} ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      
      {/* Smart Filter Bar & Actions */}
      <div className="mb-6">
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
                  <Button 
                      onClick={() => { setEditingOpp(null); setShowForm(true); }} 
                      size="sm"
                      className={`h-8 text-white shadow-lg rounded-lg ${
                          theme === 'dark' 
                              ? 'bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/30' 
                              : 'bg-purple-600 hover:bg-purple-700 shadow-purple-900/10'
                      }`}
                  >
                      <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4" /> 
                          <span className="text-xs font-medium">New Opportunity</span>
                      </div>
                  </Button>
                )}
            </SmartFilterBar>
      </div>

      {/* Stats Header (New!) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className={`p-4 rounded-2xl border flex items-center gap-3 shadow-lg backdrop-blur-xl transition-colors ${
              theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'
          }`}>
             <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}><DollarSign className="w-5 h-5"/></div>
             <div>
                 <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Total Pipeline Value</div>
                 <div className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{branding?.currency}{stats.totalPipeline.toLocaleString()}</div>
             </div>
          </div>
          <div className={`p-4 rounded-2xl border flex items-center gap-3 shadow-lg backdrop-blur-xl transition-colors ${
              theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'
          }`}>
             <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'}`}><Briefcase className="w-5 h-5"/></div>
             <div>
                 <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Active Deals</div>
                 <div className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{stats.activeDeals}</div>
             </div>
          </div>
          <div className={`p-4 rounded-2xl border flex items-center gap-3 shadow-lg backdrop-blur-xl transition-colors ${
              theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'
          }`}>
             <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}><Trophy className="w-5 h-5"/></div>
             <div>
                 <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>Closed Won</div>
                 <div className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>{stats.wonDeals}</div>
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

      {viewMode === 'kanban' ? (
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 relative h-full group/kanban isolate">
          {/* Scroll Hints */}
          {showRightArrow && (
            <Button 
                variant="secondary" 
                size="icon" 
                className={`absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-16 w-8 rounded-l-xl rounded-r-none shadow-lg border transition-all ${
                  theme === 'dark' 
                    ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700' 
                    : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
                onClick={() => scroll('right')}
            >
                <ChevronRight className="w-5 h-5" />
            </Button>
          )}
          
          {showLeftArrow && (
            <Button 
                variant="secondary" 
                size="icon" 
                className={`absolute -left-3 top-1/2 -translate-y-1/2 z-20 h-16 w-8 rounded-r-xl rounded-l-none shadow-lg border transition-all ${
                  theme === 'dark' 
                    ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700' 
                    : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
                onClick={() => scroll('left')}
            >
                <ChevronLeft className="w-5 h-5" />
            </Button>
          )}

          <div 
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex gap-4 overflow-x-auto pb-6 h-full items-start px-1 scroll-smooth"
          >
          {activeStages.map((stage) => {
            const stageOpps = getStageOpportunities(stage.id);
            const total = calculateTotal(stage.id);
            
            return (
            <div key={stage.id} className="flex-shrink-0 w-[40vw] sm:w-[40vw] md:w-48 lg:w-52 flex flex-col max-h-full">
              {/* Stage Header */}
              <div className="mb-3 px-1">
                <div className="flex items-center justify-between mb-2">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${stage.light || (theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-neutral-100 text-neutral-700')} border border-transparent`}>
                        {stage.label}
                    </span>
                    <span className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-400'}`}>{stageOpps.length}</span>
                </div>
                <div className={`h-1 w-full rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-700' : 'bg-neutral-200'}`}>
                    <div className={`h-full ${stage.color || 'bg-neutral-400'}`} style={{ width: '100%' }}></div>
                </div>
                {total > 0 && <div className={`text-xs font-medium mt-1 text-right ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'}`}>{branding?.currency}{total.toLocaleString()}</div>}
              </div>

              {/* Droppable Area */}
              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 overflow-y-auto px-1 space-y-3 min-h-[150px] transition-colors rounded-xl ${
                      snapshot.isDraggingOver 
                        ? theme === 'dark' ? 'bg-slate-800/50 ring-2 ring-dashed ring-slate-600' : 'bg-neutral-100/50 ring-2 ring-dashed ring-neutral-200' 
                        : ''
                    }`}
                  >
                    {stageOpps.map((opp, index) => (
                      <Draggable key={opp.id} draggableId={opp.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`
                              cursor-grab active:cursor-grabbing hover:shadow-lg transition-all border shadow-sm group relative overflow-hidden backdrop-blur-md
                              ${snapshot.isDragging ? 'shadow-2xl rotate-2 scale-105 z-50 ring-2 ring-teal-500' : theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'}
                            `}
                            onClick={() => { setEditingOpp(opp); setShowForm(true); }}
                          >
                            <div className={`absolute top-0 right-0 w-1 h-full ${stage.color || 'bg-neutral-300'}`} />
                            <CardContent className="p-3 space-y-2">
                              <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-400 hover:text-red-600 hover:bg-red-50"
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          if(window.confirm('Are you sure you want to delete this opportunity?')) deleteOppMutation.mutate(opp.id);
                                      }}
                                  >
                                      <Trash2 className="w-3 h-3" />
                                  </Button>
                              </div>

                              {(() => {
                                const lead = leads.find(l => l.id === opp.lead_id);
                                return (
                                  <>
                                    {/* שם */}
                                    <div className={`text-sm font-bold transition-colors truncate ${theme === 'dark' ? 'text-white group-hover:text-teal-400' : 'text-neutral-800 group-hover:text-teal-600'}`}>
                                      {opp.lead_name || "Unnamed Client"}
                                    </div>

                                    {/* טלפון */}
                                    {lead?.phone_number && (
                                      <div className={`flex items-center gap-1.5 text-xs font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-neutral-700'}`}>
                                        <Phone className={`w-3 h-3 ${theme === 'dark' ? 'text-slate-500' : 'text-neutral-400'}`} />
                                        {lead.phone_number}
                                      </div>
                                    )}

                                    {/* הערות */}
                                    {lead?.notes && (
                                      <div className={`text-[10px] p-1.5 rounded-md line-clamp-2 leading-tight ${theme === 'dark' ? 'text-slate-400 bg-slate-900/50' : 'text-neutral-600 bg-neutral-50'}`}>
                                        {lead.notes}
                                      </div>
                                    )}

                                    {/* שיחה אחרונה */}
                                    {lead?.last_contact_date && (
                                      <div className={`flex items-center gap-1.5 text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-neutral-500'}`}>
                                        <Calendar className="w-3 h-3" />
                                        <span>Last Contact: {moment(lead.last_contact_date).format('DD/MM')}</span>
                                      </div>
                                    )}
                                    
                                    {/* Stale Warning */}
                                    {moment(opp.updated_date).isBefore(moment().subtract(7, 'days')) && 
                                     !opp.deal_stage.includes('Won') && !opp.deal_stage.includes('Lost') && (
                                        <div className="text-[10px] text-amber-500 flex items-center gap-1 font-medium mt-1">
                                            <AlertCircle className="w-3 h-3" /> Stagnant ({moment(opp.updated_date).fromNow(true)})
                                        </div>
                                    )}
                                  </>
                                );
                              })()}
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )})}
        </div>
        </div>
      </DragDropContext>
      ) : (
        <div className={`rounded-xl border shadow-lg overflow-hidden flex flex-col transition-colors backdrop-blur-xl ${
          theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'
        }`}>
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className={`grid grid-cols-12 gap-4 px-6 py-3 border-b text-xs font-bold uppercase tracking-wide sticky top-0 z-10 transition-colors ${
                theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
            <div className="col-span-3 text-left">Client</div>
            <div className="col-span-2 text-left">Phone</div>
            <div className="col-span-4 text-left">Notes</div>
            <div className="col-span-2 text-left">Last Contact</div>
            <div className="col-span-1 text-right pr-4">Actions</div>
          </div>
          
          <div className={`divide-y transition-colors ${theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'}`}>
            {filteredOpportunities.map((opp) => {
              const stage = activeStages.find(s => s.id === opp.deal_stage);
              return (
                <div key={opp.id} className={`grid grid-cols-12 gap-4 px-6 py-4 items-start transition-colors group ${
                  theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50/80'
                }`}>
                  {(() => {
                    const lead = leads.find(l => l.id === opp.lead_id);
                    return (
                      <>
                        {/* שם */}
                        <div className="col-span-3 flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base ${
                            theme === 'dark' ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-50 text-purple-700'
                          }`}>
                            {opp.lead_name?.charAt(0) || '?'}
                          </div>
                          <div 
                            className={`text-base font-bold transition-colors cursor-pointer ${
                              theme === 'dark' ? 'text-white hover:text-purple-400' : 'text-slate-800 hover:text-purple-600'
                            }`}
                            onClick={() => { setEditingOpp(opp); setShowForm(true); }}
                          >
                            {opp.lead_name || 'Unnamed Client'}
                          </div>
                        </div>
                        
                        {/* טלפון */}
                        <div className={`col-span-2 text-base font-medium flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                          <Phone className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                          {lead?.phone_number || '-'}
                        </div>
                        
                        {/* הערות */}
                        <div className={`col-span-4 text-sm line-clamp-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`} title={lead?.notes}>
                          {lead?.notes || '-'}
                        </div>
                        
                        {/* שיחה אחרונה */}
                        <div className={`col-span-2 text-sm flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          <Calendar className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                          {lead?.last_contact_date ? moment(lead.last_contact_date).format('DD/MM/YYYY') : '-'}
                        </div>
                        
                        {/* פעולות */}
                        <div className="col-span-1 flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { setEditingOpp(opp); setShowForm(true); }}
                            className={`h-8 px-2 ${theme === 'dark' ? 'text-slate-500 hover:text-purple-400 hover:bg-purple-900/20' : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50'}`}
                            title={canEdit ? "Open Opportunity" : "View Opportunity"}
                          >
                            <Briefcase className="w-4 h-4" />
                          </Button>
                          {canDelete && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                if(window.confirm('האם אתה בטוח שברצונך למחוק הזדמנות זו?')) deleteOppMutation.mutate(opp.id);
                              }} 
                              className="h-8 px-2 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Delete Opportunity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              );
            })}
          </div>
            </div>
          </div>
        </div>
      )}

      {/* Transition Trigger Modal (Micro-Modal) */}
      <Dialog open={!!transitionData} onOpenChange={(open) => !open && setTransitionData(null)}>
        <DialogContent className={`sm:max-w-[425px] ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle>
                {transitionType === 'lost' ? '📉 Deal Lost' : '📅 Schedule Meeting'}
            </DialogTitle>
            <DialogDescription className={theme === 'dark' ? 'text-slate-400' : ''}>
                {transitionType === 'lost' 
                    ? "What was the main reason we lost this deal? This data is crucial for our strategy."
                    : "When is the meeting scheduled for?"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
              {transitionType === 'lost' ? (
                  <div className="space-y-2">
                      <Label htmlFor="loss-reason">Loss Reason</Label>
                      <Textarea 
                          id="loss-reason"
                          placeholder="e.g. Price too high, Competitor X feature..."
                          value={transitionInput}
                          onChange={(e) => setTransitionInput(e.target.value)}
                          className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}
                      />
                  </div>
              ) : (
                  <div className="space-y-2">
                      <Label htmlFor="meeting-date">Date & Time</Label>
                      <Input 
                          id="meeting-date"
                          type="datetime-local"
                          value={transitionInput}
                          onChange={(e) => setTransitionInput(e.target.value)}
                          className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}
                      />
                  </div>
              )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionData(null)}>Cancel</Button>
            <Button 
                onClick={handleTransitionSubmit}
                className={transitionType === 'lost' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}
            >
                {transitionType === 'lost' ? 'Mark as Lost' : 'Confirm Meeting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* טופס עריכה */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if(!open) setEditingOpp(null); }}>
        <DialogContent className={`fixed right-0 top-0 left-auto translate-x-0 translate-y-0 h-full w-full sm:w-[600px] max-w-none p-0 border-l shadow-2xl transition-all duration-300 gap-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right sm:rounded-none ${
            theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          {(showForm || editingOpp) && (
            <OpportunityForm 
              opportunity={editingOpp}
              onSubmit={(data) => {
                  if (editingOpp) {
                      updateOppMutation.mutate({ id: editingOpp.id, data });
                  } else {
                      createOppMutation.mutate(data);
                  }
              }}
              onCancel={() => setShowForm(false)}
              isSubmitting={updateOppMutation.isPending || createOppMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}