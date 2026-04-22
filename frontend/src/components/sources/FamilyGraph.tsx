// 'use client'

// import { useEffect, useMemo, useRef, useState } from 'react'
// import { User } from 'lucide-react'

// interface FamilyMember {
//   name: string
//   relation: string
//   gender: string
//   details?: string
// }

// interface FamilyGraphProps {
//   data: FamilyMember[]
//   mainPerson: string
// }

// // Image store for member photos (keyed by name)
// const memberImageStore = new Map<string, string>()
// export { memberImageStore }

// const CENTER_R  = 72   // center circle radius
// const MEMBER_R  = 48   // satellite circle radius
// const DETAIL_W  = 220  // detail popup width

// export function FamilyGraph({ data, mainPerson }: FamilyGraphProps) {
//   const containerRef = useRef<HTMLDivElement>(null)
//   const [size, setSize]           = useState({ w: 1000, h: 700 })
//   const [scale, setScale]         = useState(0.9)
//   const [pan, setPan]             = useState({ x: 0, y: 0 })
//   const [dragging, setDragging]   = useState(false)
//   const [selected, setSelected] = useState<Set<string>>(new Set())
//   const drag0 = useRef({ x: 0, y: 0 })

//   // Resize
//   useEffect(() => {
//     const el = containerRef.current; if (!el) return
//     const ro = new ResizeObserver(([e]) => {
//       const r = e.contentRect
//       setSize({ w: Math.max(800, r.width), h: Math.max(600, r.height) })
//     })
//     ro.observe(el); return () => ro.disconnect()
//   }, [])

//   // Wheel zoom
//   useEffect(() => {
//     const el = containerRef.current; if (!el) return
//     const fn = (e: WheelEvent) => {
//       e.preventDefault()
//       setScale(s => Math.min(2.5, Math.max(0.25, s - e.deltaY * 0.001)))
//     }
//     el.addEventListener('wheel', fn, { passive: false })
//     return () => el.removeEventListener('wheel', fn)
//   }, [])

//   const onDown = (e: React.MouseEvent) => {
//     if ((e.target as HTMLElement).closest('.np')) return
//     setDragging(true)
//     drag0.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
//   }
//   const onMove = (e: React.MouseEvent) => {
//     if (!dragging) return
//     setPan({ x: e.clientX - drag0.current.x, y: e.clientY - drag0.current.y })
//   }
//   const onUp = () => setDragging(false)

//   const toggleSelected = (id: string) => {
//     setSelected(prev => {
//       const next = new Set(prev)
//       if (next.has(id)) next.delete(id)
//       else next.add(id)
//       return next
//     })
//   }

//   const cx = size.w / 2
//   const cy = size.h / 2

//   // ── Deduplicate members ───────────────────────────────────────────────────
//   const members = useMemo(() => {
//     const seen = new Set<string>()
//     return data.filter(m => {
//       const key = `${m.name.toLowerCase().trim()}|${m.relation.toLowerCase().trim()}`
//       if (seen.has(key)) return false
//       seen.add(key)
//       return m.name && m.name.trim().length > 0
//     })
//   }, [data])

//   // ── Radial layout ─────────────────────────────────────────────────────────
//   // Orbit radius — enough so circles don't overlap
//   const ORBIT = Math.min(cx - MEMBER_R - 60, cy - MEMBER_R - 80, 280)

//   const nodes = useMemo(() => {
//     const n = members.length
//     if (n === 0) return []
//     return members.map((m, i) => {
//       // Start from top (-π/2), go clockwise
//       const angle = -Math.PI / 2 + (i / n) * 2 * Math.PI
//       return {
//         ...m,
//         id: `${m.relation}_${i}`,
//         angle,
//         x: cx + ORBIT * Math.cos(angle),
//         y: cy + ORBIT * Math.sin(angle),
//         details: m.details
//           ? m.details.split('|').map(s => s.trim()).filter(Boolean)
//           : [],
//       }
//     })
//   }, [members, cx, cy, ORBIT])

//   // Gender ring color
//   const ringColor = (gender: string) =>
//     gender.toLowerCase() === 'female' ? '#fda4af' : '#93c5fd'

