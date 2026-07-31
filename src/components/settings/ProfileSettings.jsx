import { useEffect, useState } from 'react';
import { atlas } from '@/api/atlasClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/components/hooks/usePermissions';
import { useSettings } from '@/components/context/SettingsContext';
import { displayName, roleLabel } from '@/lib/roles';
import { formatGallons, getMonthlyGallonQuota } from '@/lib/fuelVolume';
import { LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';

function ReadOnlyField({ label, value, theme, helper }) {
  return (
    <div className="space-y-2">
      <Label className={theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}>{label}</Label>
      <Input
        value={value || ''}
        readOnly
        aria-readonly="true"
        className={theme === 'dark'
          ? 'bg-slate-900 border-slate-700 text-slate-300'
          : 'bg-slate-50 text-slate-700'}
      />
      {helper && (
        <p className={`text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{helper}</p>
      )}
    </div>
  );
}

export default function ProfileSettings() {
  const [user, setUser] = useState(null);
  const { applicationRole, isAdminTier } = usePermissions();
  const { theme } = useSettings();

  useEffect(() => {
    atlas.auth.me().then(setUser).catch(() => {});
  }, []);

  if (!user) {
    return <div className="p-10 text-center text-slate-400">Loading user data...</div>;
  }

  const monthlyQuota = getMonthlyGallonQuota(user);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>My Employee Profile</CardTitle>
              <CardDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
                Verified MDX identity, assignment, and gallon-goal information
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1 whitespace-nowrap">
              <LockKeyhole className="w-3 h-3" />
              Admin controlled
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={`rounded-xl border p-4 flex gap-3 ${theme === 'dark' ? 'bg-slate-900/60 border-slate-700' : 'bg-blue-50 border-blue-100'}`}>
            <ShieldCheck className={`w-5 h-5 mt-0.5 ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-700'}`} />
            <div>
              <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-100' : 'text-blue-950'}`}>
                Protected company profile
              </p>
              <p className={`text-xs mt-1 leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-blue-800'}`}>
                Names, work email addresses, employment details, assignments, roles, and gallon quotas can only be changed
                through User Management by an authorized Administrator or Super Administrator.
              </p>
              {isAdminTier && (
                <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-700'}`}>
                  Use Settings → Team &amp; Users to manage an employee profile.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReadOnlyField label="First Name" value={user.first_name || displayName(user).split(/\s+/)[0]} theme={theme} />
            <ReadOnlyField label="Last Name" value={user.last_name} theme={theme} />
            <ReadOnlyField label="MDX Work Email" value={user.email} theme={theme} helper="Personal email substitutions are not permitted." />
            <ReadOnlyField label="Phone" value={user.phone} theme={theme} />
            <ReadOnlyField label="Job Title" value={user.job_title} theme={theme} />
            <ReadOnlyField label="Department" value={user.department} theme={theme} />
            <ReadOnlyField label="Employee ID" value={user.employee_id} theme={theme} />
            <ReadOnlyField label="MDX Role" value={roleLabel(applicationRole)} theme={theme} />
            <ReadOnlyField
              label="Monthly Gallon Quota"
              value={monthlyQuota ? `${formatGallons(monthlyQuota)} gallons` : 'Not assigned'}
              theme={theme}
              helper="ATLAS measures sales quota in gallons, not dollars."
            />
            <ReadOnlyField label="Timezone" value={user.timezone || 'Organization default'} theme={theme} />
          </div>
        </CardContent>
      </Card>

      <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
        <CardHeader>
          <CardTitle className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>Account Access</CardTitle>
          <CardDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
            Account deactivation and deletion are restricted to authorized administrators.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2" onClick={() => atlas.auth.logout()}>
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
