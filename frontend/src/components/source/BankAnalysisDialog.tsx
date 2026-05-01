'use client'

import { useEffect, useState } from 'react'
import {
  X, Loader2, BarChart2, AlertTriangle, TrendingUp, TrendingDown,
  Wallet, Activity, Calendar, Zap
} from 'lucide-react'
import apiClient from '@/lib/api/client'

interface BankAnalysisDialogProps {
  sourceId: string
  open: boolean
  onClose: () => void
}

// Format amount: handles negative strings like "-20,639.00" → "-Rs.20,639.00"
const fmt = (v: string | undefined) => {
  if (!v) return '-'
  const trimmed = v.trim()
  if (trimmed.startsWith('-')) return `-Rs.${trimmed.slice(1)}`
  return `Rs.${trimmed}`
}
const fmtAbs = (v: string | undefined) => (v ? `Rs.${v.replace('-', '')}` : '-')
const barPct = (val: number, max: number) =>
  max > 0 ? Math.round((Math.abs(val) / max) * 100) : 0

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  overflow: 'hidden',
}
const head = (accent: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 16px',
  borderBottom: '1px solid #e5e7eb',
  background: '#f9fafb',
  color: accent,
})
const body: React.CSSProperties = { padding: 16 }
const bodyNoPad: React.CSSProperties = { padding: 0 }

type Row = Record<string, string>
type TypeRow = { type: string; count: number; total_amount: string; total_amount_raw: number }

