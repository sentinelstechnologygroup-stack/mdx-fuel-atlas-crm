import { useSearchParams } from 'react-router-dom';
import { useMemo, useCallback } from 'react';

export function useUrlFilters(defaultView = 'all') {
    const [searchParams, setSearchParams] = useSearchParams();

    // View
    const view = searchParams.get('view') || defaultView;
    const setView = useCallback((newView) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            // Preserve action if exists
            if (newView && newView !== defaultView) {
                next.set('view', newView);
            } else {
                next.delete('view');
            }
            return next;
        });
    }, [setSearchParams, defaultView]);

    // Search (optional, if you want to sync it)
    const search = searchParams.get('q') || '';
    const setSearch = useCallback((term) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (term) {
                next.set('q', term);
            } else {
                next.delete('q');
            }
            return next;
        });
    }, [setSearchParams]);

    // Filters (everything else)
    const filters = useMemo(() => {
        const current = {};
        for (const [key, value] of searchParams.entries()) {
            if (key !== 'view' && key !== 'q' && key !== 'action') {
                current[key] = value;
            }
        }
        return current;
    }, [searchParams]);

    const setFilters = useCallback((newFilters) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            
            // 1. Identify keys to remove (old filters)
            const keysToDelete = [];
            for (const key of next.keys()) {
                if (key !== 'view' && key !== 'q' && key !== 'action') {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(k => next.delete(k));

            // 2. Add new filters
            Object.entries(newFilters).forEach(([k, v]) => {
                if (v !== null && v !== undefined && v !== '') {
                    next.set(k, v);
                }
            });
            return next;
        });
    }, [setSearchParams]);

    // Atomic update for View + Filters (to avoid race conditions)
    const setViewState = useCallback((newView, newFilters) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            
            // 1. Set View
            if (newView && newView !== defaultView) {
                next.set('view', newView);
            } else {
                next.delete('view');
            }

            // 2. Clear old filters (preserve q and action)
            const keysToDelete = [];
            for (const key of next.keys()) {
                if (key !== 'view' && key !== 'q' && key !== 'action') {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(k => next.delete(k));

            // 3. Set new filters
            if (newFilters) {
                Object.entries(newFilters).forEach(([k, v]) => {
                    if (v !== null && v !== undefined && v !== '') {
                        next.set(k, v);
                    }
                });
            }
            
            return next;
        });
    }, [setSearchParams, defaultView]);

    return { view, setView, search, setSearch, filters, setFilters, setViewState };
}