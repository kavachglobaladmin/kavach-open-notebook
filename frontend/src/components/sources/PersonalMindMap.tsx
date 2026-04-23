// 'use client'

// import { useEffect, useRef, useState, useMemo } from 'react'
// import { User, MapPin, Facebook, Phone, ShieldAlert, BookOpen, Users, Smile, CreditCard, Briefcase } from 'lucide-react'

// const nodeImageStore = new Map<string, string>()
// export { nodeImageStore }

// interface PersonalMindMapProps {
//   data: Record<string, string>
//   mainPerson: string
//   sourceId: string
//   sourceImageUrl?: string
// }

// const has = (k: string, terms: string[]) => terms.some(t => k.toLowerCase().includes(t))
// const EMPTY = new Set(['n.a.', 'n.a', 'nil', '-', '', 'not applicable', 'not available', 'none', 'not mentioned'])
// const blank = (v: string) => EMPTY.has(v.toLowerCase().trim())

// // Keys that go into the LEFT identity summary card
// const IDENTITY_K = ['parentage', 'father', 'date of birth', 'dob', 'age', 'nationality', 'religion', 'caste', 'marital', 'sex', 'gender', 'complexion']
// // Keys that go into RIGHT physical pills
// const PHYSICAL_K = ['height', 'weight', 'build', 'eyes', 'hair', 'moustache', 'beard', 'head', 'face', 'descriptive roll', 'mark of identification', 'identification mark']
// // Address
// const ADDRESS_K  = ['present address', 'permanent address', 'place of birth', 'residential address']
// // Social / contact
// const SOCIAL_K   = ['facebook', 'e mail', 'email', 'fb id', 'social media', 'instagram', 'fb ids', 'facebook or other']
// const PHONE_K    = ['phone', 'telephone', 'mobile', 'contact number', 'telephone nos', 'phone numbers']
// // Skip entirely
// const SKIP_K     = ['name', 'code name', 'alias', 'sr no', 'serial', 'social status', 'occupation']
// // These go to dedicated "detail" cards in the top area
// const DETAIL_K   = ['education', 'qualification', 'habit', 'close friend', 'details of close', 'occupation before', 'expertise', 'modus', 'economic status', 'details of code']

// function getDetailIcon(k: string) {
//   const l = k.toLowerCase()
//   if (l.includes('education') || l.includes('qualification')) return <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
//   if (l.includes('friend') || l.includes('associate'))        return <Users className="w-3.5 h-3.5 text-blue-500" />
//   if (l.includes('habit'))                                    return <Smile className="w-3.5 h-3.5 text-green-500" />
//   if (l.includes('occupation') || l.includes('expertise'))    return <Briefcase className="w-3.5 h-3.5 text-orange-500" />
//   if (l.includes('code') || l.includes('economic'))          return <CreditCard className="w-3.5 h-3.5 text-purple-500" />
//   return <BookOpen className="w-3.5 h-3.5 text-slate-400" />
// }

// const CARD_W = 210

// export function PersonalMindMap({ data, mainPerson, sourceId, sourceImageUrl }: PersonalMindMapProps) {
//   const containerRef = useRef<HTMLDivElement>(null)
//   const fileRef      = useRef<HTMLInputElement>(null)
//   const centerId     = `center_${sourceId}`

//   const [photoUrl, setPhotoUrl] = useState(nodeImageStore.get(centerId) || sourceImageUrl || '')
//   const [size, setSize]         = useState({ w: 1000, h: 700 })
//   const [scale, setScale]       = useState(1)
//   const [pan, setPan]           = useState({ x: 0, y: 0 })
//   const [dragging, setDragging] = useState(false)
//   const drag0 = useRef({ x: 0, y: 0 })

//   useEffect(() => {
//     if (sourceImageUrl && !nodeImageStore.get(centerId)) setPhotoUrl(sourceImageUrl)
//   }, [sourceImageUrl, centerId])

//   useEffect(() => {
//     const el = containerRef.current; if (!el) return
//     const ro = new ResizeObserver(([e]) => {
//       const r = e.contentRect
//       setSize({ w: Math.max(900, r.width), h: Math.max(600, r.height) })
//     })
//     ro.observe(el); return () => ro.disconnect()
//   }, [])

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

//   const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const f = e.target.files?.[0]; if (!f) return
//     const r = new FileReader()
//     r.onload = ev => { const u = ev.target?.result as string; nodeImageStore.set(centerId, u); setPhotoUrl(u) }
//     r.readAsDataURL(f); e.target.value = ''
//   }

