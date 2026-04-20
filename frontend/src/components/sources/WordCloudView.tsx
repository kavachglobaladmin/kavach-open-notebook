import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Activity, ZoomIn, ZoomOut, Maximize, MousePointer2 } from 'lucide-react'; 

// Ensure you import your API wrapper correctly based on your project structure
import { sourcesApi } from '@/lib/api/sources'; 

interface WordCloudViewProps {
  sourceId: string;
}

export function WordCloudView({ sourceId }: WordCloudViewProps) {
  // Original State Logic
  const [words, setWords] = useState<{ text: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  
  // Advanced Viewport Controls State (Pan & Zoom)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // === INTEGRATED ORIGINAL API LOGIC ===
  useEffect(() => {
    if (!sourceId) return;
    
    setLoading(true);
    setError(null);
    
    sourcesApi.getWordCloud(sourceId)
      .then((d) => { 
        setWords(d.words || []); 
        setLoading(false); 
      })
      .catch((e) => { 
        setError(e?.message || 'Failed to load word cloud'); 
        setLoading(false); 
      });
  }, [sourceId]);

  // === INTEGRATED ORIGINAL RESIZE OBSERVER ===
  useEffect(() => {
    const el = containerRef.current; 
    if (!el) return;
    
    const obs = new ResizeObserver((e) => {
      const r = e[0].contentRect;
      setSize({ w: Math.max(600, r.width), h: Math.max(400, r.height) });
    });
    
    obs.observe(el); 
    return () => obs.disconnect();
  }, []);

  // Handle Mouse Wheel Zooming
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); 
      const zoomSensitivity = 0.0015;
      setTransform((prev) => {
        const newZoom = prev.scale - e.deltaY * zoomSensitivity;
        return { ...prev, scale: Math.min(Math.max(newZoom, 0.2), 4) }; 
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // === Mouse Event Handlers ===
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.ui-controls') || (e.target as HTMLElement).tagName === 'text') return;
    setIsDraggingCanvas(true);
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  // === Typography Word Layout Algorithm ===
  const positioned = useMemo(() => {
    if (!words.length) return [];
    
    const sortedWords = [...words].sort((a, b) => b.value - a.value);
    const maxVal = Math.max(...sortedWords.map((w) => w.value));
    const minVal = Math.min(...sortedWords.map((w) => w.value));
    const range = maxVal - minVal || 1;

    // Classic Professional Palette matching the reference image
    const typoColors = [
      '#1f2937', // Dark Slate
      '#9f1239', // Deep Red/Crimson
      '#0f766e', // Dark Teal
      '#b45309', // Rust/Bronze
      '#1e3a8a', // Navy Blue
      '#475569', // Slate Gray
      '#115e59', // Forest Green
    ];

    const placed: { 
      text: string; value: number; x: number; y: number; 
      size: number; color: string; isVertical: boolean; 
      boxW: number; boxH: number;
    }[] = [];

    // Collision detection using oriented bounding boxes
    const intersect = (
      a: { x: number, y: number, boxW: number, boxH: number }, 
      b: { x: number, y: number, boxW: number, boxH: number }
    ) => {
      const padding = 2; // Tight padding for interlocking typography
      return !(
        a.x + a.boxW / 2 + padding < b.x - b.boxW / 2 ||
        a.x - a.boxW / 2 - padding > b.x + b.boxW / 2 ||
        a.y + a.boxH / 2 + padding < b.y - b.boxH / 2 ||
        a.y - a.boxH / 2 - padding > b.y + b.boxH / 2
      );
    };

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (let i = 0; i < sortedWords.length; i++) {
      const w = sortedWords[i];
      const normalized = (w.value - minVal) / range;
      
      const fontSize = Math.round(18 + normalized * 75); 
      const color = typoColors[i % typoColors.length];

      // 30% chance to be rotated vertically like the reference image
      const isVertical = Math.random() > 0.7;

      // Estimate dimensions based on narrow, dense font
      const estWidth = w.text.length * (fontSize * 0.52); 
      const estHeight = fontSize * 0.85; 
      
      const boxW = isVertical ? estHeight : estWidth;
      const boxH = isVertical ? estWidth : estHeight;

      let angle = i === 0 ? 0 : Math.random() * Math.PI * 2; 
      let radius = 0;
      let isPlaced = false;

      // Spiral search for empty space
      while (!isPlaced && radius < 2000) {
        const testX = radius * Math.cos(angle);
        const testY = radius * Math.sin(angle) * 0.65; 

        let collision = false;
        for (const p of placed) {
          if (intersect(
            { x: testX, y: testY, boxW, boxH },
            { x: p.x, y: p.y, boxW: p.boxW, boxH: p.boxH }
          )) {
            collision = true;
            break;
          }
        }

        if (!collision) {
          placed.push({ 
            text: w.text, value: w.value, 
            x: testX, y: testY, 
            size: fontSize, color, 
            isVertical, boxW, boxH
          });
          
          minX = Math.min(minX, testX - boxW / 2);
          maxX = Math.max(maxX, testX + boxW / 2);
          minY = Math.min(minY, testY - boxH / 2);
          maxY = Math.max(maxY, testY + boxH / 2);
          
          isPlaced = true;
        } else {
          angle += 0.5;
          radius += 3; 
        }
      }
    }

    // Mathematical centering of the entire cluster bounds
    const clusterCenterX = (minX + maxX) / 2;
    const clusterCenterY = (minY + maxY) / 2;

    const perfectlyCentered = placed.map(p => ({
      ...p,
      x: p.x - clusterCenterX,
      y: p.y - clusterCenterY
    }));

    return perfectlyCentered.reverse();
  }, [words]);

  // === Auto-Fit Initial Zoom ===
  useEffect(() => {
    if (positioned.length === 0 || size.w === 0) return;

    let cMaxX = 0, cMaxY = 0;
    positioned.forEach(p => {
      cMaxX = Math.max(cMaxX, Math.abs(p.x) + p.boxW / 2);
      cMaxY = Math.max(cMaxY, Math.abs(p.y) + p.boxH / 2);
    });

    const clusterW = cMaxX * 2;
    const clusterH = cMaxY * 2;

    const padding = 120; // Padding from the edge
    const scaleX = size.w / (clusterW + padding);
    const scaleY = size.h / (clusterH + padding);
    const optimalScale = Math.min(scaleX, scaleY, 1.5); // Cap zoom at 1.5x

    setTransform({ x: 0, y: 0, scale: optimalScale });
  }, [positioned, size.w, size.h]);

  // Handlers for Manual Zoom Controls
  const handleZoomIn = () => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale + 0.3, 4) }));
  const handleZoomOut = () => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale - 0.3, 0.2) }));
  const handleReset = () => { 
    setTransform({ x: 0, y: 0, scale: 1 }); 
    setSize(prev => ({ ...prev })); // Trigger auto-fit calculation again
  };

  // Loading State UI
  if (loading) return (
    <div className="flex h-full items-center justify-center gap-3 bg-white min-h-[500px] rounded-xl border border-slate-200 shadow-sm">
      <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
      <span className="text-slate-500 font-medium tracking-wide">Generating word cloud…</span>
    </div>
  );

  // Error State UI
  if (error) return (
    <div className="flex h-full items-center justify-center bg-white min-h-[500px] rounded-xl border border-slate-200 shadow-sm">
      <div className="px-4 py-3 bg-red-50 text-sm font-medium text-red-600 rounded-lg border border-red-100">{error}</div>
    </div>
  );

  // Main UI
  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full overflow-hidden select-none bg-white border border-slate-200 rounded-xl shadow-sm ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ minHeight: '550px' }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Zoom / Pan Instructions */}
      <div className="absolute bottom-4 left-4 z-50 ui-controls bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm border border-slate-200 text-xs text-slate-500 font-medium pointer-events-none transition-opacity duration-200">
        Zoom: {Math.round(transform.scale * 100)}% • Scroll to zoom, Drag canvas to pan
      </div>

      {/* The Zoomable/Pannable Canvas */}
      <div 
        className="absolute inset-0 origin-center"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transition: isDraggingCanvas ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        <svg width={size.w} height={size.h} className="absolute inset-0 overflow-visible pointer-events-none">
          <g transform={`translate(${size.w / 2}, ${size.h / 2})`}>
            {positioned.map((w, i) => (
              <motion.g 
                key={i} 
                layout 
                className="pointer-events-auto"
                whileHover={{ 
                  scale: 1.05, 
                  zIndex: 50,
                }}
                style={{ 
                  originX: 'center', originY: 'center', transformBox: 'fill-box' 
                }}
              >
                {/* Pure Typography Render */}
                <text
                  x={0} 
                  y={0}
                  transform={`translate(${w.x}, ${w.y}) rotate(${w.isVertical ? -90 : 0})`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={w.size}
                  fontWeight="800"
                  fill={w.color}
                  fontFamily="'Impact', 'Arial Black', sans-serif" 
                  style={{ 
                    cursor: 'pointer', 
                    userSelect: 'none',
                    textTransform: 'uppercase', 
                    filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.15))' // Subtle drop shadow for crispness on white background
                  }}
                >
                  {w.text}
                </text>
              </motion.g>
            ))}
          </g>
        </svg>
      </div>

      {/* Floating Light-Mode Controls */}
      <div className="absolute top-5 right-5 flex flex-col gap-2 z-10 ui-controls">
        <div className="flex flex-col bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl shadow-md overflow-hidden transition-all">
          <button onClick={handleZoomIn} className="p-3 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors border-b border-slate-200/60" title="Zoom In">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button onClick={handleReset} className="p-3 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors border-b border-slate-200/60" title="Reset View">
            <Maximize className="w-5 h-5" />
          </button>
          <button onClick={handleZoomOut} className="p-3 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors" title="Zoom Out">
            <ZoomOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Info Badge - Light Mode Data Card */}
      <div className="absolute bottom-5 right-5 flex justify-between items-end pointer-events-none z-10">
        <div className="flex flex-col gap-1.5 bg-white/90 backdrop-blur-md rounded-xl border border-slate-200 px-4 py-3 shadow-md">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm tracking-widest uppercase">
            <Activity className="h-4 w-4 text-blue-500" />
            <span>{words.length} Words</span>
          </div>
          <span className="text-xs text-slate-500 font-medium tracking-wide">Size = Frequency</span>
        </div>
      </div>
    </div>
  );
}

export default WordCloudView;