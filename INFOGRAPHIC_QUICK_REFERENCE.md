# Infographic UI - Quick Reference Guide

## Quick Start

### Display Infographic in a Component

```typescript
import { InfographicViewer } from '@/components/source/InfographicViewer'

export function MyComponent({ sourceId }: { sourceId: string }) {
  return <InfographicViewer sourceId={sourceId} autoGenerate={true} />
}
```

### Use Infographic Hook

```typescript
import { useInfographic, useGenerateInfographic } from '@/lib/hooks/use-infographic'

export function MyComponent({ sourceId }: { sourceId: string }) {
  const { data: infographic, isLoading, error } = useInfographic(sourceId)
  const generateMutation = useGenerateInfographic()

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {infographic && <pre>{JSON.stringify(infographic, null, 2)}</pre>}
      <button onClick={() => generateMutation.mutate(sourceId)}>
        Generate
      </button>
    </div>
  )
}
```

## API Endpoints

### Generate Infographic
```
POST /api/sources/{sourceId}/infographic
Content-Type: application/json

{
  "model_name": "qwen3",
  "temperature": 0.2
}
```

**Response:**
```json
{
  "source_id": "source:123",
  "document_type": "bank_statement",
  "header": {
    "title": "Bank Statement Analysis",
    "subtitle": "Account Summary"
  },
  "stat": {
    "value": "₹50,000",
    "label": "Total Balance"
  },
  "account": { ... },
  "financial_summary": { ... },
  "key_transactions": [ ... ],
  "timeline_events": [ ... ],
  "highlights": [ ... ]
}
```

## Data Types

### InfographicResponse
```typescript
interface InfographicResponse {
  source_id: string
  document_type: 'mobile_cdr' | 'bank_statement' | 'ir_document' | 'person_profile' | 'general'
  header?: { title: string; subtitle: string }
  stat?: { value: string; label: string }
  highlights?: Array<{ title: string; subtitle?: string; description: string }>
  
  // Bank statement specific
  account?: Record<string, string>
  financial_summary?: Record<string, string>
  key_transactions?: Array<{ date: string; description: string; amount: string; type: string; balance?: string }>
  
  // Mobile CDR specific
  subject?: Record<string, string>
  call_summary?: Record<string, string>
  top_contacts?: Array<{ number: string; calls: string; type: string }>
  key_locations?: Array<{ cell_id: string; area: string; count: string }>
  
  // Criminal/IR specific
  case_details?: Array<{ fir_no: string; section: string; date: string; police_station: string; status: string }>
  associates?: Array<{ name: string; relation: string }>
  
  // Common
  timeline_events?: Array<{ date: string; event: string }>
  left_column?: Array<{ title: string; description: string; icon: string }>
  right_column?: Array<{ title: string; description: string; icon: string }>
}
```

## Caching

### Check Cache
```typescript
import { infographicApi } from '@/lib/api/infographic'

const cached = infographicApi.getCached(sourceId)
if (cached) {
  console.log('Found in cache:', cached)
}
```

### Clear Cache
```typescript
import { infographicApi } from '@/lib/api/infographic'

infographicApi.clearCache(sourceId)
```

## Component Props

### InfographicViewer
```typescript
interface InfographicViewerProps {
  sourceId: string
  autoGenerate?: boolean  // Default: true
}
```

### InfographicInsightViewer
```typescript
interface InfographicInsightViewerProps {
  content?: string  // JSON string or markdown
}
```

## Supported Document Types

| Type | Indicator | Layout |
|------|-----------|--------|
| Bank Statement | `bank_statement` | Account + Financial + Transactions |
| Mobile CDR | `mobile_cdr` | Subject + Call Summary + Contacts |
| Criminal/IR | `ir_document` | Profile + Associates + Case Details |
| Generic | `general` | Left/Right Columns + Highlights |

## Debugging

### Enable Logging
```typescript
// Logs are automatically enabled in development
// Check browser console for:
// [InfographicAPI] - API calls
// [InfographicCache] - Cache operations
// [useInfographic] - Hook operations
// [InfographicInsightViewer] - Parsing operations
```

