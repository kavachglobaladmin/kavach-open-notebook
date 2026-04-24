'use client'

import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InfographicColumn {
  title: string
  description: string
  icon: string
}

export interface InfographicResponse {
  source_id: string
  document_type: 'mobile_cdr' | 'bank_statement' | 'ir_document' | 'gangster_profile' | 'general'
  header?: { title: string; subtitle: string }
  stat?: { value: string; label: string }

  // Person / Subject
  subject?: Record<string, string>
  personal?: Record<string, string>
  account?: Record<string, string>

  // Generic columns
  left_column?: InfographicColumn[]
  right_column?: InfographicColumn[]

  // CDR
  call_summary?: { outgoing?: string; incoming?: string; sms?: string; data?: string }
  top_contacts?: { number: string; type: string; calls: string }[]
  key_locations?: { area?: string; cell_id?: string; count: string }[]

  // Bank
  financial_summary?: Record<string, string>
  key_transactions?: { date: string; description: string; amount: string; type: 'credit' | 'debit'; balance?: string }[]

  // IR / Gangster
  associates?: { name: string; relation: string }[]
  case_details?: { fir_no: string; section: string; date: string; police_station: string; status: string }[]
  timeline_events?: { date: string; event: string }[]

  // Gangster profile specific
  aliases?: string[]
  distinct_identifiers?: string
  syndicate_alliances?: { name: string; color?: string }[]
  encrypted_comms?: string
  escape_events?: { year: string; description: string }[]
  skills?: string[]
  fir_snapshot?: { year: string; offence: string; jurisdiction: string }[]
  profile_summary?: Record<string, string>

  highlights?: { title: string; subtitle?: string; description: string }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clean(text: string): string {
  if (!text) return ''
  return text.replace(/\*{1,3}/g, '').replace(/_{1,3}/g, '').replace(/#+\s/g, '').trim()
}

function extractJson(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) return fence[1].trim()
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}')
  if (start !== -1 && end > start) return raw.slice(start, end + 1)
  return raw.trim()
}

// ── Shared UI pieces ──────────────────────────────────────────────────────────

const COLORS = {
  bg: '#0d1117',
  bgCard: '#1a1f2e',
  bgCardDark: '#131824',
  bgCardMid: '#1e2535',
  border: '#2d3550',
  red: '#e63946',
  gold: '#c9a84c',
  blue: '#4a90d9',
  text: '#f0f0f0',
  muted: '#a0aab8',
  green: '#22c55e',
  amber: '#f59e0b',
  purple: '#8b5cf6',
}

function SectionLabel({ children, color = COLORS.gold }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{
        fontFamily: 'Georgia, serif',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 3,
        color,
        textTransform: 'uppercase',
      }}>{children}</span>
      <div style={{ flex: 1, height: 0.5, background: color, opacity: 0.4 }} />
    </div>
  )
}

function DarkCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: COLORS.bgCard,
      border: `0.5px solid ${COLORS.border}`,
      borderRadius: 8,
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardHeader({ label, color = COLORS.gold }: { label: string; color?: string }) {
  return (
    <div style={{
      background: COLORS.bgCardMid,
      borderBottom: `0.5px solid ${COLORS.border}`,
      padding: '8px 14px',
    }}>
      <span style={{
        fontFamily: 'Georgia, serif',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 2,
        color,
        textTransform: 'uppercase',
      }}>{label}</span>
    </div>
  )
}

function KVRow({ label, value, valueColor = COLORS.text }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: '5px 0',
      borderBottom: `0.5px solid ${COLORS.border}`,
    }}>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 8, fontWeight: 700, color: COLORS.red, width: 120, flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, color: valueColor, flex: 1 }}>{value}</span>
    </div>
  )
}

// ── Gangster / IR Profile View ────────────────────────────────────────────────

