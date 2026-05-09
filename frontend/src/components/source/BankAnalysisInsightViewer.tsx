'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle, TrendingUp, TrendingDown,
  BarChart2, Users, ShieldAlert, Activity,
  ArrowUpCircle, ArrowDownCircle, Wallet,
} from 'lucide-react'

interface BankAnalysisInsightViewerProps {
  content: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function extractValue(text: string, label: string): string {
  const re = new RegExp(`\\*?\\*?${label}\\*?\\*?[:\\s]+([^\\n*|]+)`, 'i')
  const m = text.match(re)
  return m ? m[1].trim().replace(/\*+/g, '').replace(/\s+/g, ' ') : ''
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/[₹,\s]/g, '')) || 0
}

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface TxRow { date: string; description: string; type: string; amount: number; category: string }

function parseTransactions(content: string): TxRow[] {
  const rows: TxRow[] = []
  for (const line of content.split('\n')) {
    if (!line.trim().startsWith('|')) continue
    const cells = line.split('|').map(c => c.trim()).filter(Boolean)
    if (cells.length < 5) continue
    if (/^[-:]+$/.test(cells[0]) || /date/i.test(cells[0])) continue
    const amount = parseAmount(cells[3])
    if (isNaN(amount) || amount === 0) continue
    rows.push({ date: cells[0], description: cells[1], type: cells[2], amount, category: cells[4] ?? '' })
  }
  return rows
}

function parseInsightLines(content: string, sectionHeading: string): string[] {
  const re = new RegExp(`${sectionHeading}[\\s\\S]*?(?=\\n---\\n|\\n\\*\\*Risk|$)`, 'i')
  const m = content.match(re)
  if (!m) return []
  return m[0].split('\n')
    .filter(l => /^[-•*]|\d+\./.test(l.trim()))
    .map(l => l.replace(/^[-•*\d.]+\s*/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, gradient }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; gradient: string
}) {
  return (
    <div className={`rounded-lg p-3 text-white bg-gradient-to-br ${gradient} shadow-sm`}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-[9px] font-bold uppercase tracking-widest opacity-80 leading-tight">{label}</p>
        <Icon className="h-3.5 w-3.5 opacity-60 shrink-0" />
      </div>
      <p className="text-base font-black leading-tight">{value}</p>
      {sub && <p className="text-[9px] opacity-70 mt-0.5">{sub}</p>}
    </div>
  )
}

