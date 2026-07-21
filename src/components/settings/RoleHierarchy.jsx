import React from 'react';
import { APPLICATION_ROLES } from '@/lib/roles';
import { Shield, Crown, Users, Briefcase, Eye } from 'lucide-react';
import { useSettings } from '@/components/context/SettingsContext';

const ROLE_ICONS = {
  super_admin: Crown,
  administrator: Shield,
  supervisor: Users,
  salesperson: Briefcase,
  viewer_support: Eye
};

export default function RoleHierarchy() {
  const { theme } = useSettings();

  return (
    <div className="space-y-4">
      <div>
        <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          MDX Role Hierarchy
        </h3>
        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
          The MDX business role structure. Granular module permissions will be configured in Phase 3C.
        </p>
      </div>

      <div className="space-y-3">
        {APPLICATION_ROLES.map((role, idx) => {
          const Icon = ROLE_ICONS[role.value] || Shield;
          const isLast = idx === APPLICATION_ROLES.length - 1;
          return (
            <div key={role.value}>
              <div
                className={`rounded-xl border p-4 ${
                  theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      theme === 'dark' ? 'bg-slate-800 text-cyan-400' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {role.label}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          theme === 'dark'
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        LEVEL {role.level}
                      </span>
                    </div>
                    <p className={`text-sm mt-1 leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {role.description}
                    </p>
                  </div>
                </div>
              </div>
              {!isLast && (
                <div className="flex justify-center py-1">
                  <div className={`w-px h-4 ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-300'}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className={`rounded-lg p-3 text-xs ${
          theme === 'dark' ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'
        }`}
      >
        Enforcement of the full module-action permission matrix is scheduled for Phase 3C. Until then,
        role assignment and account status are managed here, while existing ATLAS authentication
        and legacy access levels remain active for compatibility.
      </div>
    </div>
  );
}