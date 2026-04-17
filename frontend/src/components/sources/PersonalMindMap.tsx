'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { User } from 'lucide-react'
import apiClient from '@/lib/api/client'

export const nodeImageStore = new Map<string, string>()

// Fields to skip (legal/procedural noise)
const SKIP_KEYS = new Set([
  'previous involvements-', 'action taken', 'case registered fir no.  etc',
  'source country ( in case of recovery of explosives/ arms/ammunition or ficn',
  'route of smuggling', 'name & addresses of carrier (s)',
  'intended recipients (s) name and addresses', 'repayment system',
  'visit to india details,( in case of foreigners)', 'circumstances of arrest',
  'arrested by', 'place of arrest', 'police station',
  'residential address during his/her studies',
  'details of close friends during studies',
  'country visited', 'sympathizer /links with politician, lawyers, intellectual, socio religious organizations',
  'details if undergone with military training',
])

function shouldSkip(key: string, val: string): boolean {
  const kl = key.toLowerCase()
  const vl = val.toLowerCase().trim()
  if (!vl || vl === 'n/a' || vl === 'nil' || vl === '-' || vl === 'none' || vl === 'not applicable' || vl === 'not available') return true
  if (SKIP_KEYS.has(kl)) return true
  if (kl.includes('previous involvements')) return true
  if (kl.includes('status of case') || kl.includes('status of accused')) return true
  if (kl.includes('fir no') && kl.includes('u/s')) return true
  return false
}

