'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { 
  User, MapPin, Calendar, Flag, Heart, Ruler, Star, Users, BarChart2, 
  FileText, Shield, Briefcase, GraduationCap, Target, Activity, 
  Link, ScanFace
} from 'lucide-react'

const EMPTY = new Set(['', '-', 'n.a.', 'nil', 'none', 'not available'])
const blank = (v: string) => EMPTY.has(v.toLowerCase().trim())

// Helper to map personal details to specific small grey icons exactly as shown in the UI
const getPersonalDetailIcon = (key: string) => {
  const k = key.toLowerCase()
  if (k.includes('code name') || k.includes('alias')) return <FileText className="w-[14px] h-[14px] text-slate-400" />
  if (k.includes('parentage') || k.includes('father')) return <Users className="w-[14px] h-[14px] text-slate-400" />
  if (k.includes('date') || k.includes('dob')) return <Calendar className="w-[14px] h-[14px] text-slate-400" />
  if (k.includes('age')) return <User className="w-[14px] h-[14px] text-slate-400" />
  if (k.includes('nation')) return <Flag className="w-[14px] h-[14px] text-slate-400" />
  if (k.includes('marital')) return <Heart className="w-[14px] h-[14px] text-slate-400" />
  if (k.includes('descriptive') || k.includes('height') || k.includes('roll')) return <Ruler className="w-[14px] h-[14px] text-slate-400" />
  if (k.includes('place of birth') || k.includes('birth')) return <MapPin className="w-[14px] h-[14px] text-slate-400" />
  if (k.includes('religion')) return <Star className="w-[14px] h-[14px] text-slate-400" /> 
  if (k.includes('caste') || k.includes('tribe') || k.includes('sect')) return <Users className="w-[14px] h-[14px] text-slate-400" />
  if (k.includes('economic')) return <BarChart2 className="w-[14px] h-[14px] text-slate-400" />
  return <User className="w-[14px] h-[14px] text-slate-400" />
}

