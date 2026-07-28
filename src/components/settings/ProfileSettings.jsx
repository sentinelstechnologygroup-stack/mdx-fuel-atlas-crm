import React, { useState } from 'react';
import { atlas } from "@/api/atlasClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from '@/components/hooks/usePermissions';
import { useSettings } from '@/components/context/SettingsContext';
import { roleLabel } from '@/lib/roles';

export default function ProfileSettings() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const { isViewer, isEditor, isAdmin, applicationRole } = usePermissions();
    const { theme } = useSettings();
    const [requestLoading, setRequestLoading] = useState(false);

    // Load user data
    React.useEffect(() => {
        atlas.auth.me().then(setUser).catch(() => {});
    }, []);

    const handleRequestUpgrade = async () => {
        if (!user) return;
        setRequestLoading(true);
        try {
            const response = await atlas.functions.invoke(
                'requestAccessUpgrade',
                {}
            );
            setUser(prev => ({
                ...prev,
                ...(response?.data?.user || {}),
                requested_access_upgrade: true
            }));
            alert("Your request has been sent to the system admin");
        } catch (e) {
            console.error(e);
            alert("Error sending request");
        } finally {
            setRequestLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await atlas.auth.updateMe({
                full_name: user.full_name,
            });
            // alert("Profile updated successfully");
        } catch (err) {
            console.error(err);
            // alert("Error updating profile");
        } finally {
            setLoading(false);
        }
    };

    if (!user) return <div className="p-10 text-center text-slate-400">Loading user data...</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                <CardHeader>
                    <CardTitle className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>My Profile</CardTitle>
                    <CardDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Personal details and login information</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className={theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}>Display Name (appears in audit log)</Label>
                                <Input
                                    value={user?.full_name || ''}
                                    onChange={(e) => setUser({...user, full_name: e.target.value})}
                                    placeholder="How you want your name to appear"
                                    className={theme === 'dark' ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" : ""}
                                />
                                <p className={`text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>This name will be displayed in all your activities and updates</p>
                            </div>
                            <div className="space-y-2">
                                <Label className={theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}>Email Address</Label>
                                <Input
                                    value={user?.email || ''}
                                    disabled
                                    className={theme === 'dark' ? "bg-slate-900 border-slate-700 text-slate-400" : "bg-slate-50 text-slate-600"}
                                />
                                <p className={`text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Email address cannot be changed</p>
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <Button type="submit" disabled={loading || isViewer} className="bg-slate-900 text-white">
                                {loading ? "Saving..." : "Save Changes"}
                            </Button>
                            {isViewer && <p className="text-xs text-red-500 mt-2">You don't have permission to edit profile (Viewer only)</p>}
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                <CardHeader>
                    <CardTitle className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>Access Permissions</CardTitle>
                    <CardDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Your MDX application role and current permission level</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>MDX Role:</span>
                            <Badge className="bg-purple-100 text-purple-700">{roleLabel(applicationRole)}</Badge>
                        </div>
                        <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {isAdmin ? "You have administrative access to the system." :
                             isEditor ? "You have edit and create permissions." :
                             "You are in viewer mode only. You cannot make changes."}
                        </p>
                    </div>
                    {isViewer && !isAdmin && (
                        user?.requested_access_upgrade ? 
                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">Request Sent</Badge> :
                        <Button variant="outline" size="sm" onClick={handleRequestUpgrade} disabled={requestLoading}>
                            Request Edit Access
                        </Button>
                    )}
                </CardContent>
            </Card>
            
            <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                <CardHeader>
                    <CardTitle className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>Account Management</CardTitle>
                    <CardDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Sign out and account deletion</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button variant="outline" className="text-slate-600 hover:bg-slate-50 w-full sm:w-auto" onClick={() => atlas.auth.logout()}>
                            Sign Out
                        </Button>
                        
                        <Button 
                            variant="ghost" 
                            className="text-red-600 hover:bg-red-50 hover:text-red-700 w-full sm:w-auto" 
                            onClick={async () => {
                                if (window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone.')) {
                                    try {
                                        setLoading(true);
                                        // Call backend function to delete account
                                        await atlas.functions.invoke('deleteAccount', {});
                                        // Then logout
                                        atlas.auth.logout();
                                    } catch (e) {
                                        console.error("Failed to delete account", e);
                                        alert("Error deleting account. Please try again later.");
                                        setLoading(false);
                                    }
                                }
                            }}
                        >
                            Delete Account
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