// Color per field category
function getFieldColor(key: string): { bg: string; text: string; border: string } {
  const k = key.toLowerCase()
  if (k.includes('status') || k.includes('criminal') || k.includes('gangster') || k.includes('social status')) return { bg: '#fff1f2', text: '#be123c', border: '#fecdd3' }
  if (k.includes('height') || k.includes('build') || k.includes('face') || k.includes('head')) return { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' }
  if (k.includes('eye') || k.includes('hair') || k.includes('complexion') || k.includes('moustache') || k.includes('beard')) return { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' }
  if (k.includes('mark') || k.includes('identification') || k.includes('tattoo')) return { bg: '#fffbeb', text: '#b45309', border: '#fde68a' }
  if (k.includes('dress') || k.includes('wearing') || k.includes('spectacle')) return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' }
  if (k.includes('occupation') || k.includes('expertise') || k.includes('modus')) return { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' }
  if (k.includes('network') || k.includes('financer') || k.includes('economic')) return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }
  return { bg: '#ffffff', text: '#374151', border: '#e5e7eb' }
}

interface Props {
  data: Record<string, string>
  mainPerson: string
  sourceId: string
  sourceImageUrl?: string
}

export function PersonalMindMap({ data, mainPerson, sourceId, sourceImageUrl }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const centerId = `center_${sourceId}`
  const [photoUrl, setPhotoUrl] = useState(nodeImageStore.get(centerId) || '')
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1000, h: 650 })

  // Load photo
  useEffect(() => {
    const stored = nodeImageStore.get(centerId)
    if (stored) { setPhotoUrl(stored); return }
    if (!sourceImageUrl) return
    if (sourceImageUrl.includes('/download') || sourceImageUrl.includes('/api/')) {
      const path = sourceImageUrl.startsWith('/api') ? sourceImageUrl.slice(4) : sourceImageUrl
      apiClient.get(path, { responseType: 'blob' })
        .then((res) => {
          const ct = String(res.headers['content-type'] || '')
          if (ct.startsWith('image/') || ct.includes('octet')) {
            setPhotoUrl(URL.createObjectURL(res.data))
          }
        })
        .catch(() => {})
    } else {
      setPhotoUrl(sourceImageUrl)
    }
  }, [centerId, sourceImageUrl])

  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const obs = new ResizeObserver((e) => {
      const r = e[0].contentRect
      setSize({ w: Math.max(800, r.width), h: Math.max(560, r.height) })
    })
    obs.observe(el); return () => obs.disconnect()
  }, [])

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = ev.target?.result as string
      nodeImageStore.set(centerId, url)
      setPhotoUrl(url)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Filter fields
  const fields = useMemo(() =>
    Object.entries(data || {})
      .filter(([k, v]) => !shouldSkip(k, String(v ?? '')))
      .map(([k, v]) => ({ key: k, value: String(v).trim() })),
    [data]
  )

  // Group fields
  const { leftFields, rightFields, bottomFields, specialFields } = useMemo(() => {
    const left: typeof fields = []
    const right: typeof fields = []
    const bottom: typeof fields = []
    const special: typeof fields = []

    fields.forEach((f) => {
      const k = f.key.toLowerCase()
      if (k.includes('address') || k.includes('village') || k.includes('place of birth') || k.includes('permanent address') || k.includes('present address') || k.includes('hide out')) {
        bottom.push(f)
      } else if (k.includes('facebook') || k.includes('email') || k.includes('e mail') || k.includes('fb id') || k.includes('phone') || k.includes('telephone') || k.includes('e-mail') || k.includes('e mail/fb')) {
        special.push(f)
      } else if (k.includes('name') || k.includes('parent') || k.includes('dob') || k.includes('date of birth') || k.includes('age') || k.includes('alias') || k.includes('code name') || k.includes('nationality') || k.includes('marital') || k.includes('religion') || k.includes('caste') || k.includes('social status')) {
        left.push(f)
      } else {
        right.push(f)
      }
    })
    return { leftFields: left, rightFields: right, bottomFields: bottom, specialFields: special }
  }, [fields])

  const { w, h } = size
  const cx = w / 2
  const cy = h / 2
  const centerR = 76

  // Right nodes: two columns, vertically centered
  const colSpacing = 72
  const col1 = rightFields.filter((_, i) => i % 2 === 0)
  const col2 = rightFields.filter((_, i) => i % 2 === 1)
  const col1X = cx + 270
  const col2X = cx + 430

  const rightNodes = [
    ...col1.map((f, i) => ({ ...f, x: col1X, y: cy - ((col1.length - 1) * colSpacing) / 2 + i * colSpacing })),
    ...col2.map((f, i) => ({ ...f, x: col2X, y: cy - ((col2.length - 1) * colSpacing) / 2 + i * colSpacing })),
  ]

  // Special nodes bottom-left
  const specialNodes = specialFields.map((f, i) => ({
    ...f, x: cx - 270, y: cy + 160 + i * 72,
  }))

  const allLineTargets = [...rightNodes, ...specialNodes]
  const bottomY = cy + 230

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #ddeeff 0%, #f0f5fc 60%, #f8fafc 100%)' }}
    >
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      {/* SVG lines */}
      <svg className="absolute inset-0 pointer-events-none" width={w} height={h} style={{ zIndex: 1 }}>
        {rightNodes.map((n, i) => (
          <path key={`r${i}`} d={`M ${cx} ${cy} Q ${cx + 100} ${cy} ${n.x - 75} ${n.y}`} stroke="#c0d0e0" strokeWidth={1.5} fill="none" />
        ))}
        {specialNodes.map((n, i) => (
          <path key={`s${i}`} d={`M ${cx} ${cy} Q ${cx - 100} ${cy + 60} ${n.x + 80} ${n.y}`} stroke="#c0d0e0" strokeWidth={1.5} fill="none" />
        ))}
        {bottomFields.length > 0 && (
          <path d={`M ${cx} ${cy} Q ${cx} ${cy + 80} ${cx} ${bottomY - 30}`} stroke="#c0d0e0" strokeWidth={1.5} fill="none" />
        )}
        {rightNodes.map((n, i) => <circle key={`dr${i}`} cx={n.x - 75} cy={n.y} r={4} fill="#a0b8cc" />)}
        {specialNodes.map((n, i) => <circle key={`ds${i}`} cx={n.x + 80} cy={n.y} r={4} fill="#a0b8cc" />)}
        {bottomFields.length > 0 && <circle cx={cx} cy={bottomY - 30} r={4} fill="#a0b8cc" />}
      </svg>

      {/* ── Center photo ── */}
      <div
        className="absolute cursor-pointer group"
        style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)', zIndex: 10 }}
        onClick={() => fileRef.current?.click()}
        title="Click to upload photo"
      >
        <div className="absolute rounded-full pointer-events-none" style={{ width: 220, height: 220, left: -110, top: -110, background: 'radial-gradient(circle, rgba(59,130,246,0.28) 0%, transparent 70%)' }} />
        <div className="absolute rounded-full" style={{ width: 174, height: 174, left: -87, top: -87, background: '#3b82f6' }} />
        <div className="absolute rounded-full bg-white" style={{ width: 168, height: 168, left: -84, top: -84 }} />
        <div className="rounded-full overflow-hidden bg-blue-50 flex items-center justify-center relative" style={{ width: 160, height: 160 }}>
          {photoUrl ? (
            <img src={photoUrl} alt={mainPerson} className="w-full h-full object-cover" onError={() => setPhotoUrl('')} />
          ) : (
            <User className="text-blue-200" style={{ width: 80, height: 80 }} />
          )}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
            <span className="text-white text-2xl">📷</span>
          </div>
        </div>
        <div className="absolute text-center pointer-events-none" style={{ top: 168, left: '50%', transform: 'translateX(-50%)', width: 200 }}>
          <p className="font-bold text-blue-700 text-sm mt-2 text-center leading-tight">
            {mainPerson.length > 26 ? mainPerson.slice(0, 24) + '…' : mainPerson}
          </p>
        </div>
      </div>

      {/* ── Left info card ── */}
      {leftFields.length > 0 && (
        <div
          className="absolute bg-white/95 shadow-xl rounded-2xl border border-slate-100 overflow-hidden"
          style={{ left: Math.max(12, cx - 450), top: cy - 140, width: 220, maxHeight: 320, zIndex: 8 }}
        >
          <div className="bg-blue-600 px-4 py-2">
            <p className="font-bold text-white text-sm leading-tight truncate">{mainPerson.length > 22 ? mainPerson.slice(0, 20) + '…' : mainPerson}</p>
          </div>
          <div className="px-4 py-3 overflow-y-auto" style={{ maxHeight: 260 }}>
            {leftFields.map((f) => (
              <div key={f.key} className="mb-2">
                <p className="text-xs text-slate-400 font-medium capitalize leading-tight">{f.key.replace(/_/g, ' ')}</p>
                <p className="text-sm text-slate-800 font-semibold leading-tight break-words">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Right chip nodes ── */}
      {rightNodes.map((node) => {
        const c = getFieldColor(node.key)
        return (
          <div
            key={node.key}
            className="absolute shadow-md rounded-2xl border"
            style={{
              left: node.x, top: node.y,
              transform: 'translate(-50%, -50%)',
              padding: '8px 14px',
              minWidth: 110, maxWidth: 175,
              background: c.bg, color: c.text, borderColor: c.border,
              zIndex: 6,
            }}
          >
            <p className="text-xs opacity-60 font-medium capitalize leading-tight mb-0.5">{node.key.replace(/_/g, ' ')}</p>
            <p className="text-sm font-bold leading-tight">{node.value.length > 22 ? node.value.slice(0, 20) + '…' : node.value}</p>
          </div>
        )
      })}

      {/* ── Special nodes (Facebook, Phone, etc.) ── */}
      {specialNodes.map((node) => (
        <div
          key={node.key}
          className="absolute bg-blue-600 text-white shadow-lg rounded-2xl border border-blue-500"
          style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)', padding: '8px 14px', minWidth: 150, maxWidth: 240, zIndex: 6 }}
        >
          <p className="text-xs opacity-80 font-medium capitalize leading-tight mb-0.5">{node.key.replace(/_/g, ' ')}</p>
          <p className="text-xs font-semibold leading-tight break-all">{node.value.length > 35 ? node.value.slice(0, 33) + '…' : node.value}</p>
        </div>
      ))}

      {/* ── Bottom address card ── */}
      {bottomFields.length > 0 && (
        <div
          className="absolute bg-white/95 shadow-xl rounded-2xl border border-slate-100 text-center"
          style={{ left: cx, top: bottomY, transform: 'translateX(-50%)', padding: '12px 20px', minWidth: 200, maxWidth: 320, zIndex: 8 }}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <span className="text-base">📍</span>
            <h3 className="font-bold text-slate-700 text-sm">Address</h3>
          </div>
          {/* Deduplicate addresses */}
          {Array.from(new Set(bottomFields.map((f) => f.value))).slice(0, 2).map((v, i) => (
            <p key={i} className="text-sm text-slate-600 leading-relaxed">{v}</p>
          ))}
        </div>
      )}

      {/* Field count */}
      <div className="absolute bottom-3 right-3 text-xs text-slate-400 bg-white/70 rounded-lg px-2 py-1 pointer-events-none" style={{ zIndex: 15 }}>
        {fields.length} fields · click photo to change
      </div>
    </div>
  )
}
