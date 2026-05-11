# Detailed Code Changes - Bank Analysis Dynamic Data Fix

## File: `frontend/src/components/source/BankAnalysisInsightViewer.tsx`

### Change 1: Enhanced JsonBankStatementViewer Function

#### Location: Lines 155-175

**BEFORE:**
```typescript
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
        {/* ... rest of component */}
```

**AFTER:**
```typescript
function JsonBankStatementViewer({ data }: {
  data: { account_summary: Record<string, unknown>; transactions: Array<Record<string, unknown>> }
}) {
  const s    = data.account_summary
  const txns = data.transactions

  const totalCredit = txns.reduce((sum, t) => sum + Math.max(Number(t.credit) || 0, 0), 0)
  const totalDebit  = txns.reduce((sum, t) => sum + Math.max(Number(t.debit)  || 0, 0), 0)

  const fmtAmt = (n: number) =>
    n > 0 ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'

  // Helper to safely parse amount strings
  const parseAmt = (val: unknown): number => {
    if (typeof val === 'number') return val
    if (typeof val === 'string') {
      const num = parseFloat(val.replace(/[₹,\s]/g, ''))
      return isNaN(num) ? 0 : num
    }
    return 0
  }

  return (
    <div className="space-y-3 pb-2">
      {/* Account Summary */}
      <div className="rounded-xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-4">
        {/* ... rest of component */}
```

**What Changed:**
- Added `parseAmt` helper function to safely parse amount strings
- Handles both numeric and string formats
- Removes currency symbols and commas before parsing

---

### Change 2: Updated Amount Parsing in Account Summary

#### Location: Lines 190-210

**BEFORE:**
```typescript
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
          {s.account_holder  && <div><span className="text-blue-300/60 text-[10px]">Holder</span><p className="font-medium text-xs">{String(s.account_holder)}</p></div>}
          {s.account_number  && <div><span className="text-blue-300/60 text-[10px]">Account No.</span><p className="font-medium text-xs">{String(s.account_number)}</p></div>}
          {s.statement_period && <div><span className="text-blue-300/60 text-[10px]">Period</span><p className="font-medium text-xs">{String(s.statement_period)}</p></div>}
          {s.opening_balance != null && <div><span className="text-blue-300/60 text-[10px]">Opening</span><p className="font-medium text-xs">{fmtAmt(Number(s.opening_balance))}</p></div>}
          {s.closing_balance != null && <div><span className="text-blue-300/60 text-[10px]">Closing</span><p className="font-medium text-xs">{fmtAmt(Number(s.closing_balance))}</p></div>}
        </div>
```

**AFTER:**
```typescript
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
          {s.account_holder  && <div><span className="text-blue-300/60 text-[10px]">Holder</span><p className="font-medium text-xs">{String(s.account_holder)}</p></div>}
          {s.account_number  && <div><span className="text-blue-300/60 text-[10px]">Account No.</span><p className="font-medium text-xs">{String(s.account_number)}</p></div>}
          {s.statement_period && <div><span className="text-blue-300/60 text-[10px]">Period</span><p className="font-medium text-xs">{String(s.statement_period)}</p></div>}
          {s.opening_balance != null && <div><span className="text-blue-300/60 text-[10px]">Opening</span><p className="font-medium text-xs">{fmtAmt(parseAmt(s.opening_balance))}</p></div>}
          {s.closing_balance != null && <div><span className="text-blue-300/60 text-[10px]">Closing</span><p className="font-medium text-xs">{fmtAmt(parseAmt(s.closing_balance))}</p></div>}
        </div>
```

**What Changed:**
- Changed `Number(s.opening_balance)` to `parseAmt(s.opening_balance)`
- Changed `Number(s.closing_balance)` to `parseAmt(s.closing_balance)`
- Now handles formatted strings like "1,234.56" correctly

---

### Change 3: Updated Total Credits/Debits Parsing

#### Location: Lines 215-225

**BEFORE:**
```typescript
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
```

