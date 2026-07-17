import React, { useState } from 'react';
import { useSettings } from '@/components/context/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";

export default function TagSettings() {
    const { systemTags, updateSystemTags, theme } = useSettings();
    const [newTag, setNewTag] = useState("");

    const addTag = () => {
        if (newTag && !systemTags.includes(newTag)) {
            updateSystemTags([...systemTags, newTag]);
            setNewTag("");
        }
    };

    const removeTag = (tagToRemove) => {
        if (confirm(`Delete tag "${tagToRemove}"?`)) {
            updateSystemTags(systemTags.filter(t => t !== tagToRemove));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                <CardHeader>
                    <CardTitle className={theme === 'dark' ? 'text-white' : ''}>System Tags Management</CardTitle>
                    <CardDescription className={theme === 'dark' ? 'text-slate-400' : ''}>Tags used for classifying leads and customers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex gap-2">
                        <Input 
                            value={newTag} 
                            onChange={(e) => setNewTag(e.target.value)} 
                            placeholder="New tag name..." 
                            onKeyDown={(e) => e.key === 'Enter' && addTag()}
                            className={`max-w-xs ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : ''}`}
                        />
                        <Button onClick={addTag} variant="secondary">
                            <Plus className="w-4 h-4 mr-2" />
                            Add
                        </Button>
                    </div>

                    <div className={`flex flex-wrap gap-2 p-4 rounded-xl border min-h-[100px] ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        {systemTags.length === 0 && <p className="text-slate-500 text-sm italic w-full text-center pt-8">No tags defined yet</p>}
                        {systemTags.map(tag => (
                            <Badge key={tag} className={`pr-1 pl-3 py-1.5 text-sm gap-2 shadow-sm ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                                {tag}
                                <button onClick={() => removeTag(tag)} className={`rounded-full p-0.5 transition-colors ${theme === 'dark' ? 'bg-slate-800 hover:bg-red-900/30 hover:text-red-400' : 'bg-slate-100 hover:bg-red-100 hover:text-red-600'}`}>
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                </CardContent>
             </Card>
        </div>
    );
}