import React, { useState, useEffect, useRef } from 'react';
import { 
    ArrowLeft, MoreHorizontal, Sparkles, Zap, 
    MessageSquare, User, Send, X, ChevronDown,
    Bold, Italic, List, Link as LinkIcon, AlertTriangle,
    CheckCircle2, AlertCircle, Info, Split, Save
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useSettings } from '@/components/context/SettingsContext';
import { useQuery } from '@tanstack/react-query';

// Custom Toolbar for Quill
const CustomToolbar = ({ theme }) => (
    <div id="toolbar" className={`flex items-center gap-1 border-b px-6 py-2 sticky top-0 z-10 transition-colors ${theme === 'dark' ? 'border-slate-800 bg-[#0f172a]' : 'border-slate-100 bg-white'}`}>
        <div className="flex items-center gap-1">
            <button className={`ql-bold p-1.5 rounded-md transition-all ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
                <Bold className="w-4 h-4" />
            </button>
            <button className={`ql-italic p-1.5 rounded-md transition-all ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
                <Italic className="w-4 h-4" />
            </button>
        </div>
        
        <div className={`w-px h-4 mx-2 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
        
        <div className="flex items-center gap-1">
            <button className="ql-list p-1.5 rounded-md transition-all hover:bg-slate-100 dark:hover:bg-slate-800" value="bullet">
                <List className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
            </button>
            <button className="ql-link p-1.5 rounded-md transition-all hover:bg-slate-100 dark:hover:bg-slate-800">
                <LinkIcon className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
            </button>
        </div>
    </div>
);

const MOCK_TEMPLATES = [
  {
    "id": "t_001",
    "name": "Enterprise Value Prop (Optimized)",
    "subject_line": "Reducing your cloud spend by 12% in Q4",
    "body_content": "Hi {{First_Name}},<br/><br/>I noticed {{Company_Name}} is expanding its infrastructure. Most CTOs I speak with are struggling to balance scaling costs with performance.<br/><br/>We helped Acme Corp cut AWS spend by 12% in under 30 days without downtime.<br/><br/>Are you open to a 10-minute technical review next Tuesday?",
    "ai_resonance_score": 92,
    "status_color": "green", 
    "tone_analysis": "Professional, Data-Driven",
    "spam_triggers": []
  },
  {
    "id": "t_002",
    "name": "Generic Follow Up (Needs Work)",
    "subject_line": "Just checking in...",
    "body_content": "Hi {{First_Name}},<br/><br/>I am just bumping this to the top of your inbox.<br/><br/>Did you see my last email? I would love to hop on a quick call and see if there are any synergies we can explore.<br/><br/>Best,<br/>[My Name]",
    "ai_resonance_score": 35,
    "status_color": "red",
    "tone_analysis": "Passive, Generic",
    "spam_triggers": [
      { "word": "synergies", "suggestion": "collaboration opportunities" },
      { "word": "bumping", "suggestion": "following up on" }
    ]
  },
  {
    "id": "t_003",
    "name": "Intro - SaaS Founders",
    "subject_line": "Question about your sales process",
    "body_content": "Hey {{First_Name}},<br/><br/>Saw you guys are growing fast. Congrats!<br/><br/>I wanted to reach out and see if you need help with your CRM. We have a great tool that is super cheap and easy to use.<br/><br/>Let me know?",
    "ai_resonance_score": 55,
    "status_color": "yellow",
    "tone_analysis": "Too Casual, Vague",
    "spam_triggers": [
      { "word": "cheap", "suggestion": "cost-effective" }
    ]
  }
];

const MOCK_PERSONAS = [
  {
    "id": "p_001",
    "name": "Steve - The Skeptical CTO",
    "role": "Chief Technology Officer",
    "company_type": "Series B Fintech",
    "disc_profile": "High Dominance (D)",
    "avatar_initials": "ST",
    "ai_simulation_prompt": "You are a busy CTO. You hate sales fluff. If the email doesn't mention security, compliance, or hard ROI numbers immediately, you delete it. You are rude but honest.",
    "recent_activity": "Posted on LinkedIn about 'SOC2 Compliance Nightmares'"
  },
  {
    "id": "p_002",
    "name": "Sarah - The Visionary VP",
    "role": "VP of Marketing",
    "company_type": "Consumer Brand",
    "disc_profile": "High Influence (I)",
    "avatar_initials": "SA",
    "ai_simulation_prompt": "You are a creative VP. You love emails that feel personal, use emojis, and talk about 'brand values' and 'storytelling'. You dislike cold, robotic data lists.",
    "recent_activity": "Shared an article about 'The Future of Community'"
  }
];

const MOCK_CHAT_HISTORY = [
  {
    "sender": "user",
    "text": "Simulating reply for: 'Generic Follow Up' template...",
    "timestamp": "10:00 AM"
  },
  {
    "sender": "ai_persona",
    "persona_name": "Steve (CTO)",
    "text": "I'm deleting this immediately. 'Just checking in' adds zero value to my day. Also, you used the word 'synergies' - that's a red flag that you don't understand my technical problems. Don't email me again unless you have a specific ROI calculation.",
    "sentiment": "negative",
    "timestamp": "10:00 AM"
  }
];

export default function SmartEmailEditor() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const templateId = searchParams.get('id');
    const { theme } = useSettings();
    
    // State
    const [templateName, setTemplateName] = useState("New Campaign Template");
    const [subject, setSubject] = useState("");
    const [content, setContent] = useState("");
    const [resonanceScore, setResonanceScore] = useState(0);
    const [isLabMode, setIsLabMode] = useState(false);
    const [selectedPersona, setSelectedPersona] = useState(MOCK_PERSONAS[0].id);
    const [personaSource, setPersonaSource] = useState('preset'); // 'preset' | 'crm'
    const [selectedCrmId, setSelectedCrmId] = useState("");
    const [crmType, setCrmType] = useState("lead"); // 'lead' | 'opportunity'
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [chatHistory, setChatHistory] = useState([
        { role: "system", text: "Simulation ready." }
    ]);
    const [isSimulating, setIsSimulating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const quillRef = useRef(null);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const templateData = {
                name: templateName,
                subject_line: subject,
                body_content: content,
                ai_resonance_score: resonanceScore,
                channel: 'EMAIL' // Default for now
            };

            if (templateId && !templateId.startsWith('t_')) {
                await base44.entities.MarketingTemplate.update(templateId, templateData);
                toast.success("Template updated successfully");
            } else {
                const newTemplate = await base44.entities.MarketingTemplate.create(templateData);
                toast.success("Template created successfully");
                // Optional: redirect to edit mode with new ID, but for now just stay or go back
                // navigate(`${createPageUrl('TemplateEditor')}?id=${newTemplate.id}`, { replace: true });
            }
        } catch (error) {
            console.error("Failed to save template:", error);
            toast.error("Failed to save template");
        } finally {
            setIsSaving(false);
        }
    };

    // Fetch CRM Data
    const { data: leads = [] } = useQuery({ 
        queryKey: ['leads'], 
        queryFn: () => base44.entities.Lead.list(),
        enabled: personaSource === 'crm'
    });
    
    const { data: opportunities = [] } = useQuery({ 
        queryKey: ['opportunities'], 
        queryFn: () => base44.entities.Opportunity.list(),
        enabled: personaSource === 'crm'
    });

    // Derived Current Persona
    const currentPersona = React.useMemo(() => {
        if (personaSource === 'preset') {
            return MOCK_PERSONAS.find(p => p.id === selectedPersona);
        }
        
        if (personaSource === 'crm' && selectedCrmId) {
            let data = null;
            let prompt = "";
            let role = "";
            
            if (crmType === 'lead') {
                data = leads.find(l => l.id === selectedCrmId);
                if (data) {
                    role = data.lead_status || "Prospect";
                    prompt = `You are ${data.full_name}, a ${data.lead_temperature} lead in the ${data.lead_status} stage. Your background: ${data.notes || 'No notes'}. AI Analysis: ${data.ai_analysis || 'None'}. React to this email based on your history.`;
                }
            } else {
                data = opportunities.find(o => o.id === selectedCrmId);
                if (data) {
                    role = `Deal: ${data.product_type} ($${data.amount})`;
                    prompt = `You are a prospect with an active deal for ${data.product_type} worth $${data.amount}. Stage: ${data.deal_stage}. Main pain point: ${data.main_pain_point}. Objection: ${data.current_objection}. Strategy: ${data.ai_sales_strategy}. React accordingly.`;
                }
            }

            if (data) {
                return {
                    id: data.id,
                    name: data.full_name || data.lead_name || "Unknown Contact",
                    role: role,
                    disc_profile: data.ai_classification || "Unknown",
                    avatar_initials: (data.full_name || data.lead_name || "??").substring(0,2).toUpperCase(),
                    ai_simulation_prompt: prompt,
                    // Synthesize style from data for UI
                    style: { likes: [], dislikes: [] } 
                };
            }
        }
        return null;
    }, [personaSource, selectedPersona, selectedCrmId, crmType, leads, opportunities]);


    // Initial Load
    useEffect(() => {
        if (templateId) {
            // Check Mocks first
            const mock = MOCK_TEMPLATES.find(t => t.id === templateId);
            if (mock) {
                setTemplateName(mock.name);
                setSubject(mock.subject_line);
                setContent(mock.body_content);
                setResonanceScore(mock.ai_resonance_score);
            } else {
                // Fallback to DB
                base44.entities.MarketingTemplate.read({ id: templateId }).then(res => {
                    if (res && res[0]) {
                        setTemplateName(res[0].name);
                        setSubject(res[0].subject_line || "");
                        setContent(res[0].body_content || "");
                        setResonanceScore(res[0].ai_resonance_score || 0);
                    }
                });
            }
        }
    }, [templateId]);

    // Live Resonance Calc
    useEffect(() => {
        // Only calc if not one of the static mocks to preserve their specific scores for demo
        const isMock = MOCK_TEMPLATES.find(t => t.id === templateId && t.body_content === content);
        if (isMock) return;

        const calculateResonance = (text) => {
            if (!text || text.length < 10) return 0;
            const base = 50;
            const randomVar = Math.floor(Math.random() * 40) - 20; 
            const hasBuzzword = text.toLowerCase().includes('synergy') || text.toLowerCase().includes('bumping');
            const penalty = hasBuzzword ? 15 : 0;
            return Math.min(100, Math.max(0, base + randomVar - penalty));
        };
        
        const timer = setTimeout(() => {
            setResonanceScore(calculateResonance(content));
        }, 500);

        return () => clearTimeout(timer);
    }, [content, templateId]);

    const handleAutoTune = async () => {
        setIsGenerating(true);
        await new Promise(r => setTimeout(r, 1500));
        
        // Demo Logic: If on the bad template (t_002), swap to good one (t_001)
        if (templateId === 't_002') {
            const goodTemplate = MOCK_TEMPLATES.find(t => t.id === 't_001');
            setContent(goodTemplate.body_content);
            setSubject(goodTemplate.subject_line);
            setResonanceScore(goodTemplate.ai_resonance_score);
            toast.success("✨ Optimization complete! Spam triggers removed.");
        } else {
            // Generic fallback
            setContent(`Hi {{FirstName}},<br/><br/>I reviewed your Q3 goals and believe we can help you reduce churn by 12%.<br/><br/>Do you have 10 mins this Tuesday?`);
            setResonanceScore(92);
            toast.success("Content optimized for higher resonance!");
        }
        setIsGenerating(false);
    };

    const handleSimulateReply = async () => {
        setIsSimulating(true);
        const persona = currentPersona;
        if (!persona) return;

        await new Promise(r => setTimeout(r, 1500));
        
        // Dynamic Simulation Logic
        let reply = "";
        
        if (personaSource === 'crm') {
            try {
                // Real AI Simulation using LLM
                const prompt = `
                    You are simulating a reply to an email.
                    
                    YOUR PERSONA:
                    ${persona.ai_simulation_prompt}
                    
                    INCOMING EMAIL:
                    Subject: ${subject || '(No Subject)'}
                    Body: ${content.replace(/<[^>]*>?/gm, '') || '(Empty Body)'}
                    
                    INSTRUCTIONS:
                    - Write a short, realistic reply (1-2 sentences max) as this persona.
                    - If the email is just "hi" or very short/vague, be confused, dismissive, or brief (e.g. "What is this about?", "Please remove me", or just "Hi?").
                    - Do NOT hallucinate that the email contained a pitch if it didn't.
                    - Do NOT be overly polite if the persona is busy/skeptical.
                `;

                const res = await base44.integrations.Core.InvokeLLM({ prompt });
                reply = res.trim().replace(/^"|"$/g, '');
            } catch (e) {
                console.error("Simulation error:", e);
                reply = "Simulation failed. Please try again.";
            }
        } else {
            // Existing Mock Logic
            if (persona.id === 'p_001') {
                const mockReply = MOCK_CHAT_HISTORY.find(m => m.sender === 'ai_persona');
                reply = mockReply.text;
                // Add system message only for the scripted demo
                setChatHistory(prev => [...prev, { role: "system", text: MOCK_CHAT_HISTORY[0].text }]);
            } else {
                reply = "I would delete this. You didn't mention pricing upfront.";
                if (persona.name?.includes("Sarah")) {
                    reply = "This feels a bit dry. Can you tell me a story about how you helped others?";
                }
            }
        }

        setChatHistory(prev => [...prev, { role: "twin", text: reply }]);
        setIsSimulating(false);
    };

    const getScoreColor = (score) => {
        if (score < 40) return { dot: "bg-red-500", text: "text-red-500", label: "High Spam Risk", badge: theme === 'dark' ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200" };
        if (score < 70) return { dot: "bg-amber-500", text: "text-amber-500", label: "Generic", badge: theme === 'dark' ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200" };
        return { dot: "bg-emerald-500", text: "text-emerald-500", label: "High Resonance", badge: theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200" };
    };

    const scoreMeta = getScoreColor(resonanceScore);

    // Theme Classes
    const bgBase = theme === 'dark' ? 'bg-[#0f172a]' : 'bg-slate-50';
    const bgHeader = theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200';
    const textMain = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
    const textSub = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';
    const inputBg = theme === 'dark' ? 'bg-transparent text-white' : 'bg-transparent text-slate-900';
    const editorBg = theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm';
    const sidePanelBg = theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200';
    const chatUserBg = theme === 'dark' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700';
    const chatTwinBg = theme === 'dark' ? 'bg-blue-900/20 text-blue-200 border-blue-800/30' : 'bg-blue-50 text-blue-800 border-blue-100';

    return (
        <div className={`flex flex-col h-screen overflow-hidden ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-100'}`}>
            {/* Cleaner Header - Minimalist */}
            <header className={`h-16 flex items-center justify-between px-6 shrink-0 z-20 transition-all ${theme === 'dark' ? 'bg-slate-950 border-b border-slate-800' : 'bg-white border-b border-slate-200 shadow-sm'}`}>
                <div className="flex items-center gap-3 flex-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className={`rounded-full ${theme === 'dark' ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
                    <Input 
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className={`border-none text-base font-medium h-9 w-64 focus-visible:ring-0 px-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors ${theme === 'dark' ? 'bg-transparent text-slate-200' : 'bg-transparent text-slate-900'}`}
                        placeholder="Template Name..."
                    />
                </div>

                <div className="flex items-center gap-3">
                    {/* Compact Status Indicator */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${scoreMeta.badge}`}>
                        <div className={`w-2 h-2 rounded-full ${scoreMeta.dot}`} />
                        <span className={scoreMeta.text}>{resonanceScore}% Score</span>
                    </div>

                    <Button 
                        onClick={handleSave}
                        disabled={isSaving}
                        size="sm"
                        className={`rounded-full px-4 shadow-sm text-white ${theme === 'dark' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                    >
                        {isSaving ? <Save className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />}
                        Save
                    </Button>

                    <Button 
                        onClick={handleAutoTune}
                        disabled={isGenerating}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded-full px-4 shadow-sm"
                    >
                        {isGenerating ? <Sparkles className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                        Auto-Tune
                    </Button>

                    <Button
                        variant={isLabMode ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setIsLabMode(!isLabMode)}
                        className={`rounded-full gap-2 transition-all ${isLabMode ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'}`}
                    >
                        <Split className="w-4 h-4" />
                        <span className="hidden sm:inline">Lab Mode</span>
                    </Button>
                </div>
            </header>

            {/* Split Layout Container */}
            <div className="flex-1 flex overflow-hidden">
                {/* Editor Area - Centered Card */}
                <main className="flex-1 flex justify-center p-4 lg:p-8 overflow-y-auto">
                    <div className={`w-full transition-all duration-300 flex flex-col ${isLabMode ? 'max-w-2xl lg:max-w-3xl mr-4' : 'max-w-3xl'}`}>
                        
                        {/* Editor Card */}
                        <div className={`flex-1 rounded-xl shadow-sm border flex flex-col overflow-hidden min-h-[500px] ${theme === 'dark' ? 'bg-[#0f172a] border-slate-800 shadow-black/40' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                            
                            {/* Subject Line */}
                            <div className="px-6 pt-6 pb-2">
                                <Input 
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Subject line..."
                                    className={`border-none px-0 text-xl font-semibold shadow-none focus-visible:ring-0 h-auto p-0 ${theme === 'dark' ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-300'}`}
                                />
                            </div>

                            <CustomToolbar theme={theme} />
                            
                            <div className="flex-1 relative flex flex-col min-h-0">
                                <ReactQuill 
                                    theme="snow"
                                    value={content}
                                    onChange={setContent}
                                    ref={quillRef}
                                    modules={{ toolbar: { container: "#toolbar" } }}
                                    className={`flex-1 flex flex-col bg-transparent ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}
                                    placeholder="Start writing your campaign..."
                                />

                                {/* Subtle Warning Toast */}
                                {content.toLowerCase().includes('synergy') && (
                                    <div className="absolute bottom-4 right-4 animate-in fade-in slide-in-from-bottom-2">
                                        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-md ${theme === 'dark' ? 'bg-amber-950/80 border-amber-800 text-amber-200' : 'bg-amber-50/90 border-amber-200 text-amber-800'}`}>
                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                            <p className="text-xs">
                                                Avoid <span className="font-bold underline">synergy</span>. Try <strong>collaboration</strong>.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Info */}
                        <div className="mt-3 flex justify-between items-center px-2 opacity-60 hover:opacity-100 transition-opacity">
                            <span className="text-xs text-slate-500">Last saved just now</span>
                            <div className="text-xs text-slate-500 flex gap-2">
                                <span>{content.replace(/<[^>]*>?/gm, '').length} chars</span>
                                <span>~{(content.replace(/<[^>]*>?/gm, '').split(' ').length / 200).toFixed(1)} min read</span>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Right Sidebar - Lab Mode */}
                <aside className={`border-l transition-all duration-300 ease-in-out flex flex-col w-[380px] ${theme === 'dark' ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50 border-slate-200'} ${isLabMode ? 'mr-0' : '-mr-[380px]'}`}>
                    <div className={`p-4 border-b ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <h2 className={`font-semibold text-sm flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                            <Zap className="w-4 h-4 text-indigo-500" />
                            Simulation Lab
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Persona Config Card */}
                        <div className={`p-4 rounded-xl border space-y-3 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Persona</Label>
                            
                            {/* Toggle Source */}
                            <div className={`p-1 rounded-lg flex ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <button 
                                    onClick={() => setPersonaSource('preset')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${personaSource === 'preset' ? (theme === 'dark' ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-900 shadow') : 'text-slate-500'}`}
                                >
                                    Presets
                                </button>
                                <button 
                                    onClick={() => setPersonaSource('crm')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${personaSource === 'crm' ? (theme === 'dark' ? 'bg-slate-700 text-white shadow' : 'bg-white text-slate-900 shadow') : 'text-slate-500'}`}
                                >
                                    CRM Data
                                </button>
                            </div>

                            {/* Dropdowns */}
                            {personaSource === 'preset' ? (
                                <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                                    <SelectTrigger className={`h-9 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : ''}>
                                        {MOCK_PERSONAS.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <Button variant={crmType === 'lead' ? 'secondary' : 'outline'} size="sm" onClick={() => setCrmType('lead')} className="flex-1 text-xs h-7">Leads</Button>
                                        <Button variant={crmType === 'opportunity' ? 'secondary' : 'outline'} size="sm" onClick={() => setCrmType('opportunity')} className="flex-1 text-xs h-7">Deals</Button>
                                    </div>
                                    <select 
                                        value={selectedCrmId}
                                        onChange={(e) => setSelectedCrmId(e.target.value)}
                                        className={`w-full p-2 rounded-md text-sm border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                                    >
                                        <option value="">-- Select --</option>
                                        {crmType === 'lead' 
                                            ? leads.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)
                                            : opportunities.map(o => <option key={o.id} value={o.id}>{o.lead_name}</option>)
                                        }
                                    </select>
                                </div>
                            )}

                            {/* Persona Info */}
                            {currentPersona && (
                                <div className={`mt-2 p-3 rounded-lg text-xs space-y-1 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                                    <div className="flex justify-between font-medium">
                                        <span className="text-slate-500">Role</span>
                                        <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>{currentPersona.role}</span>
                                    </div>
                                    <div className="flex justify-between font-medium">
                                        <span className="text-slate-500">Trait</span>
                                        <span className="text-blue-500">{currentPersona.disc_profile}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Chat Interface */}
                        <div className={`flex flex-col h-[400px] rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                            <div className={`p-3 border-b flex justify-between items-center ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/50 border-slate-200'}`}>
                                <span className="text-xs font-semibold text-slate-500">AI Feedback</span>
                            </div>
                            
                            <div className={`flex-1 p-3 space-y-3 overflow-y-auto ${theme === 'dark' ? 'bg-slate-950/30' : 'bg-slate-50/30'}`}>
                                {chatHistory.map((msg, i) => (
                                    <div key={i} className={`flex gap-2 ${msg.role === 'twin' ? '' : 'flex-row-reverse'}`}>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'twin' ? 'bg-indigo-600' : (theme === 'dark' ? 'bg-slate-700' : 'bg-slate-300')}`}>
                                            {msg.role === 'twin' ? <User className="w-3 h-3 text-white" /> : <Zap className={`w-3 h-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`} />}
                                        </div>
                                        <div className={`rounded-lg p-2.5 text-sm max-w-[90%] shadow-sm ${
                                            msg.role === 'twin' 
                                                ? (theme === 'dark' ? 'bg-indigo-900/40 text-indigo-100 border border-indigo-800' : 'bg-indigo-50 text-indigo-900 border border-indigo-100')
                                                : (theme === 'dark' ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-slate-700 border border-slate-200')
                                        }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                {isSimulating && (
                                    <div className="flex gap-2">
                                        <div className="w-6 h-6 rounded-full bg-indigo-600 animate-pulse" />
                                        <div className="text-xs text-slate-400 italic py-1">Typing...</div>
                                    </div>
                                )}
                            </div>

                            <div className={`p-3 border-t ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                                <Button 
                                    size="sm"
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                                    onClick={handleSimulateReply}
                                    disabled={isSimulating || !content}
                                >
                                    <MessageSquare className="w-3.5 h-3.5 mr-2" />
                                    Simulate Reply
                                </Button>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
            
            <style>{`
                .ql-container.ql-snow { border: none !important; }
                .ql-editor { font-size: 1rem; line-height: 1.6; min-height: 400px; padding: 1.5rem; }
                .ql-editor.ql-blank::before { color: ${theme === 'dark' ? '#64748b' : '#94a3b8'}; font-style: normal; font-size: 1rem; }
            `}</style>
        </div>
    );
}