function HBar({ label, value, max, color, amount }: {
  label: string; value: number; max: number; color: string; amount: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium truncate max-w-[55%] text-[11px]">{label}</span>
        <span className="text-muted-foreground shrink-0 tabular-nums text-[11px]">{amount} <span className="opacity-60">({pct}%)</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SectionCard({ icon: Icon, title, iconClass = 'text-muted-foreground', badge, children }: {
  icon: React.ElementType; title: string; iconClass?: string
  badge?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-muted/30">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} />
        <h3 className="text-xs font-semibold">{title}</h3>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

// ── detector ──────────────────────────────────────────────────────────────────

export function isBankAnalysisInsight(insightType: string): boolean {
  const t = insightType.toLowerCase()
  return t.includes('bank anal') || t.includes('bank statement') || t.includes('bank_statement')
}

// ── JSON bank statement viewer ────────────────────────────────────────────────

function tryParseJsonBankStatement(content: string): {
  account_summary: Record<string, unknown>
  transactions: Array<Record<string, unknown>>
} | null {
  try {
    let cleaned = content
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    cleaned = cleaned.replace(/:\s*(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?)/g, (_, n) => ': ' + n.replace(/,/g, ''))
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')
    cleaned = cleaned.replace(/\}\s*\n\s*\{/g, '},\n{')
    const parsed = JSON.parse(cleaned)
    if (parsed && parsed.account_summary && Array.isArray(parsed.transactions)) {
      return parsed
    }
  } catch { /* not JSON */ }
  return null
}

function JsonBankStatementViewer({ data }: {
  data: { account_summary: Record<string, unknown>; transactions: Array<Record<string, unknown>> }
}) {
  const s    = data.account_summary
  const txns = data.transactions

  const totalCredit = txns.reduce((sum, t) => sum + Math.max(Number(t.credit) || 0, 0), 0)
  const totalDebit  = txns.reduce((sum, t) => sum + Math.max(Number(t.debit)  || 0, 0), 0)

  const fmtAmt = (n: number) =>
    n > 0 ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'

  return (
    <div className="space-y-3 pb-2">
      {/* Account Summary */}
      <div className="rounded-xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="h-3.5 w-3.5 text-blue-300" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-blue-300">Bank Statement</span>
        </div>
        <h2 className="text-base font-black">{String(s.bank_name || s.bank || 'Bank Statement')}</h2>
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
          {s.account_holder  && <div><span className="text-blue-300/60 text-[10px]">Holder</span><p className="font-medium text-xs">{String(s.account_holder)}</p></div>}
          {s.account_number  && <div><span className="text-blue-300/60 text-[10px]">Account No.</span><p className="font-medium text-xs">{String(s.account_number)}</p></div>}
          {s.statement_period && <div><span className="text-blue-300/60 text-[10px]">Period</span><p className="font-medium text-xs">{String(s.statement_period)}</p></div>}
          {s.opening_balance != null && <div><span className="text-blue-300/60 text-[10px]">Opening</span><p className="font-medium text-xs">{fmtAmt(Number(s.opening_balance))}</p></div>}
          {s.closing_balance != null && <div><span className="text-blue-300/60 text-[10px]">Closing</span><p className="font-medium text-xs">{fmtAmt(Number(s.closing_balance))}</p></div>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-emerald-600/20 border border-emerald-500/30 p-2 text-center">
            <p className="text-[10px] text-emerald-300">Total Credits</p>
            <p className="text-sm font-black text-emerald-300">
              {fmtAmt(s.total_credits != null ? Number(s.total_credits) : totalCredit)}
            </p>
          </div>
          <div className="rounded-lg bg-rose-600/20 border border-rose-500/30 p-2 text-center">
            <p className="text-[10px] text-rose-300">Total Debits</p>
            <p className="text-sm font-black text-rose-300">
              {fmtAmt(s.total_debits != null ? Number(s.total_debits) : totalDebit)}
            </p>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="px-3 py-2 bg-muted/50 border-b flex items-center justify-between">
          <span className="text-xs font-semibold">Transactions</span>
          <Badge variant="secondary" className="text-[10px]">{txns.length}</Badge>
        </div>
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                <th className="px-2.5 py-1.5 text-left font-semibold text-[11px]">Date</th>
                <th className="px-2.5 py-1.5 text-left font-semibold text-[11px]">Description</th>
                <th className="px-2.5 py-1.5 text-right font-semibold text-rose-600 text-[11px]">Debit</th>
                <th className="px-2.5 py-1.5 text-right font-semibold text-emerald-600 text-[11px]">Credit</th>
                <th className="px-2.5 py-1.5 text-right font-semibold text-[11px]">Balance</th>
              </tr>
            </thead>
            <tbody>
              {txns
                .filter(tx => tx.date && String(tx.date) !== '...')
                .map((tx, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-2.5 py-1 whitespace-nowrap text-[11px]">{String(tx.date || '—')}</td>
                    <td className="px-2.5 py-1 max-w-[140px] truncate text-[11px]">{String(tx.description || tx.narration || '—')}</td>
                    <td className="px-2.5 py-1 text-right text-rose-600 text-[11px]">{Number(tx.debit)  > 0 ? fmtAmt(Number(tx.debit))  : '—'}</td>
                    <td className="px-2.5 py-1 text-right text-emerald-600 text-[11px]">{Number(tx.credit) > 0 ? fmtAmt(Number(tx.credit)) : '—'}</td>
                    <td className="px-2.5 py-1 text-right text-[11px]">{tx.balance != null ? fmtAmt(Number(tx.balance)) : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── main exported viewer ──────────────────────────────────────────────────────

export function BankAnalysisInsightViewer({ content }: BankAnalysisInsightViewerProps) {
  const jsonData = useMemo(() => tryParseJsonBankStatement(content), [content])
  if (jsonData) {
    return <JsonBankStatementViewer data={jsonData} />
  }
  return <LegacyBankAnalysisViewer content={content} />
}

// ── Legacy text-based viewer ──────────────────────────────────────────────────

function LegacyBankAnalysisViewer({ content }: BankAnalysisInsightViewerProps) {
  const data = useMemo(() => {
    const holder      = extractValue(content, 'Account Holder Name')
                     || extractValue(content, 'Account Holder')
                     || extractValue(content, 'Holder')
    const accountType = extractValue(content, 'Account Type')
    const status      = extractValue(content, 'Status')
    const period      = extractValue(content, 'Period')
    const currency    = extractValue(content, 'Currency')
    const creditRisk  = extractValue(content, 'Credit Risk Score')
    const riskTier    = extractValue(content, 'Risk Tier')
    const reasoning   = extractValue(content, 'Reasoning')

    const transactions = parseTransactions(content)
    const totalCredit  = transactions.filter(t => /credit/i.test(t.type)).reduce((s, t) => s + t.amount, 0)
    const totalDebit   = transactions.filter(t => /debit/i.test(t.type)).reduce((s, t)  => s + t.amount, 0)

    const categoryMap: Record<string, number> = {}
    for (const tx of transactions) {
      const cat = tx.category || 'Other'
      categoryMap[cat] = (categoryMap[cat] || 0) + tx.amount
    }
    const categories = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, total]) => ({ name, total }))

    const entityMap: Record<string, number> = {}
    for (const tx of transactions) {
      const key = tx.description.split(/[-\s]/)[0].replace(/\./g, '').trim()
      if (key) entityMap[key] = (entityMap[key] || 0) + tx.amount
    }
    const topEntities = Object.entries(entityMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }))

    const anomalies    = transactions.filter(t => /debit/i.test(t.type) && t.amount >= 5000)
    const normalCount  = transactions.length - anomalies.length
    const anomalyCount = anomalies.length
    const advancedLines = parseInsightLines(content, 'ADVANCED INSIGHTS')

    return {
      holder, accountType, status, period, currency, creditRisk, riskTier, reasoning,
      transactions, totalCredit, totalDebit, categories, topEntities,
      normalCount, anomalyCount, anomalies, advancedLines,
    }
  }, [content])

  const maxCategory = Math.max(...data.categories.map(c => c.total), 1)
  const maxEntity   = Math.max(...data.topEntities.map(e => e.value), 1)
  const catColors   = ['bg-blue-500', 'bg-amber-500', 'bg-violet-500', 'bg-emerald-500', 'bg-rose-500']
  const entColors   = ['bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500']
  const netFlow     = data.totalCredit - data.totalDebit

  return (
    <div className="space-y-3 pb-2">

      {/* Hero banner — compact */}
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-4 shadow-md">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Wallet className="h-3.5 w-3.5 text-blue-300" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-blue-300">Bank Analytical Profile</span>
            </div>
            <h2 className="text-lg font-black text-white leading-tight">{data.holder || 'N/A'}</h2>
            {data.accountType && <p className="text-xs text-blue-200/70 mt-0.5">{data.accountType}</p>}
            {data.period      && <p className="text-[10px] text-blue-300/60 mt-0.5">{data.period}</p>}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {data.status && (
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                data.status.toLowerCase() === 'regular'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
              }`}>
                {data.status}
              </span>
            )}
            {data.currency && <span className="text-[10px] text-blue-300/60 font-medium">{data.currency}</span>}
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <KpiCard label="Total Credit"  value={fmt(data.totalCredit)}      icon={ArrowUpCircle}   gradient="from-emerald-600 to-emerald-800" />
          <KpiCard label="Total Debit"   value={fmt(data.totalDebit)}       icon={ArrowDownCircle} gradient="from-rose-600 to-rose-800" />
          <KpiCard label="Net Flow"      value={fmt(Math.abs(netFlow))}     sub={netFlow >= 0 ? 'Surplus' : 'Deficit'} icon={Activity} gradient={netFlow >= 0 ? 'from-blue-600 to-blue-800' : 'from-orange-600 to-orange-800'} />
          <KpiCard label="Risk Tier"     value={data.riskTier || '—'}       icon={ShieldAlert}     gradient="from-violet-600 to-violet-800" />
        </div>
      </div>

      {/* Credit vs Debit bar */}
      <SectionCard icon={Activity} title="Credit vs Debit Flow">
        {(() => {
          const total = (data.totalCredit + data.totalDebit) || 1
          const cp = Math.round((data.totalCredit / total) * 100)
          const dp = 100 - cp
          return (
            <div className="space-y-2">
              <div className="flex h-6 rounded-lg overflow-hidden text-[10px] font-bold">
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-center text-white transition-all" style={{ width: `${cp}%` }}>
                  {cp > 15 ? `${cp}%` : ''}
                </div>
                <div className="bg-gradient-to-r from-rose-500 to-rose-600 flex-1 flex items-center justify-center text-white">
                  {dp > 15 ? `${dp}%` : ''}
                </div>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <ArrowUpCircle className="h-3 w-3" /> {fmt(data.totalCredit)}
                </span>
                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                  <ArrowDownCircle className="h-3 w-3" /> {fmt(data.totalDebit)}
                </span>
              </div>
            </div>
          )
        })()}
      </SectionCard>

      {/* Category distribution */}
      {data.categories.length > 0 && (
        <SectionCard icon={BarChart2} title="Category Distribution">
          {data.categories.map((c, i) => (
            <HBar key={i} label={c.name} value={c.total} max={maxCategory}
              color={catColors[i % catColors.length]} amount={fmt(c.total)} />
          ))}
        </SectionCard>
      )}

      {/* Anomalies */}
      {data.anomalies.length > 0 && (
        <SectionCard icon={AlertTriangle} title="High-Value Debits" iconClass="text-amber-500"
          badge={<Badge variant="destructive" className="text-[10px]">{data.anomalyCount}</Badge>}>
          <div className="space-y-1.5">
            {data.anomalies.map((tx, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-rose-50 dark:bg-rose-950/20 rounded-lg px-2.5 py-1.5">
                <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
                <span className="flex-1 truncate text-muted-foreground text-[11px]">{tx.description}</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0 tabular-nums text-[11px]">{fmt(tx.amount)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Transaction ledger */}
      {data.transactions.length > 0 && (
        <SectionCard icon={TrendingDown} title="Transaction Ledger"
          badge={<Badge variant="secondary" className="text-[10px]">{data.transactions.length} txns</Badge>}>
          <div className="overflow-x-auto -mx-3 -mb-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground text-[11px] whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground text-[11px]">Description</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground text-[11px] whitespace-nowrap">Type</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground text-[11px] whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx, i) => {
                  const isDebit = /debit/i.test(tx.type)
                  return (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums text-[11px]">{tx.date}</td>
                      <td className="px-3 py-2 max-w-[140px] truncate text-[11px]" title={tx.description}>{tx.description}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          isDebit
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}>
                          {isDebit ? <ArrowDownCircle className="h-2 w-2" /> : <ArrowUpCircle className="h-2 w-2" />}
                          {tx.type}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right font-bold whitespace-nowrap tabular-nums text-[11px] ${
                        isDebit ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {isDebit ? '−' : '+'}{fmt(tx.amount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Top entities */}
      {data.topEntities.length > 0 && (
        <SectionCard icon={Users} title="Top Entities by Volume">
          {data.topEntities.map((e, i) => (
            <HBar key={i} label={e.name} value={e.value} max={maxEntity}
              color={entColors[i % entColors.length]} amount={fmt(e.value)} />
          ))}
        </SectionCard>
      )}

      {/* Advanced insights */}
      {data.advancedLines.length > 0 && (
        <SectionCard icon={TrendingUp} title="Advanced Insights">
          <div className="space-y-1.5">
            {data.advancedLines.map((line, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30">
                <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-[11px] leading-relaxed">{line}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Risk reasoning */}
      {data.reasoning && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">Risk Assessment</h3>
              {data.creditRisk && <p className="text-[10px] text-amber-700 dark:text-amber-400">Score: {data.creditRisk}</p>}
            </div>
            {data.riskTier && (
              <Badge className="ml-auto bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/40 hover:bg-amber-500/30 text-[10px]">
                {data.riskTier}
              </Badge>
            )}
          </div>
          <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed">{data.reasoning}</p>
        </div>
      )}

    </div>
  )
}
