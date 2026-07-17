import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, X, Undo2, Zap, Flag, Target } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function ActivityForm({ initialData, onSubmit, onCancel, isSubmitting, leadId }) {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [lastLeadSnapshot, setLastLeadSnapshot] = useState(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: initialData || {
      type: "Call",
      status: "Completed",
      summary: "",
      date: new Date().toISOString().slice(0, 16) // Format for datetime-local
    }
  });

  const currentSummary = watch("summary");

  const handleAiSummarize = async () => {
    if (!currentSummary?.trim() || !leadId) return;

    setIsSummarizing(true);
    try {
      // Snapshot for undo
      const leads = await base44.entities.Lead.filter({ id: leadId });
      if (leads[0]) {
        setLastLeadSnapshot(leads[0]);
      }

      const response = await base44.functions.invoke('summarizeActivity', {
        activityText: currentSummary,
        leadId: leadId
      });

      if (response.data) {
        setAiSummary(response.data.summary);
        
        // Update form summary with professional version if available
        if (response.data.summary?.professional_summary) {
             setValue("summary", response.data.summary.professional_summary);
        }

        if (response.data.updatedFieldsCount > 0) {
          toast.success("Summary completed successfully!", {
            description: `${response.data.updatedFieldsCount} fields updated in lead profile`,
            duration: 5000
          });
        } else {
          toast.success("Summary completed!", {
            description: "Text summarized professionally",
            duration: 3000
          });
        }
      }
    } catch (error) {
      console.error('Error summarizing:', error);
      toast.error("Error summarizing activity", {
        description: "Try again or contact support",
        duration: 4000
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleUndoAiChanges = async () => {
    if (!lastLeadSnapshot || !leadId) return;

    try {
      await base44.entities.Lead.update(leadId, lastLeadSnapshot);
      setAiSummary(null);
      setLastLeadSnapshot(null);
      toast.success("Changes undone", {
        description: "Profile reverted to previous state",
        duration: 3000
      });
    } catch (error) {
      console.error('Error undoing changes:', error);
      toast.error("Error undoing changes");
    }
  };

  const activityTypeOptions = [
    { value: "Call", label: "📞 Phone Call" },
    { value: "Email", label: "📧 Email" },
    { value: "SMS", label: "💬 SMS" },
    { value: "Meeting", label: "📅 Meeting" },
    { value: "Document Collection", label: "📁 Document Collection" },
    { value: "Note", label: "📝 General Note" }
  ];

  const activityStatusOptions = [
    { value: "Completed", label: "✅ Completed" },
    { value: "Scheduled", label: "🕒 Scheduled" },
    { value: "No Answer", label: "❌ No Answer" },
    { value: "Left Message", label: "📢 Left Message" }
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 space-y-4 animate-in slide-in-from-top-2">
      <div className="flex justify-between items-start">
        <h4 className="text-sm font-bold text-slate-800">
          {initialData ? "Edit Activity" : "New Activity"}
        </h4>
        <Button variant="ghost" size="icon" type="button" onClick={onCancel} className="h-6 w-6 text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-900 text-sm font-medium">Activity Type</Label>
          <Select
            value={watch("type")}
            onValueChange={(val) => setValue("type", val)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activityTypeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-800 text-sm font-medium">Result / Status</Label>
          <Select
            value={watch("status")}
            onValueChange={(val) => setValue("status", val)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activityStatusOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-800 text-sm font-medium">Date & Time</Label>
        <Input
          type="datetime-local"
          {...register("date")}
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-slate-800 text-sm font-medium">Summary / Content</Label>
          {currentSummary?.trim() && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAiSummarize}
              disabled={isSummarizing}
              className="bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 border-purple-200 hover:from-purple-100 hover:to-blue-100 h-7 text-xs"
            >
              {isSummarizing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 mr-2" />
                  Summarize with AI
                </>
              )}
            </Button>
          )}
        </div>
        <Textarea
          placeholder="Enter activity summary here..."
          {...register("summary")}
          onChange={(e) => { setValue("summary", e.target.value); setAiSummary(null); }}
          className="h-24" />
        
        <AnimatePresence>
          {aiSummary && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mt-3 p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-900 font-semibold text-sm">
                  <Sparkles className="w-4 h-4" />
                  AI Analysis
                </div>
                {lastLeadSnapshot && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleUndoAiChanges}
                    className="text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 h-6"
                  >
                    <Undo2 className="w-3 h-3 mr-1" />
                    Undo Changes
                  </Button>
                )}
              </div>
              
              {aiSummary.key_points && aiSummary.key_points.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white/80 rounded-lg p-3 border border-purple-100"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Flag className="w-3.5 h-3.5 text-purple-600" />
                    <p className="text-xs font-bold text-purple-900">Key Points</p>
                  </div>
                  <ul className="space-y-1.5">
                    {aiSummary.key_points.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                        <span className="text-purple-500 font-bold">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
              
              {aiSummary.call_to_action && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-r from-orange-50 to-red-50 p-3 rounded-lg border border-orange-200 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Zap className="w-3.5 h-3.5 text-orange-600" />
                    <p className="text-xs font-bold text-orange-900">Required Action</p>
                  </div>
                  <p className="text-xs text-orange-800 font-semibold">{aiSummary.call_to_action}</p>
                </motion.div>
              )}
              
              {aiSummary.next_steps && aiSummary.next_steps.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white/80 rounded-lg p-3 border border-blue-100"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-3.5 h-3.5 text-blue-600" />
                    <p className="text-xs font-bold text-blue-900">Next Steps</p>
                  </div>
                  <ul className="space-y-1.5">
                    {aiSummary.next_steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                        <span className="text-blue-600 font-bold">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="text-slate-800 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
          {initialData ? "Save Changes" : "Save Activity"}
        </Button>
      </div>
    </form>
  );
}