export function PersonalMindMap({ data = {}, mainPerson = 'Sandeep Jhanjhariya' }: any) {
  const ref = useRef<HTMLDivElement>(null)

  const [size, setSize] = useState({ w: 1000, h: 800 })
  const [scale, setScale] = useState(0.85) 
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [drag, setDrag] = useState(false)
  const dragRef = useRef({ x: 0, y: 0 })

  // Resize Listener
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

  // Zoom Listener
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fn = (e: WheelEvent) => {
      e.preventDefault()
      setScale(s => Math.min(2.5, Math.max(0.3, s - e.deltaY * 0.001)))
    }
    el.addEventListener('wheel', fn, { passive: false })
    return () => el.removeEventListener('wheel', fn)
  }, [])

  // Pan Logic
  const onDown = (e: any) => {
    if ((e.target as HTMLElement).closest('.interactive-card')) return
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
  // CLEAN + GROUP DATA INTO CARDS
  // ─────────────────────────────
  const buckets = useMemo(() => {
    const b = {
      personal: [] as any[],
      address: [] as any[],
      placeOfArrest: [] as any[],
      arrestedBy: [] as any[],
      expertise: [] as any[],
      occupation: [] as any[],
      habits: [] as any[],
      education: [] as any[],
      marks: [] as any[],
    }

    Object.entries(data).forEach(([k, v]) => {
      if (blank(v as string)) return
      const kLow = k.toLowerCase().trim()

      if (kLow.includes('mark') || kLow.includes('identification')) {
        b.marks.push([k, v])
      } else if (kLow.includes('arrest') && kLow.includes('place')) {
        b.placeOfArrest.push([k, v])
      } else if (kLow.includes('arrest') && (kLow.includes('by') || kLow.includes('officer'))) {
        b.arrestedBy.push([k, v])
      } else if (kLow.includes('address') && !kLow.includes('arrest')) {
        b.address.push([k, v])
      } else if (kLow.includes('expert') || kLow.includes('skill') || kLow.includes('modus') || kLow.includes('criminal act')) {
        b.expertise.push([k, v])
      } else if (kLow.includes('occup') || kLow.includes('job') || kLow.includes('work')) {
        b.occupation.push([k, v])
      } else if (kLow.includes('habit')) {
        b.habits.push([k, v])
      } else if (kLow.includes('edu') || kLow.includes('qual') || kLow.includes('school') || kLow.includes('college')) {
        b.education.push([k, v])
      } else if (['parentage', 'father', 'date of birth', 'dob', 'age', 'nationality', 'marital', 'descriptive', 'place of birth', 'religion', 'caste', 'tribe', 'sect', 'economic', 'code name', 'alias', 'gender', 'sex', 'complexion'].some(t => kLow.includes(t))) {
        b.personal.push([k, v])
      }
    })
    return b
  }, [data])

  // Helper to deduplicate array values and render them cleanly
  const renderUniqueValues = (items: any[], fallbackText: React.ReactNode) => {
    if (!items || items.length === 0) {
      return <div className="text-[12px] font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">{fallbackText}</div>
    }
    const uniqueVals = Array.from(new Set(items.map(item => item[1] as string)))
    return (
      <div className="flex flex-col">
        {uniqueVals.map((v, i) => (
          <p key={i} className="text-[12px] font-bold text-slate-800 leading-relaxed mb-2 last:mb-0 whitespace-pre-wrap">{v}</p>
        ))}
      </div>
    )
  }

  const cx = size.w / 2
  const cy = size.h / 2

  // Default layout structure matching the exact image provided
  const defaultPersonal = [
    ['Parentage', 'Rajender Singh'],
    ['Date Of Birth', '01.01.1984 (real-\n19.11.1983)'],
    ['Age', '37 years'],
    ['Nationality', 'Indian'],
    ['Marital Status', 'Unmarried'],
    ['Descriptive Roll', "5'9\""],
    ['Place Of Birth', 'Village Jathedi, District\nSonipat, PS Rai, Haryana'],
    ['Religion', 'Hindu'],
    ['Caste/Tribe/Sect', 'Jaat'],
    ['Economic Status', 'Medium class'],
    ['Details Of Code Name', 'Kala Jathedi']
  ]

  // Deduplicate personal items specifically
  const uniquePersonal = buckets.personal.filter((v, i, a) => a.findIndex(t => t[0] === v[0] && t[1] === v[1]) === i)
  const personalDataToRender = uniquePersonal.length > 0 ? uniquePersonal : defaultPersonal

  return (
    <div
      ref={ref}
      className={`w-full h-full relative overflow-hidden bg-white ${drag ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
    >
      <div className="absolute bottom-5 left-5 z-50 pointer-events-none text-[12px] font-medium text-slate-500 bg-white/90 shadow-sm px-4 py-2 rounded-full border border-slate-200">
        Zoom: {Math.round(scale * 100)}% • Drag canvas to pan
      </div>

      {/* PAN & ZOOM WRAPPER */}
      <div
        className="absolute inset-0 origin-center"
        style={{
          transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`,
          transformOrigin: `${cx}px ${cy}px`,
        }}
      >
        {/* EXACT MASONRY DASHBOARD LAYOUT - 3 FLEX COLUMNS */}
        <div 
          className="absolute flex items-start gap-4"
          style={{ 
            left: cx, 
            top: cy, 
            transform: 'translate(-50%, -50%)',
          }}
        >
          
          {/* ================= COLUMN 1 (Left) ================= */}
          <div className="flex flex-col gap-4 w-[320px] shrink-0">
            {/* Personal Details Card */}
            <div className="interactive-card relative overflow-hidden bg-white rounded-[12px] border border-slate-100 p-5 cursor-default shadow-[0_4px_20px_rgba(59,130,246,0.08)] hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)] hover:-translate-y-0.5 transition-all duration-300">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center gap-3 mb-1">
                <div className="bg-[#3b82f6] p-1.5 rounded-md shadow-sm shadow-blue-500/20">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-[15px] font-bold text-[#1e3a8a]">Personal Details</h3>
                  <div className="h-[2.5px] w-8 bg-[#3b82f6] rounded-full mt-[3px]" />
                </div>
              </div>
              
              <div className="relative z-10 flex flex-col mt-2">
                {personalDataToRender.map(([k, v], i) => (
                  <div key={i} className={`flex justify-between items-start py-[9px] ${i < personalDataToRender.length - 1 ? 'border-b border-slate-100' : ''}`}>
                    <div className="flex items-center gap-2 w-[48%]">
                      {getPersonalDetailIcon(k)}
                      <span className="text-[11.5px] font-medium text-slate-500 capitalize">{k}</span>
                    </div>
                    <span className="text-[11.5px] font-bold text-slate-800 text-right w-[52%] whitespace-pre-wrap leading-tight">
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mark of Identification */}
            <div className="interactive-card relative overflow-hidden bg-[#fff5f5] rounded-[12px] border border-[#ffe4e6] p-5 cursor-default shadow-[0_4px_20px_rgba(225,29,72,0.1)] hover:shadow-[0_8px_30px_rgba(225,29,72,0.2)] hover:-translate-y-0.5 transition-all duration-300">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center gap-3 mb-4 pb-3 border-b border-[#fecdd3]">
                <div className="bg-[#f43f5e] p-1.5 rounded-md shadow-sm shadow-rose-500/20">
                  <ScanFace className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-[14px] font-bold text-[#be123c]">Mark Of Identification</h3>
              </div>
              <div className="relative z-10 flex flex-col">
                {renderUniqueValues(buckets.marks, 'Cut mark on both eyebrows')}
              </div>
            </div>
          </div>

          {/* ================= COLUMN 2 (Center) ================= */}
          <div className="flex flex-col gap-4 w-[280px] shrink-0">
            {/* Profile Card */}
            <div className="interactive-card bg-[#f8fbff] rounded-[12px] border border-[#eff6ff] p-6 flex flex-col items-center relative overflow-hidden cursor-default shadow-[0_4px_25px_rgba(59,130,246,0.12)] hover:shadow-[0_10px_35px_rgba(59,130,246,0.2)] hover:-translate-y-0.5 transition-all duration-300">
              {/* Exact Dotted Grid Pattern Background */}
              <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(#cbd5e1_1.5px,transparent_1.5px)] [background-size:16px_16px] opacity-40" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#f8fbff]/80 pointer-events-none" />
              
              <div className="relative z-10 w-[100px] h-[100px] rounded-full p-1 border-[3px] border-[#60a5fa] bg-white shadow-[0_0_15px_rgba(96,165,250,0.4)] mb-4 mt-2 transition-transform duration-300 hover:scale-105">
                <div className="w-full h-full rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                  <User className="w-10 h-10 text-slate-300" />
                </div>
              </div>
              
              <h2 className="text-[17px] font-black text-slate-900 text-center relative z-10 mb-1 drop-shadow-sm">
                {mainPerson}
              </h2>
              {/* Blue underline under name matching reference */}
              <div className="h-[2.5px] w-8 bg-[#3b82f6] rounded-full mb-3 relative z-10" />
              
              {/* Replaced Handcuffs with Link icon, formatted to look correct */}
              <div className="bg-[#fff1f2] px-4 py-1.5 rounded-full flex items-center gap-2 border border-[#fecdd3] relative z-10 shadow-sm shadow-rose-100/50">
                <Link className="w-3.5 h-3.5 text-[#e11d48] -rotate-45" />
                <span className="text-[11.5px] font-bold text-[#be123c] tracking-wide">Criminal / Gangster</span>
              </div>
            </div>

            {/* Address */}
            <div className="interactive-card relative overflow-hidden bg-[#f0f9ff] rounded-[12px] border border-[#e0f2fe] p-5 cursor-default shadow-[0_4px_20px_rgba(56,189,248,0.1)] hover:shadow-[0_8px_30px_rgba(56,189,248,0.2)] hover:-translate-y-0.5 transition-all duration-300">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center gap-3 mb-3 border-b border-[#e0f2fe] pb-3">
                <div className="bg-[#3b82f6] p-1.5 rounded-md shadow-sm shadow-blue-500/20">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-[14px] font-bold text-[#1d4ed8]">Address</h3>
              </div>
              <div className="relative z-10">
                {renderUniqueValues(buckets.address, 'Village Jathedi, District Sonipat,\nPS Rai, Haryana')}
              </div>
            </div>

            {/* Arrested By */}
            <div className="interactive-card relative overflow-hidden bg-[#faf5ff] rounded-[12px] border border-[#f3e8ff] p-5 cursor-default shadow-[0_4px_20px_rgba(168,85,247,0.1)] hover:shadow-[0_8px_30px_rgba(168,85,247,0.2)] hover:-translate-y-0.5 transition-all duration-300">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/50 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center gap-3 mb-3 border-b border-[#f3e8ff] pb-3">
                <div className="bg-[#a855f7] p-1.5 rounded-md shadow-sm shadow-purple-500/20">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-[14px] font-bold text-[#7e22ce]">Arrested By</h3>
              </div>
              <div className="relative z-10">
                {renderUniqueValues(buckets.arrestedBy, 'ASI Bachchu Singh')}
              </div>
            </div>

            {/* Occupation Before Joining Crime */}
            <div className="interactive-card relative overflow-hidden bg-[#f0fdf4] rounded-[12px] border border-[#dcfce7] p-5 cursor-default shadow-[0_4px_20px_rgba(34,197,94,0.1)] hover:shadow-[0_8px_30px_rgba(34,197,94,0.2)] hover:-translate-y-0.5 transition-all duration-300">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/50 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center gap-3 mb-3 border-b border-[#dcfce7] pb-3">
                <div className="bg-[#22c55e] p-1.5 rounded-md shadow-sm shadow-green-500/20">
                  <Briefcase className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-[14px] font-bold text-[#15803d]">Occupation Before Joining Crime</h3>
              </div>
              <div className="relative z-10">
                {renderUniqueValues(buckets.occupation, 'Farming, was also preparing for\nvarious police exams')}
              </div>
            </div>

            {/* Education */}
            <div className="interactive-card relative overflow-hidden bg-[#f0f9ff] rounded-[12px] border border-[#e0f2fe] p-5 cursor-default shadow-[0_4px_20px_rgba(59,130,246,0.1)] hover:shadow-[0_8px_30px_rgba(59,130,246,0.2)] hover:-translate-y-0.5 transition-all duration-300">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center gap-3 mb-3 border-b border-[#e0f2fe] pb-3">
                <div className="bg-[#3b82f6] p-1.5 rounded-md shadow-sm shadow-blue-500/20">
                  <GraduationCap className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-[13px] font-bold text-[#1d4ed8] leading-tight">Educational Qualification<br/>And School Details</h3>
              </div>
              <div className="relative z-10">
                {renderUniqueValues(buckets.education, '12th passed from Ramjas\nInternational School, Sonipat,\nHaryana')}
              </div>
            </div>
          </div>

          {/* ================= COLUMN 3 (Right) ================= */}
          <div className="flex flex-col gap-4 w-[320px] shrink-0">
            {/* Place of Arrest */}
            <div className="interactive-card relative overflow-hidden bg-[#fffbeb] rounded-[12px] border border-[#fde68a] p-5 cursor-default shadow-[0_4px_20px_rgba(245,158,11,0.1)] hover:shadow-[0_8px_30px_rgba(245,158,11,0.2)] hover:-translate-y-0.5 transition-all duration-300">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/60 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center gap-3 mb-3 border-b border-[#fde68a] pb-3">
                <div className="bg-[#f59e0b] p-1.5 rounded-md shadow-sm shadow-amber-500/20">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-[14px] font-bold text-[#b45309]">Place Of Arrest</h3>
              </div>
              <div className="relative z-10">
                {renderUniqueValues(buckets.placeOfArrest, 'Near Sarwasa Toll Plaza, Yamunanagar -\nSaharanpur highway, UP')}
              </div>
            </div>

            {/* Expertise In Criminal Act */}
            <div className="interactive-card relative overflow-hidden bg-[#faf5ff] rounded-[12px] border border-[#f3e8ff] p-5 cursor-default shadow-[0_4px_20px_rgba(168,85,247,0.1)] hover:shadow-[0_8px_30px_rgba(168,85,247,0.2)] hover:-translate-y-0.5 transition-all duration-300">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/50 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center gap-3 mb-3 border-b border-[#f3e8ff] pb-3">
                <div className="bg-[#a855f7] p-1.5 rounded-md shadow-sm shadow-purple-500/20">
                  <Target className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-[14px] font-bold text-[#7e22ce]">Expertise In Criminal Act</h3>
              </div>
              <div className="relative z-10 flex flex-col">
                <p className="text-[12px] font-semibold text-slate-700 leading-relaxed mb-2 whitespace-pre-wrap">
                  {buckets.expertise.length > 0 
                    ? Array.from(new Set(buckets.expertise.map((item: any) => item[1] as string))).join(', ') 
                    : '(Driving Skill, Explosion Expert, Organizer,\nResourceful, Firing Skill Etc.)'}
                </p>
                <div className="border-t border-[#e9d5ff] my-2" />
                <p className="text-[12px] text-slate-600 leading-relaxed">Expert in driving, Firing skills</p>
              </div>
            </div>

            {/* Habits */}
            <div className="interactive-card relative overflow-hidden bg-[#f0fdfa] rounded-[12px] border border-[#ccfbf1] p-5 cursor-default shadow-[0_4px_20px_rgba(20,184,166,0.1)] hover:shadow-[0_8px_30px_rgba(20,184,166,0.2)] hover:-translate-y-0.5 transition-all duration-300">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/50 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center gap-3 mb-3 border-b border-[#ccfbf1] pb-3">
                <div className="bg-[#14b8a6] p-1.5 rounded-md shadow-sm shadow-teal-500/20">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-[14px] font-bold text-[#0f766e]">Habits</h3>
              </div>
              <div className="relative z-10 flex flex-col">
                {buckets.habits.length > 0
                  ? renderUniqueValues(buckets.habits, '')
                  : (
                    <div className="flex flex-col gap-1">
                      <p className="text-[12px] font-bold text-slate-800 leading-relaxed">Playing Kabaddi and Wrestling</p>
                      <p className="text-[12px] font-bold text-slate-800 leading-relaxed">Bad habits:- Afeem, Smoking Cigarette,<br/>Alcohol</p>
                    </div>
                  )
                }
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  )
}