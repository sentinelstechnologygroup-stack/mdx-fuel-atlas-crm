import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Trash2, CheckCircle2 } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";

export default function LeadsKanban({ leads, statuses, onStatusChange, onEdit, onDelete, onConvert }) {
  const { theme } = useSettings();


  const getLeadsByStatus = (statusValue) => {
    return leads.filter(l => l.lead_status === statusValue);
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    const lead = leads.find(l => l.id === draggableId);

    if (lead && lead.lead_status !== newStatus) {
      if (lead.lead_status === 'Converted') return;
      if (newStatus === 'Converted') {
        onConvert(lead);
        return;
      }
      onStatusChange(lead.id, newStatus);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="relative h-full group/kanban isolate">


      <div
        className="
          grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3
          xl:grid-cols-7 gap-2 pb-4 h-full items-start px-1
          overflow-x-hidden
        "
      >
        {statuses.map((status) => {
          const statusLeads = getLeadsByStatus(status.value);

          // Style extraction to match Opportunities minimalism
          const colorClass = status.color.split(' ').find(c => c.startsWith('text-'))?.replace('text-', 'bg-') || 'bg-slate-400';
          const lightClass = status.color.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('text-')).join(' ');

          return (
            <div key={status.value} className="min-w-0 w-full flex flex-col max-h-full">
              {/* Stage Header - Matched to Opportunities */}
              <div className="mb-2 px-0.5">
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

                            <CardContent className="p-2 pr-3 space-y-1 min-h-[52px]">
                                <div className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-neutral-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (
                                        window.confirm(
                                          'Are you sure you want to delete this lead?'
                                        )
                                      ) {
                                        onDelete(lead.id);
                                      }
                                    }}
                                    title="Archive lead"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>

                                  {lead.lead_status === 'Qualified' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onConvert(lead);
                                      }}
                                      title="Convert qualified lead to opportunity"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>

                                <div
                                  className={`text-xs font-bold truncate pr-7 transition-colors ${
                                    theme === 'dark'
                                      ? 'text-white group-hover:text-teal-400'
                                      : 'text-neutral-800 group-hover:text-teal-600'
                                  }`}
                                  title={lead.full_name || "Unnamed Lead"}
                                >
                                  {lead.full_name || "Unnamed Lead"}
                                </div>

                                <div
                                  className={`flex items-center gap-1 text-[11px] font-medium truncate ${
                                    theme === 'dark'
                                      ? 'text-slate-300'
                                      : 'text-neutral-700'
                                  }`}
                                >
                                  <Phone
                                    className={`w-3 h-3 flex-shrink-0 ${
                                      theme === 'dark'
                                        ? 'text-slate-500'
                                        : 'text-neutral-400'
                                    }`}
                                  />

                                  <span className="truncate">
                                    {lead.phone_number || "No phone"}
                                  </span>
                                </div>
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
