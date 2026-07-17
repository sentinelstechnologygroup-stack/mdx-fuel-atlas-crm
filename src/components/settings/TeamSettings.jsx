import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Loader2, Trash2, Mail } from "lucide-react";
import { useSettings } from '@/components/context/SettingsContext';
import { usePermissions } from '@/components/hooks/usePermissions';
import { APPLICATION_ROLES, ASSIGNABLE_ROLES_BY_ADMIN } from '@/lib/roles';
import UserDirectory from '@/components/settings/UserDirectory';
import TeamManagement from '@/components/settings/TeamManagement';
import TerritoryManagement from '@/components/settings/TerritoryManagement';
import OwnershipMigrationReview from '@/components/ownership/OwnershipMigrationReview';
import BulkTransferTool from '@/components/ownership/BulkTransferTool';

export default function TeamSettings() {
    const { theme } = useSettings();
    const { canManageUsers, isSuperAdmin, isAdminTier } = usePermissions();
    const queryClient = useQueryClient();
    const [isInviteOpen, setIsInviteOpen] = useState(false);

    const { data: invites = [] } = useQuery({
        queryKey: ['invites'],
        queryFn: () => base44.entities.Invite.list(),
        initialData: []
    });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>Team & Users</CardTitle>
                        <CardDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
                            Employee directory, profiles, team / supervisor / territory assignment, and account status.
                        </CardDescription>
                    </div>
                    {canManageUsers && (
                        <Button onClick={() => setIsInviteOpen(true)} className="bg-slate-900 text-white">
                            <UserPlus className="w-4 h-4 mr-2" /> Invite User
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <UserDirectory />
                </CardContent>
            </Card>

            <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                <CardContent className="pt-6">
                    <TeamManagement />
                </CardContent>
            </Card>

            <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                <CardContent className="pt-6">
                    <TerritoryManagement />
                </CardContent>
            </Card>

            {isAdminTier && (
                <OwnershipMigrationReview />
            )}

            {isAdminTier && (
                <BulkTransferTool />
            )}

            {invites.filter((i) => i.status === 'pending').length > 0 && (
                <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                    <CardHeader>
                        <CardTitle className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>Pending Invitations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-left">Email</TableHead>
                                        <TableHead className="text-left">Role</TableHead>
                                        <TableHead className="text-left">Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invites.filter((i) => i.status === 'pending').map((invite) => (
                                        <TableRow key={invite.id}>
                                            <TableCell className="font-medium">{invite.email}</TableCell>
                                            <TableCell><Badge variant="outline">{invite.role}</Badge></TableCell>
                                            <TableCell><Badge className="bg-amber-100 text-amber-700">Pending</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => { if (confirm('Revoke invitation?')) base44.entities.Invite.delete(invite.id).then(() => queryClient.invalidateQueries(['invites'])); }}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            <InviteUserDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} canInviteSuperAdmin={isSuperAdmin} />
        </div>
    );
}

function InviteUserDialog({ open, onOpenChange, canInviteSuperAdmin }) {
    const { theme } = useSettings();
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("viewer_support");
    const [isLoading, setIsLoading] = useState(false);
    const queryClient = useQueryClient();

    const roles = canInviteSuperAdmin
        ? APPLICATION_ROLES
        : APPLICATION_ROLES.filter((r) => ASSIGNABLE_ROLES_BY_ADMIN.includes(r.value));

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!canInviteSuperAdmin && (role === 'super_admin')) {
            alert('Only a Super Administrator may invite a Super Administrator.');
            return;
        }
        setIsLoading(true);
        try {
            const me = await base44.auth.me();
            await base44.entities.Invite.create({
                email,
                role: canInviteSuperAdmin ? role : (role === 'super_admin' ? 'administrator' : role),
                status: 'pending',
                invited_by: me?.email
            });
            queryClient.invalidateQueries(['invites']);
            onOpenChange(false);
            setEmail("");
            setRole("viewer_support");
        } catch (error) {
            alert("Failed to send invitation: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const inputClass = theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invite New User</DialogTitle>
                    <DialogDescription>Send an invitation to add a new employee to MDX.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleInvite} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input type="email" required placeholder="colleague@mdx.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                    </div>
                    <div className="space-y-2">
                        <Label>MDX Application Role</Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {roles.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {!canInviteSuperAdmin && (
                            <p className={`text-xs ${theme === 'dark' ? 'text-amber-300' : 'text-amber-600'}`}>
                                Super Administrator invitations require a Super Administrator.
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={isLoading} className="bg-slate-900 text-white">
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                            Send Invitation
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}