//   return (
//     <div
//       ref={containerRef}
//       className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#eef3fb] to-[#f8faff] select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
//       onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
//       onClick={() => setSelected(new Set())}
//     >
//       {/* hint */}
//       <div className="absolute bottom-3 left-3 z-50 pointer-events-none text-[11px] text-slate-400 bg-white/80 px-2 py-1 rounded-lg border border-slate-100">
//         {Math.round(scale * 100)}% • Scroll to zoom • Drag to pan • Click member for details
//       </div>

//       {/* ── zoomable layer ── */}
//       <div
//         className="absolute inset-0"
//         style={{
//           transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`,
//           transformOrigin: `${cx}px ${cy}px`,
//         }}
//       >
//         {/* ── SVG lines ── */}
//         <svg
//           className="absolute inset-0 overflow-visible pointer-events-none"
//           style={{ width: size.w, height: size.h }}
//         >
//           {nodes.map(node => {
//             // Line from center circle edge to member circle edge
//             const angle = node.angle
//             const x1 = cx + (CENTER_R + 6) * Math.cos(angle)
//             const y1 = cy + (CENTER_R + 6) * Math.sin(angle)
//             const x2 = node.x - (MEMBER_R + 4) * Math.cos(angle)
//             const y2 = node.y - (MEMBER_R + 4) * Math.sin(angle)

//             // Midpoint label position
//             const lx = (x1 + x2) / 2
//             const ly = (y1 + y2) / 2

//             return (
//               <g key={node.id}>
//                 <line
//                   x1={x1} y1={y1} x2={x2} y2={y2}
//                   stroke="#93c5fd" strokeWidth={1.5} opacity={0.8}
//                   strokeLinecap="round"
//                 />
//                 {/* Relation label on the line */}
//                 <text
//                   x={lx} y={ly}
//                   textAnchor="middle"
//                   dominantBaseline="middle"
//                   fontSize={11}
//                   fontWeight={600}
//                   fill="#64748b"
//                   style={{ userSelect: 'none' }}
//                 >
//                   {node.relation}
//                 </text>
//               </g>
//             )
//           })}
//         </svg>

//         {/* ── CENTER CIRCLE ── */}
//         <div
//           className="absolute np"
//           style={{ left: cx - CENTER_R, top: cy - CENTER_R, width: CENTER_R * 2, height: CENTER_R * 2, zIndex: 20 }}
//         >
//           {/* glow rings */}
//           <div className="absolute inset-[-18px] rounded-full bg-blue-400/10 animate-pulse pointer-events-none" />
//           <div className="absolute inset-[-6px] rounded-full bg-blue-500 shadow-2xl pointer-events-none" />
//           <div className="absolute inset-[-2px] rounded-full bg-white pointer-events-none" />
//           {/* photo */}
//           <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-200 z-10">
//             <User className="w-1/2 h-1/2 text-slate-400" />
//           </div>
//           {/* name label */}
//           <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
//             <span className="text-[14px] font-extrabold text-slate-800 bg-white/90 px-3 py-1 rounded-full shadow-sm border border-slate-200">
//               {mainPerson || 'Subject'}
//             </span>
//           </div>
//         </div>

//         {/* ── SATELLITE MEMBER NODES ── */}
//         {nodes.map(node => {
//           const isSelected = selected.has(node.id)
//           const rc = ringColor(node.gender)

//           return (
//             <div
//               key={node.id}
//               className="absolute np"
//               style={{ left: node.x - MEMBER_R, top: node.y - MEMBER_R, width: MEMBER_R * 2, height: MEMBER_R * 2, zIndex: selected.has(node.id) ? 30 : 15 }}
//               onClick={e => { e.stopPropagation(); toggleSelected(node.id) }}
//             >
//               {/* gender ring */}
//               <div
//                 className="absolute inset-[-4px] rounded-full pointer-events-none"
//                 style={{ background: rc, opacity: 0.35 }}
//               />
//               <div
//                 className="absolute inset-[-2px] rounded-full pointer-events-none"
//                 style={{ border: `2.5px solid ${rc}` }}
//               />
//               {/* photo circle */}
//               <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-100 cursor-pointer shadow-md z-10 hover:shadow-lg transition-shadow">
//                 <User className="w-1/2 h-1/2 text-slate-400" />
//               </div>
//               {/* name + relation below */}
//               <div
//                 className="absolute top-full mt-2 left-1/2 -translate-x-1/2 flex flex-col items-center whitespace-nowrap cursor-pointer"
//                 onClick={e => { e.stopPropagation(); toggleSelected(node.id) }}
//               >
//                 <span className="text-[13px] font-bold text-slate-800 hover:text-blue-600 transition-colors">{node.name}</span>
//                 <span className="text-[11px] text-slate-500 capitalize">{node.relation}</span>
//               </div>
//             </div>
//           )
//         })}

