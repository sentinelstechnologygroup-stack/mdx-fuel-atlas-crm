import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { useSettings } from '@/components/context/SettingsContext';
import RoleHierarchy from '@/components/settings/RoleHierarchy';
import RoleAssignment from '@/components/settings/RoleAssignment';
import PermissionMatrix from '@/components/settings/PermissionMatrix';
import CustomRoles from '@/components/settings/CustomRoles';
import UserPermissionOverrides from '@/components/settings/UserPermissionOverrides';

export default function UserManagement() {
    const { theme } = useSettings();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Permissions & Roles</h2>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    MDX role hierarchy, role assignment, the configurable permission matrix, custom roles, and user overrides.
                </p>
            </div>

            <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                <CardContent className="pt-6">
                    <RoleHierarchy />
                </CardContent>
            </Card>

            <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                <CardContent className="pt-6">
                    <RoleAssignment />
                </CardContent>
            </Card>

            <PermissionMatrix />
            <CustomRoles />
            <UserPermissionOverrides />
        </div>
    );
}