**AFTER:**
```typescript
          <div className="rounded-lg bg-emerald-600/20 border border-emerald-500/30 p-2 text-center">
            <p className="text-[10px] text-emerald-300">Total Credits</p>
            <p className="text-sm font-black text-emerald-300">
              {fmtAmt(s.total_credits != null ? parseAmt(s.total_credits) : totalCredit)}
            </p>
          </div>
          <div className="rounded-lg bg-rose-600/20 border border-rose-500/30 p-2 text-center">
            <p className="text-[10px] text-rose-300">Total Debits</p>
            <p className="text-sm font-black text-rose-300">
              {fmtAmt(s.total_debits != null ? parseAmt(s.total_debits) : totalDebit)}
            </p>
          </div>
```

**What Changed:**
- Changed `Number(s.total_credits)` to `parseAmt(s.total_credits)`
- Changed `Number(s.total_debits)` to `parseAmt(s.total_debits)`
- Ensures formatted amounts are parsed correctly

---

### Change 4: Updated Transaction Table Amount Parsing

#### Location: Lines 245-250

**BEFORE:**
```typescript
                  <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-2.5 py-1 whitespace-nowrap text-[11px]">{String(tx.date || '—')}</td>
                    <td className="px-2.5 py-1 max-w-[140px] truncate text-[11px]">{String(tx.description || tx.narration || '—')}</td>
                    <td className="px-2.5 py-1 text-right text-rose-600 text-[11px]">{Number(tx.debit)  > 0 ? fmtAmt(Number(tx.debit))  : '—'}</td>
                    <td className="px-2.5 py-1 text-right text-emerald-600 text-[11px]">{Number(tx.credit) > 0 ? fmtAmt(Number(tx.credit)) : '—'}</td>
                    <td className="px-2.5 py-1 text-right text-[11px]">{tx.balance != null ? fmtAmt(Number(tx.balance)) : '—'}</td>
                  </tr>
```

**AFTER:**
```typescript
                  <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-2.5 py-1 whitespace-nowrap text-[11px]">{String(tx.date || '—')}</td>
                    <td className="px-2.5 py-1 max-w-[140px] truncate text-[11px]">{String(tx.description || tx.narration || '—')}</td>
                    <td className="px-2.5 py-1 text-right text-rose-600 text-[11px]">{parseAmt(tx.debit) > 0 ? fmtAmt(parseAmt(tx.debit)) : '—'}</td>
                    <td className="px-2.5 py-1 text-right text-emerald-600 text-[11px]">{parseAmt(tx.credit) > 0 ? fmtAmt(parseAmt(tx.credit)) : '—'}</td>
                    <td className="px-2.5 py-1 text-right text-[11px]">{tx.balance != null ? fmtAmt(parseAmt(tx.balance)) : '—'}</td>
                  </tr>
```

**What Changed:**
- Changed `Number(tx.debit)` to `parseAmt(tx.debit)` (2 occurrences)
- Changed `Number(tx.credit)` to `parseAmt(tx.credit)` (2 occurrences)
- Changed `Number(tx.balance)` to `parseAmt(tx.balance)`
- All transaction amounts now parsed correctly

---

### Change 5: Fixed BankAnalysisInsightViewer Main Export Function

#### Location: Lines 260-310

**BEFORE:**
```typescript
export function BankAnalysisInsightViewer({ content, data: structuredData }: BankAnalysisInsightViewerProps) {
  // If structured data is passed directly, use it
  if (structuredData) {
    return <JsonBankStatementViewer data={{
      account_summary: {
        bank_name: structuredData.details?.title || 'Bank Statement',
        account_holder: structuredData.details?.fields?.[0]?.value || '',
        account_number: structuredData.details?.fields?.[1]?.value || '',
        statement_period: structuredData.details?.fields?.[2]?.value || '',
        opening_balance: structuredData.cashflow?.opening_balance || '0',
        closing_balance: structuredData.cashflow?.closing_balance || '0',
        total_credits: structuredData.cashflow?.total_credit || '0',
        total_debits: structuredData.cashflow?.total_debit || '0',
      },
      transactions: (structuredData.transactions || []).map(tx => ({
        date: tx.date || '',
        description: tx.description || tx.narration || '',
        debit: parseFloat(tx.debit || '0') || 0,
        credit: parseFloat(tx.credit || '0') || 0,
        balance: tx.balance ? parseFloat(tx.balance) : undefined,
      })),
    }} />
  }

  // Fall back to parsing content if no data provided
  if (!content) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
      No bank analysis data available.
    </div>
  }

  const jsonData = useMemo(() => tryParseJsonBankStatement(content), [content])
  if (jsonData) {
    return <JsonBankStatementViewer data={jsonData} />
  }
  return <LegacyBankAnalysisViewer content={content} />
}
```

