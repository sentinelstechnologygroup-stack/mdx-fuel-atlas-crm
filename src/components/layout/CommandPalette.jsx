import React, { useEffect, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
    LayoutDashboard, Users, Briefcase, CheckSquare, 
    Settings, Brain, Plus, UserPlus, Search, Bot
} from "lucide-react";
import { useSettings } from "@/components/context/SettingsContext";
import { useAssistant } from "@/components/context/AssistantContext";
import { ATLAS } from "@/components/ai/atlasConfig";

export default function CommandPalette() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const { theme } = useSettings();
    const { openAssistant } = useAssistant();

    useEffect(() => {
        const down = (e) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = (command) => {
        setOpen(false);
        command();
    };

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <div className={theme === 'dark' ? 'dark' : ''}>
                <CommandInput placeholder="Type a command or search..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    
                    <CommandGroup heading="Quick Actions">
                        <CommandItem onSelect={() => runCommand(() => openAssistant())}>
                            <Bot className="mr-2 h-4 w-4" />
                            <span>Ask {ATLAS.displayName}</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => navigate(createPageUrl('Leads') + '?action=new'))}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            <span>Add New Lead</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => navigate(createPageUrl('Tasks') + '?action=new'))}>
                            <CheckSquare className="mr-2 h-4 w-4" />
                            <span>Create Task</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => navigate(createPageUrl('Opportunities') + '?action=new'))}>
                            <Plus className="mr-2 h-4 w-4" />
                            <span>New Opportunity</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    <CommandGroup heading="Navigation">
                        <CommandItem onSelect={() => runCommand(() => navigate(createPageUrl('Dashboard')))}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>Dashboard</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => navigate(createPageUrl('Leads')))}>
                            <Users className="mr-2 h-4 w-4" />
                            <span>Leads</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => navigate(createPageUrl('Opportunities')))}>
                            <Briefcase className="mr-2 h-4 w-4" />
                            <span>Opportunities</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => navigate(createPageUrl('ActNow')))}>
                            <Brain className="mr-2 h-4 w-4" />
                            <span>Act Now Engine</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => navigate(createPageUrl('Settings')))}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Settings</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </div>
        </CommandDialog>
    );
}