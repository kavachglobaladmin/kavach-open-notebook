'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Loader2, BarChart2, AlertTriangle,
} from 'lucide-react'
import apiClient from '@/lib/api/client'
import { BankAnalysisInsightViewer } from './BankAnalysisInsightViewer'

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

// ── BankAnalysisContent ───────────────────────────────────────────────────────
// Convert structured bank analysis data to insight viewer format
function BankAnalysisContent({ data }: { data: Record<string, unknown> }) {
  const details = data.details as Record<string, any> | undefined
  const cf = data.cashflow as Record<string, string> | undefined
  const monthly = data.monthly as Array<Record<string, string>> | undefined
  const types = data.types as Array<{ type: string; count: number; total_amount: string; total_amount_raw: number }> | undefined
  const atm = data.atm as { count: number; total: string; avg: string; largest: string; transactions: Array<Record<string, string>> } | undefined
  const charges = data.charges as { total: string; count: number; breakdown: Array<{ charge_type: string; amount: string }>; transactions: Array<Record<string, string>> } | undefined
  const interest = data.interest as { total: string; count: number; avg_per_quarter: string; transactions: Array<Record<string, string>> } | undefined
  const freq = data.frequency as { debit_count: number; credit_count: number; busiest_month: string; busiest_month_count: number; avg_txns_per_month: number } | undefined
  const highVal = data.high_value as Array<Record<string, string>> | undefined
  const balTrend = data.balance_trend as Array<Record<string, string>> | undefined
  const txns = data.transactions as Array<Record<string, string>> | undefined
  const pattern = data.pattern as Record<string, string | number> | undefined
  const nlp = data.nlp_groups as Array<{ group: string; keywords: string }> | undefined

  // Build content string for BankAnalysisInsightViewer
  const contentLines: string[] = []

  // Account details
  if (details) {
    contentLines.push('## Account Details')
    if (details.title) contentLines.push(`**Bank:** ${details.title}`)
    if (details.fields && Array.isArray(details.fields)) {
      for (const field of details.fields) {
        contentLines.push(`**${field.label}:** ${field.value}`)
      }
    }
    contentLines.push('')
  }

  // Cash flow
  if (cf) {
    contentLines.push('## Cash Flow Summary')
    contentLines.push(`**Opening Balance:** ${cf.opening_balance}`)
    contentLines.push(`**Total Credit:** ${cf.total_credit}`)
    contentLines.push(`**Total Debit:** ${cf.total_debit}`)
    contentLines.push(`**Net:** ${cf.net}`)
    contentLines.push(`**Closing Balance:** ${cf.closing_balance}`)
    contentLines.push('')
  }

  // Monthly summary
  if (monthly && monthly.length > 0) {
    contentLines.push('## Monthly Summary')
    contentLines.push('| Month | Credit | Debit | Balance |')
    contentLines.push('|-------|--------|-------|---------|')
    for (const row of monthly) {
      contentLines.push(`| ${row.month} | ${row.credit} | ${row.debit} | ${row.balance} |`)
    }
    contentLines.push('')
  }

  // Transaction types
  if (types && types.length > 0) {
    contentLines.push('## Transaction Types')
    for (const t of types) {
      contentLines.push(`- **${t.type}:** ${t.count} transactions, Rs.${t.total_amount}`)
    }
    contentLines.push('')
  }

  // Pattern
  if (pattern) {
    contentLines.push('## Deposit vs Withdrawal Pattern')
    contentLines.push(`- **Deposit Transactions:** ${pattern.total_deposit_txns}`)
    contentLines.push(`- **Withdrawal Transactions:** ${pattern.total_withdrawal_txns}`)
    contentLines.push(`- **Avg Deposit:** Rs.${pattern.avg_deposit}`)
    contentLines.push(`- **Avg Withdrawal:** Rs.${pattern.avg_withdrawal}`)
    contentLines.push(`- **Max Deposit:** Rs.${pattern.max_deposit}`)
    contentLines.push(`- **Max Withdrawal:** Rs.${pattern.max_withdrawal}`)
    contentLines.push('')
  }

  // ATM
  if (atm && atm.count > 0) {
    contentLines.push('## ATM Withdrawals')
    contentLines.push(`- **Count:** ${atm.count}`)
    contentLines.push(`- **Total:** Rs.${atm.total}`)
    contentLines.push(`- **Average:** Rs.${atm.avg}`)
    contentLines.push(`- **Largest:** Rs.${atm.largest}`)
    contentLines.push('')
  }

  // Charges
  if (charges && charges.count > 0) {
    contentLines.push('## Bank Charges')
    contentLines.push(`- **Total Charges:** Rs.${charges.total}`)
    contentLines.push(`- **Count:** ${charges.count}`)
    for (const b of charges.breakdown) {
      contentLines.push(`  - ${b.charge_type}: Rs.${b.amount}`)
    }
    contentLines.push('')
  }

  // Interest
  if (interest && interest.count > 0) {
    contentLines.push('## Interest Earned')
    contentLines.push(`- **Total Interest:** Rs.${interest.total}`)
    contentLines.push(`- **Count:** ${interest.count}`)
    contentLines.push(`- **Avg per Quarter:** Rs.${interest.avg_per_quarter}`)
    contentLines.push('')
  }

  // Frequency
  if (freq) {
    contentLines.push('## Transaction Frequency')
    contentLines.push(`- **Debit Transactions:** ${freq.debit_count}`)
    contentLines.push(`- **Credit Transactions:** ${freq.credit_count}`)
    contentLines.push(`- **Busiest Month:** ${freq.busiest_month} (${freq.busiest_month_count} txns)`)
    contentLines.push(`- **Avg Txns/Month:** ${freq.avg_txns_per_month}`)
    contentLines.push('')
  }

  // High value transactions
  if (highVal && highVal.length > 0) {
    contentLines.push('## High Value Transactions')
    contentLines.push('| Date | Description | Debit | Credit | Balance | Type |')
    contentLines.push('|------|-------------|-------|--------|---------|------|')
    for (const row of highVal) {
      contentLines.push(`| ${row.date} | ${row.description} | ${row.debit} | ${row.credit} | ${row.balance} | ${row.type} |`)
    }
    contentLines.push('')
  }

  // Balance trend
  if (balTrend && balTrend.length > 0) {
    contentLines.push('## Balance Trend')
    contentLines.push('| Date | Description | Debit | Credit | Balance | Month |')
    contentLines.push('|------|-------------|-------|--------|---------|-------|')
    for (const row of balTrend.slice(0, 20)) {
      contentLines.push(`| ${row.date} | ${row.description} | ${row.debit} | ${row.credit} | ${row.balance} | ${row.month_label} |`)
    }
    if (balTrend.length > 20) {
      contentLines.push(`... and ${balTrend.length - 20} more entries`)
    }
    contentLines.push('')
  }

  // All transactions
  if (txns && txns.length > 0) {
    contentLines.push('## All Transactions')
    contentLines.push('| Date | Description | Debit | Credit | Balance | Category | Keywords |')
    contentLines.push('|------|-------------|-------|--------|---------|----------|----------|')
    for (const row of txns.slice(0, 50)) {
      contentLines.push(`| ${row.date} | ${row.description} | ${row.debit} | ${row.credit} | ${row.balance} | ${row.type} | ${row.nlp_keywords} |`)
    }
    if (txns.length > 50) {
      contentLines.push(`... and ${txns.length - 50} more transactions`)
    }
    contentLines.push('')
  }

  // NLP categories
  if (nlp && nlp.length > 0) {
    contentLines.push('## NLP Categories & Keywords')
    for (const grp of nlp) {
      contentLines.push(`- **${grp.group}:** ${grp.keywords}`)
    }
    contentLines.push('')
  }

  const content = contentLines.join('\n')

  // Use BankAnalysisInsightViewer to render the formatted content
  return <BankAnalysisInsightViewer content={content} />
}

