'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { 
  User, Briefcase, ZoomIn, ZoomOut, Maximize, 
  MousePointer2, MapPin, GraduationCap, 
  HelpCircle, Users, Globe, Network, Map
} from 'lucide-react'

export interface Associate {
  name: string
  relation: string
  gender: string
  details?: string
}

// Embedded the exact data
const defaultData: Associate[] = [
  { name: 'Sachin @ Bhanja @ Kannu @ Kankad', relation: 'Gang Associate', gender: 'Male', details: 'S/O Yudhveer Gyan Singh | Address: Village Dulhera, Jhajjar, Haryana | Occupation: Gangster | Nationality: Indian' },
  { name: 'Praveen @ Tona', relation: 'Gang Associate', gender: 'Female', details: 'Address: Dichau Kalan, Delhi | Occupation: Gangster | Nationality: Indian' },
  { name: 'Sandeep @ Kala Jatehdi', relation: 'Gang Associate', gender: 'Female', details: 'Details: Not available' },
  { name: 'Sachin Bhanja', relation: 'Gang Associate', gender: 'Female', details: 'Details: Not available' },
  { name: 'Lawrence Bishnoi', relation: 'Gang Associate', gender: 'Female', details: 'Details: Not available' },
  { name: 'Sampat Nehra', relation: 'Gang Associate', gender: 'Female', details: 'Details: Not available' },
  { name: 'Jaffar Khan', relation: 'Old Friend (School Time)', gender: 'Male', details: 'Age: 23 years | S/O Rajjab Khan | Address: Village Lagarpur, Tehsil Badli, Jhajjar, Haryana- 124105 | Occupation: Student | Nationality: Indian' },
  { name: 'Akash Mehra', relation: 'Old Friend (School Time)', gender: 'Female', details: 'Age: 24 years | S/O Dilbagh | Address: Village Lagarpur, Tehsil Badli, Jhajjar, Haryana- 124105 | Occupation: Student | Nationality: Indian' },
  { name: 'Sat Kumar 27 years', relation: 'Old Friend', gender: 'Male', details: 'S/O Ram Niwas | Address: Village Lagarpur, Tehsil Badli, Jhajjar, Haryana- 124105 | Occupation: Private | Nationality: Indian' },
  { name: 'Joginder', relation: 'Old Friend', gender: 'Male', details: 'Age: 25 years | S/O Rohtash | Address: Village Lagarpur, Tehsil Badli, Jhajjar, Haryana- 124105 | Occupation: Gangster | Nationality: Indian' }
]

interface FriendsAndAssociatesProps {
  data?: Associate[]
  mainPerson?: string
}

