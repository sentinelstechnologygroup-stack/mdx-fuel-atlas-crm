import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useSettings } from '@/components/context/SettingsContext';
import { ATLAS } from './atlasConfig';

function MessageBubble({ message, isUser, theme }) {
    return (
        <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 relative z-10`}>
            {!isUser && (
                <div className={`h-8 w-8 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-md shadow-sm ${
                    theme === 'dark' 
                        ? 'bg-white/10 text-indigo-300 border border-white/10' 
                        : 'bg-white/40 text-indigo-600 border border-white/40'
                }`}>
                    <Bot className="h-5 w-5" />
                </div>
            )}
            
            <div className={`max-w-[85%] rounded-[1.5rem] px-5 py-3.5 backdrop-blur-md shadow-sm ${
                isUser 
                    ? (theme === 'dark' 
                        ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border border-indigo-500/30' 
                        : 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border border-indigo-400/30')
                    : (theme === 'dark' 
                        ? 'bg-slate-800/80 text-slate-100 border border-white/5' 
                        : 'bg-white/60 text-slate-700 border border-white/40')
            }`}>
                <ReactMarkdown 
                    className={`text-[0.95rem] font-sans tracking-wide leading-relaxed prose ${theme === 'dark' ? 'prose-invert' : 'prose-slate'} max-w-none prose-p:mb-2 prose-p:last:mb-0 prose-headings:font-bold prose-headings:text-sm prose-a:text-indigo-400 prose-a:underline hover:prose-a:text-indigo-300 transition-colors`}
                    components={{
                        p: ({children}) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                        strong: ({children}) => <span className="font-bold text-indigo-200">{children}</span>
                    }}
                >
                    {message.content}
                </ReactMarkdown>
            </div>

            {isUser && (
                <div className={`h-8 w-8 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-md shadow-sm ${
                    theme === 'dark' 
                        ? 'bg-white/10 text-slate-300 border border-white/10' 
                        : 'bg-white/40 text-slate-600 border border-white/40'
                }`}>
                    <User className="h-5 w-5" />
                </div>
            )}
        </div>
    );
}

export default function SalesAssistantChat() {
    const { theme } = useSettings();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [conversation, setConversation] = useState(null);
    const scrollRef = useRef(null);

    // Initialize conversation
    useEffect(() => {
        const initChat = async () => {
            try {
                // Check for existing recent conversation or create new
                // For simplicity in this demo, we'll create a new one or use a fixed ID logic if we had persistence
                const newConv = await base44.agents.createConversation({
                    agent_name: "SalesAssistant",
                    metadata: { name: "Sales Help" }
                });
                setConversation(newConv);
                
                // Initial greeting — ATLAS identity (internal agent identifier preserved)
                setMessages([{
                    role: 'assistant',
                    content: `${ATLAS.greeting}\n\n*${ATLAS.providerAttribution}*`
                }]);
            } catch (error) {
                console.error("Failed to init chat:", error);
            }
        };
        initChat();
    }, []);

    // Subscribe to updates
    useEffect(() => {
        if (!conversation?.id) return;

        const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
            if (data.messages && data.messages.length > 0) {
                 setMessages(data.messages);
            }
        });

        return () => unsubscribe();
    }, [conversation?.id]);

    // Scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || !conversation) return;

        const userMsg = input;
        setInput('');
        setIsLoading(true);

        try {
            await base44.agents.addMessage(conversation, {
                role: "user",
                content: userMsg
            });
            // The subscription will update the state with the new message and the AI response
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden relative z-10">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-60 space-y-4 animate-in fade-in zoom-in duration-500">
                        <div className={`p-6 rounded-full backdrop-blur-xl shadow-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-white/30'}`}>
                             <Sparkles className={`h-12 w-12 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                        </div>
                        <p className={`font-medium text-lg ${theme === 'dark' ? 'text-indigo-200' : 'text-indigo-800'}`}>How can I help you today?</p>
                    </div>
                )}
                
                {messages.map((msg, i) => (
                    <MessageBubble 
                        key={i} 
                        message={msg} 
                        isUser={msg.role === 'user'} 
                        theme={theme} 
                    />
                ))}
                
                {isLoading && (
                    <div className={`flex items-center gap-3 text-sm p-4 animate-pulse rounded-xl backdrop-blur-md mx-4 w-fit ${
                        theme === 'dark' ? 'bg-white/5 text-indigo-300' : 'bg-white/40 text-indigo-700'
                    }`}>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Analyzing pipeline data...</span>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className={`p-4 border-t backdrop-blur-xl ${theme === 'dark' ? 'border-white/10 bg-[#0B1121]/40' : 'border-white/30 bg-white/40'}`}>
                <form onSubmit={handleSend} className="flex gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Draft an email, analyze deal..."
                        className={`flex-1 transition-all text-base md:text-sm ${
                            theme === 'dark' 
                                ? 'bg-white/10 border-white/10 text-white placeholder:text-white/40 focus:bg-white/20' 
                                : 'bg-white/50 border-white/40 text-slate-800 placeholder:text-slate-500 focus:bg-white/70'
                        }`}
                        autoFocus
                    />
                    <Button 
                        type="submit" 
                        size="icon" 
                        disabled={isLoading || !input.trim()} 
                        className={`transition-all shadow-lg hover:scale-105 ${
                            theme === 'dark' 
                                ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/30' 
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/30'
                        }`}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}