//         {/* ── DETAIL POPUPS — rendered outside node divs at canvas coordinates ── */}
//         {nodes.map(node => {
//           if (!selected.has(node.id)) return null
//           const rc = ringColor(node.gender)

//           // Push popup further out from center to avoid overlap
//           // Direction: from center toward node, then beyond the circle
//           const angle = node.angle
//           const POPUP_OFFSET = MEMBER_R + 20
//           const POPUP_W = 230

//           // Place popup in the direction away from center
//           // If node is on right half → popup to the right, else to the left
//           const goRight = Math.cos(angle) >= 0
//           const popupX = goRight
//             ? node.x + POPUP_OFFSET
//             : node.x - POPUP_OFFSET - POPUP_W

//           // Vertically: align top of popup with top of circle
//           const popupY = node.y - MEMBER_R

//           return (
//             <div
//               key={`popup_${node.id}`}
//               className="absolute np bg-white rounded-2xl shadow-lg border border-slate-200 p-5"
//               style={{
//                 left: popupX,
//                 top: popupY,
//                 width: POPUP_W,
//                 zIndex: 50,
//               }}
//               onClick={e => e.stopPropagation()}
//             >
//               {/* Name — large bold */}
//               <p className="text-[16px] font-extrabold text-slate-900 leading-tight">{node.name}</p>
//               {/* Relation — small muted */}
//               <p className="text-[12px] text-slate-400 capitalize mb-3 mt-0.5">{node.relation}</p>

//               {/* Details — clean plain text, no bold labels, image style */}
//               {node.details.length > 0 ? (
//                 <div className="space-y-2">
//                   {node.details.map((d: string, i: number) => (
//                     <p key={i} className="text-[13px] text-slate-600 leading-snug">{d}</p>
//                   ))}
//                 </div>
//               ) : (
//                 <p className="text-[12px] text-slate-400 italic">No additional details</p>
//               )}
//             </div>
//           )
//         })}
//       </div>
//     </div>
//   )
// }




'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { User } from 'lucide-react'

interface FamilyMember {
  name: string
  relation: string
  gender: string
  details?: string
  photo?: string
}

interface FamilyGraphProps {
  data: FamilyMember[]
  mainPerson: string
  mainPersonPhoto?: string
}

const memberImageStore = new Map<string, string>()
export { memberImageStore }

const CENTER_R = 80
const MEMBER_R = 52

