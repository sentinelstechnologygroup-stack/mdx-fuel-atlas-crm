import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Mail, Clock, CheckCircle, AlertOctagon, GitBranch, 
    MousePointer2, Target, Plus, X, Settings, GripVertical,
    Play, Save, CheckSquare, Search, ArrowLeft, Zap, Loader2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import SmartTriggerConfig from './SmartTriggerConfig';
import { useSettings } from '@/components/context/SettingsContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// --- Node Component ---
const FlowNode = ({ node, isSelected, onClick, onDragStart, onConnectStart, onConnectEnd }) => {
    const { theme } = useSettings();
    const getIcon = () => {
        switch(node.type) {
            case 'EMAIL': return <Mail className="w-4 h-4 text-blue-500" />;
            case 'DELAY': return <Clock className="w-4 h-4 text-amber-500" />;
            case 'TASK': return <CheckSquare className="w-4 h-4 text-purple-500" />;
            case 'DECISION': return <GitBranch className="w-4 h-4 text-emerald-500" />;
            case 'GOAL': return <Target className="w-4 h-4 text-red-500" />;
            case 'START': return <Zap className="w-4 h-4 text-emerald-500" />;
            default: return <Settings className="w-4 h-4 text-slate-500" />;
        }
    };

    const getColors = () => {
        if (isSelected) return "ring-2 ring-blue-500 border-blue-500";
        if (theme === 'dark') return "border-slate-700 hover:border-blue-400";
        return "border-slate-200 hover:border-blue-300";
    };

    const bgClass = theme === 'dark' ? 'bg-slate-800' : 'bg-white';
    const textMain = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
    const textSub = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';
    const iconBg = theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100';

    return (
        <div
            className={`absolute ${bgClass} rounded-lg shadow-sm border w-64 p-3 cursor-grab active:cursor-grabbing transition-all ${getColors()} group`}
            style={{ left: node.x, top: node.y }}
            onMouseDown={(e) => onDragStart(e, node.id)}
            onClick={(e) => onClick(e, node.id)}
        >
            {/* Drop Target Overlay (visible when hovering) */}
            <div className="absolute inset-0 rounded-lg bg-blue-500/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity border-2 border-blue-500/50 hidden group-hover:block" />
            
            {/* Click-Click Helper Overlay (only visible when connecting is active global state would be needed, but simplified for now) */}
            
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-md border ${iconBg}`}>
                    {getIcon()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${textMain}`}>{node.label}</p>
                    <p className={`text-xs truncate ${textSub}`}>{node.subLabel}</p>
                </div>
                <GripVertical className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
            </div>

            {node.stats && (
                <div className={`flex items-center gap-2 mt-2 pt-2 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                    <Badge variant="secondary" className={`text-[10px] h-5 px-1 ${theme === 'dark' ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                        Open: {node.stats.openRate}%
                    </Badge>
                    <Badge variant="secondary" className={`text-[10px] h-5 px-1 ${theme === 'dark' ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                        Click: {node.stats.clickRate}%
                    </Badge>
                </div>
            )}
            
            {node.abTest && (
                 <div className="absolute -right-2 -top-2 w-4 h-4 bg-purple-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">
                    AB
                 </div>
            )}

            {/* Connection Points */}
            {/* Output Point - Click to Connect */}
            <div 
                className="absolute top-1/2 -right-3 w-8 h-8 flex items-center justify-center cursor-crosshair z-30 group"
                onClick={(e) => onConnectStart(e, node.id)}
                title="Click to start connection"
            >
                <div className="w-3 h-3 bg-slate-300 rounded-full group-hover:bg-blue-500 group-hover:scale-125 border border-slate-500 transition-all shadow-sm" />
            </div>
            
            {/* Input Point - Visual Only (Drop handled by node) */}
            {node.type !== 'START' && (
                <div 
                    className="absolute top-1/2 -left-1 w-3 h-3 bg-slate-300 rounded-full z-20 border border-slate-500" 
                />
            )}
        </div>
    );
};

// --- Connection Line Component ---
const ConnectionLine = ({ start, end }) => {
    const { theme } = useSettings();
    // Bezier curve calculation
    const controlPointOffset = Math.abs(end.x - start.x) / 2;
    const path = `M ${start.x} ${start.y} C ${start.x + controlPointOffset} ${start.y}, ${end.x - controlPointOffset} ${end.y}, ${end.x} ${end.y}`;

    return (
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible">
            <path d={path} stroke={theme === 'dark' ? '#475569' : '#cbd5e1'} strokeWidth="2" fill="none" />
            <path d={path} stroke="transparent" strokeWidth="10" fill="none" className="pointer-events-auto hover:stroke-blue-200 cursor-pointer" />
        </svg>
    );
};

export default function SequenceCanvas({ sequenceId }) {
    const navigate = useNavigate();
    const { theme } = useSettings();
    const queryClient = useQueryClient();
    
    // Default Empty State
    const defaultNodes = [
        { id: 'start', type: 'START', x: 100, y: 100, label: 'Start Sequence', subLabel: 'Trigger: New Lead' }
    ];

    const [nodes, setNodes] = useState(defaultNodes);
    const [connections, setConnections] = useState([]);
    const [sequenceName, setSequenceName] = useState("New Sequence");
    const [status, setStatus] = useState("DRAFT");
    
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [inspectorOpen, setInspectorOpen] = useState(true);
    const [dragState, setDragState] = useState({ isDragging: false, nodeId: null, startX: 0, startY: 0 });
    const [connecting, setConnecting] = useState(null); // { sourceId: string, mouseX: number, mouseY: number }

    const containerRef = useRef(null);

    // --- Data Fetching ---
    const { data: sequenceData, isLoading: isLoadingSeq } = useQuery({
        queryKey: ['sequence', sequenceId],
        queryFn: async () => {
            if (!sequenceId) return null;
            const seq = await base44.entities.MarketingSequence.read({ id: sequenceId });
            const steps = await base44.entities.SequenceStep.list({ sequence_id: sequenceId });
            const transitions = await base44.entities.StepTransition.list({ sequence_id: sequenceId }); // Ideally filter by steps related to this seq, but list all for now or improved API needed
            // NOTE: StepTransition doesn't have sequence_id in the schema I saw earlier, but logically it should relate. 
            // If not, we have to fetch transitions for each step. 
            // Assuming simplified fetching for this implementation or that we can filter transitions.
            // Let's assume we fetch all transitions and filter in memory if needed (not efficient but MVP).
            // Actually, best practice: StepTransition should be linked. If not, we iterate.
            
            // Reconstruct nodes
            const loadedNodes = steps.map(s => ({
                id: s.id,
                type: s.type === 'ACTION_EMAIL' ? 'EMAIL' : s.type === 'DELAY' ? 'DELAY' : s.type === 'START' ? 'START' : 'TASK', // Mapping back
                x: s.position_ui?.x || 100,
                y: s.position_ui?.y || 100,
                label: s.config?.label || s.type,
                subLabel: s.config?.subLabel || '',
                config: s.config
            }));

            // If no nodes (e.g. freshly created without steps), add default start
            if (loadedNodes.length === 0) {
                loadedNodes.push({ id: 'start', type: 'START', x: 100, y: 100, label: 'Start Sequence', subLabel: 'Trigger: New Lead' });
            }

            // Reconstruct connections
            // Need to fetch transitions where source_step_id is in loadedNodes
            // This part might be tricky without a direct sequence_id on Transition. 
            // For now, let's load what we can. 
            const transitionsList = await base44.entities.StepTransition.filter({ 
                source_step_id: { "$in": loadedNodes.map(n => n.id) } 
            });
            
            const loadedConnections = transitionsList.map(t => ({
                id: t.id,
                from: t.source_step_id,
                to: t.target_step_id
            }));

            return { seq: seq[0], nodes: loadedNodes, connections: loadedConnections };
        },
        enabled: !!sequenceId
    });

    useEffect(() => {
        if (sequenceData) {
            setSequenceName(sequenceData.seq.name);
            setStatus(sequenceData.seq.status);
            setNodes(sequenceData.nodes);
            setConnections(sequenceData.connections);
        }
    }, [sequenceData]);

    // --- Save Logic ---
    const saveMutation = useMutation({
        mutationFn: async () => {
            let currentSeqId = sequenceId;

            // 1. Upsert Sequence
            if (!currentSeqId) {
                const newSeq = await base44.entities.MarketingSequence.create({
                    name: sequenceName,
                    status: status,
                    exit_criteria: {},
                    schedule_config: {}
                });
                currentSeqId = newSeq.id;
            } else {
                await base44.entities.MarketingSequence.update(currentSeqId, {
                    name: sequenceName,
                    status: status
                });
            }

            // 2. Sync Steps (Nodes)
            // Strategy: Upsert based on ID. If ID starts with 'new_', create.
            // Problem: 'start' node might be virtual. 
            // Let's assume 'start' is a real step type for this builder.
            
            const savedStepMap = {}; // Map local ID to DB ID

            for (const node of nodes) {
                const stepData = {
                    sequence_id: currentSeqId,
                    type: node.type === 'EMAIL' ? 'ACTION_EMAIL' : node.type === 'DELAY' ? 'DELAY' : 'ACTION_TASK', // Simplified mapping
                    config: { label: node.label, subLabel: node.subLabel, ...node.config },
                    position_ui: { x: node.x, y: node.y }
                };

                // Fix START type mapping if needed, or exclude START if it's just a trigger placeholder
                if (node.type === 'START') {
                    // Start node might be special, maybe it's the Trigger config?
                    // For now let's save it as a step so we have a root.
                    stepData.type = 'DECISION_SPLIT'; // Placeholder type or add START to schema
                }

                if (node.id.startsWith('start') || node.id.startsWith('email') || node.id.length < 10) { 
                    // Assume temp ID
                    const created = await base44.entities.SequenceStep.create(stepData);
                    savedStepMap[node.id] = created.id;
                } else {
                    await base44.entities.SequenceStep.update(node.id, stepData);
                    savedStepMap[node.id] = node.id;
                }
            }

            // 3. Sync Connections
            // Delete old connections for this sequence (hard to do without ID list). 
            // For MVP: Just create new ones for now, or assume stable IDs if we had them.
            // Better: Iterate connections, if has ID update, if not create. 
            
            for (const conn of connections) {
                const sourceId = savedStepMap[conn.from] || conn.from;
                const targetId = savedStepMap[conn.to] || conn.to;
                
                if (sourceId && targetId) {
                    if (conn.id) {
                         // Update if needed
                    } else {
                        await base44.entities.StepTransition.create({
                            source_step_id: sourceId,
                            target_step_id: targetId,
                            condition_trigger: 'DEFAULT'
                        });
                    }
                }
            }

            return currentSeqId;
        },
        onSuccess: (newId) => {
            toast.success("Sequence saved successfully");
            if (!sequenceId) {
                navigate(createPageUrl('SequenceBuilder') + `?id=${newId}`, { replace: true });
            } else {
                queryClient.invalidateQueries(['sequence', sequenceId]);
            }
        }
    });

    // --- Interaction Handlers ---
    const handleDragStart = (e, id) => {
        e.stopPropagation();
        const node = nodes.find(n => n.id === id);
        setDragState({
            isDragging: true,
            nodeId: id,
            offsetX: e.clientX - node.x,
            offsetY: e.clientY - node.y
        });
        setSelectedNodeId(id);
        setInspectorOpen(true);
    };

    const handleNodeClick = (e, id) => {
        e.stopPropagation();
        
        // If we are in connection mode, clicking a node means "Connect Here"
        if (connecting) {
            handleConnectEnd(e, id);
            return;
        }

        setSelectedNodeId(id);
        setInspectorOpen(true);
    };

    // Connection Logic - Click-Click approach
    const handleConnectStart = (e, sourceId) => {
        e.stopPropagation(); // Prevent drag start
        
        // If we are already connecting from this node, maybe cancel? Or restart.
        // Let's just restart to be safe.
        const rect = containerRef.current.getBoundingClientRect();
        setConnecting({
            sourceId,
            startX: e.clientX - rect.left,
            startY: e.clientY - rect.top,
            currX: e.clientX - rect.left,
            currY: e.clientY - rect.top
        });
        toast("Select a step to connect", { description: "Click on another step to complete the connection.", duration: 2000 });
    };

    const handleConnectEnd = (e, targetId) => {
        e.stopPropagation();
        if (connecting) {
            if (connecting.sourceId !== targetId) {
                const exists = connections.some(c => c.from === connecting.sourceId && c.to === targetId);
                if (!exists) {
                    setConnections([...connections, { from: connecting.sourceId, to: targetId }]);
                    toast.success("Connected!");
                }
            }
            setConnecting(null);
        }
    };
    
    // Handler for clicking the canvas background
    const handleCanvasClick = (e) => {
        if (connecting) {
            setConnecting(null); // Cancel connection mode
        }
    };

    const handleMouseMove = (e) => {
        if (dragState.isDragging) {
            const newX = e.clientX - dragState.offsetX;
            const newY = e.clientY - dragState.offsetY;
            setNodes(nodes.map(n => n.id === dragState.nodeId ? { ...n, x: newX, y: newY } : n));
        }
        if (connecting) {
             const rect = containerRef.current.getBoundingClientRect();
             setConnecting(prev => ({
                 ...prev,
                 currX: e.clientX - rect.left,
                 currY: e.clientY - rect.top
             }));
        }
    };

    const handleMouseUp = () => {
        setDragState({ isDragging: false, nodeId: null, startX: 0, startY: 0 });
        // NOTE: We do NOT clear connecting here anymore, to support click-click interaction.
        // Connection is cleared only on handleConnectEnd (valid target) or handleCanvasClick (cancel).
    };

    const handleAddNode = (type, label) => {
        const id = `${type.toLowerCase()}_${Date.now()}`;
        const newNode = {
            id,
            type,
            x: 200,
            y: 200,
            label,
            subLabel: 'Configure step...'
        };
        setNodes([...nodes, newNode]);
    };

    // Calculate connection points
    const getConnectorPoints = (conn) => {
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to); 
        
        if (!fromNode || !toNode) return { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } };

        return {
            start: { x: fromNode.x + 256, y: fromNode.y + 40 },
            end: { x: toNode.x, y: toNode.y + 40 }
        };
    };

    const bgBase = theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50';
    const bgPanel = theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
    const bgHeader = theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
    const textMain = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
    const textSub = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';
    const itemBg = theme === 'dark' ? 'bg-slate-900 border-slate-700 hover:border-blue-500' : 'bg-slate-50 border-slate-200 hover:border-blue-300';
    const inspectorHeaderBg = theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50/50 border-slate-200';

    if (isLoadingSeq) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin w-10 h-10 text-blue-500" /></div>;

    return (
        <div className={`flex h-screen flex-col ${bgBase} font-sans`} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            {/* Header */}
            <header className={`h-16 border-b px-6 flex items-center justify-between shrink-0 z-20 relative ${bgHeader}`}>
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className={theme === 'dark' ? 'text-slate-300 hover:bg-slate-700' : ''}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <Input 
                            value={sequenceName} 
                            onChange={(e) => setSequenceName(e.target.value)} 
                            className={`font-bold h-8 border-none bg-transparent shadow-none px-0 text-lg ${textMain} focus-visible:ring-0`}
                        />
                        <div className={`flex items-center gap-2 text-xs ${textSub}`}>
                             <span className="flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span> 
                                {status}
                             </span>
                             <span>•</span>
                             <span>{sequenceId ? 'Saved' : 'Unsaved Draft'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className={theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'text-slate-600'}>
                        <Play className="w-4 h-4 mr-2" /> Test Run
                    </Button>
                    <Button 
                        onClick={() => saveMutation.mutate()} 
                        disabled={saveMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Save & Activate
                    </Button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Sidebar - Toolbox */}
                <aside className={`w-64 border-r z-10 flex flex-col ${bgPanel}`}>
                    <div className={`p-4 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Toolbox</h3>
                    </div>
                    <div className="p-4 space-y-3 overflow-y-auto">
                         {[
                             { type: 'EMAIL', icon: Mail, label: 'Send Email', color: 'text-blue-500' },
                             { type: 'DELAY', icon: Clock, label: 'Wait / Delay', color: 'text-amber-500' },
                             { type: 'TASK', icon: CheckSquare, label: 'Task / Call', color: 'text-purple-500' },
                             { type: 'DECISION', icon: GitBranch, label: 'Condition', color: 'text-emerald-500' },
                             { type: 'GOAL', icon: Target, label: 'Goal', color: 'text-red-500' },
                         ].map((item, idx) => (
                             <div 
                                key={idx} 
                                className={`p-3 border rounded-lg cursor-pointer hover:shadow-sm transition-all flex items-center gap-3 ${itemBg}`}
                                onClick={() => handleAddNode(item.type, item.label)}
                             >
                                 <item.icon className={`w-5 h-5 ${item.color}`} />
                                 <span className={`text-sm font-medium ${textMain}`}>{item.label}</span>
                                 <Plus className="w-4 h-4 ml-auto opacity-50" />
                             </div>
                         ))}
                    </div>
                </aside>

                {/* Main Canvas */}
                <main 
                    className={`flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing ${bgBase}`}
                    ref={containerRef}
                    style={{
                        backgroundImage: `radial-gradient(${theme === 'dark' ? '#334155' : '#cbd5e1'} 1px, transparent 1px)`,
                        backgroundSize: '20px 20px'
                    }}
                    onClick={handleCanvasClick}
                >
                    {/* Render Connections */}
                    {connections.map((conn, i) => {
                         const points = getConnectorPoints(conn);
                         return <ConnectionLine key={i} start={points.start} end={points.end} />;
                    })}

                    {/* Temp Connection Line */}
                    {connecting && (() => {
                        const sourceNode = nodes.find(n => n.id === connecting.sourceId);
                        if (!sourceNode) return null;
                        return (
                            <ConnectionLine 
                                start={{ x: sourceNode.x + 256, y: sourceNode.y + 40 }}
                                end={{ x: connecting.currX, y: connecting.currY }}
                            />
                        );
                    })()}

                    {/* Render Nodes */}
                    {nodes.map(node => (
                        <FlowNode 
                            key={node.id} 
                            node={node} 
                            isSelected={selectedNodeId === node.id}
                            onDragStart={handleDragStart}
                            onClick={handleNodeClick}
                            onConnectStart={handleConnectStart}
                            onConnectEnd={handleConnectEnd}
                        />
                    ))}

                </main>

                {/* Right Sidebar - Inspector */}
                <aside className={`w-80 border-l z-10 flex flex-col transition-all duration-300 ${inspectorOpen ? 'translate-x-0' : 'translate-x-full absolute right-0 h-full'} ${bgPanel}`}>
                    <div className={`p-4 border-b flex justify-between items-center ${inspectorHeaderBg}`}>
                        <h3 className={`text-sm font-bold ${textMain}`}>Inspector</h3>
                        <Button variant="ghost" size="icon" onClick={() => setInspectorOpen(false)} className={theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : ''}><X className="w-4 h-4" /></Button>
                    </div>
                    
                    {selectedNodeId ? (
                        <div className="p-6 space-y-6 overflow-y-auto">
                            {/* Node Specific Settings */}
                            <div className="space-y-4">
                                {nodes.find(n => n.id === selectedNodeId)?.type !== 'START' && (
                                    <div>
                                        <Label className="text-xs text-slate-500 uppercase tracking-wider">Step Name</Label>
                                        <Input 
                                            value={nodes.find(n => n.id === selectedNodeId)?.label || ''} 
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, label: val } : n));
                                            }}
                                            className={`mt-1 ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : ''}`} 
                                        />
                                    </div>
                                )}

                                {nodes.find(n => n.id === selectedNodeId)?.type === 'START' && (
                                    <SmartTriggerConfig />
                                )}

                                {nodes.find(n => n.id === selectedNodeId)?.type === 'EMAIL' && (
                                    <>
                                        <div className={`flex items-center justify-between p-3 rounded-lg border ${theme === 'dark' ? 'bg-purple-900/20 border-purple-800' : 'bg-purple-50 border-purple-100'}`}>
                                            <div className="flex items-center gap-2">
                                                <GitBranch className="w-4 h-4 text-purple-600" />
                                                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-purple-300' : 'text-purple-900'}`}>A/B Test</span>
                                            </div>
                                            <Switch defaultChecked />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className={textMain}>Email Template</Label>
                                            <div className={`p-3 border rounded-lg cursor-pointer flex items-center justify-between ${theme === 'dark' ? 'hover:bg-slate-700 border-slate-600' : 'hover:bg-slate-50'}`}>
                                                <span className={`text-sm truncate ${textMain}`}>Intro Template v2</span>
                                                <Settings className="w-4 h-4 text-slate-400" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {nodes.find(n => n.id === selectedNodeId)?.type === 'DELAY' && (
                                    <div className="space-y-4">
                                        <div>
                                            <Label className={textMain}>Wait Duration</Label>
                                            <div className="flex gap-2 mt-1">
                                                <Input type="number" defaultValue="3" className={`w-20 ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : ''}`} />
                                                <select className={`flex-1 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-background border-input'}`}>
                                                    <option>Days</option>
                                                    <option>Hours</option>
                                                    <option>Minutes</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch id="business-hours" defaultChecked />
                                            <Label htmlFor="business-hours" className={`font-normal ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Business Hours Only</Label>
                                        </div>
                                    </div>
                                )}
                                
                                <Button variant="destructive" size="sm" className="w-full mt-8" onClick={() => {
                                    setNodes(nodes.filter(n => n.id !== selectedNodeId));
                                    setSelectedNodeId(null);
                                }}>
                                    Delete Step
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-10 text-center text-slate-400">
                            <MousePointer2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>Select a node to edit its properties</p>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}