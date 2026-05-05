'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, PhoneCall } from 'lucide-react'
import apiClient from '@/lib/api/client'
import { useTranslation } from '@/lib/hooks/use-translation'

interface MobileDataAnalysisDialogProps {
  sourceId: string
  open: boolean
  onClose: () => void
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  overflow: 'hidden',
}

const sectionHead = (accent: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 18px',
  borderBottom: '1px solid #e5e7eb',
  background: '#f9fafb',
  color: accent,
})

const body: React.CSSProperties = { padding: 18 }

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
      <div style={card}>
        <div style={sectionHead('#7c3aed')}>
          <span style={{ fontSize: 16 }} aria-hidden>📋</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>🧾 {m.sectionSummary}</span>
        </div>
        <div style={body}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
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
              <div key={label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 4 }}>{value}</div>
              </div>
            ))}
          </div>
          {(summary.operators_detected?.length ?? 0) > 0 && (
            <p style={{ marginTop: 14, fontSize: 12, color: '#4b5563' }}>
              <strong>{m.operatorsInFile}:</strong> {summary.operators_detected?.join(', ')}
            </p>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={sectionHead('#2563eb')}>
          <span style={{ fontSize: 16 }} aria-hidden>📞</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{m.sectionCallActivity}</span>
        </div>
        <div style={{ ...body, padding: 0, maxHeight: 320, overflowY: 'auto' }}>
          {callActivity.length === 0 ? (
            <div style={{ padding: 16, color: '#9ca3af', fontSize: 12 }}>{m.noData}</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>{m.period}</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>{m.events}</th>
                </tr>
              </thead>
              <tbody>
                {callActivity.map((row) => (
                  <tr key={row.period} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{row.period}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={sectionHead('#16a34a')}>
          <span style={{ fontSize: 16 }} aria-hidden>👥</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{m.sectionTopContacts}</span>
        </div>
        <div style={{ ...body, padding: 0, maxHeight: 360, overflowY: 'auto' }}>
          {topContacts.length === 0 ? (
            <div style={{ padding: 16, color: '#9ca3af', fontSize: 12 }}>{m.noData}</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['#', m.number, m.events, m.inbound, m.outbound, m.durationSec].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === '#' ? 'left' : 'right',
                        padding: '8px 10px',
                        borderBottom: '1px solid #e5e7eb',
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
                  <tr key={row.number} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 10px' }}>{i + 1}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{row.number}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{row.call_count}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{row.inbound}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{row.outbound}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{row.total_duration_sec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={sectionHead('#d97706')}>
          <span style={{ fontSize: 16 }} aria-hidden>🕐</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{m.sectionTimePattern}</span>
        </div>
        <div style={body}>
          <p style={{ fontSize: 12, color: '#4b5563', marginTop: 0 }}>
            {m.peakHour}: <strong>{timePattern.peak_hour ?? '—'}</strong> · {m.nightWindow}:{' '}
            <strong>{timePattern.night_activity_pct ?? summary.night_activity_pct ?? 0}%</strong>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))', gap: 4, alignItems: 'end' }}>
            {(timePattern.by_hour || []).map((h) => {
              const max = Math.max(1, ...((timePattern.by_hour || []).map((x) => x.count)))
              const barPx = Math.max(4, Math.round((h.count / max) * 56))
              return (
                <div key={h.hour} style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      height: 64,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 18,
                        height: barPx,
                        background: '#f59e0b',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 9, color: '#6b7280', marginTop: 4 }}>{h.hour}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={sectionHead('#0891b2')}>
          <span style={{ fontSize: 16 }} aria-hidden>📱</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{m.sectionOperatorSms}</span>
        </div>
        <div style={body}>
          <p style={{ fontSize: 12, color: '#374151', marginTop: 0 }}>
            {m.smsLikeRows}: <strong>{operatorSms.sms_like_rows ?? 0}</strong>
          </p>
          <p style={{ fontSize: 11, color: '#6b7280' }}>{operatorSms.notes}</p>
        </div>
      </div>

      <div style={card}>
        <div style={sectionHead('#0d9488')}>
          <span style={{ fontSize: 16 }} aria-hidden>📍</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{m.sectionLocation}</span>
        </div>
        <div style={body}>
          <p style={{ fontSize: 11, fontWeight: 600, marginTop: 0 }}>{m.lac}</p>
          <p style={{ fontSize: 11, color: '#4b5563', wordBreak: 'break-word' }}>
            {(location.lac_values || []).join(', ') || '—'}
          </p>
          <p style={{ fontSize: 11, fontWeight: 600, marginTop: 10 }}>{m.cellId}</p>
          <p style={{ fontSize: 11, color: '#4b5563', wordBreak: 'break-word' }}>
            {(location.cell_id_values || []).join(', ') || '—'}
          </p>
          <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 10 }}>{location.notes}</p>
        </div>
      </div>

      <div style={card}>
        <div style={sectionHead('#6366f1')}>
          <span style={{ fontSize: 16 }} aria-hidden>🔧</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{m.sectionDeviceSim}</span>
        </div>
        <div style={body}>
          <p style={{ fontSize: 11, fontWeight: 600, marginTop: 0 }}>
            IMEI ({m.imeiCandidates})
          </p>
          <p style={{ fontSize: 11, color: '#4b5563', wordBreak: 'break-word' }}>
            {(deviceSim.imei_candidates || []).join(', ') || '—'}
          </p>
          <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 10 }}>{deviceSim.notes}</p>
        </div>
      </div>

      <div style={card}>
        <div style={sectionHead('#dc2626')}>
          <span style={{ fontSize: 16 }} aria-hidden>⚠️</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{m.sectionSuspicious}</span>
        </div>
        <div style={body}>
          {suspicious.length === 0 ? (
            <p style={{ fontSize: 12, color: '#16a34a', margin: 0 }}>{m.noFlags}</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {suspicious.map((s, idx) => (
                <li key={idx} style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>
                    [{s.severity}] {s.title}
                  </span>
                  <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{s.detail}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={sectionHead('#8b5cf6')}>
          <span style={{ fontSize: 16 }} aria-hidden>🧠</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{m.sectionIntelligence}</span>
        </div>
        <div style={body}>
          {intelligence.behavior_summary && (
            <p style={{ fontSize: 12, color: '#111827', marginTop: 0, fontWeight: 600 }}>{intelligence.behavior_summary}</p>
          )}
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(intelligence.insights || []).map((line, i) => (
              <li key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
                {line}
              </li>
            ))}
          </ul>
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

  useEffect(() => {
    if (!open || !sourceId) return
    setLoading(true)
    setError('')
    setData(null)
    apiClient
      .post(`/sources/${encodeURIComponent(sourceId)}/mobile-analysis`, {})
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.data?.detail ?? e.message ?? 'Analysis failed'))
      .finally(() => setLoading(false))
  }, [open, sourceId])

  if (!open) return null

  const total = typeof data?.total_records === 'number' ? data.total_records : null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        height: '100dvh',
        maxHeight: '100dvh',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        background: '#f3f4f6',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#111827',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          height: 62,
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: '#ecfdf5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <PhoneCall size={18} color="#059669" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 8, color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase' }}>
            {t.sources.mobileData.analysisTitle}
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: '#111827',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {t.sources.mobileData.reportHeading}
          </div>
        </div>
        {total != null && (
          <div
            style={{
              background: '#ecfdf5',
              color: '#059669',
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 20,
              flexShrink: 0,
            }}
          >
            {total} {t.sources.mobileData.recordsLabel}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            background: '#f3f4f6',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            flexShrink: 0,
          }}
        >
          <X size={16} />
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
          padding: '24px 24px',
          paddingBottom: 32,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 'min-content' }}>
          {loading && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 280,
                gap: 12,
                color: '#6b7280',
              }}
            >
              <Loader2 size={32} color="#059669" className="animate-spin" />
              <p style={{ fontSize: 13, margin: 0, textAlign: 'center', maxWidth: 320 }}>{t.sources.mobileData.loading}</p>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 16,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 10,
                color: '#dc2626',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {data && !loading && <MobileDataContent data={data} />}
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          background: '#fff',
          borderTop: '1px solid #e5e7eb',
          padding: '10px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 10, color: '#9ca3af' }}>
          {total != null ? `${total} ${t.sources.mobileData.footerRecords}` : ''}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: '#059669',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '7px 20px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t.common.close}
        </button>
      </div>
    </div>
  )
}
