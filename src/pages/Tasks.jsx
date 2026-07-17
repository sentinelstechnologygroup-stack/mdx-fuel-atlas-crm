import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, CheckCircle2, Calendar, Trash2, Archive, CheckSquare, AlertCircle, Filter, Briefcase, User, X
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import moment from "moment";
import { useSettings } from "@/components/context/SettingsContext";
import TaskForm from "@/components/tasks/TaskForm";

export default function TasksPage() {
  const { theme } = useSettings();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTab, setActiveTab] = useState("active");
  const [filters, setFilters] = useState({ search: "", status: "all" });

  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list()
  });

  const createTask = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks']);
      setShowTaskForm(false);
      setEditingTask(null);
    }
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries(['tasks']);
      const previousTasks = queryClient.getQueryData(['tasks']);

      queryClient.setQueryData(['tasks'], (old) => {
        return old.map((t) => 
          t.id === id ? { ...t, ...data, updated_date: new Date().toISOString() } : t
        );
      });

      return { previousTasks };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['tasks'], context.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['tasks']);
    }
  });

  const deleteTask = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks']);
    }
  });

  const toggleTaskStatus = (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    updateTask.mutate({ id: task.id, data: { status: newStatus } });
  };

  const archiveTask = (task) => {
    updateTask.mutate({ id: task.id, data: { status: 'archived' } });
  };

  const { activeTasks, archivedTasks } = useMemo(() => {
    const searchTerm = filters.search.toLowerCase();
    const filtered = tasks.filter((t) => {
      const matchesSearch = !searchTerm ||
        t.title?.toLowerCase().includes(searchTerm) ||
        t.description?.toLowerCase().includes(searchTerm);

      const matchesStatus = filters.status === "all" || t.status === filters.status;

      return matchesSearch && matchesStatus;
    });

    return {
      activeTasks: filtered.filter((t) => t.status !== 'archived'),
      archivedTasks: filtered.filter((t) => t.status === 'archived')
    };
  }, [tasks, filters]);

  const stats = useMemo(() => {
    const total = activeTasks.length;
    const completed = activeTasks.filter((t) => t.status === 'done').length;
    const overdue = activeTasks.filter((t) => {
      if (t.status === 'done') return false;
      return t.due_date && moment(t.due_date).isBefore(moment(), 'day');
    }).length;
    const today = activeTasks.filter((t) => {
      if (t.status === 'done') return false;
      return t.due_date && moment(t.due_date).isSame(moment(), 'day');
    }).length;

    return { total, completed, overdue, today };
  }, [activeTasks]);

  return (
    <div className="space-y-6 pb-24" dir="ltr">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400' : 'text-slate-900'}`}>Task Management</h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Planning, Tracking & Execution</p>
        </div>
        <Button onClick={() => setShowTaskForm(true)} className={`text-white shadow-md ${
          theme === 'dark' ? 'bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/30' : 'bg-red-700 hover:bg-red-800'
        }`}>
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={CheckSquare} label="Total Tasks" value={stats.total} color="bg-blue-500" />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} color="bg-emerald-500" />
        <StatCard icon={AlertCircle} label="Overdue" value={stats.overdue} color="bg-red-500" />
        <StatCard icon={Calendar} label="To Do" value={stats.today} color="bg-orange-500" />
      </div>

      <div className={`p-4 rounded-xl shadow-lg border flex flex-col md:flex-row gap-3 transition-colors backdrop-blur-xl ${
        theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'
      }`}>
        <div className="relative flex-1">
          <Input
            placeholder="Search tasks..."
            className="pl-10"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
          <SelectTrigger className="w-full md:w-[160px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full grid-cols-2 max-w-md transition-colors ${
          theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'
        }`}>
          <TabsTrigger value="active" className={`data-[state=active]:shadow-sm transition-all ${
            theme === 'dark' ? 'data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400' : 'data-[state=active]:bg-white'
          }`}>
            Active Tasks ({activeTasks.length})
          </TabsTrigger>
          <TabsTrigger value="archived" className={`data-[state=active]:shadow-sm transition-all ${
            theme === 'dark' ? 'data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400' : 'data-[state=active]:bg-white'
          }`}>
            Archive ({archivedTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {isLoading ? (
            <div className={`text-center py-10 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Loading tasks...</div>
          ) : activeTasks.length === 0 ? (
            <div className={`text-center py-16 rounded-xl border-2 border-dashed transition-colors ${
              theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}>
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No active tasks</p>
              <p className="text-sm mt-1">Start by creating a new task</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {activeTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={() => toggleTaskStatus(task)}
                    onArchive={() => archiveTask(task)}
                    onEdit={() => { setEditingTask(task); setShowTaskForm(true); }}
                    onDelete={() => {
                      if (confirm('Delete this task?')) deleteTask.mutate(task.id);
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-6">
          {archivedTasks.length === 0 ? (
            <div className={`text-center py-16 rounded-xl border-2 border-dashed transition-colors ${
              theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}>
              <Archive className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No archived tasks</p>
            </div>
          ) : (
            <div className="space-y-3">
              {archivedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isArchived
                  onDelete={() => {
                    if (confirm('Delete this task permanently?')) deleteTask.mutate(task.id);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showTaskForm} onOpenChange={(open) => {
        setShowTaskForm(open);
        if (!open) setEditingTask(null);
      }}>
        <DialogContent className={`fixed right-0 top-0 left-auto translate-x-0 translate-y-0 h-full w-full sm:w-[550px] max-w-none p-0 border-l shadow-2xl transition-all duration-300 gap-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right sm:rounded-none ${
            theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`} dir="ltr">
          <div className={`flex items-center justify-between px-6 py-4 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
              <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {editingTask ? "Edit Task" : "New Task"}
              </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <TaskForm
              task={editingTask}
              onSubmit={(data) => {
                if (editingTask) {
                  updateTask.mutate({ id: editingTask.id, data });
                } else {
                  createTask.mutate(data);
                }
              }}
              onCancel={() => setShowTaskForm(false)}
              isSubmitting={createTask.isPending || updateTask.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const { theme } = useSettings();
  return (
    <Card className={`border shadow-lg backdrop-blur-xl transition-colors ${
      theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'
    }`}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color} ${theme === 'dark' ? 'bg-opacity-20' : 'bg-opacity-10'}`}>
          <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
        </div>
        <div>
          <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
          <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCard({ task, onToggle, onArchive, onEdit, onDelete, isArchived }) {
  const { theme } = useSettings();
  const isOverdue = task.due_date && moment(task.due_date).isBefore(moment(), 'day') && task.status !== 'done';
  const isToday = task.due_date && moment(task.due_date).isSame(moment(), 'day');
  const isDone = task.status === 'done';
  
  // Stale check: Not updated in > 14 days and not done/archived
  const isStale = !isDone && !isArchived && moment(task.updated_date).isBefore(moment().subtract(14, 'days'));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`rounded-xl border p-4 hover:shadow-md transition-all backdrop-blur-md ${
        theme === 'dark' ?
          isDone ? 'bg-emerald-500/10 border-emerald-500/30' :
            isOverdue ? 'bg-red-500/10 border-red-500/30' :
              'bg-slate-800/60 border-slate-700/50' :
          isDone ? 'bg-emerald-50/30 border-emerald-200' :
            isOverdue ? 'bg-red-50/30 border-red-200' :
              'bg-white/60 border-white/50'
      }`}
    >
      <div className="flex items-start gap-3">
        {!isArchived && (
          <button
            onClick={onToggle}
            className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
              isDone ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-emerald-500'
            }`}
          >
            {isDone && <CheckCircle2 className="w-4 h-4 text-white" />}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className={`font-bold ${
              isDone ? 'line-through text-slate-500' : theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              {task.title}
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isOverdue && !isDone && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
              {isToday && !isDone && <Badge className="bg-orange-500 text-xs">Today</Badge>}
              {isStale && <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 bg-amber-50">Stagnant</Badge>}
              {task.due_date && (
                <span className={`text-xs flex items-center gap-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Calendar className="w-3 h-3" />
                  {moment(task.due_date).format('DD/MM/YY')}
                </span>
              )}
            </div>
          </div>

          {(task.related_lead_id || task.related_opportunity_id) && (
            <div className="flex gap-2 mb-2">
              {task.related_lead_id && (
                <Link to={`${createPageUrl('LeadDetails')}?leadId=${task.related_lead_id}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] hover:bg-blue-100 transition-colors">
                  <User className="w-3 h-3" />
                  Lead
                </Link>
              )}
              {task.related_opportunity_id && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px]">
                  <Briefcase className="w-3 h-3" />
                  Opportunity
                </div>
              )}
            </div>
          )}

          {task.description && (
            <p className={`text-sm mb-2 ${isDone ? 'line-through text-slate-500 dark:text-slate-500' : theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              {task.description}
            </p>
          )}

          {!isArchived ? (
            <div className="flex gap-2 mt-3">
              <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 px-2 text-slate-500 hover:text-blue-600">
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={onArchive} className="h-7 px-2 text-slate-500 hover:text-orange-600">
                <Archive className="w-3 h-3 mr-1" />
                Archive
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 px-2 text-slate-500 hover:text-red-600">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 px-2 text-slate-500 hover:text-red-600 mt-2">
              <Trash2 className="w-3 h-3 mr-1" />
              Delete Permanently
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}