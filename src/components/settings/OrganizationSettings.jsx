import React, { useState } from 'react';
import { useSettings } from '@/components/context/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Building2, Check, Save } from "lucide-react";

export default function OrganizationSettings() {
    const { branding, saveSettings, isLoading, theme } = useSettings();
    const [localBranding, setLocalBranding] = useState(branding);
    const [isSaving, setIsSaving] = useState(false);

    // Update local state when branding changes from context (initial load)
    React.useEffect(() => {
        setLocalBranding(branding);
    }, [branding]);

    const handleSave = () => {
        setIsSaving(true);
        saveSettings({
            company_name: localBranding.companyName,
            currency: localBranding.currency,
            logo_url: localBranding.logoUrl,
            favicon_url: localBranding.faviconUrl,
            primary_color: localBranding.primaryColor,
            secondary_color: localBranding.secondaryColor,
            font_family: localBranding.fontFamily,
            address: localBranding.address,
            support_phone: localBranding.supportPhone,
            industry: localBranding.industry,
            timezone: localBranding.timezone,
            support_email: localBranding.supportEmail
        }, {
            onSuccess: () => {
                setIsSaving(false);
                // Toast logic usually goes here
            }
        });
    };

    const colors = [
        { name: 'Red', value: 'red', class: 'bg-red-600' },
        { name: 'Blue', value: 'blue', class: 'bg-blue-600' },
        { name: 'Green', value: 'emerald', class: 'bg-emerald-600' },
        { name: 'Purple', value: 'purple', class: 'bg-purple-600' },
        { name: 'Orange', value: 'orange', class: 'bg-orange-600' },
        { name: 'Black', value: 'neutral', class: 'bg-neutral-900' },
        { name: 'Cyan', value: 'cyan', class: 'bg-cyan-600' },
        { name: 'Rose', value: 'rose', class: 'bg-rose-600' },
    ];

    const fonts = ["Inter", "Roboto", "Open Sans", "Lato", "Poppins"];

    if (isLoading) return <div className="p-10 text-center text-slate-400">Loading settings...</div>;

    return (
        <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            <Card className={`transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
                <CardHeader>
                    <CardTitle className={theme === 'dark' ? 'text-white' : ''}>Organization Profile</CardTitle>
                    <CardDescription className={theme === 'dark' ? 'text-slate-400' : ''}>Central business details and contact information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className={theme === 'dark' ? 'text-slate-200' : ''}>Company Name</Label>
                            <Input 
                                value={localBranding.companyName || ''} 
                                onChange={(e) => setLocalBranding({...localBranding, companyName: e.target.value})} 
                                className={theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : ''}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className={theme === 'dark' ? 'text-slate-200' : ''}>Industry / Sector</Label>
                            <Input 
                                value={localBranding.industry || ''} 
                                onChange={(e) => setLocalBranding({...localBranding, industry: e.target.value})} 
                                placeholder="e.g. SaaS, Fintech, Retail"
                                className={theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : ''}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className={theme === 'dark' ? 'text-slate-200' : ''}>Support Email</Label>
                            <Input 
                                value={localBranding.supportEmail || ''} 
                                onChange={(e) => setLocalBranding({...localBranding, supportEmail: e.target.value})} 
                                className={theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : ''}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className={theme === 'dark' ? 'text-slate-200' : ''}>Support Phone</Label>
                            <Input 
                                value={localBranding.supportPhone || ''} 
                                onChange={(e) => setLocalBranding({...localBranding, supportPhone: e.target.value})} 
                                className={theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : ''}
                            />
                        </div>
                         <div className="space-y-2 md:col-span-2">
                            <Label className={theme === 'dark' ? 'text-slate-200' : ''}>Address</Label>
                            <Input 
                                value={localBranding.address || ''} 
                                onChange={(e) => setLocalBranding({...localBranding, address: e.target.value})} 
                                className={theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : ''}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className={theme === 'dark' ? 'text-slate-200' : ''}>Default Currency</Label>
                            <Input 
                                value={localBranding.currency || ''} 
                                onChange={(e) => setLocalBranding({...localBranding, currency: e.target.value})}
                                className={`font-mono ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : ''}`}
                            />
                        </div>
                         <div className="space-y-2">
                            <Label className={theme === 'dark' ? 'text-slate-200' : ''}>Timezone</Label>
                            <Input 
                                value={localBranding.timezone || ''} 
                                onChange={(e) => setLocalBranding({...localBranding, timezone: e.target.value})}
                                placeholder="e.g. UTC, EST, GMT+2"
                                className={theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : ''}
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-dashed border-slate-200 dark:border-slate-700">
                        <div className="space-y-2">
                            <Label className={theme === 'dark' ? 'text-slate-200' : ''}>Logo URL</Label>
                            <div className="flex gap-4">
                                <Input 
                                    value={localBranding.logoUrl || ''} 
                                    onChange={(e) => setLocalBranding({...localBranding, logoUrl: e.target.value})}
                                    placeholder="https://example.com/logo.png"
                                    className={theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : ''}
                                />
                                <div className={`w-12 h-10 rounded border flex items-center justify-center shrink-0 overflow-hidden ${
                                    theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'
                                }`}>
                                    {localBranding.logoUrl ? 
                                        <img src={localBranding.logoUrl} className="w-full h-full object-contain" alt="Logo" /> : 
                                        <Building2 className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
                                    }
                                </div>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label className={theme === 'dark' ? 'text-slate-200' : ''}>Favicon URL</Label>
                             <div className="flex gap-4">
                                <Input 
                                    value={localBranding.faviconUrl || ''} 
                                    onChange={(e) => setLocalBranding({...localBranding, faviconUrl: e.target.value})}
                                    placeholder="https://example.com/favicon.ico"
                                    className={theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : ''}
                                />
                                <div className={`w-10 h-10 rounded border flex items-center justify-center shrink-0 overflow-hidden ${
                                    theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'
                                }`}>
                                    {localBranding.faviconUrl ? 
                                        <img src={localBranding.faviconUrl} className="w-6 h-6 object-contain" alt="Fav" /> : 
                                        <Building2 className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className={`transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
                    <CardHeader>
                        <CardTitle className={theme === 'dark' ? 'text-white' : ''}>Look & Feel</CardTitle>
                        <CardDescription className={theme === 'dark' ? 'text-slate-400' : ''}>Brand colors and typography</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <Label className={theme === 'dark' ? 'text-slate-200' : ''}>Primary Brand Color</Label>
                            <div className="flex flex-wrap gap-3">
                                {colors.map((c) => (
                                    <button
                                        key={c.value}
                                        onClick={() => setLocalBranding({...localBranding, primaryColor: c.value})}
                                        className={`group relative w-10 h-10 rounded-full flex items-center justify-center transition-all ${c.class} 
                                            ${localBranding.primaryColor === c.value ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
                                    >
                                        {localBranding.primaryColor === c.value && <Check className="w-5 h-5 text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                         <div className="space-y-3">
                            <Label className={theme === 'dark' ? 'text-slate-200' : ''}>Secondary / Accent Color</Label>
                            <div className="flex flex-wrap gap-3">
                                {colors.map((c) => (
                                    <button
                                        key={c.value + '_sec'}
                                        onClick={() => setLocalBranding({...localBranding, secondaryColor: c.value})}
                                        className={`group relative w-8 h-8 rounded-full flex items-center justify-center transition-all ${c.class} 
                                            ${localBranding.secondaryColor === c.value ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-40 hover:opacity-100'}`}
                                    >
                                        {localBranding.secondaryColor === c.value && <Check className="w-4 h-4 text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                             <Label className={theme === 'dark' ? 'text-slate-200' : ''}>System Font</Label>
                             <div className="flex flex-wrap gap-2">
                                {fonts.map(font => (
                                    <button
                                        key={font}
                                        onClick={() => setLocalBranding({...localBranding, fontFamily: font})}
                                        className={`px-3 py-1.5 text-xs rounded border transition-all ${
                                            localBranding.fontFamily === font 
                                                ? (theme === 'dark' ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-900 text-white border-slate-900')
                                                : (theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600')
                                        }`}
                                        style={{ fontFamily: font }}
                                    >
                                        {font}
                                    </button>
                                ))}
                             </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className={`transition-colors flex flex-col ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
                     <CardHeader>
                        <CardTitle className={theme === 'dark' ? 'text-white' : ''}>Live Preview</CardTitle>
                        <CardDescription className={theme === 'dark' ? 'text-slate-400' : ''}>Real-time UI component preview</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-6">
                        <div className={`flex-1 p-6 rounded-xl border flex flex-col items-center justify-center gap-6 transition-all ${
                            theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`} style={{ fontFamily: localBranding.fontFamily }}>
                            
                            <div className="flex items-center gap-4">
                                <div className={`px-5 py-2.5 rounded-lg text-white font-medium shadow-lg transition-all bg-${localBranding.primaryColor}-600`}>
                                    Primary Button
                                </div>
                                <div className={`px-5 py-2.5 rounded-lg font-medium border transition-all ${
                                    theme === 'dark' 
                                        ? `border-${localBranding.primaryColor}-500 text-${localBranding.primaryColor}-400 bg-${localBranding.primaryColor}-500/10` 
                                        : `border-${localBranding.primaryColor}-200 text-${localBranding.primaryColor}-700 bg-${localBranding.primaryColor}-50`
                                }`}>
                                    Secondary Button
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-2 text-center">
                                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                    Heading Text
                                </h3>
                                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                    This is how body text will look with <span className={`font-bold text-${localBranding.secondaryColor || localBranding.primaryColor}-500`}>highlighted accents</span> in your selected font.
                                </p>
                            </div>

                            <div className="flex gap-2 mt-2">
                                <span className={`w-3 h-3 rounded-full bg-${localBranding.primaryColor}-500`}></span>
                                <span className={`w-3 h-3 rounded-full bg-${localBranding.secondaryColor || localBranding.primaryColor}-400`}></span>
                                <span className={`w-3 h-3 rounded-full bg-slate-300 opacity-50`}></span>
                            </div>

                        </div>
                    </CardContent>
                </Card>
            </div>

             {/* Sticky Action Footer */}
             <div className={`fixed bottom-0 left-0 right-0 p-4 border-t backdrop-blur-md z-40 transition-all flex justify-end gap-3 lg:pl-72 ${
                theme === 'dark' 
                    ? 'bg-slate-900/80 border-slate-800' 
                    : 'bg-white/80 border-slate-200'
            }`}>
                 <Button variant="ghost" onClick={() => setLocalBranding(branding)} className={theme === 'dark' ? 'text-slate-300 hover:text-white hover:bg-slate-800' : ''}>
                    Reset Changes
                 </Button>
                <Button onClick={handleSave} disabled={isSaving} className={`min-w-[140px] shadow-lg ${theme === 'dark' ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                    {isSaving ? "Saving..." : "Save Settings"}
                    <Save className="w-4 h-4 ml-2" />
                </Button>
            </div>

        </div>
    );
}