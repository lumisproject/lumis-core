import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { AlertTriangle, Clock, GitMerge, FileCode, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';

interface Node {
  id: string;
  label: string;
  fullPath: string;
  group?: string;
  risk_score: number;
  legacy_flag: boolean;
  unit_count: number;
  risk_unit_count?: number;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
  types: string[];
  weight: number;
  isVirtual?: boolean;
}

interface GraphData {
  nodes: Node[];
  links: any[];
}

interface MacroArchitectureGraphProps {
  data: GraphData | null;
}

const MacroArchitectureGraph: React.FC<MacroArchitectureGraphProps> = ({ data }) => {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoverNode, setHoverNode] = useState<Node | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [connectionFilter, setConnectionFilter] = useState<string>('all');

  // Pre-process data and map DB fields
  const processedData = useMemo(() => {
    if (!data) return null;
    const nodes = JSON.parse(JSON.stringify(data.nodes)) as Node[];
    
    // 1. Map `source_unit_name` and `target_unit_name` from the DB payload
    let links = data.links.map((l: any) => ({
        ...l,
        source: l.source || l.source_unit_name,
        target: l.target || l.target_unit_name,
        types: l.types || (l.edge_type ? [l.edge_type] : ['calls'])
    }));

    // 2. Dynamically trace and build explicit File -> Function visual links
    const newLinks: any[] = [];
    const containsMap = new Map<string, string>(); // Maps a function to its parent file
    
    links.forEach(l => {
        if (l.types.includes('contains')) {
            const s = typeof l.source === 'object' ? l.source.id : l.source;
            const t = typeof l.target === 'object' ? l.target.id : l.target;
            containsMap.set(t, s);
        }
    });

    links.forEach(l => {
        if (!l.types.includes('contains')) {
            const s = typeof l.source === 'object' ? l.source.id : l.source;
            const t = typeof l.target === 'object' ? l.target.id : l.target;
            
            const parentFile = containsMap.get(s);
            // If the caller is inside a file, draw a link from the File directly to the Callee
            if (parentFile && parentFile !== t) {
                const exists = links.some(existing => 
                    (typeof existing.source === 'object' ? existing.source.id : existing.source) === parentFile &&
                    (typeof existing.target === 'object' ? existing.target.id : existing.target) === t
                ) || newLinks.some(existing => existing.source === parentFile && existing.target === t);

                if (!exists) {
                    newLinks.push({
                        source: parentFile,
                        target: t,
                        types: ['used_in_file'],
                        isVirtual: true,
                        weight: 1
                    });
                }
            }
        }
    });

    links = [...links, ...newLinks];

    nodes.forEach(node => {
        if (node.group === 'file') {
            const childLinks = links.filter(l => 
                (typeof l.source === 'string' ? l.source : (l.source as any).id) === node.id && 
                l.types.includes('contains')
            );
            const childIds = childLinks.map(l => (typeof l.target === 'string' ? l.target : (l.target as any).id));
            node.risk_unit_count = nodes.filter(n => childIds.includes(n.id) && n.risk_score > 0).length;
        }
    });

    return { nodes, links };
  }, [data]);

  // Track neighbors
  const neighbors = useMemo(() => {
    if (!hoverNode || !processedData) return new Set<string>();
    const neighborSet = new Set<string>();
    processedData.links.forEach((link: Link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      if (sourceId === hoverNode.id) neighborSet.add(targetId);
      if (targetId === hoverNode.id) neighborSet.add(sourceId);
    });
    return neighborSet;
  }, [hoverNode, processedData]);

  // Track connections for selected node
  const selectedConnections = useMemo(() => {
    if (!selectedNode || !processedData) return { incoming: [], outgoing: [], types: new Set<string>() };
    
    const incoming: { node: Node, types: string[] }[] = [];
    const outgoing: { node: Node, types: string[] }[] = [];
    const types = new Set<string>();

    processedData.links.forEach((link: Link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      link.types.forEach(t => types.add(t));

      if (targetId === selectedNode.id) {
        const sourceNode = processedData.nodes.find(n => n.id === sourceId);
        if (sourceNode) incoming.push({ node: sourceNode, types: link.types });
      }
      if (sourceId === selectedNode.id) {
        const targetNode = processedData.nodes.find(n => n.id === targetId);
        if (targetNode) outgoing.push({ node: targetNode, types: link.types });
      }
    });

    return { incoming, outgoing, types };
  }, [selectedNode, processedData]);

  // Resize handler
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    
    setDimensions({ 
      width: containerRef.current.clientWidth, 
      height: containerRef.current.clientHeight 
    });

    return () => observer.disconnect();
  }, []);

  // Update forces
  useEffect(() => {
    if (fgRef.current && processedData?.nodes?.length) {
      fgRef.current.d3Force('charge')?.strength(-800);
      // Give the new dynamic file links a longer distance so they don't tangle the graph
      fgRef.current.d3Force('link')?.distance((link: any) => link.isVirtual ? 250 : 120 + (30 / (link.weight || 1)));

      setTimeout(() => {
        fgRef.current?.zoomToFit(800, 40);
      }, 500);
    }
  }, [processedData]);

  const getNodeColor = useCallback((node: Node) => {
    if (node.group === 'file') return '#10b981'; 
    if (node.risk_score > 70) return '#f43f5e';
    if (node.legacy_flag) return '#fbbf24';
    return '#38bdf8';
  }, []);

  const getNodeSize = useCallback((node: Node) => {
    const baseSize = Math.sqrt(node.unit_count) * 4 + 12;
    return hoverNode?.id === node.id ? baseSize * 1.15 : baseSize;
  }, [hoverNode]);

  const handleJumpToNode = useCallback((node: Node) => {
    setSelectedNode(node);
    setConnectionFilter('all'); 
    if (fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 500);
        fgRef.current.zoom(2.2, 500);
    }
  }, []);

  // Custom Node Drawing
  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r = getNodeSize(node as Node);
    const color = getNodeColor(node as Node);
    
    if (typeof node.x !== 'number' || typeof node.y !== 'number' || !isFinite(node.x) || !isFinite(node.y)) {
       return;
    }

    const isHovered = hoverNode?.id === node.id;
    const isHoverNeighbor = neighbors.has(node.id);
    
    const isSelected = selectedNode?.id === node.id;
    const isSelectedNeighbor = selectedNode && (
        selectedConnections.incoming.some(c => c.node.id === node.id && (connectionFilter === 'all' || c.types.includes(connectionFilter))) ||
        selectedConnections.outgoing.some(c => c.node.id === node.id && (connectionFilter === 'all' || c.types.includes(connectionFilter)))
    );

    let isFocused = true;
    if (hoverNode) {
        isFocused = isHovered || isHoverNeighbor;
    } else if (selectedNode) {
        isFocused = isSelected || !!isSelectedNeighbor;
    }

    const opacity = isFocused ? 1 : 0.15;
    const gradient = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r * 3);
    gradient.addColorStop(0, `${color}${Math.floor(opacity * 0x44).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(1, 'transparent');
    
    ctx.beginPath();
    ctx.arc(node.x, node.y, r * 3, 0, 2 * Math.PI, false);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.shadowBlur = (isHovered || isSelected) ? 25 : (isFocused ? 12 : 0);
    ctx.shadowColor = color;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(node.x - r * 0.3, node.y - r * 0.3, r * 0.2, 0, 2 * Math.PI, false);
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    const isFile = node.group === 'file';
    const focusIsActive = !!hoverNode || !!selectedNode;
    const shouldShow = focusIsActive 
        ? isFocused 
        : ((isFile && globalScale > 0.2) || globalScale > 0.6 || isHovered);

    if (shouldShow) {
      const label = node.label;
      const fontSize = isFile ? Math.max(5, 18 / globalScale) : Math.max(3, 11 / globalScale); 
      ctx.font = `${(isHovered || isSelected) ? '900' : (isFile ? '800' : '500')} ${fontSize}px "Outfit", "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = (isHovered || isSelected) ? '#ffffff' : (isFile ? '#ffffff' : 'rgba(255, 255, 255, 0.85)');
      ctx.shadowBlur = 6 / globalScale;
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.fillText(label, node.x, node.y + r + fontSize + 6);
      ctx.shadowBlur = 0;
    }
  }, [getNodeSize, getNodeColor, hoverNode, neighbors, selectedNode, selectedConnections, connectionFilter]);

  if (!processedData || !processedData.nodes.length) {
      return (
          <div className="w-full h-full flex items-center justify-center bg-gray-950 px-6">
             <div className="text-gray-500 font-medium tracking-wide">Initializing Codebase Architecture...</div>
          </div>
      );
  }

  const filteredIncoming = selectedConnections.incoming.filter(c => connectionFilter === 'all' || c.types.includes(connectionFilter));
  const filteredOutgoing = selectedConnections.outgoing.filter(c => connectionFilter === 'all' || c.types.includes(connectionFilter));

  return (
    <div className="relative w-full h-full bg-[#030712]" ref={containerRef}>

      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={processedData as any}
        backgroundColor="transparent" 
        nodeRelSize={4}
        nodeCanvasObject={drawNode}
        nodePointerAreaPaint={(node, color, ctx) => {
           const r = getNodeSize(node as Node);
           ctx.fillStyle = color;
           ctx.beginPath();
           ctx.arc((node as any).x, (node as any).y, r * 1.5, 0, 2 * Math.PI, false);
           ctx.fill();
        }}
        linkColor={(link: any) => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            if (hoverNode) {
                const isRelated = hoverNode.id === sourceId || hoverNode.id === targetId;
                return isRelated ? '#818cf8' : 'rgba(255, 255, 255, 0.05)';
            }
            
            // Highlight connections permanently when a node is clicked!
            if (selectedNode) {
                const isRelated = selectedNode.id === sourceId || selectedNode.id === targetId;
                if (isRelated) {
                    const matchesFilter = connectionFilter === 'all' || (link.types && link.types.includes(connectionFilter));
                    if (matchesFilter) {
                        if (link.types && link.types.includes('used_in_file')) return '#10b981'; // Green for file connections
                        return targetId === selectedNode.id ? '#818cf8' : '#2dd4bf'; // Indigo Incoming, Teal Outgoing
                    }
                }
                return 'rgba(255, 255, 255, 0.05)'; // Dim unrelated links
            }

            return 'rgba(255, 255, 255, 0.25)';
        }}
        linkWidth={(link: any) => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            if (hoverNode && (hoverNode.id === sourceId || hoverNode.id === targetId)) return 4;
            if (selectedNode) {
                const matchesFilter = connectionFilter === 'all' || (link.types && link.types.includes(connectionFilter));
                if (matchesFilter && (sourceId === selectedNode.id || targetId === selectedNode.id)) return 3;
            }
            return 1.5;
        }}
        linkDirectionalParticles={(link: any) => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            if (hoverNode && (hoverNode.id === sourceId || hoverNode.id === targetId)) return 2;
            if (selectedNode) {
                const matchesFilter = connectionFilter === 'all' || (link.types && link.types.includes(connectionFilter));
                if (matchesFilter && (sourceId === selectedNode.id || targetId === selectedNode.id)) return 2;
                return 0; // Turn off particles for unrelated paths to clean up the view
            }
            return 0; 
        }}
        linkDirectionalParticleWidth={3}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={(link: any) => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            if (link.types && link.types.includes('used_in_file')) return '#10b981';
            if (selectedNode && sourceId === selectedNode.id) return '#2dd4bf'; 
            return '#a5b4fc'; 
        }}
        linkDirectionalArrowLength={(link: any) => link.types && link.types.includes('contains') ? 0 : 6}
        linkDirectionalArrowRelPos={1}
        enableNodeDrag={true}
        onNodeHover={(node) => {
          setHoverNode((node as Node) || null);
          if (containerRef.current) {
             containerRef.current.style.cursor = node ? 'pointer' : 'default';
          }
        }}
        onNodeClick={(node) => handleJumpToNode(node as Node)}
        onBackgroundClick={() => setSelectedNode(null)}
        onNodeDragEnd={(node) => {
           (node as Node).fx = (node as any).x;
           (node as Node).fy = (node as any).y;
        }}
        cooldownTicks={120}
      />

      <div className="absolute bottom-6 right-6 z-10 bg-black/40 backdrop-blur-xl p-4 rounded-2xl border border-white/5 shadow-2xl">
        <div className="flex flex-col gap-3 text-[9px] font-black uppercase tracking-[0.15em]">
          <div className="flex items-center gap-3 group cursor-help transition-opacity hover:opacity-100 opacity-80">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)] border border-rose-400/20"></div>
            <span className="text-gray-400 group-hover:text-white transition-colors">Critical</span>
          </div>
          <div className="flex items-center gap-3 group cursor-help transition-opacity hover:opacity-100 opacity-80">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)] border border-amber-300/20"></div>
            <span className="text-gray-400 group-hover:text-white transition-colors">Legacy</span>
          </div>
          <div className="flex items-center gap-3 group cursor-help transition-opacity hover:opacity-100 opacity-80">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)] border border-emerald-400/20"></div>
            <span className="text-gray-400 group-hover:text-white transition-colors">File Nodes</span>
          </div>
          <div className="flex items-center gap-3 group cursor-help transition-opacity hover:opacity-100 opacity-80">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)] border border-sky-300/20"></div>
            <span className="text-gray-400 group-hover:text-white transition-colors">Logic Units</span>
          </div>
        </div>
      </div>

      {selectedNode && (
          <div className="absolute top-6 left-6 z-10 w-80 max-h-[90vh] overflow-y-auto flex flex-col bg-black/80 backdrop-blur-xl p-5 rounded-[2rem] border border-white/5 shadow-2xl animate-in fade-in slide-in-from-left-4 custom-scrollbar">
              <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest break-all pr-4">{selectedNode.label}</h3>
                  <button className="text-gray-500 hover:text-white transition-colors p-1" onClick={() => setSelectedNode(null)}>✕</button>
              </div>
              <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400 bg-white/5 p-2 rounded-xl border border-white/5 break-all">
                      <FileCode className="h-3 w-3 shrink-0" />
                      {selectedNode.fullPath || selectedNode.id}
                  </div>
                  
                  {selectedNode.group === 'file' ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                          <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2 text-xs">
                             <CheckCircle2 className="h-4 w-4" /> Healthy File
                          </div>
                          <div className="text-gray-400 text-xs leading-relaxed">Contains <span className="text-emerald-400 font-black">{selectedNode.unit_count || 0}</span> logic units. Structured cleanly within acceptable bounds.</div>
                      </div>
                  ) : selectedNode.risk_score > 70 ? (
                      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl">
                          <div className="text-rose-400 font-bold mb-3 flex flex-col gap-2">
                              <span className="flex items-center gap-2 font-black uppercase tracking-widest text-[11px]"><AlertTriangle className="h-4 w-4 shrink-0" /> Critical Risk</span>
                          </div>
                          <div className="text-gray-400 text-xs leading-relaxed">This unit has been identified as a critical risk factor. High complexity or tight coupling threatens stability.</div>
                      </div>
                  ) : selectedNode.legacy_flag ? (
                      <div className="bg-amber-400/10 border border-amber-400/20 p-4 rounded-2xl">
                          <div className="flex items-center gap-2 text-amber-400 font-bold mb-2 font-black uppercase tracking-widest text-[11px]">
                             <Clock className="h-4 w-4" /> Legacy Code
                          </div>
                          <div className="text-gray-400 text-xs leading-relaxed">This unit hasn't been modified recently and relies on older patterns. Consider modernizing during your next sprint.</div>
                      </div>
                  ) : (
                      <div className="bg-sky-400/10 border border-sky-400/20 p-4 rounded-2xl">
                          <div className="flex items-center gap-2 text-sky-400 font-bold mb-2 font-black uppercase tracking-widest text-[11px]">
                              <GitMerge className="h-4 w-4" /> Logic Unit
                          </div>
                          <div className="text-gray-400 text-xs leading-relaxed">This node is functioning within standard complexity thresholds, no immediate action required.</div>
                      </div>
                  )}
              </div>

              {/* Connections Section */}
              <div className="flex flex-col gap-3 pt-4 border-t border-white/10">
                <div className="space-y-4 mt-2">
                    {/* Incoming */}
                    {filteredIncoming.length > 0 && (
                        <div>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 mb-2">
                                <ArrowRight className="w-3 h-3" /> Incoming (Called By)
                            </span>
                            <div className="flex flex-col gap-1.5">
                                {filteredIncoming.map((conn, idx) => (
                                    <button 
                                        key={`in-${conn.node.id}-${idx}`}
                                        onClick={() => handleJumpToNode(conn.node)}
                                        className="text-left bg-white/5 hover:bg-white/10 border border-white/5 hover:border-indigo-500/30 transition-all rounded-lg p-2 flex flex-col group"
                                    >
                                        <span className="text-xs font-semibold text-gray-200 truncate group-hover:text-white">{conn.node.label}</span>
                                        <span className="text-[9px] text-gray-500 font-mono mt-1 opacity-80">
                                            {conn.types.includes('used_in_file') ? 'Used in File' : conn.types.join(', ')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Outgoing */}
                    {filteredOutgoing.length > 0 && (
                        <div>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-teal-400 mb-2">
                                <ArrowLeft className="w-3 h-3" /> Outgoing (Calls)
                            </span>
                            <div className="flex flex-col gap-1.5">
                                {filteredOutgoing.map((conn, idx) => (
                                    <button 
                                        key={`out-${conn.node.id}-${idx}`}
                                        onClick={() => handleJumpToNode(conn.node)}
                                        className="text-left bg-white/5 hover:bg-white/10 border border-white/5 hover:border-teal-500/30 transition-all rounded-lg p-2 flex flex-col group"
                                    >
                                        <span className="text-xs font-semibold text-gray-200 truncate group-hover:text-white">{conn.node.label}</span>
                                        <span className="text-[9px] text-gray-500 font-mono mt-1 opacity-80">
                                            {conn.types.includes('used_in_file') ? 'Used in File' : conn.types.join(', ')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {filteredIncoming.length === 0 && filteredOutgoing.length === 0 && (
                        <div className="text-[10px] text-gray-500 italic text-center p-4 bg-white/5 rounded-xl">
                            No connections found matching this filter.
                        </div>
                    )}
                </div>
              </div>
          </div>
      )}
      {/* Styles for hidden scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}} />
    </div>
  );
};

export default MacroArchitectureGraph;