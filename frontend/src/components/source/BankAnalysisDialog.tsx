'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, TrendingUp, TrendingDown, CreditCard, BarChart2, Calendar, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import apiClient from '@/lib/api/client'

interface BankAnalysisDialogProps {
  sourceId: string
  open: boolean
  onClose: () => void
}

export function BankAnalysisDialog({ sourceId, open, onClose }: BankAnalysisDialogProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !sourceId) return
    setLoading(true)
    setError('')
    setData(null)
    apiClient.post(`/sources/${encodeURIComponent(sourceId)}/bank-analysis`, {})
      .then(res => setData(res.data))
      .catch(e => setError(e?.response?.data?.detail ?? e.message ?? 'Analysis failed'))
      .finally(() => setLoading(false))
  }, [open, sourceId])

  if (!open) return null

  const cf = data?.cashflow as Record<string, string> | undefined
  const monthly = data?.monthly as Array<Record<string, string>> | undefined
  const types = data?.types as Array<Record<string, unknown>> | undefined
  const atm = data?.atm as Record<string, unknown> | undefined
  const charges = data?.charges as Record<string, unknown> | undefined
  const interest = data?.interest as Record<string, unknown> | undefined
  const freq = data?.frequency as Record<string, unknown> | undefined
  const highVal = data?.high_value as Array<Record<string, string>> | undefined
  const transactions = data?.transactions as Array<Record<string, string>> | undefined
  const details = data?.details as Record<string, unknown> | undefined
  const detailCards = data?.detail_cards as Array<{label: string; value: string}> | undefined

  const C = {
    bg: '#0d1117', card: '#1a1f2e', border: '#2d3550',
    text: '#f0f0f0', muted: '#a0aab8',
    green: '#22c55e', red: '#ef4444', blue: '#4a90d9', gold: '#c9a84c',
  }

  const card = (children: React.ReactNode, style: React.CSSProperties = {}) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', ...style }}>
      {children}
    </div>
  )

  const sectionHead = (label: string, color = C.gold) => (
    <div style={{ background: '#1e2535', borderBottom: `1px solid ${C.border}`, padding: '8px 14px' }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color, textTransform: 'uppercase' as const }}>{label}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0d1117] overflow-hidden" style={{ color: '#f0f0f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1a1f2e', borderBottom: `2px solid ${C.green}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <BarChart2 size={20} style={{ color: C.green }} />
        <div>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 3, textTransform: 'uppercase' }}>Bank Statement</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Financial Analysis Report</div>
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: C.muted }}>
            <Loader2 size={32} style={{ color: C.green, animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 13 }}>Analysing bank statement...</p>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#450a0a', borderRadius: 8, color: '#fca5a5' }}>
            <AlertTriangle size={16} />
            <span style={{ fontSize: 12 }}>{error}</span>
          </div>
        )}

        {data && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Account Details */}
            {detailCards && detailCards.length > 0 && card(
              <div>
                {sectionHead('Account Details', C.blue)}
                <div style={{ padding: '8px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                  {detailCards.slice(0, 8).map((f, i) => (
                    <div key={i} style={{ padding: '6px 0', borderBottom: `0.5px solid ${C.border}` }}>
                      <div style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: C.text, fontWeight: 600, marginTop: 2 }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cash Flow KPIs */}
            {cf && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {[
                  { label: 'Opening Balance', value: cf.opening_balance, color: C.blue },
                  { label: 'Total Credits', value: cf.total_credit, color: C.green },
                  { label: 'Total Debits', value: cf.total_debit, color: C.red },
                  { label: 'Net Flow', value: cf.net, color: parseFloat(cf.net ?? '0') >= 0 ? C.green : C.red },
                  { label: 'Closing Balance', value: cf.closing_balance, color: C.gold },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 8, padding: '12px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: 9, color: C.muted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Monthly Summary + Transaction Types */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {monthly && monthly.length > 0 && card(
                <div>
                  {sectionHead('Monthly Summary', C.blue)}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                      <thead>
                        <tr style={{ background: '#1e2535' }}>
                          {['Month', 'Credits', 'Debits', 'Balance'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 8, fontWeight: 700, color: C.muted, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {monthly.map((row, i) => (
                          <tr key={i} style={{ borderBottom: `0.5px solid ${C.border}` }}>
                            <td style={{ padding: '5px 10px', color: C.gold }}>{row.month}</td>
                            <td style={{ padding: '5px 10px', color: C.green }}>{row.credit}</td>
                            <td style={{ padding: '5px 10px', color: C.red }}>{row.debit}</td>
                            <td style={{ padding: '5px 10px', color: C.text }}>{row.balance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {types && types.length > 0 && card(
                <div>
                  {sectionHead('Transaction Categories', C.gold)}
                  <div style={{ padding: '8px 14px' }}>
                    {types.map((t, i) => {
                      const pct = Math.min(100, Math.abs(parseFloat(String(t.total_amount_raw ?? 0))) / 1000)
                      return (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 10, color: C.text }}>{String(t.type)}</span>
                            <span style={{ fontSize: 10, color: C.muted }}>{String(t.count)} txns</span>
                          </div>
                          <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: C.blue, borderRadius: 2 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ATM + Charges + Interest */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {atm && card(
                <div>
                  {sectionHead('ATM Withdrawals', C.red)}
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        { label: 'Count', value: String(atm.count) },
                        { label: 'Total', value: String(atm.total) },
                        { label: 'Average', value: String(atm.avg) },
                        { label: 'Largest', value: String(atm.largest) },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase' }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {charges && card(
                <div>
                  {sectionHead('Bank Charges', C.gold)}
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase' }}>Total Charges</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.gold }}>{String(charges.total)}</div>
                    </div>
                    {(charges.breakdown as Array<{charge_type: string; amount: string}>)?.map((b, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, padding: '3px 0', borderBottom: `0.5px solid ${C.border}` }}>
                        <span style={{ color: C.muted }}>{b.charge_type}</span>
                        <span style={{ color: C.text }}>{b.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {interest && card(
                <div>
                  {sectionHead('Interest Earned', C.green)}
                  <div style={{ padding: '10px 14px' }}>
                    {[
                      { label: 'Total Interest', value: String(interest.total) },
                      { label: 'Count', value: String(interest.count) },
                      { label: 'Avg/Quarter', value: String(interest.avg_per_quarter) },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* High Value Transactions */}
            {highVal && highVal.length > 0 && card(
              <div>
                {sectionHead('High Value Transactions (>₹5,000)', C.red)}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr style={{ background: '#1e2535' }}>
                        {['Date', 'Description', 'Debit', 'Credit', 'Balance', 'Category'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 8, fontWeight: 700, color: C.muted, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {highVal.slice(0, 20).map((row, i) => (
                        <tr key={i} style={{ borderBottom: `0.5px solid ${C.border}` }}>
                          <td style={{ padding: '5px 10px', color: C.muted, fontFamily: 'monospace' }}>{row.date}</td>
                          <td style={{ padding: '5px 10px', color: C.text, maxWidth: 200 }}>{row.description}</td>
                          <td style={{ padding: '5px 10px', color: C.red }}>{row.debit !== '0.00' ? row.debit : '—'}</td>
                          <td style={{ padding: '5px 10px', color: C.green }}>{row.credit !== '0.00' ? row.credit : '—'}</td>
                          <td style={{ padding: '5px 10px', color: C.text }}>{row.balance}</td>
                          <td style={{ padding: '5px 10px', color: C.gold }}>{row.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* All Transactions */}
            {transactions && transactions.length > 0 && card(
              <div>
                {sectionHead(`All Transactions (${transactions.length})`, C.blue)}
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead style={{ position: 'sticky', top: 0 }}>
                      <tr style={{ background: '#1e2535' }}>
                        {['Date', 'Description', 'Debit', 'Credit', 'Balance', 'Category'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 8, fontWeight: 700, color: C.muted, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((row, i) => (
                        <tr key={i} style={{ borderBottom: `0.5px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : '#1e253520' }}>
                          <td style={{ padding: '4px 10px', color: C.muted, fontFamily: 'monospace', fontSize: 9 }}>{row.date}</td>
                          <td style={{ padding: '4px 10px', color: C.text, maxWidth: 220 }}>{row.description}</td>
                          <td style={{ padding: '4px 10px', color: C.red, fontSize: 9 }}>{row.debit !== '0.00' ? row.debit : '—'}</td>
                          <td style={{ padding: '4px 10px', color: C.green, fontSize: 9 }}>{row.credit !== '0.00' ? row.credit : '—'}</td>
                          <td style={{ padding: '4px 10px', color: C.text, fontSize: 9 }}>{row.balance}</td>
                          <td style={{ padding: '4px 10px', color: C.gold, fontSize: 9 }}>{row.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: '#1a1f2e', borderTop: `1px solid ${C.border}`, padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: C.muted }}>
          {data ? `${(data.total_transactions as number) ?? 0} transactions analysed` : ''}
        </span>
        <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}
