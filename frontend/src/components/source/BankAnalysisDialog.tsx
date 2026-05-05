'use client'

import { useEffect, useState } from 'react'
import {
  X, Loader2, BarChart2, AlertTriangle, TrendingUp, TrendingDown,
  Wallet, Activity, Calendar, Zap,
} from 'lucide-react'
import apiClient from '@/lib/api/client'

// ── Loading stages ────────────────────────────────────────────────────────────
const LOADING_STAGES = [
  'Connecting to backend…',
  'Reading PDF file…',
  'Extracting text (OCR may take a few minutes for scanned PDFs)…',
  'Parsing transactions…',
  'Running financial analysis…',
  'Building reports…',
  'Almost done…',
]

function useLoadingMessage(loading: boolean) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (!loading) { setIdx(0); return }
    let cancelled = false
    const delays = [1500, 3000, 8000, 60000, 90000, 120000]
    const run = async () => {
      for (let i = 0; i < LOADING_STAGES.length - 1; i++) {
        await new Promise(res => setTimeout(res, delays[i] ?? 2000))
        if (cancelled) return
        setIdx(i + 1)
      }
    }
    run()
    return () => { cancelled = true }
  }, [loading])
  return LOADING_STAGES[idx]
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface BankAnalysisDialogProps {
  sourceId: string
  open: boolean
  onClose: () => void
}

type Row = Record<string, string>

type TypeRow = {
  type: string
  count: number
  total_amount: string
  total_amount_raw: number
}

type Column = {
  key: string
  label: string
  color?: string
  mono?: boolean
}

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (v?: string | number | null): string => {
  if (v === null || v === undefined || v === '') return '-'
  const str = String(v).trim()
  if (!str) return '-'
  const neg = str.startsWith('-')
  return neg ? `-Rs.${str.slice(1)}` : `Rs.${str}`
}

const fmtAbs = (v?: string | number | null): string => {
  if (v === null || v === undefined || v === '') return '-'
  return `Rs.${String(v).replace('-', '')}`
}

const barPct = (val = 0, max = 0): number =>
  max > 0 ? Math.min(100, Math.round((Math.abs(val) / max) * 100)) : 0

// ── Style constants ───────────────────────────────────────────────────────────
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
const bodyNoPad: React.CSSProperties = { padding: 0 }

// ── Junk filters ──────────────────────────────────────────────────────────────
const JUNK_PATTERNS = [
  /value\s*date/i, /cheque/i, /nominee/i, /^[©®]/,
  /cr\s+statement/i, /avg\s+balance/i, /drawing\s+power/i,
  /money\s+in/i, /spent\s+\d/i, /saved\s+\d/i,
  /opening\s+balance/i, /closing\s+balance/i,
  /^\d+,\d+$/, /^\d+$/, /^[0-9,\s]+$/,
  /day\/night/i, /payment\s+method/i, /transaction\s+details/i,
  /comment\s+place/i, /^ifsc/i, /^savings/i,
  /^\s*$/, /^[^a-zA-Z0-9]{3,}/,
]

const isValidCustomerLine = (line: string): boolean => {
  const t = line.trim()
  if (!t || t.length < 3) return false
  if (JUNK_PATTERNS.some(p => p.test(t))) return false
  if (/^[A-Za-z\s]+\s*:\s*\S/.test(t) && t.split(':').length === 2) return false
  return true
}

const LABEL_FIXES: Record<string, string> = {
  'tatement from': 'Statement From',
  'as pin code': 'Pin Code',
  'stat t': 'Date of Statement',
  'if no': 'CIF No',
}
const fixLabel = (label: string): string =>
  LABEL_FIXES[label.toLowerCase().trim()] ?? label