export function FamilyGraph({ data, mainPerson, mainPersonPhoto }: FamilyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1000, h: 700 })
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const drag0 = useRef({ x: 0, y: 0 })
  const didDrag = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect
      setSize({ w: Math.max(600, r.width), h: Math.max(500, r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const fn = (e: WheelEvent) => {
      e.preventDefault()
      setScale(s => Math.min(2.5, Math.max(0.3, s - e.deltaY * 0.001)))
    }
    el.addEventListener('wheel', fn, { passive: false })
    return () => el.removeEventListener('wheel', fn)
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.np')) return
    setDragging(true)
    didDrag.current = false
    drag0.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    didDrag.current = true
    setPan({ x: e.clientX - drag0.current.x, y: e.clientY - drag0.current.y })
  }
  const onMouseUp = () => setDragging(false)
  const onCanvasClick = () => {
    if (!didDrag.current) setSelectedId(null)
  }

  const cx = size.w / 2
  const cy = size.h / 2

  const members = useMemo(() => {
    const seen = new Set<string>()
    return data.filter(m => {
      const key = `${m.name.toLowerCase().trim()}|${m.relation.toLowerCase().trim()}`
      if (seen.has(key)) return false
      seen.add(key)
      return m.name?.trim().length > 0
    })
  }, [data])

  const ORBIT = Math.min(cx - MEMBER_R - 80, cy - MEMBER_R - 100, 260)

  const nodes = useMemo(() => {
    const n = members.length
    if (n === 0) return []
    return members.map((m, i) => {
      const angle = -Math.PI / 2 + (i / n) * 2 * Math.PI
      return {
        ...m,
        id: `node_${i}`,
        angle,
        x: cx + ORBIT * Math.cos(angle),
        y: cy + ORBIT * Math.sin(angle),
        parsedDetails: m.details
          ? m.details.split('|').map(s => s.trim()).filter(Boolean)
          : [],
        photo: m.photo || memberImageStore.get(m.name) || null,
      }
    })
  }, [members, cx, cy, ORBIT])

  const genderBorderColor = (gender: string) =>
    gender?.toLowerCase() === 'female' ? '#f9a8d4' : '#cbd5e1'

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${dragging ? 'cursor-grabbing' : 'cursor-default'}`}
      style={{ background: 'linear-gradient(160deg, #eef2fb 0%, #f4f7fe 40%, #edf1fa 100%)' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onClick={onCanvasClick}
    >
      {/* hint */}
      <div
        className="absolute bottom-3 left-3 z-50 pointer-events-none"
        style={{
          fontSize: 11,
          color: '#94a3b8',
          background: 'rgba(255,255,255,0.7)',
          padding: '4px 10px',
          borderRadius: 8,
        }}
      >
        {Math.round(scale * 100)}% · Scroll to zoom · Drag to pan · Click member for details
      </div>

      {/* zoomable layer */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: `${cx}px ${cy}px`,
        }}
      >
        {/* SVG lines + relation labels */}
        <svg
          className="absolute inset-0 overflow-visible pointer-events-none"
          style={{ width: size.w, height: size.h }}
        >
          {nodes.map(node => {
            const a = node.angle
            const x1 = cx + (CENTER_R + 6) * Math.cos(a)
            const y1 = cy + (CENTER_R + 6) * Math.sin(a)
            const x2 = node.x - (MEMBER_R + 6) * Math.cos(a)
            const y2 = node.y - (MEMBER_R + 6) * Math.sin(a)
            const mx = (x1 + x2) / 2
            const my = (y1 + y2) / 2

            // Rotate label to avoid overlapping line
            const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
            const flip = angleDeg > 90 || angleDeg < -90

            return (
              <g key={node.id}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#c8d3e8"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                />
                {/* Label sits just above/beside the line midpoint — exactly like reference */}
                <text
                  x={mx}
                  y={my - 8}
                  textAnchor="middle"
                  dominantBaseline="auto"
                  fontSize={12}
                  fontWeight={500}
                  fill="#64748b"
                  style={{
                    userSelect: 'none',
                    fontFamily: '"Inter", system-ui, sans-serif',
                  }}
                >
                  {node.relation}
                </text>
              </g>
            )
          })}
        </svg>

        {/* ── CENTER CIRCLE ── */}
        <div
          className="absolute np"
          style={{
            left: cx - CENTER_R,
            top: cy - CENTER_R,
            width: CENTER_R * 2,
            height: CENTER_R * 2,
            zIndex: 20,
          }}
        >
          {/* Outer blue glow - soft radial, exact like reference */}
          <div
            style={{
              position: 'absolute',
              inset: -28,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(96,165,250,0.30) 0%, rgba(147,197,253,0.15) 50%, transparent 75%)',
              pointerEvents: 'none',
            }}
          />
          {/* White ring */}
          <div
            style={{
              position: 'absolute',
              inset: -5,
              borderRadius: '50%',
              background: 'white',
              boxShadow: '0 0 0 2.5px #60a5fa, 0 8px 32px rgba(59,130,246,0.22)',
              pointerEvents: 'none',
            }}
          />
          {/* Photo */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              overflow: 'hidden',
              background: '#dde5f4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            {mainPersonPhoto ? (
              <img
                src={mainPersonPhoto}
                alt={mainPerson}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <User style={{ width: 36, height: 36, color: '#94a3b8' }} />
            )}
          </div>
          {/* Center name — bold, dark, slightly left of center like reference */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: 16,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#1e3a5f',
                fontFamily: '"Inter", system-ui, sans-serif',
                letterSpacing: '-0.02em',
              }}
            >
              – {mainPerson || 'Subject'}
            </span>
          </div>
        </div>

        {/* ── SATELLITE NODES ── */}
        {nodes.map(node => {
          const isSelected = selectedId === node.id
          const bc = genderBorderColor(node.gender)

          // Popup position: directly below the node circle, left-aligned with it
          // (just like in the reference — popup appears below-right of Anar Singh)
          const a = node.angle
          const goRight = Math.cos(a) >= 0
          const POPUP_W = 230
          const popupLeft = goRight
            ? node.x - MEMBER_R
            : node.x - POPUP_W + MEMBER_R
          const popupTop = node.y + MEMBER_R + 16

          const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation()
            setSelectedId(prev => (prev === node.id ? null : node.id))
          }

          return (
            <div
              key={node.id}
              className="np"
              style={{ position: 'absolute', zIndex: isSelected ? 40 : 10 }}
            >
              {/* Circle */}
              <div
                style={{
                  position: 'absolute',
                  left: node.x - MEMBER_R,
                  top: node.y - MEMBER_R,
                  width: MEMBER_R * 2,
                  height: MEMBER_R * 2,
                  cursor: 'pointer',
                }}
                onClick={handleClick}
              >
                {/* Gender outer ring */}
                <div
                  style={{
                    position: 'absolute',
                    inset: -4,
                    borderRadius: '50%',
                    border: `2px solid ${bc}`,
                    pointerEvents: 'none',
                  }}
                />
                {/* Photo */}
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: '#e8eef8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isSelected
                      ? '0 0 0 2.5px #3b82f6, 0 4px 20px rgba(59,130,246,0.2)'
                      : '0 2px 14px rgba(0,0,0,0.09)',
                    transition: 'box-shadow 0.18s',
                  }}
                >
                  {node.photo ? (
                    <img
                      src={node.photo}
                      alt={node.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <User style={{ width: 26, height: 26, color: '#94a3b8' }} />
                  )}
                </div>
              </div>

              {/* Name + Relation below circle */}
              <div
                style={{
                  position: 'absolute',
                  left: node.x - 80,
                  top: node.y + MEMBER_R + 10,
                  width: 160,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
                onClick={handleClick}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: isSelected ? '#2563eb' : '#1e3a5f',
                    fontFamily: '"Inter", system-ui, sans-serif',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.15s',
                  }}
                >
                  {node.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: '#94a3b8',
                    fontFamily: '"Inter", system-ui, sans-serif',
                    textAlign: 'center',
                    marginTop: 2,
                    textTransform: 'capitalize',
                  }}
                >
                  {node.relation}
                </span>
              </div>

              {/* ── POPUP — exactly like reference image ── */}
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    left: popupLeft,
                    top: popupTop,
                    width: POPUP_W,
                    zIndex: 60,
                    background: 'white',
                    borderRadius: 14,
                    // Exact shadow from reference — soft, no harsh borders
                    boxShadow: '0 4px 24px rgba(30,58,138,0.10), 0 1px 4px rgba(0,0,0,0.06)',
                    padding: '16px 18px 18px 18px',
                    pointerEvents: 'auto',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Bold name — large */}
                  <p
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#1e3a5f',
                      fontFamily: '"Inter", system-ui, sans-serif',
                      margin: '0 0 8px 0',
                      lineHeight: 1.3,
                    }}
                  >
                    {node.name}
                  </p>

                  {/* Details — plain text lines, no labels, no bold — exactly like reference */}
                  {node.parsedDetails.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {node.parsedDetails.map((d, i) => (
                        <p
                          key={i}
                          style={{
                            fontSize: 13,
                            color: '#475569',
                            fontFamily: '"Inter", system-ui, sans-serif',
                            lineHeight: 1.55,
                            margin: 0,
                          }}
                        >
                          {d}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p
                      style={{
                        fontSize: 12,
                        color: '#b0bec5',
                        fontStyle: 'italic',
                        margin: 0,
                        fontFamily: '"Inter", system-ui, sans-serif',
                      }}
                    >
                      No details available
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}




