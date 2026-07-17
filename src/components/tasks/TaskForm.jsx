import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from "@/components/context/SettingsContext";

export default function TaskForm({ task, onSubmit, onCancel, isSubmitting }) {
  const { theme } = useSettings();

  // Fetch leads and opportunities for selection
  const { data: leads = [] } = useQuery({ queryKey: ['leads_basic'], queryFn: () => base44.entities.Lead.list(), staleTime: 60000 });
  const { data: opportunities = [] } = useQuery({ queryKey: ['opportunities_basic'], queryFn: () => base44.entities.Opportunity.list(), staleTime: 60000 });

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    status: "todo",
    priority: "medium",
    assigned_to: "",
    related_lead_id: "",
    related_opportunity_id: ""
  });

  // Initialize form data when task prop changes
  useEffect(() => {
      setFormData({
        title: task?.title || "",
        description: task?.description || "",
        due_date: task?.due_date || "",
        status: task?.status || "todo",
        priority: task?.priority || "medium",
        assigned_to: task?.assigned_to || "",
        related_lead_id: task?.related_lead_id || "",
        related_opportunity_id: task?.related_opportunity_id || ""
      });
  }, [task]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert("Task title is required");
      return;
    }

    const submissionData = { ...formData };

    // If no assigned_to, use current user
    if (!submissionData.assigned_to) {
        try {
            const user = await base44.auth.me();
            submissionData.assigned_to = user.email;
        } catch (e) {
            console.error("Could not get current user", e);
        }
    }

    onSubmit(submissionData);
  };

  const labelClass = `text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`;
  const inputClass = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'border-slate-300';
  const selectContentClass = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : '';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className={labelClass}>Task Title *</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="What needs to be done?"
          className={inputClass} />
      </div>

      <div className="space-y-2">
        <label className={labelClass}>Description</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Additional details..."
          className={`${inputClass} h-24 resize-none`} />
      </div>

      <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={labelClass}>Due Date</label>
            <Input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Priority</label>
            <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
              <SelectTrigger className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
      </div>

      <div className="space-y-2">
        <label className={labelClass}>Status</label>
        <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
          <SelectTrigger className={inputClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={selectContentClass}>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Relational Fields */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
         <div className="space-y-1">
            <label className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Assign to Lead</label>
            <Select value={formData.related_lead_id || "none"} onValueChange={(v) => setFormData({ ...formData, related_lead_id: v === "none" ? null : v })}>
              <SelectTrigger className={`h-9 text-sm ${inputClass}`}>
                <SelectValue placeholder="Select Lead..." />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                <SelectItem value="none">-- Unassigned --</SelectItem>
                {leads.map((l) =>
              <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>
              )}
              </SelectContent>
            </Select>
         </div>
         <div className="space-y-1">
            <label className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Assign to Opportunity</label>
            <Select value={formData.related_opportunity_id || "none"} onValueChange={(v) => setFormData({ ...formData, related_opportunity_id: v === "none" ? null : v })}>
              <SelectTrigger className={`h-9 text-sm ${inputClass}`}>
                <SelectValue placeholder="Select Opportunity..." />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                <SelectItem value="none">-- Unassigned --</SelectItem>
                {opportunities.map((o) =>
              <SelectItem key={o.id} value={o.id}>{o.product_type} - {o.lead_name}</SelectItem>
              )}
              </SelectContent>
            </Select>
         </div>
      </div>

      <div className={`flex justify-end gap-3 pt-4 border-t ${theme === 'dark' ? 'border-slate-700' : ''}`}>
        <Button type="button" variant="outline" onClick={onCancel} className="bg-background text-slate-900 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground h-9 border-slate-600 hover:bg-slate-700">
          Cancel
        </Button>
        <Button type="submit" className="bg-red-700 hover:bg-red-800" disabled={isSubmitting}>
          {task?.id ? "Update" : "Create Task"}
        </Button>
      </div>
    </form>
  );
}