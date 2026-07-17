import React from 'react';
import { Badge } from '@/components/ui/badge';
import { roleLabel, statusLabel, territoryTypeLabel } from '@/lib/roles';
import { useSettings } from '@/components/context/SettingsContext';
import UserAvatar from '@/components/settings/UserAvatar';
import { Mail, Phone, Briefcase, Building2, MapPin, Clock, Palette, Bell, FileText } from 'lucide-react';

function InfoRow({ icon: Icon, label, value }) {
  const { theme } = useSettings();
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
        <p className={`text-sm break-words ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{value || '—'}</p>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  const { theme } = useSettings();
  return (
    <div className={`rounded-xl border p-4 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
      <h4 className={`text-sm font-bold uppercase tracking-wide mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{title}</h4>
      <div className="divide-y divide-transparent">{children}</div>
    </div>
  );
}

export default function UserProfileView({ user, team, supervisor, territories }) {
  const { theme } = useSettings();
  if (!user) return null;

  const statusColor = {
    active: 'bg-emerald-100 text-emerald-700',
    invited: 'bg-blue-100 text-blue-700',
    inactive: 'bg-slate-200 text-slate-600',
    suspended: 'bg-red-100 text-red-700'
  }[user.account_status || 'active'];

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <div className={`rounded-xl border p-5 flex items-center gap-4 ${theme === 'dark' ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>
        <UserAvatar user={user} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {user.display_name || user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}
            </h3>
            <Badge className={statusColor}>{statusLabel(user.account_status)}</Badge>
          </div>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{roleLabel(user.application_role)}</p>
        </div>
      </div>

      <Section title="Profile">
        <InfoRow icon={Briefcase} label="Job Title" value={user.job_title} />
        <InfoRow icon={Mail} label="Email" value={user.email} />
        <InfoRow icon={Phone} label="Phone" value={user.phone} />
        <InfoRow icon={Building2} label="Department" value={user.department} />
        <InfoRow icon={Briefcase} label="Employee ID" value={user.employee_id} />
      </Section>

      <Section title="Assignment">
        <InfoRow icon={Briefcase} label="MDX Role" value={roleLabel(user.application_role)} />
        <InfoRow icon={Building2} label="Team" value={team?.name} />
        <InfoRow icon={Building2} label="Supervisor" value={supervisor ? (supervisor.display_name || supervisor.full_name || supervisor.email) : null} />
        <InfoRow icon={MapPin} label="Territories" value={territories?.length ? territories.map((t) => t.name).join(', ') : null} />
        <InfoRow icon={MapPin} label="Service Area Notes" value={user.service_area_notes} />
      </Section>

      <Section title="Preferences">
        <InfoRow icon={Bell} label="Notification Preferences" value={user.notification_preferences ? 'Configured' : 'Default'} />
        <InfoRow icon={FileText} label="Email Signature" value={user.email_signature ? 'Set' : 'Not set'} />
        <InfoRow icon={FileText} label="Default Email Template" value={user.default_email_template_id ? 'Selected' : 'None'} />
        <InfoRow icon={Clock} label="Timezone" value={user.timezone} />
        <InfoRow icon={Palette} label="Preferred Theme" value={user.preferred_theme} />
      </Section>

      <Section title="Performance">
        <div className={`rounded-lg p-4 text-center text-sm ${theme === 'dark' ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
          Available after ownership migration
        </div>
        <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
          Assigned leads, assigned opportunities, open tasks, won opportunities, lost opportunities, quotes created,
          sales goals, and performance metrics will be populated once record ownership is migrated in a later phase.
        </p>
      </Section>
    </div>
  );
}