function TxTable({ rows, cols, maxH = 320 }: {
  rows: Row[]
  cols: { key: string; label: string; color?: string; mono?: boolean }[]
  maxH?: number
}) {
  return (
    <div style={{ overflowX: 'auto', maxHeight: maxH, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
          <tr>
            {cols.map(c => (
              <th key={c.key} style={{
                padding: '7px 10px', textAlign: 'left', fontSize: 9, fontWeight: 700,
                color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5,
                borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              {cols.map(c => {
                const v = row[c.key] ?? '-'
                const display =['debit', 'credit', 'amount'].includes(c.key) && v === '0.00' ? '-' : v
                return (
                  <td key={c.key} style={{
                    padding: '6px 10px', color: c.color ?? '#374151',
                    fontFamily: c.mono ? 'monospace' : undefined,
                    whiteSpace: c.key === 'description' ? 'normal' : 'nowrap',
                    maxWidth: c.key === 'description' ? 240 : undefined,
                    fontSize: 11,
                  }}>{display}</td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Junk patterns for customer_lines filtering — defined outside component for performance
const CUSTOMER_LINE_JUNK = [
  /value\s*date/i, /cheque/i, /nominee/i, /^[©®]/,
  /cr\s+statement/i, /siatemen/i, /wonthi/i, /oninly/i,
  /avg\s+balance/i, /drawing\s+power/i, /limit\s+0/i,
  /date\s+of/i, /time\s+of/i, /^\s*$/, /^[^a-zA-Z0-9]{3,}/,
]

const LABEL_FIXES: Record<string, string> = {
  'tatement from': 'Statement From',
  'as pin code': 'Pin Code',
  'stat t': 'Date of Statement',
  'if no': 'CIF No',
}

function fixLabel(label: string): string {
  return LABEL_FIXES[label.toLowerCase()] ?? label
}

function BankAnalysisContent({ data }: { data: Record<string, unknown> }) {
  const details       = data.details as Record<string, any> | undefined
  const detailCards   = (details?.fields || data.detail_cards || data.cards || []) as { label: string; value: string }[]
  const issuerLines   = (details?.issuer_lines || []) as string[]

  const rawCustomerLines = (details?.customer_lines || []) as string[]
  const customerLines = rawCustomerLines.filter(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length < 3) return false
    if (CUSTOMER_LINE_JUNK.some(p => p.test(trimmed))) return false
    if (/^[A-Za-z\s]+\s*:\s*\S/.test(trimmed) && trimmed.split(':').length === 2) return false
    return true
  })

  const cleanedDetailCards = detailCards.map(f => ({ ...f, label: fixLabel(f.label) }))
  
  const nlp      = data.nlp_groups as { group: string; keywords: string }[] | undefined
  const cf       = data.cashflow as Record<string, string> | undefined
  const monthly  = data.monthly as Row[] | undefined
  const types    = data.types as TypeRow[] | undefined
  const atm      = data.atm as { count: number; total: string; avg: string; largest: string; transactions: Row[] } | undefined
  const charges  = data.charges as { total: string; count: number; breakdown: { charge_type: string; amount: string }[]; transactions: Row[] } | undefined
  const interest = data.interest as { total: string; count: number; avg_per_quarter: string; transactions: Row[] } | undefined
  const freq     = data.frequency as { debit_count: number; credit_count: number; busiest_month: string; busiest_month_count: number; avg_txns_per_month: number } | undefined
  const highVal  = data.high_value as Row[] | undefined
  const balTrend = data.balance_trend as Row[] | undefined
  const txns     = data.transactions as Row[] | undefined
  const pattern  = data.pattern as Record<string, string> | undefined
  const maxType  = types ? Math.max(...types.map(t => Math.abs(t.total_amount_raw)), 1) : 1

  return (
    <>
      {/* 1. Account Details — always shown at top if any data exists */}
      {(issuerLines.length > 0 || customerLines.length > 0 || cleanedDetailCards.length > 0) && (
        <div style={{ ...card, background: '#fff' }}>
          {/* Section header */}
          <div style={head('#2563eb')}>
            <Wallet size={15} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Account Details</span>
            {details?.title && (
              <span style={{ marginLeft: 8, fontSize: 10, color: '#6b7280', fontWeight: 500 }}>
                — {details.title}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
            {/* Left: Bank & customer info — only if we have lines */}
          {(issuerLines.length > 0 || customerLines.length > 0) && (
            <div style={{
              flex: '0 0 260px',
              padding: '20px 24px',
              borderRight: '1px solid #e5e7eb',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: '#fff'
            }}>
              {/* Statement title badge */}
              {details?.title && (
                <div style={{
                  fontSize: 9, fontWeight: 700, color: '#2563eb',
                  textTransform: 'uppercase', letterSpacing: 1.5,
                  background: '#eff6ff', padding: '3px 8px', borderRadius: 4,
                  display: 'inline-block', alignSelf: 'flex-start'
                }}>
                  {details.title}
                </div>
              )}

              {issuerLines.length > 0 && (
                <div>
                  {issuerLines.map((line, i) => (
                    <div key={`iss-${i}`} style={{
                      fontSize: i === 0 ? 15 : 12,
                      fontWeight: i === 0 ? 800 : 500,
                      color: i === 0 ? '#0f766e' : '#374151',
                      marginBottom: 4,
                      textTransform: i === 0 ? 'uppercase' : 'none'
                    }}>
                      {line}
                    </div>
                  ))}
                </div>
              )}

              {customerLines.length > 0 && (
                <div>
                  {customerLines.map((line, i) => (
                    <div key={`cus-${i}`} style={{
                      fontSize: i === 0 ? 14 : 12,
                      fontWeight: i === 0 ? 800 : 400,
                      color: i === 0 ? '#111827' : '#4b5563',
                      marginBottom: 3,
                      textTransform: i === 0 ? 'uppercase' : 'none'
                    }}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Right: Account detail cards — full width if no left panel */}
          {cleanedDetailCards.length > 0 && (
            <div style={{
              flex: '1 1 400px',
              padding: '20px 24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '10px',
              background: '#f8fafc'
            }}>
              {cleanedDetailCards.map((f, i) => (
                <div key={`fld-${i}`} style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', wordBreak: 'break-word' }}>
                    {f.value || '-'}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>{/* end inner flex row */}
        </div>
      )}

      {/* 2. Cash Flow — only show if there are actual transactions */}
      {cf && parseFloat((cf.total_credit ?? '0').replace(/,/g, '')) + parseFloat((cf.total_debit ?? '0').replace(/,/g, '')) > 0 && (
        <div style={card}>
          <div style={head('#16a34a')}>
            <Wallet size={15} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Cash Flow Report</span>
          </div>
          <div style={body}>
            {/* Summary bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
              padding: '10px 16px', marginBottom: 16, fontSize: 12, flexWrap: 'wrap',
            }}>
              <span style={{ color: '#166534', fontWeight: 600 }}>Opening: Rs.{cf.opening_balance}</span>
              <span style={{ color: '#9ca3af' }}>+</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>Credits: Rs.{cf.total_credit}</span>
              <span style={{ color: '#9ca3af' }}>−</span>
              <span style={{ color: '#dc2626', fontWeight: 600 }}>Debits: Rs.{cf.total_debit}</span>
              <span style={{ color: '#9ca3af' }}>=</span>
              <span style={{ color: '#d97706', fontWeight: 700 }}>Closing: Rs.{cf.closing_balance}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {(() => {
                const netRaw = parseFloat((cf.net ?? '0').replace(/,/g, ''))
                const netColor = netRaw >= 0 ? '#16a34a' : '#dc2626'
                return [
                  { label: 'Opening Balance', value: fmtAbs(cf.opening_balance), color: '#2563eb' },
                  { label: 'Total Credits',   value: fmtAbs(cf.total_credit),    color: '#16a34a' },
                  { label: 'Total Debits',    value: fmtAbs(cf.total_debit),     color: '#dc2626' },
                  { label: 'Net Flow',        value: fmt(cf.net),                color: netColor },
                  { label: 'Closing Balance', value: fmtAbs(cf.closing_balance), color: '#d97706' },
                ]
              })().map(({ label, value, color }) => (
                <div key={label} style={{ background: '#f9fafb', border: `2px solid ${color}20`, borderRadius: 12, padding: '16px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: -0.5 }}>{value}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Monthly + Types */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {monthly && monthly.length > 0 && (
          <div style={card}>
            <div style={head('#2563eb')}>
              <Calendar size={15} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Monthly Summary</span>
            </div>
            <div style={bodyNoPad}>
              <TxTable rows={monthly} cols={[
                { key: 'month',   label: 'Month',   color: '#d97706' },
                { key: 'credit',  label: 'Credits',  color: '#16a34a' },
                { key: 'debit',   label: 'Debits',   color: '#dc2626' },
                { key: 'balance', label: 'Balance',  color: '#111827' },
              ]} />
            </div>
          </div>
        )}
        {types && types.length > 0 && (
          <div style={card}>
            <div style={head('#d97706')}>
              <Activity size={15} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Transaction Types</span>
            </div>
            <div style={{ ...body, maxHeight: 320, overflowY: 'auto' }}>
              {types.map((t, i) => {
                const isDebit  = t.total_amount_raw < 0
                const barColor = isDebit ? '#dc2626' : '#16a34a'
                const w        = barPct(t.total_amount_raw, maxType)
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{t.type}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: '#6b7280', background: '#f3f4f6', padding: '1px 7px', borderRadius: 10 }}>{t.count} txns</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>Rs.{t.total_amount.replace('-', '')}</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${w}%`, background: barColor, borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Deposit vs Withdrawal Pattern — only show if data exists */}
      {pattern && (parseInt(String(pattern.total_deposit_txns)) > 0 || parseInt(String(pattern.total_withdrawal_txns)) > 0) && (
        <div style={card}>
          <div style={head('#7c3aed')}>
            <TrendingUp size={15} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Deposit vs Withdrawal Pattern</span>
          </div>
          <div style={body}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {[
                { label: 'Deposit Transactions',    value: String(pattern.total_deposit_txns),    color: '#16a34a' },
                { label: 'Withdrawal Transactions', value: String(pattern.total_withdrawal_txns), color: '#dc2626' },
                { label: 'Avg Deposit',             value: fmt(pattern.avg_deposit),              color: '#16a34a' },
                { label: 'Avg Withdrawal',          value: fmt(pattern.avg_withdrawal),           color: '#dc2626' },
                { label: 'Max Deposit',             value: fmt(pattern.max_deposit),              color: '#16a34a' },
                { label: 'Max Withdrawal',          value: fmt(pattern.max_withdrawal),           color: '#dc2626' },
                { label: 'Min Deposit',             value: fmt(pattern.min_deposit),              color: '#6b7280' },
                { label: 'Min Withdrawal',          value: fmt(pattern.min_withdrawal),           color: '#6b7280' },
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

      {/* 5. ATM + Charges + Interest — only show if they have data */}
      {((atm && atm.count > 0) || (charges && charges.count > 0) || (interest && interest.count > 0)) && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {atm && atm.count > 0 && (
          <div style={card}>
            <div style={head('#dc2626')}>
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
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                All Transactions ({atm.transactions.length})
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                {atm.transactions.map((tx, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 11, gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>{tx.date}</span>
                      <span style={{ color: '#9ca3af', fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={tx.description}>{tx.description}</span>
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
            <div style={head('#d97706')}>
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
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', margin: '10px 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Transactions ({charges.transactions.length})
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                {charges.transactions.map((tx, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 11, gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>{tx.date}</span>
                      <span style={{ color: '#9ca3af', fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={tx.description}>{tx.description}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: '#d97706', flexShrink: 0 }}>Rs.{tx.debit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {interest && interest.count > 0 && (
          <div style={card}>
            <div style={head('#16a34a')}>
              <TrendingUp size={15} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Interest Earned</span>
            </div>
            <div style={body}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>Total Interest</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>Rs.{interest.total}</div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{interest.count} entries · Avg/Quarter: Rs.{interest.avg_per_quarter}</div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Interest Credits ({interest.transactions.length})
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                {interest.transactions.map((tx, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 11, gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>{tx.date}</span>
                      <span style={{ color: '#9ca3af', fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={tx.description}>{tx.description}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>Rs.{tx.credit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      )}{/* end ATM/Charges/Interest conditional */}

      {/* 6. Frequency — only show if there are transactions */}
      {freq && (freq.debit_count > 0 || freq.credit_count > 0) && (
        <div style={card}>
          <div style={head('#7c3aed')}>
            <Activity size={15} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Transaction Frequency</span>
          </div>
          <div style={body}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {[
                { label: 'Debit Transactions',    value: String(freq.debit_count),         color: '#dc2626' },
                { label: 'Credit Transactions',   value: String(freq.credit_count),        color: '#16a34a' },
                { label: 'Busiest Month',          value: freq.busiest_month,               color: '#d97706' },
                { label: 'Txns in Busiest Month', value: String(freq.busiest_month_count), color: '#d97706' },
                { label: 'Avg Txns / Month',       value: String(freq.avg_txns_per_month),  color: '#2563eb' },
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

      {/* 7. Balance Trend */}
      {balTrend && balTrend.length > 0 && (
        <div style={card}>
          <div style={head('#0891b2')}>
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

      {/* 8. High Value */}
      {highVal && highVal.length > 0 && (
        <div style={card}>
          <div style={head('#dc2626')}>
            <AlertTriangle size={15} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>High Value Transactions — {highVal.length} entries</span>
          </div>
          <div style={bodyNoPad}>
            <TxTable rows={highVal} maxH={320} cols={[
              { key: 'date',        label: 'Date',        color: '#6b7280', mono: true },
              { key: 'description', label: 'Description', color: '#374151' },
              { key: 'debit',       label: 'Debit',       color: '#dc2626' },
              { key: 'credit',      label: 'Credit',      color: '#16a34a' },
              { key: 'balance',     label: 'Balance',     color: '#111827' },
              { key: 'type',        label: 'Category',    color: '#d97706' },
            ]} />
          </div>
        </div>
      )}

      {/* 9. NLP Categorization Info */}
      {nlp && nlp.length > 0 && (
        <div style={card}>
          <div style={head('#8b5cf6')}>
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

      {/* 10. All Transactions */}
      {txns && txns.length > 0 && (
        <div style={card}>
          <div style={head('#2563eb')}>
            <BarChart2 size={15} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>All Transactions — {txns.length} entries</span>
          </div>
          <div style={bodyNoPad}>
            <TxTable rows={txns} maxH={500} cols={[
              { key: 'date',         label: 'Date',        color: '#6b7280', mono: true },
              { key: 'description',  label: 'Description', color: '#374151' },
              { key: 'debit',        label: 'Debit',       color: '#dc2626' },
              { key: 'credit',       label: 'Credit',      color: '#16a34a' },
              { key: 'balance',      label: 'Balance',     color: '#111827' },
              { key: 'type',         label: 'Category',    color: '#d97706' },
              { key: 'nlp_keywords', label: 'Keywords',    color: '#7c3aed' },
            ]} />
          </div>
        </div>
      )}

      {/* Fallback: show raw summary if nothing else rendered */}
      {!cleanedDetailCards.length && !cf && !txns?.length && (
        <div style={{ ...card, padding: 20, color: '#6b7280', fontSize: 13 }}>
          Data received but no sections to display. Total transactions: {String(data.total_transactions ?? 0)}
        </div>
      )}
    </>
  )
}

export function BankAnalysisDialog({ sourceId, open, onClose }: BankAnalysisDialogProps) {
  const [data, setData]       = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!open || !sourceId) return
    setLoading(true)
    setError('')
    setData(null)
    apiClient.post(`/sources/${encodeURIComponent(sourceId)}/bank-analysis`, {})
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.detail ?? e.message ?? 'Analysis failed'))
      .finally(() => setLoading(false))
  }, [open, sourceId])

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      background: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#111827',
      overflow: 'hidden',
    }}>

      {/* Top bar */}
      <div style={{
        flexShrink: 0, height: 56,
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '0 24px', display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart2 size={18} color="#2563eb" />
        </div>
        <div>
          <div style={{ fontSize: 8, color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase' }}>Bank Statement</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
            {data ? ((data.details as Record<string, any>)?.title || 'Financial Analysis Report') : 'Financial Analysis Report'}
          </div>
        </div>
        {data && (
          <div style={{ marginLeft: 12, background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
            {(data.total_transactions as number) ?? 0} transactions
          </div>
        )}
        <button onClick={onClose} style={{
          marginLeft: 'auto', background: '#f3f4f6', border: 'none',
          borderRadius: '50%', width: 32, height: 32, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280',
        }}>
          <X size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: '#6b7280' }}>
            <Loader2 size={32} color="#2563eb" className="animate-spin" />
            <p style={{ fontSize: 13, margin: 0 }}>Analysing bank statement…</p>
          </div>
        )}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626' }}>
            <AlertTriangle size={16} />
            <span style={{ fontSize: 12 }}>{error}</span>
          </div>
        )}
        {data && !loading && <BankAnalysisContent data={data} />}
      </div>

      {/* Footer */}
      <div style={{
        flexShrink: 0,
        background: '#fff', borderTop: '1px solid #e5e7eb',
        padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>
          {data ? `${(data.total_transactions as number) ?? 0} transactions analysed` : ''}
        </span>
        <button onClick={onClose} style={{
          background: '#2563eb', color: '#fff', border: 'none',
          borderRadius: 8, padding: '7px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          Close
        </button>
      </div>
    </div>
  )
}