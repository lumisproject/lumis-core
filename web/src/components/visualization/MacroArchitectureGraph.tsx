import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

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
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface MacroArchitectureGraphProps {
  data: GraphData | null;
}

const MacroArchitectureGraph: React.FC<MacroArchitectureGraphProps> = ({ data }) => {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoverNode, setHoverNode] = useState<Node | null>(null);

  // Pre-process data
  const processedData = useMemo(() => {
    if (!data) return null;
    const nodes = JSON.parse(JSON.stringify(data.nodes)) as Node[];
    const links = data.links;

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
      fgRef.current.d3Force('link')?.distance((link: any) => 120 + (30 / (link.weight || 1)));

      setTimeout(() => {
        fgRef.current?.zoomToFit(800, 40);
      }, 500);
    }
  }, [processedData]);

  const getNodeColor = useCallback((node: Node) => {
    // All file nodes should be emerald green regardless of internal risk scores
    if (node.group === 'file') return '#10b981'; 
    if (node.risk_score > 70) return '#f43f5e';
    if (node.legacy_flag) return '#fbbf24';
    return '#38bdf8';
  }, []);

  const getNodeSize = useCallback((node: Node) => {
    const baseSize = Math.sqrt(node.unit_count) * 4 + 12;
    return hoverNode?.id === node.id ? baseSize * 1.15 : baseSize;
  }, [hoverNode]);

  // Custom Node Drawing
  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r = getNodeSize(node as Node);
    const color = getNodeColor(node as Node);
    const isHovered = hoverNode?.id === node.id;
    const isNeighbor = neighbors.has(node.id);
    const isFocused = !hoverNode || isHovered || isNeighbor;
    
    if (typeof node.x !== 'number' || typeof node.y !== 'number' || !isFinite(node.x) || !isFinite(node.y)) {
       return;
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
    ctx.shadowBlur = isHovered ? 25 : (isFocused ? 12 : 0);
    ctx.shadowColor = color;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(node.x - r * 0.3, node.y - r * 0.3, r * 0.2, 0, 2 * Math.PI, false);
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    const isFile = node.group === 'file';
    const focusIsActive = !!hoverNode;
    const shouldShow = focusIsActive 
        ? isFocused 
        : ((isFile && globalScale > 0.2) || globalScale > 0.6 || isHovered);

    if (shouldShow) {
      const label = node.label;
      const fontSize = isFile ? Math.max(5, 18 / globalScale) : Math.max(3, 11 / globalScale); 
      ctx.font = `${isHovered ? '900' : (isFile ? '800' : '500')} ${fontSize}px "Outfit", "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isHovered ? '#ffffff' : (isFile ? '#ffffff' : 'rgba(255, 255, 255, 0.85)');
      ctx.shadowBlur = 6 / globalScale;
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.fillText(label, node.x, node.y + r + fontSize + 6);
      ctx.shadowBlur = 0;
    }
  }, [getNodeSize, getNodeColor, hoverNode, neighbors]);

  if (!processedData || !processedData.nodes.length) {
      return (
          <div className="w-full h-full flex items-center justify-center bg-gray-950 px-6">
             <div className="text-gray-500 font-medium tracking-wide">Initializing Codebase Architecture...</div>
          </div>
      );
  }

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
            const isSourceHovered = hoverNode?.id === (typeof link.source === 'object' ? link.source.id : link.source);
            const isTargetHovered = hoverNode?.id === (typeof link.target === 'object' ? link.target.id : link.target);
            if (!hoverNode) return 'rgba(255, 255, 255, 0.25)'; // Brightened default from 0.08
            // Focused path is much more vibrant
            return isSourceHovered || isTargetHovered ? '#818cf8' : 'rgba(255, 255, 255, 0.05)';
        }}
        linkWidth={(link: any) => {
            const isRelated = hoverNode?.id === (typeof link.source === 'object' ? link.source.id : link.source) || 
                              hoverNode?.id === (typeof link.target === 'object' ? link.target.id : link.target);
            // Increased widths across the board for "detectability"
            return isRelated ? 4 : 2; 
        }}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={(link: any) => {
            const isRelated = hoverNode?.id === (typeof link.source === 'object' ? link.source.id : link.source) || 
                              hoverNode?.id === (typeof link.target === 'object' ? link.target.id : link.target);
            return isRelated ? 4 : 1.5;
        }}
        linkDirectionalParticleSpeed={(link: any) => {
            const isRelated = hoverNode?.id === (typeof link.source === 'object' ? link.source.id : link.source) || 
                              hoverNode?.id === (typeof link.target === 'object' ? link.target.id : link.target);
            return isRelated ? 0.01 : 0.002;
        }}
        linkDirectionalParticleColor={() => '#a5b4fc'}
        linkDirectionalArrowLength={6} // Doubled from 3.5
        linkDirectionalArrowRelPos={1}
        enableNodeDrag={true}
        onNodeHover={(node) => {
          setHoverNode((node as Node) || null);
          if (containerRef.current) {
             containerRef.current.style.cursor = node ? 'pointer' : 'default';
          }
        }}
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
    </div>
  );
};

export default MacroArchitectureGraph;