// ── BankAnalysisDialog ────────────────────────────────────────────────────────
export function BankAnalysisDialog({ sourceId, open, onClose }: BankAnalysisDialogProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const loadingMessage = useLoadingMessage(loading)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !sourceId) return
    setLoading(true)
    setError('')
    setData(null)

    const encodedId = encodeURIComponent(sourceId)

    // Try to load from cache first (GET), fall back to running the pipeline (POST)
    apiClient
      .get(`/sources/${encodedId}/bank-analysis`)
      .then(r => {
        setData(r.data)
        setLoading(false)
      })
      .catch(() => {
        // Cache miss — run the full pipeline
        apiClient
          .post(`/sources/${encodedId}/bank-analysis`, {})
          .then(r => setData(r.data))
          .catch(e => setError(e?.response?.data?.detail ?? e.message ?? 'Analysis failed'))
          .finally(() => setLoading(false))
      })
  }, [open, sourceId])

  if (!open || !mounted) return null

  // Wrap the entire component in a variable so it can be portaled out of the layout hierarchy
  const dialogContent = (
    /* position:fixed + explicit top/right/bottom/left is zoom-proof */
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
      height: '100dvh',
      maxHeight: '100dvh',
      zIndex: 999999,
      display: 'flex', flexDirection: 'column',
      background: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#111827',
      overflow: 'hidden',
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

      {/* ── Scrollable body ── */}
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

  // Portal forces the dialog to mount directly into document.body avoiding layout hierarchy locks
  return createPortal(dialogContent, document.body)
}
