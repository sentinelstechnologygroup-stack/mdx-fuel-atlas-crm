import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";

export default function TagManager({ tags = [], onChange }) {
  const { theme } = useSettings();
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInputValue("");
    }
  };

  const removeTag = (tagToRemove) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, index) => (
          <Badge 
            key={index} 
            variant="secondary" 
            className={`px-2 py-1 text-sm font-medium flex items-center gap-1 border ${
                theme === 'dark' 
                ? 'bg-slate-900 text-cyan-400 hover:bg-slate-800 border-slate-700' 
                : 'bg-slate-100 text-red-700 hover:bg-slate-200 border-slate-200'
            }`}
          >
            {tag}
            <button onClick={() => removeTag(tag)} type="button" className={`${theme === 'dark' ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-red-600'}`}>
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="relative">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type tag and press Enter..."
          className={`font-medium placeholder:text-slate-400 pl-10 ${
            theme === 'dark'
            ? 'bg-slate-900 border-slate-700 text-white focus:border-cyan-500'
            : 'bg-white border-slate-300 text-slate-900 focus:border-red-500'
          }`}
        />
        <button 
          type="button" 
          onClick={addTag}
          className={`absolute left-2 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-500 hover:text-cyan-400' : 'text-slate-400 hover:text-red-600'}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}