//   // ── categorise & deduplicate ──────────────────────────────────────────────
//   const cat = useMemo(() => {
//     const identity: [string, string][] = []
//     const physical: [string, string][] = []
//     const addresses: [string, string][] = []
//     const socials:   [string, string][] = []
//     const phones:    [string, string][] = []
//     const details:   [string, string][] = []   // education, habits, friends, etc.
//     const seenVals = new Set<string>()
//     const seenKeys = new Set<string>()

//     Object.entries(data).forEach(([k, v]) => {
//       if (has(k, SKIP_K)) return   // social status & occupation skipped (shown in badge)
//       if (blank(v)) return
//       const nk = k.toLowerCase().trim()
//       const nv = v.toLowerCase().trim()
//       if (seenKeys.has(nk)) return; seenKeys.add(nk)
//       if (seenVals.has(nv)) return; seenVals.add(nv)

//       if (has(k, IDENTITY_K))      identity.push([k, v])
//       else if (has(k, PHYSICAL_K)) physical.push([k, v])
//       else if (has(k, ADDRESS_K))  addresses.push([k, v])
//       else if (has(k, SOCIAL_K))   socials.push([k, v])
//       else if (has(k, PHONE_K))    phones.push([k, v])
//       else if (has(k, DETAIL_K))   details.push([k, v])
//       // everything else is silently dropped to avoid clutter
//     })
//     return { identity, physical, addresses, socials, phones, details }
//   }, [data])

//   const isCriminal =
//     (data['Occupation'] || '').toLowerCase().includes('crime') ||
//     (data['Social Status'] || '').toLowerCase().includes('criminal') ||
//     (data['Social Status'] || '').toLowerCase().includes('gangster')

//   const contacts = [...cat.socials, ...cat.phones]

//   // ── layout ────────────────────────────────────────────────────────────────
//   const cx = size.w / 2
//   const cy = size.h / 2
//   const CR = 82

//   // LEFT: identity card
//   const leftCardX = Math.max(CARD_W + 20, cx - 300)
//   const leftCardY = cy

//   // RIGHT: physical pills stacked
//   const rightX = Math.min(size.w - CARD_W - 20, cx + 300)
//   const PH = 46, PG = 10
//   const physTotal = cat.physical.length * (PH + PG) - PG
//   const physStartY = cy - physTotal / 2

//   // BOTTOM: address
//   const botY = Math.min(size.h - 130, cy + 220)

//   // BOTTOM-LEFT: contacts stacked
//   const contX = Math.max(CARD_W / 2 + 20, cx - 290)
//   const contStartY = cy + 110

//   // TOP: detail cards spread evenly across top half
//   // Spread from top-left to top-right in a horizontal row
//   const detailCards = cat.details.slice(0, 6)
//   const topY = Math.max(80, cy - 230)
//   const topSpread = Math.min(size.w - CARD_W - 40, 700)
//   const topStartX = cx - topSpread / 2 + CARD_W / 2

//   // ── edge point helper ─────────────────────────────────────────────────────
//   const edgePt = (tx: number, ty: number) => {
//     const a = Math.atan2(ty - cy, tx - cx)
//     return { x: cx + (CR + 5) * Math.cos(a), y: cy + (CR + 5) * Math.sin(a) }
//   }

//   return (
//     <div
//       ref={containerRef}
//       className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#eef3fb] to-[#f8faff] select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
//       onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
//     >
//       <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

//       <div className="absolute bottom-3 left-3 z-50 pointer-events-none text-[11px] text-slate-400 bg-white/80 px-2 py-1 rounded-lg border border-slate-100">
//         {Math.round(scale * 100)}% • Scroll to zoom • Drag to pan
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
//           {/* identity */}
//           {cat.identity.length > 0 && (() => {
//             const e = edgePt(leftCardX, leftCardY)
//             return <line x1={e.x} y1={e.y} x2={leftCardX + CARD_W / 2} y2={leftCardY} stroke="#93c5fd" strokeWidth={1.5} opacity={0.8} strokeLinecap="round" />
//           })()}

//           {/* physical pills */}
//           {cat.physical.map((_, i) => {
//             const py = physStartY + i * (PH + PG) + PH / 2
//             const e = edgePt(rightX + CARD_W / 2, py)
//             return <line key={i} x1={e.x} y1={e.y} x2={rightX} y2={py} stroke="#93c5fd" strokeWidth={1.5} opacity={0.8} strokeLinecap="round" />
//           })}

//           {/* address */}
//           {cat.addresses[0] && (() => {
//             const e = edgePt(cx, botY)
//             return <line x1={e.x} y1={e.y} x2={cx} y2={botY} stroke="#93c5fd" strokeWidth={1.5} opacity={0.8} strokeLinecap="round" />
//           })()}