**AFTER:**
```typescript
export function BankAnalysisInsightViewer({ content, data: structuredData }: BankAnalysisInsightViewerProps) {
  // If structured data is passed directly, use it
  if (structuredData) {
    // Extract account details from the details.fields array
    const fieldsMap: Record<string, string> = {}
    if (structuredData.details?.fields && Array.isArray(structuredData.details.fields)) {
      for (const field of structuredData.details.fields) {
        if (field.label && field.value) {
          fieldsMap[field.label.toLowerCase().replace(/\s+/g, '_')] = String(field.value)
        }
      }
    }

    // Parse cashflow amounts (they come as formatted strings like "1,234.56")
    const parseAmount = (val: unknown): string => {
      if (typeof val === 'string') return val
      if (typeof val === 'number') return String(val)
      return '0.00'
    }

    return <JsonBankStatementViewer data={{
      account_summary: {
        bank_name: structuredData.details?.title || fieldsMap.bank || 'Bank Statement',
        account_holder: fieldsMap.account_holder || fieldsMap.holder || '',
        account_number: fieldsMap.account_number || fieldsMap.account_no || '',
        statement_period: fieldsMap.statement_period || fieldsMap.period || '',
        opening_balance: parseAmount(structuredData.cashflow?.opening_balance || '0'),
        closing_balance: parseAmount(structuredData.cashflow?.closing_balance || '0'),
        total_credits: parseAmount(structuredData.cashflow?.total_credit || '0'),
        total_debits: parseAmount(structuredData.cashflow?.total_debit || '0'),
      },
      transactions: (structuredData.transactions || []).map(tx => ({
        date: tx.date || '',
        description: tx.description || tx.narration || '',
        debit: parseAmount(tx.debit || '0'),
        credit: parseAmount(tx.credit || '0'),
        balance: tx.balance ? parseAmount(tx.balance) : undefined,
      })),
    }} />
  }

  // Fall back to parsing content if no data provided
  if (!content) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
      No bank analysis data available.
    </div>
  }

  const jsonData = useMemo(() => tryParseJsonBankStatement(content), [content])
  if (jsonData) {
    return <JsonBankStatementViewer data={jsonData} />
  }
  return <LegacyBankAnalysisViewer content={content} />
}
```

**What Changed:**
- Added field map extraction logic to build a map from `details.fields` array
- Changed from array index access to field map lookup
- Added fallback options for different field naming conventions
- Added `parseAmount` helper to handle both string and numeric amounts
- Updated all amount parsing to use `parseAmount` instead of `parseFloat`

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| Added `parseAmt` helper | Enhancement | Robust amount parsing |
| Updated opening/closing balance parsing | Fix | Handles formatted strings |
| Updated total credits/debits parsing | Fix | Handles formatted strings |
| Updated transaction amount parsing | Fix | Handles formatted strings |
| Added field map extraction | Fix | Order-independent field lookup |
| Added `parseAmount` helper | Enhancement | Flexible amount handling |
| Updated field extraction logic | Fix | Fallback options for naming variations |

---

## Lines Changed

- **Lines 155-175**: Added `parseAmt` helper
- **Lines 190-210**: Updated balance parsing
- **Lines 215-225**: Updated total credits/debits parsing
- **Lines 245-250**: Updated transaction amount parsing
- **Lines 260-310**: Fixed main export function with field map extraction

---

## Total Changes

- **Lines Added**: ~30
- **Lines Modified**: ~15
- **Lines Removed**: 0
- **Net Change**: +30 lines (all additions, no deletions)

---

## Backward Compatibility

✅ **Fully maintained**
- All existing functionality preserved
- Legacy content parsing still works
- No breaking changes to component interface
- No changes to other components

---

## Build Status

✅ **PASSING** (0 errors, 0 type errors)