export function GangsterProfileView({ data }: { data: InfographicResponse }) {
  const title = data.header?.title ?? 'Criminal Intelligence Profile'
  const subtitle = data.header?.subtitle ?? ''

  const aliases = data.aliases ?? Object.values(data.subject ?? {}).slice(0, 1)
  const primaryAlias = aliases[0] ?? '—'
  const alliances = data.syndicate_alliances ?? [
    { name: 'Lawrence Bishnoi Network', color: COLORS.blue },
    { name: clean(primaryAlias), color: COLORS.red },
    { name: 'Goldy Brar Criminal Network', color: COLORS.gold },
  ]
  const firRows = data.fir_snapshot ?? data.case_details?.map(c => ({
    year: c.date?.slice(0, 4) ?? '—',
    offence: `${c.section} — ${c.police_station}`,
    jurisdiction: c.status,
  })) ?? []

  const summaryEntries: [string, string][] = Object.entries(data.profile_summary ?? data.subject ?? {})
  const escapeEvents = data.escape_events ?? data.timeline_events?.slice(0, 2) ?? []
  const skills = data.skills ?? []
  const comms = data.encrypted_comms ?? ''

  return (
    <div style={{
      fontFamily: 'Georgia, serif',
      background: COLORS.bg,
      borderRadius: 12,
      overflow: 'hidden',
      color: COLORS.text,
    }}>

      {/* ── TOP BANNER ── */}
      <div style={{ background: COLORS.bgCard, borderBottom: `2px solid ${COLORS.red}`, padding: '10px 20px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 4, color: COLORS.red, textTransform: 'uppercase', marginBottom: 4 }}>
          Classified — Criminal Intelligence File
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1, color: COLORS.text, textTransform: 'uppercase' }}>
          {clean(title)}
        </div>
        {subtitle && (
          <div style={{ fontSize: 9, color: COLORS.muted, marginTop: 2 }}>{clean(subtitle)}</div>
        )}
      </div>

      {/* ── ROW 1: Face + Alias | Syndicate | High-tech ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 200px', gap: 12, padding: 16 }}>

        {/* Face + Alias */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Face card */}
          <DarkCard style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <svg width="100%" height="140" viewBox="0 0 160 140">
              {/* Network dots */}
              {[[20,20],[140,18],[15,120],[148,115],[80,10]].map(([cx,cy],i) => (
                <circle key={i} cx={cx} cy={cy} r={3} fill={COLORS.blue} opacity={0.5}/>
              ))}
              {[[20,20],[80,10],[140,18],[80,10],[20,20],[140,18]].reduce((acc,_,i,arr) => {
                if(i<arr.length-1) acc.push(<line key={i} x1={arr[i][0]} y1={arr[i][1]} x2={arr[i+1][0]} y2={arr[i+1][1]} stroke={COLORS.blue} strokeWidth={0.5} opacity={0.4}/>)
                return acc
              }, [] as React.ReactElement[])}
              {/* Head silhouette */}
              <circle cx={80} cy={62} r={32} fill={COLORS.bgCardMid}/>
              <ellipse cx={80} cy={128} rx={42} ry={22} fill={COLORS.bgCardMid}/>
              {/* Scar marks */}
              <line x1={68} y1={52} x2={74} y2={64} stroke={COLORS.red} strokeWidth={2} strokeLinecap="round"/>
              <line x1={86} y1={52} x2={92} y2={64} stroke={COLORS.red} strokeWidth={2} strokeLinecap="round"/>
              {/* Corner brackets */}
              <path d="M4 4 L4 14 M4 4 L14 4" stroke={COLORS.red} strokeWidth={1.5} fill="none"/>
              <path d="M156 4 L156 14 M156 4 L146 4" stroke={COLORS.red} strokeWidth={1.5} fill="none"/>
            </svg>
          </DarkCard>

          {/* Alias box */}
          <DarkCard style={{ border: `1px solid ${COLORS.red}`, padding: '10px 12px' }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: COLORS.red, textTransform: 'uppercase', marginBottom: 4 }}>High-Profile Alias</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, lineHeight: 1.2 }}>"{clean(primaryAlias)}"</div>
          </DarkCard>

          {/* Distinct identifiers */}
          {data.distinct_identifiers && (
            <DarkCard style={{ padding: '8px 12px' }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: COLORS.red, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Distinct Identifiers</div>
              <div style={{ fontSize: 8, color: COLORS.muted, lineHeight: 1.5 }}>{data.distinct_identifiers}</div>
            </DarkCard>
          )}
        </div>

        {/* Syndicate Alliances */}
        <div>
          <SectionLabel>Strategic Syndicate Alliances</SectionLabel>
          <DarkCard style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 170 }}>
            <svg width="100%" height="160" viewBox="0 0 300 160">
              {alliances.map((a, i) => {
                const cx = 60 + i * 90
                const color = a.color ?? [COLORS.blue, COLORS.red, COLORS.gold][i] ?? COLORS.muted
                const parts = a.name.split(' ')
                return (
                  <g key={i}>
                    <ellipse cx={cx} cy={80} rx={58} ry={42}
                      fill={i === 1 ? `${COLORS.red}22` : 'none'}
                      stroke={color} strokeWidth={i === 1 ? 2.5 : 2} opacity={0.9}/>
                    {parts.map((p, pi) => (
                      <text key={pi} x={cx} y={72 + pi * 14} textAnchor="middle"
                        fontFamily="Georgia, serif" fontSize={8} fontWeight={700} fill={color}>
                        {p}
                      </text>
                    ))}
                    {i < alliances.length - 1 && (
                      <circle cx={cx + 68} cy={80} r={3} fill="#fff" opacity={0.6}/>
                    )}
                  </g>
                )
              })}
            </svg>
          </DarkCard>
        </div>

        {/* High-tech coordination */}
        <div>
          <SectionLabel>High-Tech Coordination</SectionLabel>
          <DarkCard style={{ padding: 12 }}>
            <svg width="100%" height="120" viewBox="0 0 200 120">
              {/* Phone */}
              <rect x={120} y={8} width={52} height={84} fill={COLORS.bgCardMid} rx={8} stroke={COLORS.blue} strokeWidth={1.5}/>
              <rect x={126} y={14} width={40} height={66} fill={COLORS.bg} rx={4}/>
              <rect x={130} y={20} width={32} height={14} fill={COLORS.blue} rx={3} opacity={0.8}/>
              <rect x={130} y={40} width={24} height={10} fill={COLORS.border} rx={3} opacity={0.9}/>
              <rect x={130} y={56} width={28} height={10} fill={COLORS.blue} rx={3} opacity={0.5}/>
              <text x={146} y={106} textAnchor="middle" fontFamily="Georgia, serif" fontSize={9} fontWeight={700} fill={COLORS.blue}>WICKR</text>
              {/* Globe */}
              <circle cx={30} cy={55} r={18} fill="none" stroke={COLORS.blue} strokeWidth={1} opacity={0.6}/>
              <ellipse cx={30} cy={55} rx={9} ry={18} fill="none" stroke={COLORS.blue} strokeWidth={0.5} opacity={0.5}/>
              <line x1={12} y1={55} x2={48} y2={55} stroke={COLORS.blue} strokeWidth={0.5} opacity={0.5}/>
              {/* Lock */}
              <rect x={75} y={42} width={24} height={20} fill={COLORS.gold} rx={4} opacity={0.85}/>
              <path d="M79 42 Q79 32 87 32 Q95 32 95 42" fill="none" stroke={COLORS.gold} strokeWidth={2} opacity={0.9}/>
              <circle cx={87} cy={52} r={4} fill={COLORS.bg}/>
              {/* Users */}
              <circle cx={72} cy={20} r={10} fill={COLORS.bgCardMid} stroke={COLORS.blue} strokeWidth={1}/>
              <circle cx={72} cy={16} r={4} fill={COLORS.blue} opacity={0.7}/>
              <ellipse cx={72} cy={28} rx={6} ry={3} fill={COLORS.blue} opacity={0.5}/>
              {/* Lines */}
              <line x1={48} y1={55} x2={75} y2={52} stroke={COLORS.blue} strokeWidth={0.5} opacity={0.4} strokeDasharray="3,3"/>
              <line x1={99} y1={52} x2={120} y2={55} stroke={COLORS.gold} strokeWidth={0.5} opacity={0.5}/>
              <line x1={82} y1={20} x2={120} y2={40} stroke={COLORS.blue} strokeWidth={0.5} opacity={0.4} strokeDasharray="3,3"/>
            </svg>
            {comms && (
              <div style={{ marginTop: 4 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: COLORS.gold }}>Encrypted Comms: </span>
                <span style={{ fontSize: 8, color: COLORS.muted }}>{comms}</span>
              </div>
            )}
          </DarkCard>
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div style={{ height: 0.5, background: COLORS.border, margin: '0 16px' }}/>

      {/* ── ROW 2: Jailbreak | Dozens | Tactical ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 220px', gap: 12, padding: 16 }}>

        {/* Jailbreak / Escape Events */}
        <div>
          <SectionLabel color={COLORS.gold}>
            {escapeEvents.length > 0 ? `${escapeEvents[0]?.year ?? '2020'} Jailbreak` : 'Key Events'}
          </SectionLabel>
          <DarkCard style={{ padding: 12 }}>
            <svg width="100%" height="90" viewBox="0 0 180 90">
              {/* Pin */}
              <circle cx={20} cy={20} r={12} fill={COLORS.red}/>
              <circle cx={20} cy={18} r={5} fill="#fff"/>
              <polygon points="20,32 15,22 25,22" fill={COLORS.red}/>
              {/* Timeline line */}
              <line x1={20} y1={35} x2={20} y2={75} stroke={COLORS.red} strokeWidth={1.5}/>
              <circle cx={20} cy={77} r={4} fill={COLORS.red}/>
              {/* Van */}
              <rect x={40} y={35} width={80} height={38} fill={COLORS.bgCardMid} rx={4} stroke={COLORS.border} strokeWidth={0.5}/>
              <rect x={46} y={40} width={50} height={24} fill={COLORS.border} rx={3}/>
              <rect x={68} y={40} width={32} height={16} fill="#3a4560" rx={2}/>
              <circle cx={56} cy={74} r={6} fill={COLORS.bg} stroke={COLORS.blue} strokeWidth={1}/>
              <circle cx={102} cy={74} r={6} fill={COLORS.bg} stroke={COLORS.blue} strokeWidth={1}/>
              {/* Running figure */}
              <circle cx={136} cy={38} r={5} fill={COLORS.muted}/>
              <line x1={136} y1={43} x2={133} y2={56} stroke={COLORS.muted} strokeWidth={1.5}/>
              <line x1={133} y1={56} x2={129} y2={66} stroke={COLORS.muted} strokeWidth={1.5}/>
              <line x1={133} y1={56} x2={138} y2={66} stroke={COLORS.muted} strokeWidth={1.5}/>
              {/* Explosion */}
              <circle cx={125} cy={35} r={3} fill={COLORS.red} opacity={0.8}/>
              <circle cx={130} cy={28} r={2} fill={COLORS.gold} opacity={0.8}/>
              <circle cx={135} cy={32} r={2} fill={COLORS.red} opacity={0.6}/>
            </svg>
            {escapeEvents.map((e, i) => (
              <div key={i} style={{ marginTop: 6 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: COLORS.red }}>Daring Escape: </span>
                <span style={{ fontSize: 8, color: COLORS.muted }}>{e.description}</span>
              </div>
            ))}
          </DarkCard>
        </div>

        {/* Violent Portfolio */}
        <div>
          <SectionLabel>Extensive Violent Portfolio</SectionLabel>
          <DarkCard style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: COLORS.red,
              borderRadius: 6,
              padding: '12px 24px',
              width: '100%',
              textAlign: 'center',
              border: '1.5px solid rgba(255,255,255,0.3)',
              boxSizing: 'border-box',
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: 4 }}>
                {data.stat?.value ?? 'DOZENS'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,200,200,0.9)', letterSpacing: 2, marginTop: 2 }}>
                {data.stat?.label ?? 'OF CASES'}
              </div>
            </div>
            {data.highlights?.[0] && (
              <div style={{ fontSize: 8, color: COLORS.muted, textAlign: 'center' }}>
                <span style={{ color: COLORS.red, fontWeight: 700 }}>Involved in: </span>
                {data.highlights[0].description}
              </div>
            )}
          </DarkCard>
        </div>

        {/* Tactical Expertise */}
        <div>
          <SectionLabel>Expertise in Tactical Operations</SectionLabel>
          <DarkCard style={{ padding: 12 }}>
            <svg width="100%" height="70" viewBox="0 0 200 70">
              {/* Gun */}
              <rect x={10} y={22} width={40} height={12} fill="#3a4560" rx={3}/>
              <rect x={18} y={16} width={8} height={6} fill="#3a4560" rx={1}/>
              <rect x={10} y={32} width={10} height={8} fill={COLORS.bgCardMid} rx={1}/>
              <circle cx={8} cy={27} r={4} fill="none" stroke={COLORS.red} strokeWidth={1.5}/>
              <line x1={0} y1={27} x2={4} y2={27} stroke={COLORS.red} strokeWidth={1.5}/>
              {/* Car */}
              <rect x={65} y={26} width={50} height={20} fill="#3a4560" rx={4}/>
              <rect x={72} y={20} width={34} height={14} fill={COLORS.bgCardMid} rx={3}/>
              <circle cx={75} cy={47} r={6} fill={COLORS.bg} stroke={COLORS.blue} strokeWidth={1}/>
              <circle cx={106} cy={47} r={6} fill={COLORS.bg} stroke={COLORS.blue} strokeWidth={1}/>
              {/* People */}
              {[140, 158, 176].map((x, i) => (
                <g key={i} opacity={1 - i * 0.25}>
                  <circle cx={x} cy={22} r={7} fill={['#3a4560','#2d3550','#1e2535'][i]}/>
                  <ellipse cx={x} cy={36} rx={9} ry={5} fill={['#3a4560','#2d3550','#1e2535'][i]}/>
                </g>
              ))}
            </svg>
            {skills.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: COLORS.gold }}>Highly Skilled: </span>
                <span style={{ fontSize: 8, color: COLORS.muted }}>{skills.join(', ')}</span>
              </div>
            )}
          </DarkCard>
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div style={{ height: 0.5, background: COLORS.border, margin: '0 16px' }}/>

      {/* ── ROW 3: Profile Summary | FIR Snapshot ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16 }}>

        {/* Criminal Profile Summary */}
        <DarkCard>
          <CardHeader label="Criminal Profile Summary" color={COLORS.gold}/>
          <div style={{ padding: '8px 14px' }}>
            {summaryEntries.map(([k, v], i) => (
              <KVRow key={i} label={k} value={v}
                valueColor={k.toLowerCase().includes('status') ? COLORS.red : COLORS.text}/>
            ))}
            {summaryEntries.length === 0 && (
              <div style={{ fontSize: 9, color: COLORS.muted }}>No profile data available.</div>
            )}
          </div>
        </DarkCard>

        {/* FIR Snapshot */}
        <DarkCard>
          <CardHeader label="Key FIR Snapshot (First Information Reports)" color={COLORS.gold}/>
          <div style={{ padding: '8px 14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
              <thead>
                <tr>
                  {['Year', 'Offence Type', 'Jurisdiction'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '4px 6px 4px 0',
                      fontFamily: 'Georgia, serif', fontSize: 8, fontWeight: 700,
                      color: COLORS.red, textTransform: 'uppercase', letterSpacing: 0.5,
                      borderBottom: `0.5px solid ${COLORS.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {firRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `0.5px solid ${COLORS.border}` }}>
                    <td style={{ padding: '5px 6px 5px 0', color: COLORS.gold, fontFamily: 'Georgia, serif' }}>
                      ● {r.year}
                    </td>
                    <td style={{ padding: '5px 6px 5px 0', color: COLORS.text, fontFamily: 'Georgia, serif' }}>
                      {r.offence}
                    </td>
                    <td style={{ padding: '5px 6px 5px 0', color: COLORS.muted, fontFamily: 'Georgia, serif' }}>
                      📍 {r.jurisdiction}
                    </td>
                  </tr>
                ))}
                {firRows.length === 0 && (
                  <tr><td colSpan={3} style={{ color: COLORS.muted, padding: '8px 0', fontFamily: 'Georgia, serif', fontSize: 9 }}>No FIR records available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DarkCard>
      </div>

      {/* ── Highlights / Key Findings ── */}
      {data.highlights && data.highlights.length > 1 && (
        <div style={{ padding: '0 16px 16px' }}>
          <SectionLabel>Key Findings</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {data.highlights.map((h, i) => (
              <DarkCard key={i} style={{ padding: '10px 14px', borderLeft: `2px solid ${COLORS.red}`, borderRadius: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.text, textTransform: 'uppercase', letterSpacing: 1 }}>{clean(h.title)}</div>
                {h.subtitle && <div style={{ fontSize: 8, color: COLORS.muted, marginTop: 2 }}>{h.subtitle}</div>}
                <div style={{ fontSize: 8, color: COLORS.muted, marginTop: 6, lineHeight: 1.5 }}>{clean(h.description)}</div>
              </DarkCard>
            ))}
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <div style={{
        background: COLORS.bgCard,
        borderTop: `2px solid ${COLORS.red}`,
        padding: '8px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 8, color: COLORS.muted, letterSpacing: 1 }}>Intelligence File — Restricted</span>
        <span style={{ fontSize: 8, color: COLORS.border, letterSpacing: 1 }}>DO NOT DISTRIBUTE</span>
      </div>
    </div>
  )
}

// ── Mobile CDR View ───────────────────────────────────────────────────────────

function MobileCDRView({ data }: { data: InfographicResponse }) {
  const color = '#0ea5e9'
  const cs = data.call_summary ?? {}

  const summaryItems = [
    { label: 'Outgoing', value: cs.outgoing ?? '—', color: '#ef4444' },
    { label: 'Incoming', value: cs.incoming ?? '—', color: '#22c55e' },
    { label: 'SMS', value: cs.sms ?? '—', color: '#f59e0b' },
    { label: 'Data', value: cs.data ?? '—', color: '#8b5cf6' },
  ]

  return (
    <div style={{ background: COLORS.bg, borderRadius: 12, overflow: 'hidden', color: COLORS.text, fontFamily: 'Georgia, serif' }}>
      <div style={{ background: COLORS.bgCard, borderBottom: `2px solid ${color}`, padding: '10px 20px' }}>
        <div style={{ fontSize: 9, color, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>Mobile CDR Analysis</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>{clean(data.header?.title ?? 'CDR Report')}</div>
        {data.header?.subtitle && <div style={{ fontSize: 9, color: COLORS.muted }}>{clean(data.header.subtitle)}</div>}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {summaryItems.map(({ label, value, color: c }) => (
            <div key={label} style={{ background: `${c}10`, border: `1px solid ${c}30`, borderRadius: 6, padding: '10px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{value}</div>
              <div style={{ fontSize: 9, color: COLORS.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {data.top_contacts && data.top_contacts.length > 0 && (
            <DarkCard>
              <CardHeader label="Top Contacts" color={color}/>
              <div style={{ padding: '8px 12px' }}>
                {data.top_contacts.slice(0, 8).map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: `0.5px solid ${COLORS.border}` }}>
                    <span style={{ fontSize: 9, color: COLORS.text, fontFamily: 'monospace' }}>{c.number}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 8, color: COLORS.muted }}>{c.type}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: COLORS.text, background: COLORS.bgCardMid, padding: '2px 6px', borderRadius: 4 }}>{c.calls}</span>
                    </div>
                  </div>
                ))}
              </div>
            </DarkCard>
          )}

          {data.key_locations && data.key_locations.length > 0 && (
            <DarkCard>
              <CardHeader label="Key Locations" color={color}/>
              <div style={{ padding: '8px 12px' }}>
                {data.key_locations.slice(0, 6).map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `0.5px solid ${COLORS.border}` }}>
                    <span style={{ fontSize: 9, color: COLORS.muted }}>{l.area ?? l.cell_id}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: COLORS.text, background: COLORS.bgCardMid, padding: '2px 6px', borderRadius: 4 }}>{l.count}×</span>
                  </div>
                ))}
              </div>
            </DarkCard>
          )}
        </div>

        {data.timeline_events && data.timeline_events.length > 0 && (
          <DarkCard>
            <CardHeader label="Timeline Events" color={color}/>
            <div style={{ padding: '8px 12px' }}>
              {data.timeline_events.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '4px 0', borderBottom: `0.5px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: 9, color: COLORS.muted, fontFamily: 'monospace', width: 90, flexShrink: 0 }}>{e.date}</span>
                  <span style={{ fontSize: 9, color: COLORS.text }}>{e.event}</span>
                </div>
              ))}
            </div>
          </DarkCard>
        )}
      </div>
    </div>
  )
}

