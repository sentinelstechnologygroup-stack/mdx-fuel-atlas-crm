import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import moment from "moment";
import { useSettings } from "@/components/context/SettingsContext";

export default function TasksWidget({ className }) {
  const { theme } = useSettings();
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list()
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['tasks'])
  });

  // Active tasks - sorted by due date (overdue/upcoming first, then no date)
  const upcomingTasks = React.useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'done' && t.status !== 'archived')
      .sort((a, b) => {
        // If both have due dates, sort by date ascending
        if (a.due_date && b.due_date) {
            return moment(a.due_date).valueOf() - moment(b.due_date).valueOf();
        }
        // If only a has date, it comes first (urgent)
        if (a.due_date) return -1;
        // If only b has date, it comes first
        if (b.due_date) return 1;
        // If neither, keep order (or sort by creation if needed)
        return 0; 
      })
      .slice(0, 5);
  }, [tasks]);

  const toggleTaskStatus = (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    updateTask.mutate({ id: task.id, data: { status: newStatus } });
  };

  return (
    <Card className={`border-none shadow-none bg-transparent flex flex-col h-full min-h-[350px] ${className || ''}`}>
      <CardHeader className="pb-4 shrink-0 px-6 pt-6">
        <CardTitle className="text-lg flex items-center justify-between">
          <Link to={createPageUrl('Tasks')} className={`flex items-center gap-2 hover:opacity-80 transition-opacity text-xl ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
            Focus List
          </Link>
          <Badge className={`rounded-full px-2 ${theme === 'dark' ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700'}`}>{upcomingTasks.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
        {upcomingTasks.length === 0 ? (
          <div className={`text-center py-10 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>No active tasks</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingTasks.map((task) => {
              const isToday = moment(task.due_date).isSame(moment(), 'day');
              const isOverdue = moment(task.due_date).isBefore(moment(), 'day');
              const isDone = task.status === 'done';

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-2xl border transition-all duration-300 group ${
                    theme === 'dark'
                      ? isDone 
                        ? 'bg-slate-800/30 border-slate-700 opacity-50' 
                        : isOverdue 
                        ? 'bg-red-500/10 border-red-500/30' 
                        : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-indigo-500/50'
                      : isDone
                        ? 'bg-slate-50 border-slate-100 opacity-50'
                        : isOverdue
                        ? 'bg-red-50 border-red-100'
                        : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {/* Checkbox */}
                    <button
                      onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleTaskStatus(task);
                      }}
                      className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors z-10 ${
                        isDone
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-slate-300 hover:border-emerald-500'
                      }`}
                    >
                      {isDone && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>

                    {/* Content */}
                    <Link to={createPageUrl('Tasks')} className="flex-1 min-w-0 cursor-pointer block">
                      <div className="flex justify-between items-start mb-1">
                        <h4
                          className={`font-medium text-sm line-clamp-1 ${
                            isDone 
                              ? 'line-through text-slate-400' 
                              : theme === 'dark' ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </h4>
                        {isOverdue && !isDone ? (
                          <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                            Overdue
                          </Badge>
                        ) : isToday && !isDone ? (
                          <Badge className="bg-orange-500 text-[10px] h-5 px-1.5">Today</Badge>
                        ) : (
                          <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {moment(task.due_date).format('DD/MM')}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p
                          className={`text-xs line-clamp-1 ${
                            isDone ? 'text-slate-400' : theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          {task.description}
                        </p>
                      )}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <div className={`p-4 border-t shrink-0 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
        <Link to={createPageUrl('Tasks')}>
          <Button variant="ghost" className={`w-full text-xs h-8 ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-600'}`}>
            All Tasks
          </Button>
        </Link>
      </div>
    </Card>
  );
}