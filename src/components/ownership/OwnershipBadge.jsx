import React from 'react';
import { UserCircle2 } from 'lucide-react';
import { getInitials, displayName } from '@/lib/roles';
import { useDirectoryData } from '@/components/hooks/useDirectoryData';

const STATUS_STYLES = {
  assigned: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  unassigned: 'bg-amber-50 text-amber-700 border-amber-200',
  transfer_pending: 'bg-blue-50 text-blue-700 border-blue-200',
  inactive_owner: 'bg-rose-50 text-rose-700 border-rose-200'
};
const STATUS_LABELS = {
  assigned: 'Assigned',
  unassigned: 'Unassigned',
  transfer_pending: 'Transfer Pending',
  inactive_owner: 'Inactive Owner'
};

// Compact ownership presentation: owner avatar/initials, owner name, team,
// supervisor, and ownership status. Designed to drop into existing list and
// detail views without crowding mobile screens.
export default function OwnershipBadge({ record, showTeam = true, showStatus = true, size = 'sm' }) {
  const { userById, teamById, isLoading } = useDirectoryData();

  if (!record) return null;
  const owner = record.owner_user_id ? userById.get(record.owner_user_id) : null;
  const team = record.assigned_team_id ? teamById.get(record.assigned_team_id) : null;
  const supervisor = record.assigned_supervisor_user_id ? userById.get(record.assigned_supervisor_user_id) : null;
  const status = record.ownership_status || (owner ? 'assigned' : 'unassigned');

  const avatarSize = size === 'lg' ? 'w-9 h-9 text-xs' : 'w-6 h-6 text-[10px]';

  return (
    <div className="flex items-center gap-2 min-w-0">
      {owner ? (
        <span className={`${avatarSize} rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center font-semibold flex-shrink-0`}>
          {getInitials(owner)}
        </span>
      ) : (
        <UserCircle2 className={`${size === 'lg' ? 'w-9 h-9' : 'w-6 h-6'} text-slate-300 flex-shrink-0`} />
      )}
      <div className="min-w-0 leading-tight">
        <p className={`truncate font-medium ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>
          {isLoading && !owner ? 'Loading…' : owner ? displayName(owner) : 'Unassigned'}
        </p>
        {(showTeam || supervisor) && (
          <p className="text-[10px] text-slate-400 truncate">
            {showTeam && team ? team.name : ''}
            {showTeam && team && supervisor ? ' · ' : ''}
            {supervisor ? `Sup: ${displayName(supervisor)}` : ''}
            {!team && !supervisor ? 'No team' : ''}
          </p>
        )}
      </div>
      {showStatus && (
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap ${STATUS_STYLES[status] || STATUS_STYLES.unassigned}`}>
          {STATUS_LABELS[status] || status}
        </span>
      )}
    </div>
  );
}