// ── Bank Statement View ───────────────────────────────────────────────────────

function BankStatementView({ data }: { data: InfographicResponse }) {
  const color = '#059669'
  const fs = data.financial_summary ?? {}

  return (
    <div style={{ background: COLORS.bg, borderRadius: 12, overflow: 'hidden', color: COLORS.text, fontFamily: 'Georgia, serif' }}>
      <div style={{ background: COLORS.bgCard, borderBottom: `2px solid ${color}`, padding: '10px 20px' }}>
        <div style={{ fontSize: 9, color, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>Bank Statement Analysis</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>{clean(data.header?.title ?? 'Bank Statement')}</div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {data.account && (
            <DarkCard>
              <CardHeader label="Account Details" color={color}/>
              <div style={{ padding: '8px 14px' }}>
                {Object.entries(data.account).map(([k, v]) => <KVRow key={k} label={k} value={v}/>)}
              </div>
            </DarkCard>
          )}
          {Object.keys(fs).length > 0 && (
            <DarkCard>
              <CardHeader label="Financial Summary" color={color}/>
              <div style={{ padding: '8px 14px' }}>
                {Object.entries(fs).map(([k, v]) => <KVRow key={k} label={k} value={v}/>)}
              </div>
            </DarkCard>
          )}
        </div>

        {data.key_transactions && data.key_transactions.length > 0 && (
          <DarkCard>
            <CardHeader label="Key Transactions" color={color}/>
            <div style={{ padding: '8px 14px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                <thead>
                  <tr>
                    {['Date', 'Description', 'Amount', 'Balance'].map(h => (
                      <th key={h} style={{
                        textAlign: h === 'Amount' || h === 'Balance' ? 'right' : 'left',
                        padding: '4px 8px 4px 0',
                        fontFamily: 'Georgia, serif', fontSize: 8, fontWeight: 700,
                        color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5,
                        borderBottom: `0.5px solid ${COLORS.border}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.key_transactions.slice(0, 15).map((t, i) => (
                    <tr key={i} style={{ borderBottom: `0.5px solid ${COLORS.border}` }}>
                      <td style={{ padding: '4px 8px 4px 0', color: COLORS.muted, fontFamily: 'monospace', fontSize: 9 }}>{t.date}</td>
                      <td style={{ padding: '4px 8px 4px 0', color: COLORS.text, fontSize: 9, maxWidth: 180 }}>{t.description}</td>
                      <td style={{ padding: '4px 8px 4px 0', textAlign: 'right', fontWeight: 700, color: t.type === 'credit' ? '#22c55e' : '#ef4444' }}>
                        {t.type === 'credit' ? '+' : '-'}{t.amount}
                      </td>
                      <td style={{ padding: '4px 0', textAlign: 'right', color: COLORS.muted }}>{t.balance ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DarkCard>
        )}
      </div>
    </div>
  )
}

// ── Generic View ──────────────────────────────────────────────────────────────

function GenericView({ data }: { data: InfographicResponse }) {
  const color = '#7c3aed'

  const renderCol = (items?: InfographicColumn[]) =>
    items?.map((item, i) => (
      <DarkCard key={i}>
        <CardHeader label={clean(item.title)} color={color}/>
        <div style={{ padding: '8px 14px', fontSize: 9, color: COLORS.muted, lineHeight: 1.6 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.description}</ReactMarkdown>
        </div>
      </DarkCard>
    ))

  return (
    <div style={{ background: COLORS.bg, borderRadius: 12, overflow: 'hidden', color: COLORS.text, fontFamily: 'Georgia, serif' }}>
      <div style={{ background: COLORS.bgCard, borderBottom: `2px solid ${color}`, padding: '10px 20px' }}>
        <div style={{ fontSize: 9, color, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>Document Analysis</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>{clean(data.header?.title ?? 'Analysis')}</div>
        {data.header?.subtitle && <div style={{ fontSize: 9, color: COLORS.muted }}>{clean(data.header.subtitle)}</div>}
      </div>

      <div style={{ padding: 16 }}>
        {data.personal && (
          <DarkCard style={{ marginBottom: 12 }}>
            <CardHeader label="Personal Details" color={color}/>
            <div style={{ padding: '8px 14px' }}>
              {Object.entries(data.personal).map(([k, v]) => <KVRow key={k} label={k} value={v}/>)}
            </div>
          </DarkCard>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{renderCol(data.left_column)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{renderCol(data.right_column)}</div>
        </div>

        {data.highlights && data.highlights.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <SectionLabel color={color}>Key Findings</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.highlights.map((h, i) => (
                <DarkCard key={i} style={{ padding: '10px 14px', borderLeft: `2px solid ${color}`, borderRadius: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.text, textTransform: 'uppercase' }}>{clean(h.title)}</div>
                  {h.subtitle && <div style={{ fontSize: 8, color: COLORS.muted, marginTop: 2 }}>{h.subtitle}</div>}
                  <div style={{ fontSize: 8, color: COLORS.muted, marginTop: 4, lineHeight: 1.5 }}>{clean(h.description)}</div>
                </DarkCard>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Fallback parser ───────────────────────────────────────────────────────────

function parseMarkdownToInfographic(raw: string): InfographicResponse {
  const lines = raw.split('\n')
  const sections: InfographicColumn[] = []
  let firstHeading = ''
  let currentHeader = ''
  let currentContent: string[] = []

  const finalizeSection = () => {
    const desc = currentContent.join('\n').trim()
    if (!desc) return
    sections.push({ title: currentHeader, description: desc, icon: 'info' })
    currentContent = []
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (!firstHeading && t.length > 5) firstHeading = t
    const isSectionStart = t.startsWith('**') && t.endsWith('**') && t.length > 5
    if (isSectionStart) { finalizeSection(); currentHeader = t }
    else currentContent.push(line)
  }
  finalizeSection()

  return {
    source_id: '',
    document_type: 'general',
    header: { title: firstHeading || 'Document Analysis', subtitle: '' },
    left_column: sections.slice(0, Math.ceil(sections.length / 2)),
    right_column: sections.slice(Math.ceil(sections.length / 2)),
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

export function isInfographicInsight(insightType: string): boolean {
  return insightType.toLowerCase().includes('infographic')
}

export function InfographicInsightViewer({ content }: { content: string }) {
  const data = useMemo<InfographicResponse>(() => {
    try {
      const jsonStr = extractJson(content)
      const parsed = JSON.parse(jsonStr) as InfographicResponse
      if (parsed && (parsed.header || parsed.document_type)) return parsed
      throw new Error('invalid')
    } catch {
      return parseMarkdownToInfographic(content)
    }
  }, [content])

  const type = data.document_type ?? 'general'

  if (type === 'gangster_profile' || type === 'ir_document') return <GangsterProfileView data={data}/>
  if (type === 'mobile_cdr') return <MobileCDRView data={data}/>
  if (type === 'bank_statement') return <BankStatementView data={data}/>
  return <GenericView data={data}/>
}