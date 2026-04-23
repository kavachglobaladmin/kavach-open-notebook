'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import { 
  User, MapPin, Briefcase, Calendar, ShieldAlert, 
  Search, Info, ZoomIn, ZoomOut, Maximize, 
  MousePointer2, Activity
} from 'lucide-react'

export interface Associate {
  name: string
  relation: string
  gender: string
  details?: string
}

interface FriendsAndAssociatesProps {
  data: Associate[]
  mainPerson: string
}

export function FriendsAssociates({ data, mainPerson }: FriendsAndAssociatesProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  
  // === Transform State (Zoom & Pan Logic) ===
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.85 })
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const filteredData = useMemo(() => {
    if (!searchTerm) return data
    const lowerSearch = searchTerm.toLowerCase()
    return data.filter(
      (person) =>
        person.name.toLowerCase().includes(lowerSearch) ||
        person.relation.toLowerCase().includes(lowerSearch) ||
        (person.details && person.details.toLowerCase().includes(lowerSearch))
    )
  }, [data, searchTerm])

  // === Mouse Wheel Zoom Logic ===
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const zoomSensitivity = 0.001
      const delta = -e.deltaY * zoomSensitivity
      setTransform((prev) => ({
        ...prev,
        scale: Math.min(Math.max(0.3, prev.scale + delta), 2)
      }))
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // === Canvas Pan Logic ===
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.interactive-node') || (e.target as HTMLElement).closest('.ui-controls')) return
    setIsDraggingCanvas(true)
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      }))
    }
  }

  const getDetailIcon = (text: string) => {
    const l = text.toLowerCase()
    if (l.includes('age') || l.includes('dob') || l.includes('year')) return <Calendar className="w-3 h-3" />
    if (l.includes('occup') || l.includes('work')) return <Briefcase className="w-3 h-3" />
    if (l.includes('distt') || l.includes('village')) return <MapPin className="w-3 h-3" />
    return <Info className="w-3 h-3" />
  }

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-[750px] overflow-hidden select-none bg-[#f8fafc] border border-slate-200 rounded-3xl shadow-inner font-sans ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDraggingCanvas(false)}
      onMouseLeave={() => setIsDraggingCanvas(false)}
    >
      {/* Dynamic Grid Background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]" 
        style={{ 
          backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', 
          backgroundSize: '40px 40px',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
        }} 
      />

      {/* UI Controls (Zoom & Search) - Preserved from logic but visual layout maintained */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-3 ui-controls">
        {/* <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search Network..." 
            className="pl-10 pr-4 py-2.5 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl text-sm font-bold shadow-2xl focus:ring-4 focus:ring-blue-500/10 transition-all w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div> */}
        <div className="flex bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
          <button onClick={() => setTransform(t => ({...t, scale: Math.min(t.scale + 0.1, 2)}))} className="p-3 hover:bg-slate-50 text-slate-600 transition-colors"><ZoomIn className="h-4 w-4"/></button>
          <button onClick={() => setTransform(t => ({...t, scale: Math.max(t.scale - 0.1, 0.3)}))} className="p-3 hover:bg-slate-50 text-slate-600 transition-colors border-l border-slate-100"><ZoomOut className="h-4 w-4"/></button>
          <button onClick={() => setTransform({x: 0, y: 0, scale: 0.85})} className="p-3 hover:bg-slate-50 text-slate-600 transition-colors border-l border-slate-100"><Maximize className="h-4 w-4"/></button>
        </div>
      </div>

      {/* Main Graph Area */}
      <div 
        className="absolute inset-0 origin-center pointer-events-none"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transition: isDraggingCanvas ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        <div className="relative w-full h-full flex items-center justify-center min-h-[1000px] py-32 px-[10%]">
          
          <AnimatePresence mode="popLayout">
            <motion.div 
              className="flex flex-wrap items-center justify-center gap-8 max-w-[1400px]"
              layout
            >
              {filteredData.map((person, index) => {
                const isThreat = person.relation.toLowerCase().includes('jail') || person.relation.toLowerCase().includes('lodged')
                const details = person.details ? person.details.split('|').map(s => s.trim()).filter(Boolean) : []

                return (
                  <motion.div
                    key={`${person.name}-${index}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ delay: index * 0.03 }}
                    className="interactive-node pointer-events-auto group relative"
                  >
                    {/* Animated Connection Link */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 opacity-20 group-hover:opacity-40 transition-opacity">
                       <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] rounded-full border-2 border-dashed ${isThreat ? 'border-red-400' : 'border-blue-400'} animate-[spin_10s_linear_infinite]`} />
                    </div>

                    <div className={`relative bg-white border ${isThreat ? 'border-red-200' : 'border-slate-200'} rounded-[32px] p-6 shadow-sm hover:shadow-2xl hover:border-blue-400 transition-all w-[320px] overflow-hidden`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${isThreat ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-blue-600 border-slate-100'}`}>
                            <User className="h-6 w-6" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate w-32">{person.name}</h4>
                            <div className={`mt-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border inline-block ${isThreat ? 'bg-red-500 text-white border-red-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                              {person.relation}
                            </div>
                          </div>
                        </div>
                        {isThreat && <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />}
                      </div>

                      <div className="space-y-1.5">
                        {details.slice(0, 3).map((detail, i) => (
                          <div key={i} className="flex items-center gap-2.5 bg-slate-50/50 p-2 rounded-xl group-hover:bg-blue-50/50 transition-colors">
                            <span className="text-slate-400 group-hover:text-blue-500 transition-colors">{getDetailIcon(detail)}</span>
                            <span className="text-[10px] font-bold text-slate-600 truncate uppercase tracking-tight">{detail}</span>
                          </div>
                        ))}
                        {details.length === 0 && (
                          <div className="py-2 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">No Metadata</div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                         <span className="text-[8px] font-black text-slate-300 uppercase">Node #{index + 101}</span>
                         <div className="flex gap-1">
                            <div className="w-1 h-1 rounded-full bg-blue-400" />
                            <div className="w-1 h-1 rounded-full bg-blue-200" />
                         </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Instructions Badge */}
      <div className="absolute bottom-6 left-6 right-6 z-20 flex justify-between items-end pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 pointer-events-auto">
          <Activity className="h-4 w-4 text-blue-400" />
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-[0.2em]">Active Trace</span>
            <span className="text-sm font-black tracking-tight">{filteredData.length} Connection Nodes</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-200 pointer-events-none">
          <MousePointer2 className="h-3 w-3" />
          Scroll to Zoom • Drag to Pan
        </div>
      </div>
    </div>
  )
}