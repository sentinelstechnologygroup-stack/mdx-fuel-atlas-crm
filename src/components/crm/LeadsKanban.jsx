import React, { useState, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Trash2, Pencil, CheckCircle2, MessageCircle, ChevronLeft, ChevronRight, AlertCircle, Clock } from "lucide-react";
import moment from "moment";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { useSettings } from "@/components/context/SettingsContext";

export default function LeadsKanban({ leads, statuses, onStatusChange, onEdit, onDelete, onConvert, activities }) {
  const { theme } = useSettings();
  
  // Scroll Logic
  const scrollContainerRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      const scrollAbs = Math.abs(scrollLeft);
      const maxScroll = scrollWidth - clientWidth;
      
      if (scrollWidth <= clientWidth) {
        setShowLeftArrow(false);
        setShowRightArrow(false);
        return;
      }

      const isAtStart = scrollAbs < 5;
      const isAtEnd = scrollAbs >= maxScroll - 5;

      setShowLeftArrow(!isAtStart);
      setShowRightArrow(!isAtEnd);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [leads, statuses]);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({ 
        left: direction === 'left' ? -scrollAmount : scrollAmount, 
        behavior: 'smooth' 
      });
      setTimeout(checkScroll, 300);
    }
  };

  const getLeadsByStatus = (statusValue) => {
    return leads.filter(l => l.lead_status === statusValue);
  };

  const getLastActivityDate = (leadId) => {
    if (!activities) return null;
    const leadActivities = activities.filter(a => a.lead_id === leadId);
    if (!leadActivities.length) return null;
    const sorted = leadActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
    return sorted[0]?.date;
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    const lead = leads.find(l => l.id === draggableId);

    if (lead && lead.lead_status !== newStatus) {
      onStatusChange(lead.id, newStatus);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="relative h-full group/kanban isolate">
         {/* Scroll Hints */}
         {showRightArrow && (
            <Button 
                variant="secondary" 
                size="icon" 
                className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 h-16 w-8 rounded-l-xl rounded-r-none shadow-lg border transition-all ${
                  theme === 'dark' 
                    ? 'bg-slate-800/90 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 backdrop-blur-sm' 
                    : 'bg-white/90 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 backdrop-blur-sm'
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
                className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 h-16 w-8 rounded-r-xl rounded-l-none shadow-lg border transition-all ${
                  theme === 'dark' 
                    ? 'bg-slate-800/90 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 backdrop-blur-sm' 
                    : 'bg-white/90 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 backdrop-blur-sm'
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
        {statuses.map((status) => {
          const statusLeads = getLeadsByStatus(status.value);
          
          // Style extraction to match Opportunities minimalism
          const colorClass = status.color.split(' ').find(c => c.startsWith('text-'))?.replace('text-', 'bg-') || 'bg-slate-400';
          const lightClass = status.color.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('text-')).join(' ');

          return (
            <div key={status.value} className="flex-shrink-0 w-[40vw] sm:w-[40vw] md:w-48 lg:w-52 flex flex-col max-h-full">
              {/* Stage Header - Matched to Opportunities */}
              <div className="mb-3 px-1">
                <div className="flex items-center justify-between mb-2">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${lightClass} border border-transparent bg-opacity-20`}>
                        <span className="md:hidden">{status.mobileLabel || status.label}</span>
                        <span className="hidden md:inline">{status.label}</span>
                    </span>
                    <span className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-neutral-400'}`}>{statusLeads.length}</span>
                </div>
                <div className={`h-1 w-full rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-700' : 'bg-neutral-200'}`}>
                    <div className={`h-full ${colorClass}`} style={{ width: '100%' }}></div>
                </div>
              </div>

              {/* Droppable Area */}
              <Droppable droppableId={status.value}>
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
                    {statusLeads.map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`
                              cursor-grab active:cursor-grabbing hover:shadow-lg transition-all border shadow-sm group relative overflow-hidden backdrop-blur-md
                              ${snapshot.isDragging 
                                ? 'shadow-2xl rotate-2 scale-105 z-50 ring-2 ring-blue-500' 
                                : theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/80' : 'bg-white/60 border-white/50 hover:bg-white/80'}
                            `}
                            onClick={() => onEdit(lead)}
                          >
                             {/* Side Indicator */}
                            <div className={`absolute top-0 right-0 w-1 h-full ${colorClass}`} />
                            
                            <CardContent className="p-3 space-y-2">
                                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-400 hover:text-red-600 hover:bg-red-50"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if(window.confirm('Are you sure you want to delete this lead?')) onDelete(lead.id);
                                        }}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                    {status.value !== 'Converted' && (
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50"
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              onConvert(lead);
                                          }}
                                          title="Convert"
                                      >
                                          <CheckCircle2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                </div>

                                <div className={`text-sm font-bold transition-colors truncate ${theme === 'dark' ? 'text-white group-hover:text-teal-400' : 'text-neutral-800 group-hover:text-teal-600'}`}>
                                  {lead.full_name || "Unnamed Lead"}
                                </div>

                                {lead.phone_number && (
                                  <div className={`flex items-center gap-1.5 text-xs font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-neutral-700'}`}>
                                    <Phone className={`w-3 h-3 ${theme === 'dark' ? 'text-slate-500' : 'text-neutral-400'}`} />
                                    {lead.phone_number}
                                  </div>
                                )}

                                {(lead.city || lead.notes) && (
                                  <div className={`text-[10px] p-1.5 rounded-md line-clamp-2 leading-tight ${theme === 'dark' ? 'text-slate-400 bg-slate-900/50' : 'text-neutral-600 bg-neutral-50'}`}>
                                    {lead.notes || lead.city}
                                  </div>
                                )}

                                {getLastActivityDate(lead.id) ? (
                                  <div className={`flex items-center gap-1.5 text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-neutral-500'}`}>
                                    <Clock className="w-3 h-3" />
                                    <span>Last Activity: {moment(getLastActivityDate(lead.id)).format('DD/MM')}</span>
                                  </div>
                                ) : (
                                  <div className={`flex items-center gap-1.5 text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-neutral-400'}`}>
                                    <Clock className="w-3 h-3" /> No activity
                                  </div>
                                )}
                                
                                {moment(lead.updated_date).isBefore(moment().subtract(7, 'days')) && 
                                 !['Converted', 'Lost / Unqualified'].includes(lead.lead_status) && (
                                    <div className="text-[10px] text-amber-500 flex items-center gap-1 font-medium mt-1">
                                        <AlertCircle className="w-3 h-3" /> Stale ({moment(lead.updated_date).fromNow(true)})
                                    </div>
                                )}
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
          );
        })}
      </div>
      </div>
    </DragDropContext>
  );
}