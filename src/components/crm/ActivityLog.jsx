import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  FileText,
  FileCheck,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Voicemail,
  User,
  Sparkles,
  Loader2,
  Undo2,
  Zap,
  Flag,
  Target,
  Pencil } from
"lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ActivityForm from "./ActivityForm";

export default function ActivityLog({ leadId, opportunityId }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);

  const queryClient = useQueryClient();

  // Fetch Activities
  const { data: activities, isLoading } = useQuery({
    queryKey: ['activities', leadId],
    queryFn: () => base44.entities.Activity.filter({ lead_id: leadId }),
    enabled: !!leadId
  });

  // Fetch all users for display names
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  const getUserDisplayName = (email) => {
    if (!email) return "Unknown";
    const user = users?.find(u => u.email === email);
    return user?.full_name || email;
  };

  // Create Activity Mutation
  const createActivity = useMutation({
    mutationFn: (data) => base44.entities.Activity.create({
      ...data,
      lead_id: leadId,
      opportunity_id: opportunityId,
      date: new Date(data.date).toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['activities', leadId]);
      setIsAdding(false);
      toast.success("Activity added successfully");
    }
  });

  // Update Activity Mutation
  const updateActivity = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Activity.update(id, {
      ...data,
      date: new Date(data.date).toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['activities', leadId]);
      setEditingActivity(null);
      toast.success("Activity updated successfully");
    }
  });

  const handleFormSubmit = (data) => {
    if (editingActivity) {
      updateActivity.mutate({ id: editingActivity.id, data });
    } else {
      createActivity.mutate(data);
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'Call':return <Phone className="w-4 h-4" />;
      case 'Email':return <Mail className="w-4 h-4" />;
      case 'SMS':return <MessageSquare className="w-4 h-4" />;
      case 'Meeting':return <Calendar className="w-4 h-4" />;
      case 'Document Collection':return <FileCheck className="w-4 h-4" />;
      default:return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':return 'text-green-600 bg-green-50 border-green-200';
      case 'Scheduled':return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'No Answer':return 'text-red-600 bg-red-50 border-red-200';
      case 'Left Message':return 'text-orange-600 bg-orange-50 border-orange-200';
      default:return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'Completed':return 'Completed';
      case 'Scheduled':return 'Scheduled';
      case 'No Answer':return 'No Answer';
      case 'Left Message':return 'Left Message';
      default:return status;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'Call':return 'Phone Call';
      case 'Email':return 'Email';
      case 'SMS':return 'SMS';
      case 'Meeting':return 'Meeting';
      case 'Document Collection':return 'Document Collection';
      default:return 'General Note';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-800">Interaction Log</h3>
        <Button
          size="sm"
          variant="default"
          onClick={() => { setIsAdding(true); setEditingActivity(null); }}
        >
          <Plus className="w-4 h-4 mr-2" /> New Activity
        </Button>
      </div>

      {(isAdding || editingActivity) && (
        <ActivityForm
          initialData={editingActivity}
          leadId={leadId}
          onSubmit={handleFormSubmit}
          onCancel={() => { setIsAdding(false); setEditingActivity(null); }}
          isSubmitting={createActivity.isPending || updateActivity.isPending}
        />
      )}

      <ScrollArea className="flex-1 pr-4 -mr-4">
        <div className="space-y-4 pb-4">
          {isLoading ?
          <p className="text-center text-slate-500 py-4">Loading history...</p> :
          activities?.length === 0 ?
          <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-lg">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No activities logged yet</p>
            </div> :

          activities?.sort((a, b) => new Date(b.date) - new Date(a.date)).map((activity) =>
          <div key={activity.id} className="flex gap-3 p-3 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                <div className={`p-2 rounded-full h-fit ${
            activity.type === 'Call' ? 'bg-blue-100 text-blue-600' :
            activity.type === 'Meeting' ? 'bg-purple-100 text-purple-600' :
            'bg-slate-100 text-slate-600'}`
            }>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-sm">{getTypeLabel(activity.type)}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        {format(new Date(activity.date), 'dd/MM/yy HH:mm')}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-blue-600"
                        onClick={() => {
                            // Ensure date is properly formatted for datetime-local input
                            const date = new Date(activity.date);
                            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
                            const formattedDate = date.toISOString().slice(0, 16);
                            
                            setEditingActivity({ ...activity, date: formattedDate });
                            setIsAdding(false);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">{activity.summary}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(activity.status)}`}>
                      {getStatusLabel(activity.status)}
                    </span>
                    {activity.created_by && (
                      <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200 text-slate-600 font-normal flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {getUserDisplayName(activity.created_by)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
          )
          }
        </div>
      </ScrollArea>
    </div>);

}