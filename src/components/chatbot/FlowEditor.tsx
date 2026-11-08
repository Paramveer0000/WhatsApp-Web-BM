'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import {
  ArrowLeft,
  Save,
  Play,
  Sparkles,
  Layers,
  Smartphone,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Layout,
  Undo2,
  Redo2,
  Send,
  HelpCircle,
} from 'lucide-react';

import { CustomNode } from './CustomNode';
import { CustomEdge } from './CustomEdge';
import { NodePalette } from './NodePalette';
import { PropertiesPanel } from './PropertiesPanel';
import { TestSimulator } from './TestSimulator';
import { FlowDefinition, FlowNode, FlowEdge, FlowNodeTypeKey } from '@/lib/flow/schema';
import { validateFlow, FlowValidationResult } from '@/lib/flow/validate';

// Register custom node and edge types outside of component
const nodeTypes = {
  flowNode: CustomNode,
};

const edgeTypes = {
  customEdge: CustomEdge,
};

// Auto-layout helper using Dagre
function autoLayoutFlow(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'TB') {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranksep: 90, nodesep: 60 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 280, height: 160 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 140,
        y: nodeWithPosition.y - 80,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

interface FlowEditorInnerProps {
  botId: string;
  initialBot: any;
  availableInstances: Array<{ id: string; name: string }>;
  onBack: () => void;
  onSaveBot: (botId: string, updated: any) => Promise<void>;
  onPublishBot: (botId: string, note?: string) => Promise<any>;
}

function FlowEditorInner({
  botId,
  initialBot,
  availableInstances,
  onBack,
  onSaveBot,
  onPublishBot,
}: FlowEditorInnerProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [botName, setBotName] = useState(initialBot.name || 'Untitled Bot');
  const [selectedInstances, setSelectedInstances] = useState<string[]>(
    initialBot.assignments?.map((a: any) => a.instanceId) || []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialBot.flow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialBot.flow?.edges || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [validation, setValidation] = useState<FlowValidationResult | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // History for Undo/Redo
  const [history, setHistory] = useState<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Run live validation whenever nodes or edges change
  useEffect(() => {
    const flowDef: FlowDefinition = {
      schemaVersion: 1,
      metadata: { name: botName, description: '', category: 'general', version: 1 },
      nodes: nodes as FlowNode[],
      edges: edges as FlowEdge[],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const res = validateFlow(flowDef);
    setValidation(res);

    // Annotate nodes with validation errors
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          validationErrors: res.nodeErrors[n.id] || [],
          isValid: !(res.nodeErrors[n.id] && res.nodeErrors[n.id].length > 0),
        },
      }))
    );
  }, [nodes.length, edges.length, botName, setNodes]);

  // Autosave debouncer
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const markUnsaved = useCallback(() => {
    setSaveStatus('unsaved');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      const flowDef: FlowDefinition = {
        schemaVersion: 1,
        metadata: { name: botName, description: initialBot.description || '', category: 'general', version: 1 },
        nodes: nodes as FlowNode[],
        edges: edges as FlowEdge[],
        viewport: { x: 0, y: 0, zoom: 1 },
      };
      await onSaveBot(botId, { name: botName, flow: flowDef });
      setSaveStatus('saved');
    }, 1500);
  }, [botId, botName, nodes, edges, initialBot.description, onSaveBot]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: 'customEdge' }, eds));
      markUnsaved();
    },
    [setEdges, markUnsaved]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Drag and Drop from Node Palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData('application/reactflow-type') as FlowNodeTypeKey;
      if (!nodeType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNewNode(nodeType, position);
    },
    [screenToFlowPosition]
  );

  const addNewNode = useCallback(
    (type: FlowNodeTypeKey, position?: { x: number; y: number }) => {
      const newNodeId = `node_${Date.now()}`;
      const defaultPos = position || { x: 250, y: 150 + nodes.length * 80 };

      const newNode: FlowNode = {
        id: newNodeId,
        type: 'flowNode',
        position: defaultPos,
        data: {
          label: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          nodeType: type,
          config: getDefaultConfigForType(type),
          isValid: true,
          validationErrors: [],
        },
      };

      setNodes((nds) => [...nds, newNode as Node]);
      setSelectedNodeId(newNodeId);
      markUnsaved();
    },
    [nodes.length, setNodes, markUnsaved]
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, updatedData: Partial<FlowNode['data']>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                ...updatedData,
              },
            };
          }
          return n;
        })
      );
      markUnsaved();
    },
    [setNodes, markUnsaved]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
      markUnsaved();
    },
    [selectedNodeId, setNodes, setEdges, markUnsaved]
  );

  // Auto Layout
  const handleAutoLayout = () => {
    const layouted = autoLayoutFlow(nodes, edges, 'TB');
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
    setTimeout(() => fitView({ padding: 0.2 }), 50);
    markUnsaved();
  };

  // Publish
  const handlePublish = async () => {
    if (validation && !validation.isValid) {
      alert(`Cannot publish: Please fix ${validation.errors.length} validation errors first.`);
      return;
    }
    setIsPublishing(true);
    try {
      await onPublishBot(botId, 'Published from Visual Studio');
      setSaveStatus('saved');
      alert('Bot published successfully and is now LIVE!');
    } catch (err: any) {
      alert(err.message || 'Failed to publish bot');
    } finally {
      setIsPublishing(false);
    }
  };

  // Export JSON
  const handleExportJson = () => {
    const flowDef: FlowDefinition = {
      schemaVersion: 1,
      metadata: { name: botName, description: '', category: 'general', version: 1 },
      nodes: nodes as FlowNode[],
      edges: edges as FlowEdge[],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const blob = new Blob([JSON.stringify(flowDef, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${botName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_flow.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedNode = (nodes.find((n) => n.id === selectedNodeId) as FlowNode) || null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-slate-950 text-white rounded-3xl overflow-hidden border border-slate-800 shadow-2xl animate-in fade-in">
      {/* Top Navigation & Action Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Back & Title Edit */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title="Back to Bots List"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <input
              type="text"
              value={botName}
              onChange={(e) => {
                setBotName(e.target.value);
                markUnsaved();
              }}
              className="bg-transparent font-bold text-white text-sm hover:bg-slate-800/60 px-2 py-0.5 rounded-lg border border-transparent hover:border-slate-700 focus:outline-none focus:border-emerald-500 transition max-w-xs"
            />
            <div className="flex items-center gap-2 pl-2">
              <span className="text-[10px] text-slate-400 font-mono">
                {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved changes'}
              </span>
              {validation && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.2 rounded-full ${
                    validation.isValid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400 font-bold'
                  }`}
                >
                  {validation.isValid ? 'Valid' : `${validation.errors.length} Issues`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Quick Toolbar */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
          <button
            onClick={handleAutoLayout}
            className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-xs transition cursor-pointer"
            title="Auto-arrange layout cleanly"
          >
            <Layout className="w-3.5 h-3.5 text-emerald-400" />
            <span>Auto Layout</span>
          </button>
          <div className="w-px h-4 bg-slate-800" />
          <button
            onClick={handleExportJson}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Export flow as JSON"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Test Simulator & Publish */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsSimulatorOpen(!isSimulatorOpen)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
              isSimulatorOpen
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40 shadow-lg'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isSimulatorOpen ? 'Close Simulator' : 'Test Flow'}</span>
          </button>

          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950/50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace (Palette + React Flow Canvas + Inspector + Simulator) */}
      <div className="flex-1 flex overflow-hidden relative" ref={reactFlowWrapper}>
        {/* 1. Left Node Palette */}
        <NodePalette onAddNode={addNewNode} />

        {/* 2. Center React Flow Canvas */}
        <div className="flex-1 h-full relative" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            snapToGrid
            snapGrid={[16, 16]}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            colorMode="dark"
            className="bg-[#060b10]"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1.2} color="#1e293b" />
            <Controls className="!bg-slate-900 !border-slate-800 !text-white !rounded-xl" />
            <MiniMap
              className="!bg-slate-900/90 !border-slate-800 !rounded-xl"
              nodeColor={(n: any) => ((n.data as any)?.nodeType?.startsWith?.('trigger_') ? '#f59e0b' : '#10b981')}
              maskColor="rgba(2, 6, 23, 0.7)"
            />
          </ReactFlow>
        </div>

        {/* 3. Right Properties Panel */}
        {selectedNode && (
          <PropertiesPanel
            selectedNode={selectedNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onClose={() => setSelectedNodeId(null)}
          />
        )}

        {/* 4. Test Simulator Drawer */}
        {isSimulatorOpen && (
          <TestSimulator
            flow={{
              schemaVersion: 1,
              metadata: { name: botName, description: '', category: 'general', version: 1 },
              nodes: nodes as FlowNode[],
              edges: edges as FlowEdge[],
              viewport: { x: 0, y: 0, zoom: 1 },
            }}
            onHighlightNode={(nodeId) => {
              if (nodeId) setSelectedNodeId(nodeId);
            }}
            onClose={() => setIsSimulatorOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function getDefaultConfigForType(type: FlowNodeTypeKey): any {
  switch (type) {
    case 'trigger_keyword':
      return { keywords: ['hi', 'help'], matchMode: 'contains' };
    case 'message_text':
      return { text: 'Hello! How can we assist you today?', typingSimulation: true };
    case 'message_menu':
      return {
        menuTitle: 'Please select an option:',
        menuOptions: [
          { id: 'opt_1', index: 1, label: 'Option 1' },
          { id: 'opt_2', index: 2, label: 'Option 2' },
        ],
        invalidReplyText: 'Please reply with 1 or 2.',
      };
    case 'input_ask':
      return { questionText: 'May I know your full name?', variableName: 'customer_name', validationType: 'text' };
    case 'logic_condition':
      return { conditionRules: [{ variable: 'last_menu_choice', operator: 'equals', value: '' }] };
    case 'logic_business_hours':
      return { timezone: 'Asia/Kolkata', openTime: '09:30', closeTime: '18:30', daysOpen: [1, 2, 3, 4, 5, 6] };
    case 'ai_reply':
      return { systemPrompt: 'Answer customer questions politely and accurately.', confidenceThreshold: 0.7 };
    case 'control_handoff':
      return { handoffMessage: 'Connecting you with an agent...' };
    case 'control_end':
      return { endReason: 'completed' };
    default:
      return {};
  }
}

export function FlowEditor(props: FlowEditorInnerProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