//           {/* contacts */}
//           {contacts.map((_, i) => {
//             const ty = contStartY + i * 85
//             const e = edgePt(contX, ty)
//             return <line key={i} x1={e.x} y1={e.y} x2={contX} y2={ty} stroke="#93c5fd" strokeWidth={1.5} opacity={0.8} strokeLinecap="round" />
//           })}

//           {/* detail cards (top) */}
//           {detailCards.map((_, i) => {
//             const step = detailCards.length > 1 ? topSpread / (detailCards.length - 1) : 0
//             const tx = topStartX + i * step
//             const e = edgePt(tx, topY)
//             return <line key={i} x1={e.x} y1={e.y} x2={tx} y2={topY + 30} stroke="#93c5fd" strokeWidth={1.5} opacity={0.8} strokeLinecap="round" />
//           })}

//           {/* edge dots */}
//           {[
//             cat.identity.length > 0 ? edgePt(leftCardX, leftCardY) : null,
//             ...cat.physical.map((_, i) => edgePt(rightX + CARD_W / 2, physStartY + i * (PH + PG) + PH / 2)),
//             cat.addresses[0] ? edgePt(cx, botY) : null,
//             ...contacts.map((_, i) => edgePt(contX, contStartY + i * 85)),
//             ...detailCards.map((_, i) => {
//               const step = detailCards.length > 1 ? topSpread / (detailCards.length - 1) : 0
//               return edgePt(topStartX + i * step, topY)
//             }),
//           ].filter(Boolean).map((pt, i) => (
//             <circle key={i} cx={pt!.x} cy={pt!.y} r={3.5} fill="#3b82f6" />
//           ))}
//         </svg>

//         {/* ── CENTER CIRCLE ── */}
//         <div
//           className="absolute np group"
//           style={{ left: cx - CR, top: cy - CR, width: CR * 2, height: CR * 2, zIndex: 20 }}
//           onClick={() => fileRef.current?.click()}
//         >
//           <div className="absolute inset-[-16px] rounded-full bg-blue-400/10 animate-pulse pointer-events-none" />
//           <div className="absolute inset-[-5px] rounded-full bg-blue-500 shadow-xl pointer-events-none" />
//           <div className="absolute inset-[-1px] rounded-full bg-white pointer-events-none" />
//           <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-100 cursor-pointer z-10">
//             {photoUrl
//               ? <img src={photoUrl} alt={mainPerson} className="w-full h-full object-cover" onError={() => setPhotoUrl('')} />
//               : <User className="w-1/2 h-1/2 text-slate-300" />
//             }
//             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-semibold transition-opacity">
//               Upload Photo
//             </div>
//           </div>
//           <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white border border-slate-200 rounded-full px-3 py-1 shadow-sm pointer-events-none">
//             <span className="text-[13px] font-extrabold text-slate-800">{mainPerson || 'Subject'}</span>
//           </div>
//         </div>

//         {/* ── LEFT: Identity summary card ── */}
//         {cat.identity.length > 0 && (
//           <div
//             className="absolute np bg-white rounded-2xl shadow-md border border-slate-200 p-4"
//             style={{ left: leftCardX - CARD_W / 2, top: leftCardY, transform: 'translate(0,-50%)', width: CARD_W, zIndex: 10 }}
//           >
//             <p className="text-[15px] font-extrabold text-slate-900 mb-2 leading-tight">
//               {mainPerson || 'Profile'}
//             </p>
//             <div className="h-px bg-slate-100 mb-2" />
//             <div className="space-y-1.5">
//               {cat.identity.map(([k, v]) => (
//                 <div key={k} className="flex gap-1 text-[12px] leading-snug">
//                   <span className="text-slate-400 shrink-0 capitalize">{k}:</span>
//                   <span className="text-slate-700 font-semibold break-words">{v}</span>
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}

//         {/* ── RIGHT: Physical attribute pills ── */}
//         {cat.physical.map(([k, v], i) => {
//           const py = physStartY + i * (PH + PG) + PH / 2
//           return (
//             <div
//               key={k}
//               className="absolute np bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-2.5 flex items-center gap-2"
//               style={{ left: rightX, top: py, transform: 'translate(0,-50%)', minWidth: 160, maxWidth: CARD_W, zIndex: 10 }}
//             >
//               <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
//               <span className="text-[13px] text-slate-700 whitespace-nowrap">
//                 <span className="text-slate-400 capitalize">{k}: </span>
//                 <span className="font-bold text-slate-800">{v}</span>
//               </span>
//             </div>
//           )
//         })}

