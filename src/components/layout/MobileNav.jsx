import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LayoutDashboard, Users, Briefcase, BarChart3, Menu } from 'lucide-react';
import { cn } from "@/lib/utils"; // Assuming standard shadcn utils, or I'll implement inline logic if not sure

export default function MobileNav({ currentPageName, onMenuClick }) {
  const navItems = [
    { name: 'לוח בקרה', path: 'Dashboard', icon: LayoutDashboard },
    { name: 'לידים', path: 'Leads', icon: Users },
    { name: 'הזדמנויות', path: 'Opportunities', icon: Briefcase },
    { name: 'דוחות', path: 'Reports', icon: BarChart3 },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-2 pb-safe pt-2 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = currentPageName === item.path;
          return (
            <Link
              key={item.path}
              to={createPageUrl(item.path)}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200",
                isActive ? "text-red-600" : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive && "fill-current opacity-20")} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
        
        {/* Menu Button for Sidebar */}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center w-full h-full space-y-1 text-neutral-400 hover:text-neutral-600 active:text-red-600 transition-colors"
        >
          <Menu className="w-6 h-6" />
          <span className="text-[10px] font-medium">תפריט</span>
        </button>
      </div>
    </div>
  );
}