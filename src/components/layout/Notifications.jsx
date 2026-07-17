import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettings } from '@/components/context/SettingsContext';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Bell, Calendar, CheckSquare, MessageSquare, Check, X, 
    Briefcase, UserPlus, Clock, Settings
} from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
// import { he } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Notifications() {
    const { theme } = useSettings();
    const [isOpen, setIsOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const queryClient = useQueryClient();

    // Get Current User
    useEffect(() => {
        base44.auth.me().then(setCurrentUser).catch(() => {});
    }, []);

    // Fetch Settings
    const { data: settings } = useQuery({
        queryKey: ['notification_settings', currentUser?.email],
        queryFn: async () => {
            if (!currentUser?.email) return null;
            const res = await base44.entities.NotificationSettings.filter({ user_email: currentUser.email });
            return res[0] || { notify_tasks: true, notify_opp_closing: true, days_before_deadline: 3 }; // Defaults
        },
        enabled: !!currentUser
    });

    // Fetch 1: Persistent Notifications (DB)
    const { data: persistentNotifications } = useQuery({
        queryKey: ['notifications_db', currentUser?.email],
        queryFn: () => base44.entities.Notification.filter(
            { user_email: currentUser.email, is_read: false }, 
            '-created_date', 
            20
        ),
        enabled: !!currentUser,
        initialData: []
    });

    // Fetch 2: Tasks due soon/overdue (Computed)
    const { data: taskAlerts } = useQuery({
        queryKey: ['notifications_tasks', currentUser?.email],
        queryFn: async () => {
            if (!settings?.notify_tasks) return [];
            const tasks = await base44.entities.Task.list(); // Filter logic below due to SDK limitations on complex dates
            const today = new Date();
            const twoDaysFromNow = new Date();
            twoDaysFromNow.setDate(today.getDate() + 2);

            return tasks.filter(t => {
                if (t.status === 'done') return false;
                // Simple assignment check - ideally matched by email
                // Assuming task.assigned_to stores email
                if (t.assigned_to && t.assigned_to !== currentUser.email) return false;
                
                if (!t.due_date) return false;
                const due = new Date(t.due_date);
                return due <= twoDaysFromNow;
            }).map(t => ({
                id: `task-${t.id}`,
                type: 'task',
                title: 'Task requires attention',
                message: t.title,
                date: t.due_date,
                isOverdue: new Date(t.due_date) < new Date(),
                link: createPageUrl('Dashboard'), // Or Tasks page
                actionLabel: 'View Tasks'
            }));
        },
        enabled: !!currentUser && !!settings,
        initialData: []
    });

    // Fetch 3: Opportunities Closing Soon (Computed)
    const { data: oppAlerts } = useQuery({
        queryKey: ['notifications_opps'],
        queryFn: async () => {
            if (!settings?.notify_opp_closing) return [];
            const opps = await base44.entities.Opportunity.list();
            const days = settings.days_before_deadline || 3;
            const threshold = new Date();
            threshold.setDate(threshold.getDate() + days);

            return opps.filter(o => {
                if (['Closed Won', 'Closed Lost'].some(s => o.deal_stage.includes(s))) return false;
                if (!o.expected_close_date) return false;
                const closeDate = new Date(o.expected_close_date);
                return closeDate <= threshold && closeDate >= new Date(); // Future but soon
            }).map(o => ({
                id: `opp-${o.id}`,
                type: 'opportunity',
                title: 'Opportunity closing soon',
                message: `${o.lead_name} - ${o.product_type}`,
                date: o.expected_close_date,
                link: createPageUrl('Opportunities'),
                actionLabel: 'View Board'
            }));
        },
        enabled: !!settings,
        initialData: []
    });

    // Mark as read mutation
    const markAsRead = useMutation({
        mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
        onSuccess: () => queryClient.invalidateQueries(['notifications_db'])
    });

    // Combine all
    const allNotifications = useMemo(() => {
        const dbNotifs = persistentNotifications.map(n => {
            let link = null;
            let actionLabel = null;

            if (n.related_entity_type === 'Lead' && n.related_entity_id) {
                link = `${createPageUrl('LeadDetails')}?id=${n.related_entity_id}`;
                actionLabel = 'Lead File';
            } else if (n.related_entity_type === 'Opportunity') {
                link = createPageUrl('Opportunities');
                actionLabel = 'Opportunities Board';
            } else if (n.related_entity_type === 'Task') {
                link = createPageUrl('Tasks');
                actionLabel = 'Tasks';
            }

            return {
                id: n.id,
                type: n.type || 'info',
                title: n.title,
                message: n.message,
                date: n.created_date,
                isPersistent: true,
                link,
                actionLabel
            };
        });

        return [...dbNotifs, ...taskAlerts, ...oppAlerts].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
    }, [persistentNotifications, taskAlerts, oppAlerts]);

    const unreadCount = allNotifications.length;

    const getIcon = (type) => {
        switch (type) {
            case 'task': return <CheckSquare className="w-4 h-4 text-blue-500" />;
            case 'opportunity': return <Briefcase className="w-4 h-4 text-purple-500" />;
            case 'lead': return <UserPlus className="w-4 h-4 text-green-500" />;
            case 'warning': return <Clock className="w-4 h-4 text-amber-500" />;
            default: return <MessageSquare className="w-4 h-4 text-slate-500" />;
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className={`relative rounded-xl transition-colors ${
                    theme === 'dark' 
                        ? 'text-slate-300 hover:text-cyan-400 hover:bg-slate-800' 
                        : 'text-slate-600 hover:text-red-600 hover:bg-red-50'
                }`}>
                    <Bell className={`w-6 h-6 ${unreadCount > 0 ? 'fill-current' : ''}`} />
                    {unreadCount > 0 && (
                        <span className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 ${theme === 'dark' ? 'bg-cyan-500 border-slate-900' : 'bg-red-600 border-white'}`} />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className={`w-80 p-0 rounded-xl shadow-xl ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`} align="end">
                <div className={`p-3 border-b flex justify-between items-center rounded-t-xl ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50/50 border-slate-100'}`}>
                    <h4 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>Notification Center</h4>
                    {unreadCount > 0 && <Badge variant="secondary" className={theme === 'dark' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-red-100 text-red-700 hover:bg-red-200'}>{unreadCount} New</Badge>}
                </div>

                <ScrollArea className="h-[320px]">
                    {allNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-400 space-y-2">
                            <Bell className="w-8 h-8 opacity-20" />
                            <p className="text-sm">No new notifications</p>
                            <p className="text-xs opacity-70">All caught up!</p>
                        </div>
                    ) : (
                        <div className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-50'}`}>
                            {allNotifications.map((notif) => (
                                <div key={notif.id} className={`p-3 transition-colors relative group ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                                    <div className="flex gap-3 items-start">
                                        <div className={`mt-1 p-1.5 rounded-lg border shadow-sm shrink-0 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                                            {getIcon(notif.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium leading-none mb-1.5 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                                                {notif.title}
                                            </p>
                                            <p className={`text-xs line-clamp-2 mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {notif.message}
                                            </p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-slate-400">
                                                    {notif.date ? formatDistanceToNow(new Date(notif.date), { addSuffix: true }) : 'Today'}
                                                </span>
                                                {notif.link && (
                                                    <Link to={notif.link} onClick={() => setIsOpen(false)} className={`text-[10px] font-medium hover:underline ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`}>
                                                        {notif.actionLabel || 'View'}
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                        {notif.isPersistent && (
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className={`h-6 w-6 opacity-0 group-hover:opacity-100 absolute top-2 right-2 ${theme === 'dark' ? 'text-slate-500 hover:text-cyan-400' : 'text-slate-300 hover:text-blue-600'}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    markAsRead.mutate(notif.id);
                                                }}
                                                title="Mark as read"
                                            >
                                                <Check className="w-3 h-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className={`p-2 border-t rounded-b-xl flex justify-between ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <Link to={createPageUrl('Settings')} onClick={() => setIsOpen(false)}>
                        <Button variant="ghost" size="sm" className={`h-7 text-xs ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                            <Settings className="w-3 h-3 mr-1" />
                            Settings
                        </Button>
                    </Link>
                    {/* Potential "Clear All" logic here */}
                </div>
            </PopoverContent>
        </Popover>
    );
}