// ── TxTable ───────────────────────────────────────────────────────────────────
function TxTable({ rows, cols, maxH = 320 }: {
  rows: Row[]
  cols: Column[]
  /** Use "none" so the dialog body scrolls as one column (avoids nested scroll + flex clipping at 100% zoom). */
  maxH?: number | 'none'
}) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
        No data available
      </div>
    )
  }
  const scrollWrap: React.CSSProperties =
    maxH === 'none'
      ? { overflowX: 'auto' }
      : { maxHeight: maxH, overflowY: 'auto', overflowX: 'auto' }
  return (
    <div style={scrollWrap}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 560 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} style={{
                padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5,
                borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
                background: '#f9fafb', position: 'sticky', top: 0, zIndex: 1,
              }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{
              borderBottom: '1px solid #f3f4f6',
              background: i % 2 === 0 ? '#fff' : '#fafafa',
            }}>
              {cols.map(c => {
                const v = row[c.key] ?? '-'
                const display = ['debit', 'credit', 'amount'].includes(c.key) && (v === '0.00' || v === '0') ? '-' : v
                return (
                  <td key={c.key} style={{
                    padding: '8px 12px',
                    color: c.color ?? '#374151',
                    fontFamily: c.mono ? 'monospace' : undefined,
                    whiteSpace: c.key === 'description' ? 'normal' : 'nowrap',
                    maxWidth: c.key === 'description' ? 320 : undefined,
                    fontSize: 12,
                    verticalAlign: 'top',
                  }}>
                    {display}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── BankAnalysisContent ───────────────────────────────────────────────────────
function BankAnalysisContent({ data }: { data: Record<string, unknown> }) {
  const details = data.details as Record<string, any> | undefined

  // Robust detail card extraction
  const rawDetailCards: { label: string; value: string }[] = (() => {
    const candidates = [details?.fields, data.detail_cards, data.cards]
    for (const c of candidates) {
      if (Array.isArray(c) && c.length > 0) return c as { label: string; value: string }[]
    }
    return []
  })()

  const issuerLines   = (details?.issuer_lines   || []) as string[]
  const customerLines = ((details?.customer_lines || []) as string[]).filter(isValidCustomerLine)
  const cleanedCards  = rawDetailCards.map(f => ({ ...f, label: fixLabel(f.label) }))

  const cf       = data.cashflow    as Record<string, string>                                                    | undefined
  const monthly  = data.monthly     as Row[]                                                                     | undefined
  const types    = data.types       as TypeRow[]                                                                 | undefined
  const atm      = data.atm         as { count: number; total: string; avg: string; largest: string; transactions: Row[] } | undefined
  const charges  = data.charges     as { total: string; count: number; breakdown: { charge_type: string; amount: string }[]; transactions: Row[] } | undefined
  const interest = data.interest    as { total: string; count: number; avg_per_quarter: string; transactions: Row[] } | undefined
  const freq     = data.frequency   as { debit_count: number; credit_count: number; busiest_month: string; busiest_month_count: number; avg_txns_per_month: number } | undefined
  const highVal  = data.high_value  as Row[]                                                                     | undefined
  const balTrend = data.balance_trend as Row[]                                                                   | undefined
  const txns     = data.transactions as Row[]                                                                    | undefined
  const pattern  = data.pattern     as Record<string, string | number>                                          | undefined
  const nlp      = data.nlp_groups  as { group: string; keywords: string }[]                                    | undefined

  const maxType = types ? Math.max(...types.map(t => Math.abs(t.total_amount_raw)), 1) : 1
  const hasAccountSection = issuerLines.length > 0 || customerLines.length > 0 || cleanedCards.length > 0

  return (
    <>
      {/* ── 1. Account Details ── */}
      {hasAccountSection && (
        <div style={{ ...card }}>
          <div style={sectionHead('#2563eb')}>
            <Wallet size={16} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Account Details</span>
            {details?.title && (
              <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>— {details.title}</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
            {/* Left panel: issuer + customer lines */}
            {(issuerLines.length > 0 || customerLines.length > 0) && (
              <div style={{
                flex: '0 0 280px', padding: '22px 24px',
                borderRight: '1px solid #e5e7eb',
                display: 'flex', flexDirection: 'column', gap: 12,
                background: '#fff',
              }}>
                {details?.title && (
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#2563eb',
                    textTransform: 'uppercase', letterSpacing: 1.5,
                    background: '#eff6ff', padding: '3px 8px', borderRadius: 4,
                    display: 'inline-block',
                  }}>
                    {details.title}
                  </div>
                )}
                {issuerLines.map((line, i) => (
                  <div key={`iss-${i}`} style={{
                    fontSize: i === 0 ? 17 : 13, fontWeight: i === 0 ? 800 : 500,
                    color: i === 0 ? '#0f766e' : '#374151', marginBottom: 2,
                    textTransform: i === 0 ? 'uppercase' : 'none',
                  }}>
                    {line}
                  </div>
                ))}
                {customerLines.map((line, i) => (
                  <div key={`cus-${i}`} style={{
                    fontSize: i === 0 ? 15 : 13, fontWeight: i === 0 ? 700 : 400,
                    color: i === 0 ? '#111827' : '#4b5563', marginBottom: 2,
                  }}>
                    {line}
                  </div>
                ))}
              </div>
            )}
            {/* Right panel: detail cards */}
            {cleanedCards.length > 0 && (
              <div style={{
                flex: '1 1 400px', padding: '22px 24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                gap: 12, background: '#f8fafc',
              }}>
                {cleanedCards.map((f, i) => (
                  <div key={i} style={{
                    background: '#fff', border: '1px solid #e2e8f0',
                    borderRadius: 8, padding: '12px 14px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  }}>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                      {f.label}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', wordBreak: 'break-word' }}>
                      {f.value || '-'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2. Cash Flow ── */}
      {cf && (parseFloat((cf.total_credit ?? '0').replace(/,/g, '')) + parseFloat((cf.total_debit ?? '0').replace(/,/g, ''))) > 0 && (
        <div style={card}>
          <div style={sectionHead('#16a34a')}>
            <Wallet size={16} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Cash Flow Report</span>
          </div>
          <div style={body}>
            {/* Summary bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 8, padding: '12px 16px', marginBottom: 18, fontSize: 13,
            }}>
              <span style={{ color: '#166534', fontWeight: 600 }}>Opening: Rs.{cf.opening_balance}</span>
              <span style={{ color: '#9ca3af' }}>+</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>Credits: Rs.{cf.total_credit}</span>
              <span style={{ color: '#9ca3af' }}>−</span>
              <span style={{ color: '#dc2626', fontWeight: 600 }}>Debits: Rs.{cf.total_debit}</span>
              <span style={{ color: '#9ca3af' }}>=</span>
              <span style={{ color: '#d97706', fontWeight: 700 }}>Closing: Rs.{cf.closing_balance}</span>
            </div>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              {(() => {
                const netRaw = parseFloat((cf.net ?? '0').replace(/,/g, ''))
                const netColor = netRaw >= 0 ? '#16a34a' : '#dc2626'
                return [
                  { label: 'Opening Balance', value: fmtAbs(cf.opening_balance), color: '#2563eb' },
                  { label: 'Total Credits',   value: fmtAbs(cf.total_credit),    color: '#16a34a' },
                  { label: 'Total Debits',    value: fmtAbs(cf.total_debit),     color: '#dc2626' },
                  { label: 'Net Flow',        value: fmt(cf.net),                color: netColor  },
                  { label: 'Closing Balance', value: fmtAbs(cf.closing_balance), color: '#d97706' },
                ]
              })().map(({ label, value, color }) => (
                <div key={label} style={{
                  background: '#f9fafb', border: `2px solid ${color}20`,
                  borderRadius: 12, padding: '16px 14px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: -0.5 }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Monthly Summary + Transaction Types ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {monthly && monthly.length > 0 && (
          <div style={card}>
            <div style={sectionHead('#2563eb')}>
              <Calendar size={16} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Monthly Summary</span>
            </div>
            <div style={bodyNoPad}>
              <TxTable rows={monthly} cols={[
                { key: 'month',   label: 'Month',   color: '#d97706' },
                { key: 'credit',  label: 'Credits', color: '#16a34a' },
                { key: 'debit',   label: 'Debits',  color: '#dc2626' },
                { key: 'balance', label: 'Balance', color: '#111827' },
              ]} />
            </div>
          </div>
        )}
        {types && types.length > 0 && (
          <div style={card}>
            <div style={sectionHead('#d97706')}>
              <Activity size={16} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Transaction Types</span>
            </div>
            <div style={{ ...body, maxHeight: 320, overflowY: 'auto' }}>
              {types.map((t, i) => {
                const isDebit  = t.total_amount_raw < 0
                const barColor = isDebit ? '#dc2626' : '#16a34a'
                const w        = barPct(t.total_amount_raw, maxType)
                return (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{t.type}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '1px 7px', borderRadius: 10 }}>
                          {t.count} txns
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>
                          Rs.{t.total_amount.replace('-', '')}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${w}%`, background: barColor, borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Deposit vs Withdrawal Pattern ── */}
      {pattern && (Number(pattern.total_deposit_txns) > 0 || Number(pattern.total_withdrawal_txns) > 0) && (
        <div style={card}>
          <div style={sectionHead('#7c3aed')}>
            <TrendingUp size={15} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Deposit vs Withdrawal Pattern</span>
          </div>
          <div style={body}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {[
                { label: 'Deposit Txns',      value: String(pattern.total_deposit_txns),    color: '#16a34a' },
                { label: 'Withdrawal Txns',   value: String(pattern.total_withdrawal_txns), color: '#dc2626' },
                { label: 'Avg Deposit',       value: fmt(String(pattern.avg_deposit)),      color: '#16a34a' },
                { label: 'Avg Withdrawal',    value: fmt(String(pattern.avg_withdrawal)),   color: '#dc2626' },
                { label: 'Max Deposit',       value: fmt(String(pattern.max_deposit)),      color: '#16a34a' },
                { label: 'Max Withdrawal',    value: fmt(String(pattern.max_withdrawal)),   color: '#dc2626' },
                { label: 'Min Deposit',       value: fmt(String(pattern.min_deposit)),      color: '#6b7280' },
                { label: 'Min Withdrawal',    value: fmt(String(pattern.min_withdrawal)),   color: '#6b7280' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 5. ATM + Charges + Interest ── */}
      {((atm && atm.count > 0) || (charges && charges.count > 0) || (interest && interest.count > 0)) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {atm && atm.count > 0 && (
            <div style={card}>
              <div style={sectionHead('#dc2626')}>
                <TrendingDown size={15} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>ATM Withdrawals</span>
              </div>
              <div style={body}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'Count',   value: String(atm.count), color: '#dc2626' },
                    { label: 'Total',   value: fmt(atm.total),    color: '#dc2626' },
                    { label: 'Average', value: fmt(atm.avg),      color: '#6b7280' },
                    { label: 'Largest', value: fmt(atm.largest),  color: '#dc2626' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: '#fef2f2', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' }}>
                  Transactions ({atm.transactions.length})
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {atm.transactions.map((tx, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 11, gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>{tx.date}</span>
                        <span style={{ color: '#9ca3af', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.description}>{tx.description}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>Rs.{tx.debit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {charges && charges.count > 0 && (
            <div style={card}>
              <div style={sectionHead('#d97706')}>
                <Zap size={15} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Bank Charges</span>
              </div>
              <div style={body}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>Total Charges</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>Rs.{charges.total}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{charges.count} charge transactions</div>
                </div>
                {charges.breakdown.map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: 11 }}>
                    <span style={{ color: '#374151' }}>{b.charge_type}</span>
                    <span style={{ fontWeight: 700, color: '#d97706' }}>Rs.{b.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {interest && interest.count > 0 && (
            <div style={card}>
              <div style={sectionHead('#16a34a')}>
                <TrendingUp size={15} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Interest Earned</span>
              </div>
              <div style={body}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>Total Interest</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>Rs.{interest.total}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{interest.count} entries · Avg/Quarter: Rs.{interest.avg_per_quarter}</div>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {interest.transactions.map((tx, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 11, gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>{tx.date}</span>
                        <span style={{ color: '#9ca3af', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>Rs.{tx.credit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 6. Transaction Frequency ── */}
      {freq && (freq.debit_count > 0 || freq.credit_count > 0) && (
        <div style={card}>
          <div style={sectionHead('#7c3aed')}>
            <Activity size={15} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Transaction Frequency</span>
          </div>
          <div style={body}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {[
                { label: 'Debit Transactions',    value: String(freq.debit_count),         color: '#dc2626' },
                { label: 'Credit Transactions',   value: String(freq.credit_count),        color: '#16a34a' },
                { label: 'Busiest Month',         value: freq.busiest_month,               color: '#d97706' },
                { label: 'Txns in Busiest Month', value: String(freq.busiest_month_count), color: '#d97706' },
                { label: 'Avg Txns / Month',      value: String(freq.avg_txns_per_month),  color: '#2563eb' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Balance Trend ── */}
      {balTrend && balTrend.length > 0 && (
        <div style={card}>
          <div style={sectionHead('#0891b2')}>
            <TrendingUp size={15} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Balance Trend — {balTrend.length} entries</span>
          </div>
          <div style={bodyNoPad}>
            <TxTable rows={balTrend} maxH={320} cols={[
              { key: 'date',        label: 'Date',        color: '#6b7280', mono: true },
              { key: 'description', label: 'Description', color: '#374151' },
              { key: 'debit',       label: 'Debit',       color: '#dc2626' },
              { key: 'credit',      label: 'Credit',      color: '#16a34a' },
              { key: 'balance',     label: 'Balance',     color: '#111827' },
              { key: 'month_label', label: 'Month',       color: '#d97706' },
            ]} />
          </div>
        </div>
      )}

      {/* ── 8. High Value Transactions ── */}
      {highVal && highVal.length > 0 && (
        <div style={card}>
          <div style={sectionHead('#dc2626')}>
            <AlertTriangle size={15} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>High Value Transactions — {highVal.length} entries</span>
          </div>
          <div style={bodyNoPad}>
            <TxTable rows={highVal} maxH={320} cols={[
              { key: 'date',        label: 'Date',     color: '#6b7280', mono: true },
              { key: 'description', label: 'Desc',     color: '#374151' },
              { key: 'debit',       label: 'Debit',    color: '#dc2626' },
              { key: 'credit',      label: 'Credit',   color: '#16a34a' },
              { key: 'balance',     label: 'Balance',  color: '#111827' },
              { key: 'type',        label: 'Category', color: '#d97706' },
            ]} />
          </div>
        </div>
      )}

      {/* ── 9. NLP Categories ── */}
      {nlp && nlp.length > 0 && (
        <div style={card}>
          <div style={sectionHead('#8b5cf6')}>
            <Zap size={15} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>NLP Categories & Keywords</span>
          </div>
          <div style={body}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {nlp.map((grp, i) => (
                <div key={i} style={{ background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', marginBottom: 4 }}>{grp.group}</div>
                  <div style={{ fontSize: 10, color: '#4c1d95', lineHeight: 1.4 }}>{grp.keywords}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 10. All Transactions ── */}
      {txns && txns.length > 0 && (
        <div style={card}>
          <div style={sectionHead('#2563eb')}>
            <BarChart2 size={15} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>All Transactions — {txns.length} entries</span>
          </div>
          <div style={bodyNoPad}>
            <TxTable rows={txns} maxH="none" cols={[
              { key: 'date',         label: 'Date',     color: '#6b7280', mono: true },
              { key: 'description',  label: 'Desc',     color: '#374151' },
              { key: 'debit',        label: 'Debit',    color: '#dc2626' },
              { key: 'credit',       label: 'Credit',   color: '#16a34a' },
              { key: 'balance',      label: 'Balance',  color: '#111827' },
              { key: 'type',         label: 'Category', color: '#d97706' },
              { key: 'nlp_keywords', label: 'Keywords', color: '#7c3aed' },
            ]} />
          </div>
        </div>
      )}

      {/* Fallback */}
      {!hasAccountSection && !cf && !txns?.length && (
        <div style={{ ...card, padding: 20, color: '#6b7280', fontSize: 13 }}>
          No data to display. Total transactions: {String(data.total_transactions ?? 0)}
        </div>
      )}
    </>
  )
}

// ── BankAnalysisDialog ────────────────────────────────────────────────────────
export function BankAnalysisDialog({ sourceId, open, onClose }: BankAnalysisDialogProps) {
  const [data, setData]     = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const loadingMessage      = useLoadingMessage(loading)

  useEffect(() => {
    if (!open || !sourceId) return
    setLoading(true)
    setError('')
    setData(null)
    apiClient
      .post(`/sources/${encodeURIComponent(sourceId)}/bank-analysis`, {})
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.detail ?? e.message ?? 'Analysis failed'))
      .finally(() => setLoading(false))
  }, [open, sourceId])

  if (!open) return null

  return (
    /* position:fixed + explicit top/right/bottom/left is zoom-proof */
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
      height: '100dvh',
      maxHeight: '100dvh',
      zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      background: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#111827',
      overflow: 'hidden',   /* clip children; scroll is on the body div below */
    }}>

      {/* ── Top bar ── */}
      <div style={{
        flexShrink: 0, height: 62,
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '0 24px', display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: '#eff6ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <BarChart2 size={18} color="#2563eb" />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 8, color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase' }}>
            Bank Statement
          </div>
          <div style={{
            fontSize: 17, fontWeight: 700, color: '#111827',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {data
              ? ((data.details as Record<string, any>)?.title || 'Financial Analysis Report')
              : 'Financial Analysis Report'}
          </div>
        </div>

        {data && (
          <div style={{
            background: '#eff6ff', color: '#2563eb',
            fontSize: 12, fontWeight: 600, padding: '4px 10px',
            borderRadius: 20, flexShrink: 0,
          }}>
            {(data.total_transactions as number) ?? 0} transactions
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            background: '#f3f4f6', border: 'none',
            borderRadius: '50%', width: 32, height: 32, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6b7280', flexShrink: 0,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Scrollable body ──
          Avoid display:flex on the element that also scrolls — nested flex min-height:auto
          prevents reliable overflow in some browsers at 100% zoom. Inner stack uses flex+gap. */}
      <div style={{
        flex: 1, minHeight: 0,
        overflowY: 'auto', overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        padding: '24px 24px',
        paddingBottom: 32,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 'min-content' }}>
        {loading && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            minHeight: 300, gap: 12, color: '#6b7280',
          }}>
            <Loader2 size={32} color="#2563eb" className="animate-spin" />
            <p style={{ fontSize: 13, margin: 0, textAlign: 'center', maxWidth: 320 }}>
              {loadingMessage}
            </p>
            <p style={{ fontSize: 11, margin: 0, color: '#9ca3af', textAlign: 'center', maxWidth: 320 }}>
              Scanned PDFs require OCR and may take several minutes. Please keep this window open.
            </p>
          </div>
        )}

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: 16, background: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626',
          }}>
            <AlertTriangle size={16} />
            <span style={{ fontSize: 12 }}>{error}</span>
          </div>
        )}

        {data && !loading && <BankAnalysisContent data={data} />}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        flexShrink: 0,
        background: '#fff', borderTop: '1px solid #e5e7eb',
        padding: '10px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>
          {data ? `${(data.total_transactions as number) ?? 0} transactions analysed` : ''}
        </span>
        <button
          onClick={onClose}
          style={{
            background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: 8, padding: '7px 20px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