export function FriendsAssociates({ data = defaultData, mainPerson = "Central Target" }: FriendsAndAssociatesProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // === Transform State (Zoom & Pan Logic) ===
  // Scaled down to 0.55 initially so the larger spread fits on screen
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.55 })
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  // 1. Group by Relation (Top Boxes)
  const gangAssociates = data.filter(p => {
    const rel = p.relation.toLowerCase()
    return rel.includes('gang') || rel.includes('assosiate') || rel.includes('associate')
  })
  const oldFriends = data.filter(p => {
    const rel = p.relation.toLowerCase()
    return rel.includes('friend') && !rel.includes('gang')
  })

  // 2. Dynamic Geographic Extraction (Bottom Left Box)
  const geographicClusters = useMemo(() => {
    const clusters: Record<string, string[]> = {}
    data.forEach(p => {
      const addrMatch = p.details?.match(/Address:\s*([^|]+)/i)
      let location = "Unknown"
      
      if (addrMatch) {
        const fullAddr = addrMatch[1].trim().toLowerCase()
        if (fullAddr.includes('jhajjar') || fullAddr.includes('haryana')) {
            location = "Jhajjar, Haryana"
        }
        else if (fullAddr.includes('delhi')) {
            location = "Delhi"
        }
      }

      if (location !== "Unknown") {
        if (!clusters[location]) clusters[location] = []
        clusters[location].push(p.name)
      }
    })
    return clusters
  }, [data])

  // 3. Dynamic Occupation Extraction (Bottom Right Box)
  const occupationBreakdown = useMemo(() => {
    const occupations: Record<string, string[]> = {}
    data.forEach(p => {
      const occMatch = p.details?.match(/Occupation:\s*([^|]+)/i)
      let occ = occMatch ? occMatch[1].trim() : "Unknown"
      occ = occ.charAt(0).toUpperCase() + occ.slice(1).toLowerCase()
      
      if (!occupations[occ]) occupations[occ] = []
      occupations[occ].push(p.name)
    })
    return occupations
  }, [data])

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
    if ((e.target as HTMLElement).closest('.ui-controls') || (e.target as HTMLElement).closest('.interactive-card')) return
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

  // Generic Card Renderer (Increased padding and margins)
  const renderCard = (person: Associate, index: number, colorTheme: 'red' | 'amber') => {
    const details = person.details ? person.details.split('|').map(s => s.trim()).filter(Boolean) : []

    return (
      <div key={index} className={`relative bg-white border border-${colorTheme}-200 rounded-lg p-4 mb-3 shadow-sm flex gap-4 w-full hover:shadow-md transition-shadow`}>
        <div className={`mt-1 flex flex-col items-center justify-start`}>
          <User className={`w-8 h-8 ${colorTheme === 'red' ? 'text-[#e63946] fill-[#e63946]' : 'text-[#e9c46a] fill-[#e9c46a]'}`} />
        </div>
        <div className="flex-1 w-full">
          <div className="flex justify-between items-start mb-1.5 gap-2">
            <h4 className="font-bold text-[15px] text-gray-900 leading-tight pr-2">{person.name}</h4>
            <span className={`text-[11px] font-bold border rounded-full px-2.5 py-0.5 whitespace-nowrap capitalize ${colorTheme === 'red' ? 'text-blue-600 border-blue-600' : 'text-blue-600 border-blue-600'}`}>
              {person.gender}
            </span>
          </div>
          <ul className="text-[12px] text-gray-700 space-y-1.5 mt-2 list-none pl-0">
            {details.map((detail, i) => {
               if (detail.toLowerCase().includes('not available')) {
                   return <li key={i} className="flex items-start"><span className="mr-1.5 text-gray-400 text-[9px] mt-0.5">●</span><span className="text-gray-500 italic">{detail}</span></li>
               }
               return (
                <li key={i} className="flex items-start">
                  <span className="mr-1.5 text-gray-400 text-[9px] mt-0.5">●</span>
                  <span className="leading-snug">{detail}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    )
  }

  // Helper to map occupation to an icon
  const getOccIcon = (occ: string) => {
    const l = occ.toLowerCase()
    if (l.includes('gang')) return <User className="w-5 h-5 text-[#db303c] fill-[#db303c]" />
    if (l.includes('student')) return <GraduationCap className="w-5 h-5 text-[#0070c0] fill-[#0070c0]" />
    if (l.includes('private')) return <Briefcase className="w-5 h-5 text-[#9a3412] fill-[#9a3412]" />
    return <HelpCircle className="w-5 h-5 text-gray-500 fill-gray-500" />
  }

  // Render specific map thumbnails based on location
  const renderMapThumbnail = (location: string) => {
    if (location === "Jhajjar, Haryana") {
      return (
        <div className="w-[100px] h-[90px] border border-blue-100 rounded-lg relative overflow-hidden flex items-center justify-center shrink-0">
          <svg viewBox="0 0 100 100" className="absolute w-[140%] h-[140%] text-blue-100 fill-blue-50/50">
             <path d="M45,10 C50,5 55,10 55,15 C65,15 75,25 80,35 C85,50 70,70 55,90 C45,100 40,90 35,80 C20,60 10,40 15,30 C20,20 35,20 40,15 Z" stroke="currentColor" strokeWidth="2" />
          </svg>
          <MapPin className="text-[#0070c0] fill-[#0070c0] w-6 h-6 absolute top-[35%] left-[45%] -translate-x-1/2 -translate-y-1/2 drop-shadow-md" />
        </div>
      )
    }
    if (location === "Delhi") {
      return (
        <div className="w-[100px] h-[90px] border border-blue-100 rounded-lg relative overflow-hidden flex items-center justify-center shrink-0">
          <svg viewBox="0 0 100 100" className="absolute w-[120%] h-[120%] text-blue-100 fill-blue-50/50 mt-2">
             <path d="M30,20 C40,10 60,15 70,30 C80,50 65,80 50,85 C30,90 15,70 20,45 C20,30 25,25 30,20 Z" stroke="currentColor" strokeWidth="2" />
          </svg>
          <MapPin className="text-[#0070c0] fill-[#0070c0] w-6 h-6 absolute top-[45%] left-[50%] -translate-x-1/2 -translate-y-1/2 drop-shadow-md" />
        </div>
      )
    }
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-[850px] overflow-hidden select-none bg-[#f8fafc] font-sans rounded-3xl border border-slate-200 shadow-inner ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDraggingCanvas(false)}
      onMouseLeave={() => setIsDraggingCanvas(false)}
    >
      {/* UI Controls (Zoom Only) */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-4 ui-controls">
        <div className="flex bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <button onClick={() => setTransform(t => ({...t, scale: Math.min(t.scale + 0.1, 2)}))} className="p-2.5 hover:bg-slate-50 text-slate-600 border-r border-slate-100"><ZoomIn className="h-4 w-4"/></button>
          <button onClick={() => setTransform(t => ({...t, scale: Math.max(t.scale - 0.1, 0.3)}))} className="p-2.5 hover:bg-slate-50 text-slate-600 border-r border-slate-100"><ZoomOut className="h-4 w-4"/></button>
          <button onClick={() => setTransform({x: 0, y: 0, scale: 0.55})} className="p-2.5 hover:bg-slate-50 text-slate-600"><Maximize className="h-4 w-4"/></button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div 
        className="absolute inset-0 origin-center pointer-events-none"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transition: isDraggingCanvas ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        {/* Significantly Expanded Layout Canvas (1800x1400) to prevent overlap entirely */}
        <div className="relative w-[1800px] h-[1400px] mx-auto mt-16 pointer-events-auto">
          
          {/* Connecting SVG Curves */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: 'visible' }}>
            {/* To Box 1 (Red) */}
            <path d="M 900 500 C 750 500, 700 250, 570 250" stroke="#db303c" strokeWidth="3" fill="none" />
            <circle cx="570" cy="250" r="7" fill="#db303c" />
            
            {/* To Box 2 (Yellow) */}
            <path d="M 900 500 C 1050 500, 1100 250, 1230 250" stroke="#eab308" strokeWidth="3" fill="none" />
            <circle cx="1230" cy="250" r="7" fill="#eab308" />

            {/* To Box 3 (Blue) */}
            <path d="M 900 500 C 750 500, 700 1000, 570 1000" stroke="#0070c0" strokeWidth="3" fill="none" />
            <circle cx="570" cy="1000" r="7" fill="#0070c0" />

            {/* To Box 4 (Green) */}
            <path d="M 900 500 C 1050 500, 1100 750, 1230 750" stroke="#16a34a" strokeWidth="3" fill="none" />
            <circle cx="1230" cy="750" r="7" fill="#16a34a" />

            {/* To Box 5 (Purple) */}
            <path d="M 900 500 C 900 750, 900 850, 900 1000" stroke="#7e22ce" strokeWidth="3" fill="none" />
            <circle cx="900" cy="1000" r="7" fill="#7e22ce" />
          </svg>

          {/* CENTRAL NODE */}
          <div className="absolute left-[900px] top-[500px] -translate-x-1/2 -translate-y-1/2 z-10 w-[240px] h-[240px] rounded-full bg-[#1c305c] border-[6px] border-white shadow-2xl flex flex-col items-center justify-center text-center p-6 text-white outline outline-4 outline-[#1c305c]/30">
            <Users className="w-16 h-16 mb-2 text-white" />
            <h2 className="font-black text-[20px] leading-tight tracking-wide mb-2">ASSOCIATES<br/>OVERVIEW</h2>
            <p className="text-[11px] text-gray-300 font-medium leading-snug px-2">
              Network of associates organized by relationship, role, location & occupation
            </p>
          </div>

          {/* 1. GANG ASSOCIATES (Top Left) - Made Wider */}
          <div className="absolute left-[150px] top-[50px] w-[420px] h-fit flex flex-col bg-white rounded-xl shadow-lg border border-[#db303c]/20 z-10 overflow-hidden interactive-card outline outline-1 outline-gray-200">
            <div className="bg-[#db303c] px-5 py-3 flex items-center gap-3 text-white shrink-0">
              <div className="bg-white text-[#db303c] rounded-full w-7 h-7 flex items-center justify-center font-black text-sm">1</div>
              <Users className="w-5 h-5" />
              <h3 className="font-bold text-[17px] tracking-wide">GANG ASSOCIATES</h3>
            </div>
            <div className="p-4 bg-white flex-1">
              {gangAssociates.map((person, i) => renderCard(person, i, 'red'))}
            </div>
          </div>

          {/* 2. OLD FRIENDS (Top Right) */}
          <div className="absolute left-[1230px] top-[50px] w-[420px] h-fit flex flex-col bg-white rounded-xl shadow-lg border border-[#eab308]/20 z-10 overflow-hidden interactive-card outline outline-1 outline-gray-200">
            <div className="bg-[#eab308] px-5 py-3 flex items-center gap-3 text-white shrink-0">
              <div className="bg-white text-[#eab308] rounded-full w-7 h-7 flex items-center justify-center font-black text-sm">2</div>
              <Users className="w-5 h-5" />
              <h3 className="font-bold text-[17px] tracking-wide">OLD FRIENDS (SCHOOL TIME)</h3>
            </div>
            <div className="p-4 bg-white flex-1">
               {oldFriends.map((person, i) => renderCard(person, i, 'amber'))}
            </div>
          </div>

          {/* 3. GEOGRAPHIC CLUSTERS (Bottom Left) */}
          <div className="absolute left-[150px] top-[900px] w-[420px] h-fit flex flex-col bg-white rounded-xl shadow-lg border border-[#0070c0]/20 z-10 overflow-hidden interactive-card outline outline-1 outline-gray-200">
            <div className="bg-[#0070c0] px-5 py-3 flex items-center gap-3 text-white shrink-0">
              <div className="bg-white text-[#0070c0] rounded-full w-7 h-7 flex items-center justify-center font-black text-sm">3</div>
              <Globe className="w-5 h-5" />
              <h3 className="font-bold text-[17px] tracking-wide">GEOGRAPHIC CLUSTERS</h3>
            </div>
            <div className="p-5 bg-white flex-1">
              {Object.entries(geographicClusters).map(([location, names], i) => (
                <div key={i} className="flex justify-between items-center gap-4 border-b border-dashed border-gray-200 last:border-0 py-4 first:pt-0 last:pb-0">
                   <div className="flex gap-4">
                      <MapPin className="w-7 h-7 text-[#0070c0] fill-[#0070c0]/10 shrink-0 mt-1" />
                      <div>
                         <h4 className="font-bold text-[15px] text-gray-900">{location}</h4>
                         <ul className="text-[13px] text-gray-600 mt-2 list-disc pl-3 space-y-1.5">
                           {location === "Jhajjar, Haryana" && (
                             <>
                                <li>Majority of associates</li>
                                <li>Key Villages: Dulhera, Lagarpur</li>
                             </>
                           )}
                           {location === "Delhi" && (
                             <li>Dichau Kalan<br/><span className="text-gray-400 mt-1 inline-block">(Praveen @ Tona)</span></li>
                           )}
                         </ul>
                      </div>
                   </div>
                   {/* Dedicated Map Graphic Box */}
                   {renderMapThumbnail(location)}
                </div>
              ))}
            </div>
          </div>

          {/* 4. OCCUPATION BREAKDOWN (Bottom Right) */}
          <div className="absolute left-[1230px] top-[580px] w-[420px] h-fit flex flex-col bg-white rounded-xl shadow-lg border border-[#16a34a]/20 z-10 overflow-hidden interactive-card outline outline-1 outline-gray-200">
            <div className="bg-[#16a34a] px-5 py-3 flex items-center gap-3 text-white shrink-0">
              <div className="bg-white text-[#16a34a] rounded-full w-7 h-7 flex items-center justify-center font-black text-sm">4</div>
              <Briefcase className="w-5 h-5" />
              <h3 className="font-bold text-[17px] tracking-wide">OCCUPATION BREAKDOWN</h3>
            </div>
            <div className="p-5 bg-white flex-1">
               <table className="w-full text-sm border-collapse">
                 <tbody>
                   {Object.entries(occupationBreakdown).map(([occ, names], i) => (
                     <tr key={i} className="border-b border-gray-200 last:border-0">
                       <td className="py-3.5 px-2 w-12 align-top">{getOccIcon(occ)}</td>
                       <td className="py-3.5 pr-2 font-bold text-gray-800 w-32 align-top text-[14px]">{occ} ({names.length})</td>
                       <td className="py-3.5 text-[13px] text-gray-600 border-l border-gray-200 pl-4 align-top">
                         <ul className="list-disc pl-3 space-y-2">
                           {names.map((n, idx) => (
                             <li key={idx} className="leading-tight">{n}</li>
                           ))}
                         </ul>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </div>

          {/* 5. RELATIONSHIP TYPES (Bottom Center) */}
          <div className="absolute left-[900px] top-[1000px] -translate-x-1/2 w-[400px] h-fit bg-white rounded-xl shadow-lg border border-[#7e22ce]/20 z-10 overflow-hidden outline outline-1 outline-gray-200">
            <div className="bg-[#7e22ce] px-5 py-3 flex items-center gap-3 text-white">
              <div className="bg-white text-[#7e22ce] rounded-full w-7 h-7 flex items-center justify-center font-black text-sm">5</div>
              <Network className="w-5 h-5" />
              <h3 className="font-bold text-[17px] tracking-wide">RELATIONSHIP TYPES</h3>
            </div>
            <div className="p-5 space-y-4 bg-white">
              <div className="flex items-center gap-5 border border-red-100 p-3 rounded-lg shadow-sm">
                <Users className="w-10 h-10 text-[#db303c] fill-[#db303c]/10 shrink-0" />
                <div>
                  <h4 className="font-bold text-[14px] text-gray-900">Gang Associate</h4>
                  <p className="text-[12px] text-gray-500 mt-0.5">High-risk criminal network</p>
                </div>
              </div>
              <div className="flex items-center gap-5 border border-amber-100 p-3 rounded-lg shadow-sm">
                <User className="w-10 h-10 text-amber-500 fill-amber-500/10 shrink-0" />
                <div>
                  <h4 className="font-bold text-[14px] text-gray-900">Associate</h4>
                  <p className="text-[12px] text-gray-500 mt-0.5">Connected to gang members</p>
                </div>
              </div>
              <div className="flex items-center gap-5 border border-blue-100 p-3 rounded-lg shadow-sm">
                <Users className="w-10 h-10 text-[#0070c0] fill-[#0070c0]/10 shrink-0" />
                <div>
                  <h4 className="font-bold text-[14px] text-gray-900">Old Friend (School Time)</h4>
                  <p className="text-[12px] text-gray-500 mt-0.5">Personal / Non-criminal connections</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer Banner */}
      <div className="absolute bottom-6 left-6 z-20 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 bg-white/90 backdrop-blur-md px-5 py-3 rounded-xl border border-slate-200 shadow-sm pointer-events-none">
        <MousePointer2 className="h-4 w-4" />
        Scroll to Zoom • Drag to Pan inside Canvas
      </div>
    </div>
  )
}