//         {/* ── BOTTOM-CENTER: Address + criminal badge ── */}
//         {cat.addresses[0] && (
//           <div
//             className="absolute np flex flex-col items-center"
//             style={{ left: cx, top: botY, transform: 'translate(-50%,0)', zIndex: 10 }}
//           >
//             <div className="bg-white rounded-t-xl shadow-sm border border-slate-200 p-3 w-[220px]">
//               <div className="flex items-start gap-2">
//                 <div className="bg-blue-50 p-1 rounded-full shrink-0 mt-0.5">
//                   <MapPin className="w-3.5 h-3.5 text-blue-500" />
//                 </div>
//                 <div>
//                   <div className="text-[11px] text-slate-400 font-semibold mb-0.5 capitalize">{cat.addresses[0][0]}</div>
//                   <div className="text-[12px] text-slate-700 font-medium leading-snug">{cat.addresses[0][1]}</div>
//                 </div>
//               </div>
//             </div>
//             {isCriminal && (
//               <div className="bg-red-500 rounded-b-xl px-4 py-1.5 flex items-center justify-center gap-1.5 w-[220px]">
//                 <ShieldAlert className="w-3.5 h-3.5 text-white" />
//                 <span className="text-[12px] text-white font-bold tracking-wide">Criminal / Gangster</span>
//               </div>
//             )}
//           </div>
//         )}

//         {/* ── BOTTOM-LEFT: Social / Phone ── */}
//         {contacts.map(([k, v], i) => (
//           <div
//             key={k}
//             className="absolute np bg-white rounded-xl shadow-sm border border-slate-200 p-3"
//             style={{ left: contX - CARD_W / 2, top: contStartY + i * 85, transform: 'translate(0,-50%)', width: CARD_W, zIndex: 10 }}
//           >
//             <div className="flex items-center gap-2 mb-1">
//               <div className="bg-blue-50 p-1 rounded-full shrink-0">
//                 {has(k, SOCIAL_K)
//                   ? <Facebook className="w-3.5 h-3.5 text-blue-600" />
//                   : <Phone className="w-3.5 h-3.5 text-blue-500" />
//                 }
//               </div>
//               <span className="text-[12px] font-bold text-slate-700 capitalize leading-tight">{k}</span>
//             </div>
//             <p className="text-[12px] text-blue-600 break-all leading-snug">{v}</p>
//           </div>
//         ))}

//         {/* ── TOP: Detail cards (education, habits, friends, etc.) ── */}
//         {detailCards.map(([k, v], i) => {
//           const step = detailCards.length > 1 ? topSpread / (detailCards.length - 1) : 0
//           const tx = topStartX + i * step
//           const isLong = v.length > 60
//           return (
//             <div
//               key={k}
//               className="absolute np bg-white rounded-xl shadow-sm border border-slate-200 p-3"
//               style={{
//                 left: tx,
//                 top: topY,
//                 transform: 'translate(-50%, 0)',
//                 width: isLong ? CARD_W + 10 : 'auto',
//                 maxWidth: CARD_W + 20,
//                 zIndex: 10,
//               }}
//             >
//               <div className="flex items-center gap-1.5 mb-1.5">
//                 <div className="bg-slate-50 p-1 rounded-full shrink-0">
//                   {getDetailIcon(k)}
//                 </div>
//                 <span className="text-[11px] font-bold text-slate-600 capitalize leading-tight">{k}</span>
//               </div>
//               <p className="text-[12px] text-slate-700 leading-relaxed break-words">{v}</p>
//             </div>
//           )
//         })}
//       </div>
//     </div>
//   )
// }





'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { User } from 'lucide-react'

const EMPTY = new Set(['', '-', 'n.a.', 'nil', 'none', 'not available'])
const blank = (v: string) => EMPTY.has(v.toLowerCase().trim())

