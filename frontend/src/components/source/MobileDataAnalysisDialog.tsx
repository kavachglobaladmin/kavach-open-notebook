'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { 
  X, 
  Loader2, 
  PhoneCall, 
  FileText, 
  Activity, 
  Users, 
  Clock, 
  MessageSquare, 
  MapPin, 
  Cpu, 
  AlertTriangle, 
  Brain 
} from 'lucide-react'
import apiClient from '@/lib/api/client'
import { useTranslation } from '@/lib/hooks/use-translation'

interface MobileDataAnalysisDialogProps {
  sourceId: string
  open: boolean
  onClose: () => void
}

const card: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #f1f5f9',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
  borderRadius: 16,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

const sectionHead = (accent: string, bgGradient: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '16px 20px',
  borderBottom: '1px solid #f1f5f9',
  background: bgGradient,
  color: accent,
})

const body: React.CSSProperties = { padding: 20 }

type Summary = {
  parsed_rows?: number
  unique_contacts?: number
  total_calls_est?: number
  sms_count?: number
  total_duration_min?: number
  avg_duration_sec?: number | null
  date_range?: string
  night_activity_pct?: number
  operators_detected?: string[]
}

function MobileDataContent({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation()
  const m = t.sources.mobileData
  const summary = (data.summary || {}) as Summary
  const callActivity = (data.call_activity || []) as { period: string; count: number }[]
  const topContacts = (data.top_contacts || []) as {
    number: string
    call_count: number
    total_duration_sec: number
    inbound: number
    outbound: number
  }[]
  const timePattern = (data.time_pattern || {}) as {
    by_hour?: { hour: number; count: number }[]
    peak_hour?: number | null
    night_activity_pct?: number
  }
  const operatorSms = (data.operator_sms || {}) as {
    operators_plaintext?: string[]
    sms_like_rows?: number
    notes?: string
  }
  const location = (data.location || {}) as {
    lac_values?: string[]
    cell_id_values?: string[]
    notes?: string
  }
  const deviceSim = (data.device_sim || {}) as { imei_candidates?: string[]; notes?: string }
  const suspicious = (data.suspicious || []) as { title: string; detail: string; severity: string }[]
  const intelligence = (data.intelligence || {}) as { insights?: string[]; behavior_summary?: string }

  return (
    <>
      {/* SUMMARY OVERVIEW */}
      <div style={card}>
        <div style={sectionHead('#7c3aed', 'linear-gradient(to right, #f3e8ff, #ffffff)')}>
          <FileText size={20} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{m.sectionSummary}</span>
        </div>
        <div style={body}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
            {[
              { label: m.rowsParsedLabel, value: String(summary.parsed_rows ?? '—') },
              { label: m.uniqueContacts, value: String(summary.unique_contacts ?? '—') },
              { label: m.totalCalls, value: String(summary.total_calls_est ?? '—') },
              { label: m.smsRows, value: String(summary.sms_count ?? '—') },
              { label: m.totalMinutes, value: String(summary.total_duration_min ?? '—') },
              { label: m.avgDurationSec, value: summary.avg_duration_sec != null ? String(summary.avg_duration_sec) : '—' },
              { label: m.dateRange, value: summary.date_range || '—' },
              { label: m.nightActivity, value: `${summary.night_activity_pct ?? 0}%` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderLeft: '3px solid #7c3aed', borderRadius: 8, padding: '12px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>{value}</div>
              </div>
            ))}
          </div>
          {(summary.operators_detected?.length ?? 0) > 0 && (
            <div style={{ marginTop: 20, background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'inline-block' }}>
              <span style={{ fontSize: 12, color: '#475569' }}>
                <strong style={{ color: '#0f172a' }}>{m.operatorsInFile}:</strong> {summary.operators_detected?.join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
        {/* CALL ACTIVITY */}
        <div style={card}>
          <div style={sectionHead('#2563eb', 'linear-gradient(to right, #eff6ff, #ffffff)')}>
            <Activity size={20} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{m.sectionCallActivity}</span>
          </div>
          <div style={{ ...body, padding: 0, maxHeight: 340, overflowY: 'auto' }}>
            {callActivity.length === 0 ? (
              <div style={{ padding: 24, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>{m.noData}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>{m.period}</th>
                    <th style={{ textAlign: 'right', padding: '12px 20px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>{m.events}</th>
                  </tr>
                </thead>
                <tbody>
                  {callActivity.map((row) => (
                    <tr key={row.period} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 20px', fontFamily: 'ui-monospace, monospace', color: '#334155' }}>{row.period}</td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* TIME PATTERN */}
        <div style={card}>
          <div style={sectionHead('#d97706', 'linear-gradient(to right, #fffbeb, #ffffff)')}>
            <Clock size={20} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{m.sectionTimePattern}</span>
          </div>
          <div style={{ ...body, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, marginBottom: 24, border: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                {m.peakHour}: <strong style={{ color: '#0f172a' }}>{timePattern.peak_hour ?? '—'}</strong>
                <span style={{ margin: '0 12px', color: '#cbd5e1' }}>|</span>
                {m.nightWindow}: <strong style={{ color: '#0f172a' }}>{timePattern.night_activity_pct ?? summary.night_activity_pct ?? 0}%</strong>
              </p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))', gap: 4, alignItems: 'end', marginTop: 'auto' }}>
              {(timePattern.by_hour || []).map((h) => {
                const max = Math.max(1, ...((timePattern.by_hour || []).map((x) => x.count)))
                const barPx = Math.max(4, Math.round((h.count / max) * 100))
                return (
                  <div key={h.hour} style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        height: 110,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 16,
                          height: barPx,
                          background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
                          borderRadius: '4px 4px 0 0',
                          boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)',
                          transition: 'height 0.3s ease'
                        }}
                        title={`${h.count} events`}
                      />
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 8, fontWeight: 500 }}>{h.hour}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* TOP CONTACTS */}
      <div style={card}>
        <div style={sectionHead('#16a34a', 'linear-gradient(to right, #f0fdf4, #ffffff)')}>
          <Users size={20} />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{m.sectionTopContacts}</span>
        </div>
        <div style={{ ...body, padding: 0, maxHeight: 400, overflowY: 'auto' }}>
          {topContacts.length === 0 ? (
            <div style={{ padding: 24, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>{m.noData}</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                <tr>
                  {['#', m.number, m.events, m.inbound, m.outbound, m.durationSec].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === '#' ? 'center' : 'right',
                        padding: '12px 20px',
                        borderBottom: '1px solid #e2e8f0',
                        color: '#475569',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topContacts.map((row, i) => (
                  <tr key={row.number} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 20px', textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>{i + 1}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#0f172a', fontWeight: 500 }}>{row.number}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', color: '#334155' }}>
                      <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>{row.call_count}</span>
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', color: '#334155' }}>{row.inbound}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', color: '#334155' }}>{row.outbound}</td>
                    <td style={{ padding: '12px 20px', textAlign: 'right', color: '#64748b' }}>{row.total_duration_sec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        {/* OPERATOR SMS */}
        <div style={card}>
          <div style={sectionHead('#0891b2', 'linear-gradient(to right, #ecfeff, #ffffff)')}>
            <MessageSquare size={20} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{m.sectionOperatorSms}</span>
          </div>
          <div style={body}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{m.smsLikeRows}</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#0891b2' }}>{operatorSms.sms_like_rows ?? 0}</span>
            </div>
            {operatorSms.notes && <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, margin: 0, padding: '12px', background: '#f8fafc', borderRadius: 8 }}>{operatorSms.notes}</p>}
          </div>
        </div>

        {/* LOCATION */}
        <div style={card}>
          <div style={sectionHead('#0d9488', 'linear-gradient(to right, #f0fdfa, #ffffff)')}>
            <MapPin size={20} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{m.sectionLocation}</span>
          </div>
          <div style={body}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px 0' }}>{m.lac}</p>
              <p style={{ fontSize: 13, color: '#0f172a', margin: 0, wordBreak: 'break-word', background: '#f8fafc', padding: '8px 12px', borderRadius: 6 }}>
                {(location.lac_values || []).join(', ') || '—'}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px 0' }}>{m.cellId}</p>
              <p style={{ fontSize: 13, color: '#0f172a', margin: 0, wordBreak: 'break-word', background: '#f8fafc', padding: '8px 12px', borderRadius: 6 }}>
                {(location.cell_id_values || []).join(', ') || '—'}
              </p>
            </div>
            {location.notes && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 16, marginBottom: 0 }}>{location.notes}</p>}
          </div>
        </div>

        {/* DEVICE SIM */}
        <div style={card}>
          <div style={sectionHead('#6366f1', 'linear-gradient(to right, #e0e7ff, #ffffff)')}>
            <Cpu size={20} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{m.sectionDeviceSim}</span>
          </div>
          <div style={body}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px 0' }}>
              IMEI ({m.imeiCandidates})
            </p>
            <p style={{ fontSize: 13, color: '#0f172a', margin: 0, wordBreak: 'break-word', background: '#f8fafc', padding: '8px 12px', borderRadius: 6, fontFamily: 'ui-monospace, monospace' }}>
              {(deviceSim.imei_candidates || []).join(', ') || '—'}
            </p>
            {deviceSim.notes && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 16, marginBottom: 0 }}>{deviceSim.notes}</p>}
          </div>
        </div>
      </div>

      {/* INTELLIGENCE & SUSPICIOUS (Full Width) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
        
        {/* SUSPICIOUS */}
        <div style={card}>
          <div style={sectionHead('#dc2626', 'linear-gradient(to right, #fef2f2, #ffffff)')}>
            <AlertTriangle size={20} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{m.sectionSuspicious}</span>
          </div>
          <div style={body}>
            {suspicious.length === 0 ? (
              <div style={{ padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#16a34a', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, background: '#16a34a', borderRadius: '50%' }} />
                {m.noFlags}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suspicious.map((s, idx) => (
                  <div key={idx} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444', padding: '14px 16px', borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: '#fee2e2', padding: '2px 8px', borderRadius: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.severity}</span>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 1.5 }}>{s.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* INTELLIGENCE */}
        <div style={card}>
          <div style={sectionHead('#8b5cf6', 'linear-gradient(to right, #f5f3ff, #ffffff)')}>
            <Brain size={20} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{m.sectionIntelligence}</span>
          </div>
          <div style={body}>
            {intelligence.behavior_summary && (
              <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                <p style={{ fontSize: 14, color: '#0f172a', margin: 0, fontWeight: 500, lineHeight: 1.6 }}>{intelligence.behavior_summary}</p>
              </div>
            )}
            {intelligence.insights && intelligence.insights.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {intelligence.insights.map((line, i) => (
                  <li key={i} style={{ fontSize: 13, color: '#334155', display: 'flex', gap: 12, lineHeight: 1.5 }}>
                    <div style={{ minWidth: 6, height: 6, borderRadius: '50%', background: '#8b5cf6', marginTop: 6 }} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </>
  )
}

export function MobileDataAnalysisDialog({ sourceId, open, onClose }: MobileDataAnalysisDialogProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false) 

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !sourceId) return
    setLoading(true)
    setError('')
    setData(null)

    const encodedId = encodeURIComponent(sourceId)

    apiClient
      .get(`/sources/${encodedId}/mobile-analysis`)
      .then((r) => {
        setData(r.data)
        setLoading(false)
      })
      .catch(() => {
        apiClient
          .post(`/sources/${encodedId}/mobile-analysis`, {})
          .then((r) => setData(r.data))
          .catch((e) => setError(e?.response?.data?.detail ?? e.message ?? 'Analysis failed'))
          .finally(() => setLoading(false))
      })
  }, [open, sourceId])

  if (!open || !mounted) return null

  const total = typeof data?.total_records === 'number' ? data.total_records : null

  const dialogContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        height: '100dvh',
        maxHeight: '100dvh',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        background: '#f8fafc', 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#0f172a',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          height: 68,
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
          }}
        >
          <PhoneCall size={20} color="#ffffff" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
            {t.sources.mobileData.analysisTitle}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: 2
            }}
          >
            {t.sources.mobileData.reportHeading}
          </div>
        </div>
        {total != null && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              fontSize: 13,
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: 20,
              flexShrink: 0,
            }}
          >
            {total} {t.sources.mobileData.recordsLabel}
          </div>
        )}
        <div style={{ width: 1, height: 24, background: '#e2e8f0', margin: '0 8px' }} />
        <button
          type="button"
          onClick={onClose}
          style={{
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: 36,
            height: 36,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#475569',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'}
          onMouseOut={e => e.currentTarget.style.background = '#f1f5f9'}
        >
          <X size={18} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          padding: '32px 32px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minHeight: 'min-content', maxWidth: 1400, margin: '0 auto' }}>
          {loading && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 400,
                gap: 16,
                color: '#64748b',
              }}
            >
              <Loader2 size={36} color="#059669" className="animate-spin" />
              <p style={{ fontSize: 14, margin: 0, textAlign: 'center', maxWidth: 320, fontWeight: 500 }}>{t.sources.mobileData.loading}</p>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 20,
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: 12,
                color: '#b91c1c',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}
            >
              <AlertTriangle size={20} />
              {error}
            </div>
          )}

          {data && !loading && <MobileDataContent data={data} />}
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
          {total != null ? `${total} ${t.sources.mobileData.footerRecords}` : ''}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: '#059669',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.background = '#047857'}
          onMouseOut={e => e.currentTarget.style.background = '#059669'}
        >
          {t.common.close}
        </button>
      </div>
    </div>
  )

  return createPortal(dialogContent, document.body)
}