import React, { useState } from 'react';
import { Search, Plus, X, Filter, Check, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk"; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from "@/components/context/SettingsContext";
import { cn } from "@/lib/utils";

// Helper for generic filter inputs inside the popover
function FilterValueInput({ type, options, value, onChange, placeholder, theme }) {
    if (type === 'select') {
        return (
            <div className="min-w-[200px] p-2">
                <div className="space-y-1">
                    {options.map((opt) => (
                        <div 
                            key={opt.value}
                            onClick={() => onChange(opt.value)}
                            className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-sm ${
                                value === opt.value 
                                    ? theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-50 text-blue-700'
                                    : theme === 'dark' ? 'hover:bg-[#0B1121] text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                            }`}
                        >
                            <span>{opt.label}</span>
                            {value === opt.value && <Check className="w-4 h-4" />}
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    
    // Default to text input
    return (
        <div className="p-2 min-w-[200px]">
             <Input 
                autoFocus
                placeholder={placeholder || "Type to filter..."}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className={theme === 'dark' ? 'bg-[#0B1121] border-[#1E293B]' : ''}
            />
        </div>
    );
}

export default function SmartFilterBar({ 
    views = [], 
    activeView, 
    onViewChange,
    schema = [], 
    filters = {}, 
    onFilterChange,
    search,
    onSearchChange,
    className,
    children
}) {
    const { theme } = useSettings();
    const [openPopover, setOpenPopover] = useState(null); // 'add' or filter key

    const handleRemoveFilter = (key) => {
        const newFilters = { ...filters };
        delete newFilters[key];
        onFilterChange(newFilters);
    };

    const handleSetFilter = (key, value) => {
        onFilterChange({ ...filters, [key]: value });
        setOpenPopover(null);
    };

    // Available fields to add (exclude active ones)
    const availableFields = schema.filter(field => filters[field.key] === undefined);

    const activeFilterCount = Object.keys(filters).length;

    return (
        <div className={cn("space-y-4", className)}>
            
            {/* 1. Smart Views Tabs */}
            {views.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {views.map(view => (
                        <button
                            key={view.id}
                            onClick={() => onViewChange(view.id)}
                            className={cn(
                                "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border",
                                activeView === view.id
                                    ? theme === 'dark' 
                                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/10" 
                                        : "bg-slate-900 text-white border-slate-900 shadow-md"
                                    : theme === 'dark'
                                        ? "bg-[#151E32] text-slate-400 border-transparent hover:bg-[#1E293B] hover:text-slate-200"
                                        : "bg-white text-slate-600 border-transparent hover:bg-slate-100 hover:border-slate-200"
                            )}
                        >
                            {view.label}
                        </button>
                    ))}
                </div>
            )}

            {/* 2. Filter Bar Container */}
            <div className={cn(
                "p-2 rounded-2xl border flex flex-col md:flex-row gap-2 items-center shadow-sm backdrop-blur-xl transition-all",
                theme === 'dark' 
                    ? "bg-[#151E32]/80 border-[#1E293B] shadow-black/30" 
                    : "bg-white/80 border-white/50 shadow-slate-200/50"
            )}>

                    {/* Search Input */}
                    <div className="relative flex-1 w-full md:w-auto min-w-[200px]">
                    <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", theme === 'dark' ? "text-slate-500" : "text-slate-400")} />
                    <Input 
                        placeholder="Search..." 
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className={cn(
                            "pl-9 border-none shadow-none h-10 focus-visible:ring-0", 
                            theme === 'dark' ? "bg-transparent text-white placeholder:text-slate-600" : "bg-transparent text-slate-900 placeholder:text-slate-400"
                        )}
                    />
                    </div>

                    {/* Vertical Divider */}
                    <div className={cn("hidden md:block w-px h-6 mx-2", theme === 'dark' ? "bg-[#1E293B]" : "bg-slate-200")} />

                    {/* Active Filter Chips */}
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {schema.map(field => {
                        const isActive = filters[field.key] !== undefined;
                        if (!isActive) return null;

                        const displayValue = field.type === 'select' 
                            ? (field.options.find(o => o.value === filters[field.key])?.label || filters[field.key])
                            : filters[field.key];

                        return (
                            <Popover key={field.key}>
                                <PopoverTrigger asChild>
                                    <div className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all border group",
                                        theme === 'dark' 
                                            ? "bg-[#151E32] border-[#1E293B] text-emerald-300 hover:border-emerald-500/50" 
                                            : "bg-slate-100 border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                                    )}>
                                        <span className={theme === 'dark' ? "text-slate-400" : "text-slate-500"}>{field.label}:</span>
                                        <span className="max-w-[100px] truncate">{displayValue}</span>
                                        <div 
                                            role="button"
                                            onClick={(e) => { e.stopPropagation(); handleRemoveFilter(field.key); }}
                                            className={cn("ml-1 p-0.5 rounded-full", theme === 'dark' ? "hover:bg-[#1E293B]" : "hover:bg-slate-200")}
                                        >
                                            <X className="w-3 h-3" />
                                        </div>
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent align="start" className={cn("p-0 w-auto border shadow-xl", theme === 'dark' ? "bg-[#151E32] border-[#1E293B]" : "bg-white")}>
                                    <div className="p-2 border-b text-xs font-semibold text-center opacity-50">Edit {field.label}</div>
                                    <FilterValueInput 
                                        type={field.type} 
                                        options={field.options} 
                                        value={filters[field.key]} 
                                        onChange={(val) => handleSetFilter(field.key, val)}
                                        theme={theme}
                                    />
                                </PopoverContent>
                            </Popover>
                        );
                    })}

                    {/* Add Filter Button */}
                    <Popover open={openPopover === 'add'} onOpenChange={(open) => setOpenPopover(open ? 'add' : null)}>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className={cn(
                                    "h-8 rounded-full gap-2 text-xs font-medium border border-dashed",
                                    theme === 'dark' 
                                        ? "border-[#1E293B] text-slate-400 hover:text-white hover:bg-[#151E32]" 
                                        : "border-slate-300 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                )}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Filter
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className={cn("p-1 w-48 shadow-xl", theme === 'dark' ? "bg-[#151E32] border-[#1E293B]" : "bg-white")}>
                            <div className="space-y-1">
                                <div className={cn("px-2 py-1.5 text-xs font-semibold", theme === 'dark' ? "text-slate-500" : "text-slate-500")}>
                                    Filter by...
                                </div>
                                {availableFields.length === 0 ? (
                                    <div className="px-2 py-2 text-xs text-center opacity-50">No more filters</div>
                                ) : (
                                    availableFields.map(field => (
                                        <div 
                                            key={field.key}
                                            onClick={() => {
                                                // Initialize with first option or empty string
                                                const initialVal = field.type === 'select' ? field.options[0]?.value : '';
                                                handleSetFilter(field.key, initialVal);
                                            }}
                                            className={cn(
                                                "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
                                                theme === 'dark' ? "hover:bg-[#0B1121] text-slate-200" : "hover:bg-slate-100 text-slate-700"
                                            )}
                                        >
                                            <Filter className="w-3.5 h-3.5 opacity-70" />
                                            {field.label}
                                        </div>
                                    ))
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {activeFilterCount > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => onFilterChange({})}
                            className={cn("h-8 text-xs px-2 hover:bg-transparent", theme === 'dark' ? "text-red-400 hover:text-red-300" : "text-red-600 hover:text-red-700")}
                        >
                            Reset
                        </Button>
                    )}
                    </div>

                    {/* 4. Action Buttons (Passed as Children) */}
                    {children && (
                    <>
                        <div className={cn("hidden md:block w-px h-6 mx-2", theme === 'dark' ? "bg-[#1E293B]" : "bg-slate-200")} />
                        <div className="flex items-center gap-2">
                            {children}
                        </div>
                    </>
                    )}
                    </div>
                    </div>
                    );
                    }