### Check Cache Status
```javascript
// In browser console:
localStorage.getItem('infographic_cache_source:123')
```

### Clear All Caches
```javascript
// In browser console:
Object.keys(localStorage)
  .filter(k => k.startsWith('infographic_cache_'))
  .forEach(k => localStorage.removeItem(k))
```

## Common Issues & Solutions

### Issue: Infographic not displaying
**Solution:**
1. Check browser console for errors
2. Verify API is running: `curl http://localhost:5055/api/health`
3. Try regenerating: Click "Regenerate" button
4. Clear cache: `localStorage.clear()`

### Issue: Slow generation
**Solution:**
1. Check API logs: `docker logs api`
2. Verify Ollama is running: `curl http://localhost:11434/api/tags`
3. Check system resources: `top` or Task Manager

### Issue: Cache not working
**Solution:**
1. Check localStorage quota: `console.log(localStorage.length)`
2. Clear old caches: See "Clear All Caches" above
3. Check browser privacy settings

## Performance Tips

1. **Use caching**: Always use `useInfographic` hook (has built-in caching)
2. **Lazy load**: Only generate when needed
3. **Batch operations**: Generate multiple infographics in sequence
4. **Monitor cache**: Periodically clear old entries

## Integration Examples

### In Source Detail Page
```typescript
import { InfographicViewer } from '@/components/source/InfographicViewer'

export function SourceDetail({ sourceId }: { sourceId: string }) {
  return (
    <div className="space-y-4">
      <h2>Source Analysis</h2>
      <InfographicViewer sourceId={sourceId} autoGenerate={true} />
    </div>
  )
}
```

### In Insight Dialog
```typescript
import { InfographicInsightViewer } from '@/components/source/InfographicInsightViewer'

export function InsightDialog({ insight }: { insight: any }) {
  return (
    <Dialog>
      <DialogContent>
        <InfographicInsightViewer content={insight.content} />
      </DialogContent>
    </Dialog>
  )
}
```

### In Custom Hook
```typescript
import { useInfographic } from '@/lib/hooks/use-infographic'

export function useSourceAnalysis(sourceId: string) {
  const { data: infographic, isLoading } = useInfographic(sourceId)
  
  return {
    infographic,
    isLoading,
    documentType: infographic?.document_type,
    hasTransactions: !!infographic?.key_transactions?.length,
  }
}
```

## API Response Examples

### Bank Statement
```json
{
  "source_id": "source:123",
  "document_type": "bank_statement",
  "header": {
    "title": "Federal Bank Statement",
    "subtitle": "Account: 1234567890"
  },
  "stat": {
    "value": "₹2,50,000",
    "label": "Total Balance"
  },
  "account": {
    "Account Number": "1234567890",
    "Account Holder": "John Doe",
    "Bank": "Federal Bank"
  },
  "financial_summary": {
    "Total Credits": "₹5,00,000",
    "Total Debits": "₹2,50,000"
  },
  "key_transactions": [
    {
      "date": "2024-01-15",
      "description": "Salary Deposit",
      "amount": "₹50,000",
      "type": "credit",
      "balance": "₹2,50,000"
    }
  ]
}
```

### Mobile CDR
```json
{
  "source_id": "source:456",
  "document_type": "mobile_cdr",
  "header": {
    "title": "Mobile CDR Analysis",
    "subtitle": "Phone: +91-9876543210"
  },
  "call_summary": {
    "outgoing": "150",
    "incoming": "200",
    "sms": "50",
    "data": "2.5GB"
  },
  "top_contacts": [
    {
      "number": "+91-9876543211",
      "type": "Mobile",
      "calls": "45"
    }
  ]
}
```

## Version Info

- **Created**: May 2026
- **Last Updated**: May 2026
- **Status**: Production Ready
- **Compatibility**: React 19+, Next.js 16+

## Support

For issues or questions:
1. Check this guide first
2. Review `INFOGRAPHIC_UI_FIX_COMPLETE.md` for detailed documentation
3. Check browser console logs
4. Review API logs: `docker logs api`
5. Open an issue on GitHub
