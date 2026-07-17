import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/components/context/SettingsContext";

/**
 * InlineEdit - Smart inline editing component
 * Supports text, number, and Select inputs
 */
export function InlineEdit({ 
  value, 
  onSave, 
  type = "text", 
  options = [], // for type="select"
  className, 
  placeholder, 
  formatDisplay 
}) {
  const { theme } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value || "");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setCurrentValue(value || "");
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current && type !== 'select') {
      inputRef.current.focus();
    }
  }, [isEditing, type]);

  const handleSave = async (newValue) => {
    const valToSave = newValue !== undefined ? newValue : currentValue;

    // If no change, cancel
    if (valToSave == value) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await onSave(valToSave); // Server call
      setIsLoading(false);
      setIsEditing(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      console.error("Save failed:", err);
      setIsLoading(false);
      setIsEditing(false);
      setCurrentValue(value); // Revert
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setCurrentValue(value);
      setIsEditing(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm animate-pulse">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>שומר...</span>
      </div>
    );
  }

  // Editing state
  if (isEditing) {
    if (type === 'select') {
      return (
        <div className="w-full min-w-[120px]" onClick={(e) => e.stopPropagation()}>
           <Select 
            value={currentValue} 
            onValueChange={(val) => {
                setCurrentValue(val);
                handleSave(val); // Auto-save on select
            }}
            open={true} 
            onOpenChange={(open) => !open && setIsEditing(false)}
           >
            <SelectTrigger className={`h-8 text-sm transition-all ${
              theme === 'dark' 
                ? 'bg-[#151E32] border-[#1E293B] text-white ring-1 ring-[#1E293B]' 
                : 'bg-white border-slate-200 text-slate-900 ring-1 ring-slate-200'
            }`}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className={`backdrop-blur-xl border shadow-xl ${
              theme === 'dark' 
                ? 'bg-[#0B1121]/95 border-[#1E293B] text-slate-200' 
                : 'bg-white/95 border-slate-200 text-slate-700'
            }`}>
              {options.map((opt) => (
                <SelectItem 
                  key={opt.value} 
                  value={opt.value}
                  className={`transition-colors cursor-pointer ${
                    theme === 'dark' 
                      ? 'focus:bg-[#151E32] focus:text-emerald-400 hover:bg-[#151E32] hover:text-emerald-400' 
                      : 'focus:bg-slate-50 focus:text-indigo-600 hover:bg-slate-50 hover:text-indigo-600'
                  }`}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          type={type === "phone" ? "tel" : type}
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={() => handleSave()}
          onKeyDown={handleKeyDown}
          className={`h-8 text-sm w-full transition-all ${
            theme === 'dark' 
              ? 'bg-[#151E32] border-[#1E293B] text-white focus-visible:ring-emerald-500/50' 
              : 'bg-white border-slate-200 text-slate-900 focus-visible:ring-indigo-200'
          }`}
          placeholder={placeholder}
        />
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex gap-1">
            <button onMouseDown={() => handleSave()} className={`rounded-full p-0.5 transition-colors ${
              theme === 'dark' 
                ? 'bg-emerald-600 text-white hover:bg-emerald-500' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}>
                <Check className="w-3 h-3" />
            </button>
        </div>
      </div>
    );
  }

  // Normal display state
  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={cn(
        "group relative flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -ml-2 transition-all border border-transparent min-h-[32px] font-medium", 
        theme === 'dark' 
          ? "text-slate-200 hover:bg-[#151E32] hover:border-[#1E293B]" 
          : "text-neutral-900 hover:bg-white hover:shadow-sm hover:border-neutral-200", 
        className
      )}
    >
      <span className={cn("truncate block w-full", !currentValue && "text-neutral-400 italic text-xs")}>
        {formatDisplay ? formatDisplay(currentValue) : (currentValue || placeholder || "לחץ לעריכה")}
      </span>
      
      {showSuccess && <Check className="w-3 h-3 text-red-600 animate-in fade-in zoom-in" />}
      
      <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity absolute left-1" />
    </div>
  );
}