export function PersonalMindMap({ data, mainPerson }: any) {
  const ref = useRef<HTMLDivElement>(null)

  const [size, setSize] = useState({ w: 1000, h: 700 })
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [drag, setDrag] = useState(false)
  const dragRef = useRef({ x: 0, y: 0 })

  // resize
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // zoom
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fn = (e: WheelEvent) => {
      e.preventDefault()
      setScale(s => Math.min(2.5, Math.max(0.4, s - e.deltaY * 0.001)))
    }
    el.addEventListener('wheel', fn, { passive: false })
    return () => el.removeEventListener('wheel', fn)
  }, [])

  // pan
  const onDown = (e: any) => {
    setDrag(true)
    dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const onMove = (e: any) => {
    if (!drag) return
    setPan({
      x: e.clientX - dragRef.current.x,
      y: e.clientY - dragRef.current.y
    })
  }

  const onUp = () => setDrag(false)

  // ─────────────────────────────
  // GROUP DATA
  // ─────────────────────────────
  // ─────────────────────────────
  // CLEAN + GROUP + DEDUPE
  // ─────────────────────────────
  const groups = useMemo(() => {
    const g = {
      identity: [] as any[],
      physical: [] as any[],
      address: [] as any[],
      contact: [] as any[],
      details: [] as any[],
    }

    const seen = new Set<string>()

    Object.entries(data).forEach(([k, v]) => {
      if (blank(v as string)) return

      const key = k.toLowerCase().trim()
      const val = (v as string).toLowerCase().trim()

      if (seen.has(key + val)) return
      seen.add(key + val)

      if (key.includes('birth') || key.includes('age') || key.includes('religion') || key.includes('name'))
        g.identity.push([k, v])

      else if (key.includes('height') || key.includes('mark') || key.includes('descriptive'))
        g.physical.push([k, v])

      else if (key.includes('address') || key.includes('place'))
        g.address.push([k, v])

      else if (key.includes('phone') || key.includes('facebook') || key.includes('email'))
        g.contact.push([k, v])

      else
        g.details.push([k, v])
    })

    return g
  }, [data])

  // ─────────────────────────────
  // IMPROVED LAYOUT ENGINE
  // ─────────────────────────────
  const cx = size.w / 2
  const cy = size.h / 2

  const rings = [
    { data: groups.identity, radius: 180 },
    { data: [...groups.physical, ...groups.address], radius: 340 },
    { data: [...groups.contact, ...groups.details], radius: 520 },
  ]

  let nodes: any[] = []

  rings.forEach((ring, ringIndex) => {
    const count = ring.data.length

    if (count === 0) return

    // better spacing
    const angleStart = -Math.PI / 2
    const angleEnd = Math.PI * 1.5
    const step = (angleEnd - angleStart) / count

    ring.data.forEach((n, i) => {
      const angle = angleStart + i * step

      nodes.push({
        key: n[0],
        value: n[1],
        x: cx + ring.radius * Math.cos(angle),
        y: cy + ring.radius * Math.sin(angle),
        angle,
        width: getWidth(n[1]),
        ring: ringIndex
      })
    })
  })


  // ─────────────────────────────
  // STRONG COLLISION FIX (UPGRADED)
  // ─────────────────────────────
  for (let iter = 0; iter < 80; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]

        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        const minDist = 120 // increased spacing

        if (dist < minDist) {
          const push = (minDist - dist) / 2
          const nx = dx / dist
          const ny = dy / dist

          a.x -= nx * push
          a.y -= ny * push
          b.x += nx * push
          b.y += ny * push
        }
      }
    }
  }
  const getWidth = (t: string) => {
    if (t.length > 120) return 260
    if (t.length > 60) return 220
    return 180
  }

  const trim = (t: string) => t.length > 120 ? t.slice(0, 120) + '...' : t

  return (
    <div
      ref={ref}
      className="w-full h-full relative overflow-hidden bg-gradient-to-br from-[#eef3fb] to-[#f8faff]"
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`,
          transformOrigin: `${cx}px ${cy}px`
        }}
      >
        {/* SVG LINES */}
        <svg className="absolute inset-0 pointer-events-none">
          {nodes.map((n, i) => (
            <path
              key={i}
              d={`M ${cx} ${cy} Q ${(cx + n.x)/2} ${(cy + n.y)/2 - 40} ${n.x} ${n.y}`}
              stroke="#93c5fd"
              fill="none"
            />
          ))}
        </svg>

        {/* CENTER */}
        <div
          style={{
            left: cx,
            top: cy,
            transform: 'translate(-50%, -50%)'
          }}
          className="absolute w-32 h-32 rounded-full bg-white shadow-xl flex items-center justify-center"
        >
          <User className="w-10 h-10 text-gray-300" />
        </div>

        <div
          className="absolute font-bold text-sm text-center"
          style={{
            left: cx,
            top: cy + 70,
            transform: 'translateX(-50%)'
          }}
        >
          {mainPerson}
        </div>

        {/* NODES */}
        {nodes.map((n, i) => (
          <div
            key={i}
            className="absolute bg-white rounded-xl shadow-md border p-3"
            style={{
              left: n.x,
              top: n.y,
              transform: 'translate(-50%, -50%)',
              width: Math.min(getWidth(n.value), 240),
              maxWidth: 240
            }}
          >
            <div className="text-xs text-gray-500 font-bold mb-1">
              {n.key}
            </div>
            <div className="text-sm font-semibold text-gray-800 break-words">
              {trim(n.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}