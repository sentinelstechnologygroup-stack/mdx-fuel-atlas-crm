import React, { useEffect } from 'react';
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Calendar, CheckSquare, Users, Save, Loader2 } from "lucide-react";
import { useSettings } from '@/components/context/SettingsContext';

export default function NotificationSettings() {
    const { theme } = useSettings();
    const queryClient = useQueryClient();
    const [currentUser, setCurrentUser] = React.useState(null);

    // Get current user
    React.useEffect(() => {
        async function getUser() {
            try {
                const user = await base44.auth.me();
                setCurrentUser(user);
            } catch (e) {
                console.error("Not logged in");
            }
        }
        getUser();
    }, []);

    const { data: settings, isLoading } = useQuery({
        queryKey: ['notification_settings', currentUser?.email],
        queryFn: async () => {
            if (!currentUser?.email) return null;
            const res = await base44.entities.NotificationSettings.filter({ user_email: currentUser.email });
            return res[0] || null;
        },
        enabled: !!currentUser
    });

    const { register, handleSubmit, setValue, watch, formState: { isDirty } } = useForm({
        defaultValues: {
            notify_new_leads: true,
            notify_opp_closing: true,
            notify_tasks: true,
            days_before_deadline: 3
        }
    });

    // Update form when data loads
    useEffect(() => {
        if (settings) {
            setValue('notify_new_leads', settings.notify_new_leads);
            setValue('notify_opp_closing', settings.notify_opp_closing);
            setValue('notify_tasks', settings.notify_tasks);
            setValue('days_before_deadline', settings.days_before_deadline);
        }
    }, [settings, setValue]);

    const saveMutation = useMutation({
        mutationFn: (data) => {
            const payload = { ...data, user_email: currentUser.email };
            if (settings?.id) {
                return base44.entities.NotificationSettings.update(settings.id, payload);
            } else {
                return base44.entities.NotificationSettings.create(payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['notification_settings']);
            alert("Settings saved successfully");
        }
    });

    const onSubmit = (data) => {
        saveMutation.mutate(data);
    };

    if (!currentUser) return <div className="p-4">Please log in to manage notifications</div>;
    if (isLoading) return <div className="p-4"><Loader2 className="animate-spin" /></div>;

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                <CardHeader>
                    <CardTitle className={`flex items-center gap-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                        <Bell className="w-5 h-5 text-red-600" />
                        Notification Preferences
                    </CardTitle>
                    <CardDescription className={theme === 'dark' ? 'text-slate-400' : ''}>
                        Choose which notifications you want to receive
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    
                    <div className="flex items-center justify-between space-x-4">
                        <div className="flex items-center space-x-4">
                            <Users className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                            <div className="space-y-0.5">
                                <Label className={`text-base ${theme === 'dark' ? 'text-slate-200' : ''}`}>New Leads</Label>
                                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Get notified when a new lead is created</p>
                            </div>
                        </div>
                        <Switch 
                            checked={watch('notify_new_leads')}
                            onCheckedChange={(checked) => setValue('notify_new_leads', checked, { shouldDirty: true })}
                        />
                    </div>

                    <div className="flex items-center justify-between space-x-4">
                        <div className="flex items-center space-x-4">
                            <CheckSquare className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                            <div className="space-y-0.5">
                                <Label className={`text-base ${theme === 'dark' ? 'text-slate-200' : ''}`}>My Tasks</Label>
                                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Get notified about new or overdue tasks</p>
                            </div>
                        </div>
                        <Switch 
                            checked={watch('notify_tasks')}
                            onCheckedChange={(checked) => setValue('notify_tasks', checked, { shouldDirty: true })}
                        />
                    </div>

                    <div className="flex items-center justify-between space-x-4">
                        <div className="flex items-center space-x-4">
                            <Calendar className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                            <div className="space-y-0.5">
                                <Label className={`text-base ${theme === 'dark' ? 'text-slate-200' : ''}`}>Opportunities Closing Soon</Label>
                                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Get a reminder when opportunities are nearing their close date</p>
                            </div>
                        </div>
                        <Switch 
                            checked={watch('notify_opp_closing')}
                            onCheckedChange={(checked) => setValue('notify_opp_closing', checked, { shouldDirty: true })}
                        />
                    </div>

                    {watch('notify_opp_closing') && (
                        <div className={`ml-10 pr-4 border-l-2 pl-4 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                            <div className="flex items-center gap-3">
                                <Label className={`whitespace-nowrap ${theme === 'dark' ? 'text-slate-300' : ''}`}>Alert</Label>
                                <Input 
                                    type="number" 
                                    className={`w-20 ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : ''}`}
                                    {...register('days_before_deadline', { min: 1 })}
                                />
                                <Label className={theme === 'dark' ? 'text-slate-300' : ''}>days before deadline</Label>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end">
                        <Button type="submit" disabled={saveMutation.isPending} className="bg-red-600 hover:bg-red-700">
                            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                        </Button>
                    </div>

                </CardContent>
            </Card>
        </form>
    );
}