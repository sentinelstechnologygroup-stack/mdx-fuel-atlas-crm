import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, User, Briefcase, Loader2, X, CheckSquare, Activity, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { useSettings } from '@/components/context/SettingsContext';

export default function GlobalSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const { branding, theme } = useSettings();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // Search Query
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['globalSearch', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return { leads: [], opportunities: [], tasks: [], activities: [] };

      // Fetch more recent items for better coverage
      const [leads, opportunities, tasks, activities] = await Promise.all([
        base44.entities.Lead.list('-updated_date', 100),
        base44.entities.Opportunity.list('-updated_date', 100),
        base44.entities.Task.list('-updated_date', 100),
        base44.entities.Activity.list('-date', 50)
      ]);

      const lowerTerm = searchTerm.toLowerCase().trim();
      const phoneSearch = searchTerm.replace(/\D/g, '');
      const isPhoneSearch = phoneSearch.length > 2; // Only search phone if at least 3 digits

      // Helper to score matches for smarter ranking
      const calculateScore = (item, fields) => {
        let score = 0;
        let matched = false;

        // Text Search
        if (lowerTerm) {
            fields.text.forEach(field => {
                const value = item[field]?.toString().toLowerCase();
                if (!value) return;
                
                if (value === lowerTerm) { score += 100; matched = true; } // Exact match
                else if (value.startsWith(lowerTerm)) { score += 80; matched = true; } // Starts with
                else if (value.includes(' ' + lowerTerm)) { score += 60; matched = true; } // Word start
                else if (value.includes(lowerTerm)) { score += 40; matched = true; } // Contains
            });
        }

        // Phone Search
        if (isPhoneSearch && fields.phone) {
             const phone = item[fields.phone]?.replace(/\D/g, '');
             if (phone && phone.includes(phoneSearch)) {
                 score += 90;
                 matched = true;
             }
        }

        return matched ? score : 0;
      };

      const processResults = (items, fields) => {
          return items
            .map(item => ({ ...item, score: calculateScore(item, fields) }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score) // Sort by score (relevance)
            .slice(0, 5);
      };

      return { 
        leads: processResults(leads, { text: ['full_name', 'email', 'city', 'notes'], phone: 'phone_number' }),
        opportunities: processResults(opportunities, { text: ['lead_name', 'product_type', 'deal_stage', 'main_pain_point'], phone: 'phone_number' }),
        tasks: processResults(tasks, { text: ['title', 'description', 'status'] }),
        activities: processResults(activities, { text: ['type', 'summary', 'status'] })
      };
    },
    enabled: searchTerm.length >= 2,
    staleTime: 5000 // Reduced cache time for fresher results
  });

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    if (e.target.value.length >= 2) setIsOpen(true);else
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm.length >= 2) {
        setIsOpen(false);
        // Navigate will be handled by the Link or form submission normally, 
        // but since this is a controlled input inside a div, we need to force navigation
        window.location.href = createPageUrl('SearchResults') + `?q=${encodeURIComponent(searchTerm)}`;
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setIsOpen(false);
  };

  const focusRing = `focus:ring-red-100`;

  return (
    <div className="relative w-full max-w-xl" ref={wrapperRef}>
      <div className="relative group">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors pointer-events-none ${
          theme === 'dark' 
            ? 'text-slate-500 group-focus-within:text-cyan-400' 
            : 'text-slate-400 group-focus-within:text-red-600'
        }`} />
        <input
          value={searchTerm}
          onChange={handleSearch}
          onKeyDown={handleKeyDown}
          onFocus={() => searchTerm.length >= 2 && setIsOpen(true)} 
          className={`pl-12 pr-10 py-3 text-base rounded-full border w-72 focus:w-96 transition-all shadow-sm ${
            theme === 'dark'
              ? 'bg-slate-800 text-white border-slate-700 focus:ring-4 focus:ring-cyan-900/20 focus:border-cyan-500/50 placeholder:text-slate-500'
              : 'bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-red-100 focus:border-red-300 placeholder:text-slate-400'
          }`}
          placeholder="Search leads, opportunities, tasks..." 
        />

        {searchTerm &&
        <button onClick={clearSearch} className={`absolute right-4 top-1/2 -translate-y-1/2 ${
          theme === 'dark' ? 'text-slate-500 hover:text-cyan-400' : 'text-slate-400 hover:text-red-600'
        }`}>
                <X className="w-4 h-4" />
            </button>
        }
      </div>

      {/* Results Dropdown */}
      {isOpen && searchTerm.length >= 2 &&
      <div className={`absolute top-full left-0 mt-2 w-96 rounded-xl shadow-xl border overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
      }`}>
          {isLoading ?
        <div className="p-4 text-center text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Searching...
            </div> :

        <>
              {searchResults?.leads?.length === 0 && searchResults?.opportunities?.length === 0 && searchResults?.tasks?.length === 0 && searchResults?.activities?.length === 0 ?
          <div className="p-4 text-center text-slate-500 text-sm">
                    No results found for "{searchTerm}"
                </div> :

          <div className="max-h-[400px] overflow-y-auto py-2">
                    {searchResults?.leads?.length > 0 &&
            <div className="mb-2">
                            <div className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ${
                              theme === 'dark' ? 'text-slate-500 bg-slate-800/50' : 'text-slate-400 bg-slate-50'
                            }`}>
                                Leads
                            </div>
                            {searchResults.leads.map((lead) =>
              <Link
                key={lead.id}
                to={createPageUrl(`LeadDetails?leadId=${lead.id}`)}
                onClick={clearSearch}
                className={`flex items-center gap-3 px-4 py-2 transition-colors ${
                  theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                }`}>

                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                      theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                                    }`}>
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{lead.full_name}</div>
                                        <div className="text-xs text-slate-500 truncate">{lead.phone_number}</div>
                                    </div>
                                </Link>
              )}
                        </div>
            }
                    
                    {searchResults?.opportunities?.length > 0 &&
            <div className="mb-2">
                            <div className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ${
                              theme === 'dark' ? 'text-slate-500 bg-slate-800/50' : 'text-slate-400 bg-slate-50'
                            }`}>
                                Opportunities
                            </div>
                            {searchResults.opportunities.map((opp) =>
              <Link
                key={opp.id}
                to={createPageUrl('Opportunities')}
                onClick={clearSearch}
                className={`flex items-center gap-3 px-4 py-2 transition-colors ${
                  theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                }`}>

                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                      theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-600'
                                    }`}>
                                        <Briefcase className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{opp.lead_name || 'עסקה ללא שם'}</div>
                                        <div className="text-xs text-slate-500 truncate">{opp.product_type} • {opp.deal_stage?.split('(')[0]}</div>
                                    </div>
                                </Link>
              )}
                        </div>
            }

                    {searchResults?.tasks?.length > 0 &&
            <div className="mb-2">
                            <div className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ${
                              theme === 'dark' ? 'text-slate-500 bg-slate-800/50' : 'text-slate-400 bg-slate-50'
                            }`}>
                                Tasks
                            </div>
                            {searchResults.tasks.map((task) =>
              <Link
                key={task.id}
                to={createPageUrl('Tasks')}
                onClick={clearSearch}
                className={`flex items-center gap-3 px-4 py-2 transition-colors ${
                  theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                }`}>

                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        task.status === 'done' ? (theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600') : 
                                        task.status === 'in_progress' ? (theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-600') : 
                                        (theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')
                                    }`}>
                                        <CheckSquare className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'} ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
                                            {task.title}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">
                                            {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US') : 'No Date'} • {task.status === 'done' ? 'Completed' : task.status === 'in_progress' ? 'In Progress' : 'New'}
                                        </div>
                                    </div>
                                </Link>
              )}
                        </div>
            }

                    {searchResults?.activities?.length > 0 &&
            <div className="mb-2">
                            <div className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ${
                              theme === 'dark' ? 'text-slate-500 bg-slate-800/50' : 'text-slate-400 bg-slate-50'
                            }`}>
                                Recent Activities
                            </div>
                            {searchResults.activities.map((activity) =>
              <Link
                key={activity.id}
                to={createPageUrl(`LeadDetails?leadId=${activity.lead_id}`)}
                onClick={clearSearch}
                className={`flex items-center gap-3 px-4 py-2 transition-colors ${
                  theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                }`}>

                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                      theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
                                    }`}>
                                        <Activity className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{activity.type} • {activity.status}</div>
                                        <div className="text-xs text-slate-500 truncate">{activity.summary || 'No description'}</div>
                                    </div>
                                </Link>
              )}
                        </div>
            }
                </div>
          }
              {/* Footer Link */}
              <Link 
                  to={createPageUrl('SearchResults') + `?q=${encodeURIComponent(searchTerm)}`}
                  onClick={() => setIsOpen(false)}
                  className={`block p-3 text-center text-sm font-medium border-t transition-colors mt-1 ${
                    theme === 'dark' 
                      ? 'text-cyan-400 bg-slate-800 hover:bg-slate-700 border-slate-700' 
                      : 'text-red-600 bg-slate-50 hover:bg-red-50 border-slate-100'
                  }`}
              >
                  Show all results for "{searchTerm}"
              </Link>
            </>
        }
        </div>
      }
    </div>);

}