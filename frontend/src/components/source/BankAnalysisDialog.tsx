'use client'

import { useEffect, useState } from 'react'
import {
  Loader2, BarChart2, AlertTriangle, TrendingUp, TrendingDown,
  Wallet, Activity, Calendar, Zap, Building2, MapPin, Clock,
  Mail, Info, ArrowDownRight, ArrowUpRight, CheckCircle2,
  PieChart, FileText, Download, Upload, CreditCard,
  Landmark, UserCircle, Phone
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import apiClient from '@/lib/api/client'
import { motion, Variants } from 'framer-motion'

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

// ── Animation Variants ────────────────────────────────────────────────────────
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03 }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'tween', duration: 0.3 } }
}

// ── Style constants ───────────────────────────────────────────────────────────
const cardClasses = "bg-white border border-gray-200 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden flex flex-col h-full"
const sectionHeadClasses = "flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80"
const sectionTitleClasses = "text-[11px] font-bold text-gray-800 uppercase tracking-wider"

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
  maxH?: number | 'none'
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="p-5 text-center text-gray-400 text-xs">
        No data available
      </div>
    )
  }
  const scrollWrap: React.CSSProperties =
    maxH === 'none'
      ? { overflowX: 'auto', flex: 1 }
      : { maxHeight: maxH, overflowY: 'auto', overflowX: 'auto', flex: 1 }

  return (
    <div style={scrollWrap} className="custom-scrollbar bg-white">
      <table className="w-full border-collapse text-[10px] min-w-[400px]">
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} className="px-3 py-2.5 text-left font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-100 bg-white sticky top-0 z-10 whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
              {cols.map(c => {
                const v = row[c.key] ?? '-'
                const display = ['debit', 'credit', 'amount'].includes(c.key) && (v === '0.00' || v === '0') ? '-' : v
                return (
                  <td key={c.key} className="px-3 py-2 align-top font-medium" style={{
                    color: c.color ?? '#4b5563',
                    fontFamily: c.mono ? 'var(--font-mono)' : undefined,
                    whiteSpace: c.key === 'description' ? 'normal' : 'nowrap',
                    maxWidth: c.key === 'description' ? 250 : undefined,
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

  const hasAccountSection = issuerLines.length > 0 || customerLines.length > 0 || cleanedCards.length > 0

  // Donut chart logic for Transaction Types
  const CHART_COLORS = ['#ef4444', '#22c55e', '#f59e0b', '#14b8a6', '#6366f1', '#ec4899', '#8b5cf6']
  let totalAbsAmount = 0
  if (types) {
    totalAbsAmount = types.reduce((acc, t) => acc + Math.abs(t.total_amount_raw), 0)
  }
  let currentPct = 0
  const conicGradient = types?.map((t, i) => {
    const pct = (Math.abs(t.total_amount_raw) / (totalAbsAmount || 1)) * 100
    const start = currentPct
    currentPct += pct
    return `${CHART_COLORS[i % CHART_COLORS.length]} ${start}% ${currentPct}%`
  }).join(', ')

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-5 p-2 sm:p-4 font-sans text-gray-800 bg-[#f8f9fa]">
      
      {/* ── 1. Top Header Section ── */}
      {hasAccountSection && (
        <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative mb-2">
          <div className="flex flex-col xl:flex-row p-6 gap-8 justify-between items-start">
            
            {/* Left: Bank Info */}
            <div className="flex items-start gap-4 max-w-xl">
              <div className="w-12 h-12 rounded-full bg-[#eef2ff] flex items-center justify-center shrink-0 border border-[#c7d2fe]">
                <Building2 size={24} className="text-[#4f46e5]" />
              </div>
              <div className="flex flex-col gap-1">
                {issuerLines.map((line, i) => (
                  <div key={`iss-${i}`} className={`${i === 0 ? 'text-sm font-black uppercase tracking-wider text-[#1e3a8a]' : 'text-xs font-semibold text-gray-700'}`}>
                    {line}
                  </div>
                ))}
                <div className="mt-2 flex flex-col gap-0.5">
                  {customerLines.map((line, i) => (
                    <div key={`cus-${i}`} className={`${i === 0 ? 'text-sm font-bold text-gray-900 uppercase' : 'text-xs text-gray-600'}`}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Right: Statement Title & Details Grid */}
            <div className="flex flex-col gap-4 w-full xl:w-auto xl:min-w-[450px]">
               <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <FileText className="text-[#2563eb]" size={24} />
                  <h1 className="text-xl font-black text-[#1e3a8a] tracking-tight uppercase">Statement of Account</h1>
               </div>
              {cleanedCards.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  {cleanedCards.map((f, i) => {
                    let Icon = Info
                    const lbl = f.label.toLowerCase()
                    if (lbl.includes('date') || lbl.includes('from') || lbl.includes('period')) Icon = Calendar
                    else if (lbl.includes('time')) Icon = Clock
                    else if (lbl.includes('email')) Icon = Mail
                    else if (lbl.includes('cif') || lbl.includes('ckyc')) Icon = UserCircle

                    return (
                      <div key={i} className="flex items-center gap-4">
                        <Icon size={14} className="text-gray-400 shrink-0" />
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="text-[10px] text-gray-500 font-bold uppercase w-24">{f.label}</span>
                          <span className="text-gray-300 text-[10px]">:</span>
                          <span className="text-[11px] font-bold text-gray-900 flex-1">{f.value || 'Not Available'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── 2. Cash Flow Report ── */}
      {cf && (parseFloat((cf.total_credit ?? '0').replace(/,/g, '')) + parseFloat((cf.total_debit ?? '0').replace(/,/g, ''))) > 0 && (
        <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="text-[#2563eb]" size={18} />
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Cash Flow Report</h2>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap text-[11px] font-medium border-b border-gray-100 pb-4 mb-4">
            <span className="text-gray-500">Opening: <span className="font-bold text-gray-800">Rs.{cf.opening_balance}</span></span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500">Credits: <span className="font-bold text-green-600">Rs.{cf.total_credit}</span></span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500">Debits: <span className="font-bold text-red-600">Rs.{cf.total_debit}</span></span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500">Closing: <span className="font-bold text-[#d97706]">Rs.{cf.closing_balance}</span></span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Opening Balance', value: fmtAbs(cf.opening_balance), valColor: 'text-[#1e3a8a]', bg: 'bg-[#eff6ff]', border: 'border-[#bfdbfe]', icon: Wallet, iconColor: 'text-[#2563eb]' },
              { label: 'Total Credits',   value: fmtAbs(cf.total_credit),    valColor: 'text-green-700', bg: 'bg-[#f0fdf4]', border: 'border-[#bbf7d0]', icon: TrendingUp, iconColor: 'text-green-600' },
              { label: 'Total Debits',    value: fmtAbs(cf.total_debit),     valColor: 'text-red-700', bg: 'bg-[#fef2f2]', border: 'border-[#fecaca]', icon: TrendingDown, iconColor: 'text-red-600' },
              { label: 'Net Flow',        value: fmt(cf.net),                valColor: parseFloat((cf.net ?? '0').replace(/,/g, '')) >= 0 ? 'text-green-700' : 'text-red-700', bg: 'bg-white', border: 'border-gray-200', icon: Activity, iconColor: 'text-gray-400' },
              { label: 'Closing Balance', value: fmtAbs(cf.closing_balance), valColor: 'text-[#d97706]', bg: 'bg-[#fffbeb]', border: 'border-[#fde68a]', icon: Wallet, iconColor: 'text-[#f59e0b]' },
            ].map((card, idx) => (
              <div key={idx} className={`relative rounded-lg border ${card.border} bg-white p-4 flex items-center gap-3 shadow-sm`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${card.bg}`}>
                  <card.icon size={18} className={card.iconColor} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-black tracking-tight ${card.valColor}`}>{card.value}</span>
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">{card.label}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── 3. Row 2: Monthly / Transaction Types / Deposit vs Withdrawal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Monthly Summary */}
        {monthly && monthly.length > 0 && (
          <motion.div variants={itemVariants} className={cardClasses}>
            <div className={sectionHeadClasses}>
              <Calendar size={14} className="text-[#3b82f6]" />
              <span className={sectionTitleClasses}>Monthly Summary</span>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col p-2">
              <TxTable rows={monthly} cols={[
                { key: 'month',   label: 'Month',   color: '#4b5563' },
                { key: 'credit',  label: 'Credits (₹)', color: '#16a34a' },
                { key: 'debit',   label: 'Debits (₹)',  color: '#dc2626' },
                { key: 'balance', label: 'Balance (₹)', color: '#111827' },
              ]} />
            </div>
          </motion.div>
        )}

        {/* Transaction Types with Donut Chart */}
        {types && types.length > 0 && (
          <motion.div variants={itemVariants} className={cardClasses}>
            <div className={sectionHeadClasses}>
              <Activity size={14} className="text-[#6366f1]" />
              <span className={sectionTitleClasses}>Transaction Types</span>
            </div>
            <div className="flex-1 p-5 flex items-center gap-6">
              <div className="relative w-32 h-32 shrink-0">
                <div className="absolute inset-0 rounded-full shadow-sm" style={{ background: `conic-gradient(${conicGradient})` }} />
                <div className="absolute inset-0 m-[22%] bg-white rounded-full shadow-inner flex items-center justify-center">
                   <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar">
                {types.map((t, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-[10px] font-bold text-gray-700 truncate max-w-[100px]">{t.type}</span>
                      </div>
                      <span className="text-[9px] text-gray-400 font-medium">({t.count} txns)</span>
                    </div>
                    <span className="text-[11px] font-bold text-right" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>
                      Rs.{t.total_amount.replace('-', '')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Deposit vs Withdrawal Pattern */}
        {pattern && (Number(pattern.total_deposit_txns) > 0 || Number(pattern.total_withdrawal_txns) > 0) && (
          <motion.div variants={itemVariants} className={cardClasses}>
            <div className={sectionHeadClasses}>
              <TrendingUp size={14} className="text-[#8b5cf6]" />
              <span className={sectionTitleClasses}>Deposit vs Withdrawal Pattern</span>
            </div>
            <div className="flex-1 p-5 flex flex-col justify-between gap-4">
              {[
                { lLabel: 'Deposit Txns', lValue: String(pattern.total_deposit_txns), lIcon: Upload, lColor: 'text-[#16a34a]', lBg: 'bg-[#dcfce7]', rLabel: 'Withdrawal Txns', rValue: String(pattern.total_withdrawal_txns), rIcon: Download, rColor: 'text-[#dc2626]', rBg: 'bg-[#fee2e2]' },
                { lLabel: 'Avg Deposit', lValue: fmt(String(pattern.avg_deposit)), lIcon: ArrowUpRight, lColor: 'text-[#16a34a]', lBg: 'bg-[#dcfce7]', rLabel: 'Avg Withdrawal', rValue: fmt(String(pattern.avg_withdrawal)), rIcon: ArrowDownRight, rColor: 'text-[#dc2626]', rBg: 'bg-[#fee2e2]' },
                { lLabel: 'Max Deposit', lValue: fmt(String(pattern.max_deposit)), lIcon: TrendingUp, lColor: 'text-[#16a34a]', lBg: 'bg-[#dcfce7]', rLabel: 'Max Withdrawal', rValue: fmt(String(pattern.max_withdrawal)), rIcon: TrendingDown, rColor: 'text-[#dc2626]', rBg: 'bg-[#fee2e2]' },
                { lLabel: 'Min Deposit', lValue: fmt(String(pattern.min_deposit)), lIcon: Download, lColor: 'text-[#3b82f6]', lBg: 'bg-[#dbeafe]', rLabel: 'Min Withdrawal', rValue: fmt(String(pattern.min_withdrawal)), rIcon: Upload, rColor: 'text-[#8b5cf6]', rBg: 'bg-[#ede9fe]' },
              ].map((row, idx) => (
                <div key={idx} className="flex justify-between items-center gap-4 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                  {/* Left Col */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${row.lBg}`}>
                      <row.lIcon size={12} className={row.lColor} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-gray-400 font-bold uppercase">{row.lLabel}</span>
                      <span className={`text-[11px] font-bold ${row.lColor}`}>{row.lValue}</span>
                    </div>
                  </div>
                  {/* Right Col */}
                  <div className="flex items-center gap-3 flex-1 justify-end text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-gray-400 font-bold uppercase">{row.rLabel}</span>
                      <span className={`text-[11px] font-bold ${row.rColor}`}>{row.rValue}</span>
                    </div>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${row.rBg}`}>
                      <row.rIcon size={12} className={row.rColor} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── 4. Row 3: ATM / Bank Charges / Transaction Freq ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {atm && atm.count > 0 && (
          <motion.div variants={itemVariants} className={cardClasses}>
            <div className={sectionHeadClasses}>
              <CreditCard size={14} className="text-[#ef4444]" />
              <span className={sectionTitleClasses}>ATM Withdrawals</span>
            </div>
            <div className="p-4 flex flex-col flex-1">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-10 h-10 bg-[#fef2f2] rounded-lg flex items-center justify-center shrink-0 border border-[#fca5a5]">
                  <CreditCard className="text-[#ef4444]" size={20} />
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-3 flex-1">
                  <div><div className="text-[9px] text-gray-400 font-bold uppercase">Count</div><div className="text-[11px] font-bold text-gray-800">{atm.count}</div></div>
                  <div><div className="text-[9px] text-gray-400 font-bold uppercase">Total</div><div className="text-[11px] font-bold text-[#ef4444]">{fmt(atm.total)}</div></div>
                  <div><div className="text-[9px] text-gray-400 font-bold uppercase">Average</div><div className="text-[11px] font-bold text-gray-600">{fmt(atm.avg)}</div></div>
                  <div><div className="text-[9px] text-gray-400 font-bold uppercase">Largest</div><div className="text-[11px] font-bold text-[#ef4444]">{fmt(atm.largest)}</div></div>
                </div>
              </div>
              <div className="text-[9px] font-bold text-gray-500 uppercase mb-2 border-b border-gray-100 pb-1">Recent Transactions</div>
              <div className="max-h-[120px] overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-2">
                {atm.transactions.map((tx, i) => (
                  <div key={i} className="flex justify-between items-start text-[10px] gap-2">
                    <div className="flex flex-col overflow-hidden">
                      <div className="flex items-center gap-1.5">
                         <div className="w-1 h-1 bg-[#ef4444] rounded-full shrink-0" />
                         <span className="text-gray-500 font-mono text-[9px]">{tx.date}</span>
                      </div>
                      <span className="text-gray-700 truncate pl-2.5" title={tx.description}>{tx.description}</span>
                    </div>
                    <span className="font-bold text-[#ef4444] shrink-0 mt-3">Rs.{tx.debit}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {charges && charges.count > 0 && (
          <motion.div variants={itemVariants} className={cardClasses}>
            <div className={sectionHeadClasses}>
              <Landmark size={14} className="text-[#f59e0b]" />
              <span className={sectionTitleClasses}>Bank Charges</span>
            </div>
            <div className="p-4 flex flex-col flex-1">
              <div className="flex items-center gap-4 mb-5 border-b border-gray-100 pb-4">
                 <div className="w-10 h-10 bg-[#fffbeb] rounded-lg flex items-center justify-center shrink-0 border border-[#fde68a]">
                  <Landmark className="text-[#f59e0b]" size={20} />
                </div>
                <div className="flex flex-col">
                  <div className="text-[9px] text-gray-400 font-bold uppercase">Total Charges</div>
                  <div className="text-sm font-black text-[#f59e0b]">Rs.{charges.total}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">{charges.count} charge transactions</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[140px] pr-2 custom-scrollbar flex flex-col gap-2.5">
                {charges.breakdown.map((b, i) => (
                  <div key={i} className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-700 font-medium">{b.charge_type}</span>
                    <span className="font-bold text-[#f59e0b]">Rs.{b.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {freq && (freq.debit_count > 0 || freq.credit_count > 0) && (
           <motion.div variants={itemVariants} className={cardClasses}>
             <div className={sectionHeadClasses}>
               <Clock size={14} className="text-[#8b5cf6]" />
               <span className={sectionTitleClasses}>Transaction Frequency</span>
             </div>
             <div className="p-5 flex flex-col justify-center flex-1 gap-6">
               <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                 <div className="flex flex-col">
                   <span className="text-[9px] text-gray-400 font-bold uppercase">Debit Transactions</span>
                   <span className="text-lg font-black text-[#8b5cf6] leading-tight">{freq.debit_count}</span>
                 </div>
                 <div className="flex flex-col text-right">
                   <span className="text-[9px] text-gray-400 font-bold uppercase">Credit Transactions</span>
                   <span className="text-lg font-black text-[#3b82f6] leading-tight">{freq.credit_count}</span>
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="flex flex-col">
                   <span className="text-[9px] text-gray-400 font-bold uppercase">Busiest Month</span>
                   <span className="text-[11px] font-bold text-gray-800">{freq.busiest_month}</span>
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[9px] text-gray-400 font-bold uppercase">Txns in Busiest Month</span>
                   <span className="text-[11px] font-bold text-[#8b5cf6]">{freq.busiest_month_count}</span>
                 </div>
                 <div className="flex flex-col col-span-2 pt-2 border-t border-gray-50">
                   <span className="text-[9px] text-gray-400 font-bold uppercase">Avg Txns / Month</span>
                   <span className="text-sm font-bold text-gray-800">{freq.avg_txns_per_month}</span>
                 </div>
               </div>
             </div>
           </motion.div>
        )}
      </div>

      {/* ── 5. Row 4: Interest Earned & NLP Categories ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
         {interest && interest.count > 0 && (
          <motion.div variants={itemVariants} className={cardClasses}>
            <div className={sectionHeadClasses}>
              <CheckCircle2 size={14} className="text-[#10b981]" />
              <span className={sectionTitleClasses}>Interest Earned</span>
            </div>
            <div className="p-4 flex flex-col flex-1">
              <div className="flex items-center gap-4 mb-4 border-b border-gray-100 pb-3">
                <div className="w-10 h-10 bg-[#ecfdf5] rounded-lg flex items-center justify-center shrink-0 border border-[#a7f3d0]">
                  <CheckCircle2 className="text-[#10b981]" size={20} />
                </div>
                <div className="flex flex-col">
                  <div className="text-[9px] text-gray-400 font-bold uppercase">Total Interest</div>
                  <div className="text-sm font-black text-[#10b981]">Rs.{interest.total}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">{interest.count} entries · Avg/Qtr: Rs.{interest.avg_per_quarter}</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[120px] pr-2 custom-scrollbar flex flex-col gap-2.5">
                {interest.transactions.map((tx, i) => (
                  <div key={i} className="flex justify-between items-start text-[10px] gap-2">
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[9px] text-gray-400 font-mono">{tx.date}</span>
                      <span className="text-gray-700 truncate font-medium">{tx.description}</span>
                    </div>
                    <span className="font-bold text-[#10b981] shrink-0 mt-2">Rs.{tx.credit}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {nlp && nlp.length > 0 && (
           <motion.div variants={itemVariants} className={`${cardClasses} md:col-span-2`}>
             <div className={sectionHeadClasses}>
               <Zap size={14} className="text-[#3b82f6]" />
               <span className={sectionTitleClasses}>NLP Categories & Keywords</span>
             </div>
             <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[180px] overflow-y-auto custom-scrollbar content-start">
               {nlp.map((grp, i) => (
                 <div key={i} className="bg-white border border-[#e2e8f0] rounded-md p-2 shadow-sm flex flex-col justify-between">
                   <div className="text-[10px] font-bold text-[#1e3a8a] mb-2 leading-tight">{grp.group}</div>
                   <div className="text-[9px] text-gray-500 leading-snug">{grp.keywords}</div>
                 </div>
               ))}
             </div>
           </motion.div>
        )}
      </div>

      {/* ── 6. Bottom Tables Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {balTrend && balTrend.length > 0 && (
          <motion.div variants={itemVariants} className={cardClasses}>
            <div className={sectionHeadClasses}>
              <TrendingUp size={14} className="text-[#3b82f6]" />
              <span className={sectionTitleClasses}>Balance Trend ({balTrend.length} Entries)</span>
            </div>
            <div className="p-2 flex-1 flex flex-col overflow-hidden">
              <TxTable rows={balTrend} maxH={300} cols={[
                { key: 'date',        label: 'Date',        color: '#6b7280', mono: true },
                { key: 'description', label: 'Description', color: '#374151' },
                { key: 'debit',       label: 'Debit (₹)',   color: '#ef4444' },
                { key: 'credit',      label: 'Credit (₹)',  color: '#10b981' },
                { key: 'balance',     label: 'Balance (₹)', color: '#111827' },
              ]} />
            </div>
          </motion.div>
        )}

        {highVal && highVal.length > 0 && (
          <motion.div variants={itemVariants} className={cardClasses}>
            <div className={sectionHeadClasses}>
              <AlertTriangle size={14} className="text-[#ef4444]" />
              <span className={sectionTitleClasses}>High Value Transactions ({highVal.length} Entries)</span>
            </div>
            <div className="p-2 flex-1 flex flex-col overflow-hidden">
              <TxTable rows={highVal} maxH={300} cols={[
                { key: 'date',        label: 'Date',     color: '#6b7280', mono: true },
                { key: 'description', label: 'Desc',     color: '#374151' },
                { key: 'debit',       label: 'Debit (₹)',    color: '#ef4444' },
                { key: 'credit',      label: 'Credit (₹)',   color: '#10b981' },
                { key: 'balance',     label: 'Balance (₹)',  color: '#111827' },
                { key: 'type',        label: 'Category', color: '#d97706' },
              ]} />
            </div>
          </motion.div>
        )}

        {txns && txns.length > 0 && (
          <motion.div variants={itemVariants} className={cardClasses}>
            <div className={sectionHeadClasses}>
              <BarChart2 size={14} className="text-[#10b981]" />
              <span className={sectionTitleClasses}>All Transactions ({txns.length} Entries)</span>
            </div>
            <div className="p-2 flex-1 flex flex-col overflow-hidden">
              <TxTable rows={txns} maxH={300} cols={[
                { key: 'date',         label: 'Date',     color: '#6b7280', mono: true },
                { key: 'description',  label: 'Desc',     color: '#374151' },
                { key: 'debit',        label: 'Debit (₹)',    color: '#ef4444' },
                { key: 'credit',       label: 'Credit (₹)',   color: '#10b981' },
                { key: 'balance',      label: 'Balance (₹)',  color: '#111827' },
                { key: 'type',         label: 'Category', color: '#d97706' },
              ]} />
            </div>
          </motion.div>
        )}
      </div>

      {/* ── 7. Bottom Footer Summary ── */}
      <motion.div variants={itemVariants} className="mt-2 bg-[#eff6ff] rounded-b-[2rem] p-6 border-t-[3px] border-[#3b82f6] flex flex-wrap items-center justify-between gap-6 relative shadow-inner">
        <div className="flex items-center gap-4 relative z-10 w-full lg:w-auto">
          <div className="w-10 h-10 bg-[#3b82f6] rounded-full flex items-center justify-center shadow-md">
            <PieChart className="text-white" size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[#1e3a8a] uppercase tracking-wider mb-1">Statement Summary</span>
            <div className="flex gap-4">
              <div className="flex flex-col"><span className="text-[9px] text-gray-500 font-medium">Brought Forward</span><span className="font-bold text-[#2563eb] text-[11px]">Rs.{cf?.opening_balance ?? '-'} CR</span></div>
              <div className="flex flex-col"><span className="text-[9px] text-gray-500 font-medium">Closing Balance</span><span className="font-bold text-[#10b981] text-[11px]">Rs.{cf?.closing_balance ?? '-'} CR</span></div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-around flex-1 relative z-10 gap-2 min-w-[300px]">
           <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-gray-600 uppercase">Total Debits</span>
            <span className="text-[13px] font-black text-gray-900 mt-0.5">Rs.{cf?.total_debit ?? '-'}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-gray-600 uppercase">Total Credits</span>
            <span className="text-[13px] font-black text-gray-900 mt-0.5">Rs.{cf?.total_credit ?? '-'}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-gray-600 uppercase">Dr Count</span>
            <span className="text-[13px] font-black text-gray-900 mt-0.5">{freq?.debit_count ?? '-'}</span>
          </div>
           <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-gray-600 uppercase">Cr Count</span>
            <span className="text-[13px] font-black text-gray-900 mt-0.5">{freq?.credit_count ?? '-'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10 border-l border-[#bfdbfe] pl-6 w-full lg:w-auto">
           <Calendar className="text-[#3b82f6]" size={20} />
           <div className="flex flex-col">
             <span className="text-[9px] font-bold text-gray-500 uppercase">Statement Period</span>
             <span className="text-[11px] font-bold text-gray-900 mt-0.5">{cleanedCards.find(c => c.label.toLowerCase().includes('from'))?.value || 'N/A'}</span>
             <div className="flex items-center gap-1 text-[8px] text-gray-400 mt-1">
                <Clock size={8} /> Last transaction date appearing in this statement is {cleanedCards.find(c => c.label.toLowerCase().includes('to'))?.value?.split(' ')[2] || 'N/A'}
             </div>
           </div>
        </div>
      </motion.div>

      <div className="text-center mt-2 pb-4">
         <div className="inline-flex items-center justify-center gap-2 text-[#1e3a8a] font-bold text-[11px] bg-[#eef2ff] px-4 py-1.5 rounded-full border border-[#c7d2fe]">
            <div className="bg-[#3b82f6] text-white rounded-full p-0.5">
               <CheckCircle2 size={12} />
            </div>
            Thank you for banking with us.
         </div>
         <div className="text-[9px] text-gray-400 mt-1.5">This is a computer generated statement and does not require a signature.</div>
      </div>

    </motion.div>
  )
}

// ── BankAnalysisDialog ────────────────────────────────────────────────────────
export function BankAnalysisDialog({ sourceId, open, onClose }: BankAnalysisDialogProps) {
  const [data, setData]     = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const loadingMessage      = useLoadingMessage(loading)

  const runAnalysis = (force = false) => {
    if (!sourceId) return
    setLoading(true)
    setError('')
    setData(null)
    const url = force
      ? `/sources/${encodeURIComponent(sourceId)}/bank-analysis?force_refresh=true`
      : `/sources/${encodeURIComponent(sourceId)}/bank-analysis`
    apiClient
      .post(url, {})
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.detail ?? e.message ?? 'Analysis failed'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!open || !sourceId) return
    runAnalysis(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourceId])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="flex flex-col sm:max-w-[98vw] w-[min(98vw,1600px)] max-h-[96vh] p-0 gap-0 overflow-hidden bg-white border-none shadow-[0_0_50px_-12px_rgba(0,0,0,0.25)] rounded-2xl">

        {/* ── Scrollable body (Header is now part of the content body per the image) ── */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 sm:p-4 bg-white">
          <div className="flex flex-col gap-4 max-w-[1500px] mx-auto">

            {loading && (
              <div className="flex flex-col items-center justify-center min-h-[500px] gap-4 text-gray-500">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#eff6ff] rounded-full blur-xl animate-pulse" />
                  <Loader2 size={40} className="animate-spin text-[#2563eb] relative z-10" />
                </div>
                <p className="text-sm font-bold text-center max-w-sm text-gray-800">{loadingMessage}</p>
                <p className="text-[10px] text-center max-w-xs text-gray-400 uppercase tracking-wide">
                  Scanned PDFs require OCR and may take several minutes.
                </p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
                 <div className="w-16 h-16 bg-[#fef2f2] rounded-full flex items-center justify-center mb-2 border border-[#fca5a5]">
                    <AlertTriangle size={32} className="text-[#ef4444]" />
                 </div>
                 <span className="text-base font-black text-gray-900 uppercase">Analysis Failed</span>
                 <span className="text-xs font-bold text-[#ef4444] max-w-md text-center bg-[#fef2f2] px-4 py-2 rounded-lg border border-[#fecaca]">{error}</span>
              </div>
            )}

            {data && !loading && <BankAnalysisContent data={data} />}
          </div>
        </div>

        {/* ── Close button top right overlay (since header is internal) ── */}
        <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 shadow-sm transition-all z-50"
          >
            <span className="sr-only">Close</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </DialogContent>
    </Dialog>
  )
}