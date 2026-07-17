import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useSettings } from "@/components/context/SettingsContext";
import { motion, AnimatePresence } from "framer-motion";

export default function QuickTaskCreator({ leadId, leadName }) {
  const { theme } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [taskData, setTaskData] = useState({
    title: "",
    description: "",
    due_date: "",
  });

  const handleCreateTask = async () => {
    if (!taskData.title.trim()) {
      alert("Please enter a task title");
      return;
    }

    setIsCreating(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.Task.create({
        title: taskData.title,
        description: taskData.description,
        due_date: taskData.due_date || null,
        status: "todo",
        assigned_to: user.email,
        related_lead_id: leadId,
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsOpen(false);
        setTaskData({ title: "", description: "", due_date: "" });
      }, 1500);
    } catch (error) {
      console.error("Failed to create task:", error);
      alert("Error creating task");
    } finally {
      setIsCreating(false);
    }
  };

  const inputClass = theme === 'dark' 
    ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500" 
    : "bg-white border-slate-300 focus:border-blue-500";
    
  const labelClass = theme === 'dark' ? "text-slate-300 font-semibold" : "text-slate-800 font-semibold";

  return (
    <div className={`col-span-1 md:col-span-2 border-t pt-6 mt-4 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
      <div className={`border rounded-xl p-4 transition-colors ${
        theme === 'dark' ? 'bg-cyan-900/10 border-cyan-500/30' : 'bg-blue-50 border-blue-200'
      }`}>
        {!isOpen ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(true)}
            className={`w-full font-medium ${
                theme === 'dark' 
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-cyan-400' 
                : 'bg-white hover:bg-blue-50 border-blue-300 text-blue-700'
            }`}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Follow-up Task
          </Button>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className={`font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  <Calendar className={`w-4 h-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`} />
                  New Task - {leadName}
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className={theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700'}
                >
                  Cancel
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className={labelClass}>Task Title *</Label>
                  <Input
                    value={taskData.title}
                    onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
                    placeholder="e.g., Call back regarding offer"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1">
                  <Label className={labelClass}>Description (Optional)</Label>
                  <Textarea
                    value={taskData.description}
                    onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                    placeholder="More details..."
                    className={`${inputClass} h-20 resize-none`}
                  />
                </div>

                <div className="space-y-1">
                  <Label className={labelClass}>Due Date</Label>
                  <Input
                    type="date"
                    value={taskData.due_date}
                    onChange={(e) => setTaskData({ ...taskData, due_date: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleCreateTask}
                  disabled={isCreating || showSuccess}
                  className={`w-full font-medium ${theme === 'dark' ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                >
                  {isCreating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {showSuccess && <CheckCircle2 className="w-4 h-4 mr-2" />}
                  {showSuccess ? "Created Successfully!" : "Create Task"}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}