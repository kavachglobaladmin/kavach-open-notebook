'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, AlertTriangle, Shield, MapPin, Calendar,
  Users, FileText, Eye, Target, ChevronRight,
  BookOpen, Network, Smartphone, TrendingUp,
  Search, Crosshair, Brain, Activity, ChevronDown,
  Fingerprint, Gavel, Home,
  Hash, Clock,
} from 'lucide-react'

interface InvestigativeProfileInsightViewerProps {
  content: string
}

export function isInvestigativeProfileInsight(insightType: string): boolean {
  const type = insightType.toLowerCase()
  return (
    type.includes('investigat') ||
    type.includes('investigation profile') ||
    type.includes('profile analysis') ||
    type.includes('criminal profile') ||
    type.includes('subject profile')
  )
}


interface FlatSegment {
  title: string
  icon: React.ElementType
  color: string
  accent: string
  items: string[]
}

const SEGMENT_RULES: {
  keywords: string[]
  title: string
  icon: React.ElementType
  color: string
  accent: string
}[] = [
  {
    keywords: ['height', 'complexion', 'face shape', 'eyes', 'hair', 'moustache', 'built', 'tattoo', 'physical'],
    title: 'Physical Description',
    icon: Eye,
    color: 'text-violet-400',
    accent: '#a78bfa',
  },
  {
    keywords: ['gang', 'group', 'syndicate', 'associate', 'member', 'affiliated', 'network'],
    title: 'Gang & Network Affiliations',
    icon: Network,
    color: 'text-cyan-400',
    accent: '#22d3ee',
  },
  {
    keywords: ['apprehended', 'arrested', 'convicted', 'fir', 'case', 'police', 'court', 'sentenced', 'bail', 'custody'],
    title: 'Criminal Case History',
    icon: Gavel,
    color: 'text-rose-400',
    accent: '#fb7185',
  },
  {
    keywords: ['november', 'june', 'august', 'april', 'january', 'february', 'march', 'may', 'july', 'september', 'october', 'december', '201', '202', '199'],
    title: 'Timeline of Events',
    icon: Clock,
    color: 'text-amber-400',
    accent: '#fbbf24',
  },
  {
    keywords: ['father', 'mother', 'family', 'relative', 'constable', 'business', 'education', 'llb', 'university', 'college'],
    title: 'Background & Family',
    icon: Home,
    color: 'text-emerald-400',
    accent: '#34d399',
  },
  {
    keywords: ['murder', 'robbery', 'extortion', 'attempt', 'heinous', 'crime', 'conviction', 'prior'],
    title: 'Criminal Activities',
    icon: AlertTriangle,
    color: 'text-orange-400',
    accent: '#fb923c',
  },
  {
    keywords: ['individual', 'accused', 'report', 'summary', 'overview', 'comprehensive', 'details', 'information'],
    title: 'Profile Summary',
    icon: FileText,
    color: 'text-blue-400',
    accent: '#60a5fa',
  },
]

function parseFlatTextToSegments(text: string): FlatSegment[] {
  // Split on double newlines or sentence boundaries
  const rawParagraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 20)

  // Further split long paragraphs at sentence boundaries
  const sentences: string[] = []
  for (const para of rawParagraphs) {
    const parts = para.split(/(?<=[.!?])\s+(?=[A-Z])/)
    sentences.push(...parts.map(s => s.trim()).filter(s => s.length > 15))
  }

  // Score each sentence against each segment rule
  const buckets: Map<string, { rule: typeof SEGMENT_RULES[0]; sentences: string[] }> = new Map()
  const unmatched: string[] = []

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()
    let bestRule: typeof SEGMENT_RULES[0] | null = null
    let bestScore = 0

    for (const rule of SEGMENT_RULES) {
      const score = rule.keywords.filter(k => lower.includes(k)).length
      if (score > bestScore) {
        bestScore = score
        bestRule = rule
      }
    }

    if (bestRule && bestScore > 0) {
      const key = bestRule.title
      if (!buckets.has(key)) {
        buckets.set(key, { rule: bestRule, sentences: [] })
      }
      buckets.get(key)!.sentences.push(sentence)
    } else {
      unmatched.push(sentence)
    }
  }

  const result: FlatSegment[] = []

  // Add matched segments in rule order
  for (const rule of SEGMENT_RULES) {
    const bucket = buckets.get(rule.title)
    if (bucket && bucket.sentences.length > 0) {
      result.push({
        title: rule.title,
        icon: rule.icon,
        color: rule.color,
        accent: rule.accent,
        items: bucket.sentences,
      })
    }
  }

  // Add unmatched as a general overview
  if (unmatched.length > 0) {
    result.unshift({
      title: 'Profile Overview',
      icon: FileText,
      color: 'text-blue-400',
      accent: '#60a5fa',
      items: unmatched,
    })
  }

  return result
}

// Extract key stats from flat text for the hero banner
function extractStatsFromFlat(text: string): {
  totalIndividuals: number
  totalCases: number
  gangsCount: number
  timelineEvents: number
} {
  const indivMatch = text.match(/(\d+)\s+individuals/i)
  const casesMatch = text.match(/(\d+)\s+(?:prior\s+)?convictions?/i)
  const gangsMatch = text.match(/(\d+)\s+(?:gangs?|groups?)/i)
  const eventsMatch = text.match(/(\d+)\s+(?:events?|incidents?|cases?)/i)

  return {
    totalIndividuals: indivMatch ? parseInt(indivMatch[1]) : 0,
    totalCases: casesMatch ? parseInt(casesMatch[1]) : 0,
    gangsCount: gangsMatch ? parseInt(gangsMatch[1]) : 0,
    timelineEvents: eventsMatch ? parseInt(eventsMatch[1]) : 0,
  }
}

// Extract named persons from text
function extractNamedPersons(text: string): string[] {
  const names: string[] = []
  // Match capitalized name patterns (2-3 words)
  const re = /\b([A-Z][a-z]+(?:\s+[A-Z@][a-z]+){1,3})\b/g
  let m: RegExpExecArray | null
  const seen = new Set<string>()
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim()
    // Filter out common non-name capitalized phrases (English stop words only)
    if (
      name.length > 4 &&
      !name.match(/^(The|This|These|Those|Their|There|When|Where|While|After|Before|During|Since|Until)$/) &&
      !seen.has(name)
    ) {
      seen.add(name)
      names.push(name)
    }
  }
  return names.slice(0, 12)
}

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function clean(val: string): string {
  return val.replace(/\*\*/g, '').replace(/`/g, '').trim()
}

function isInsuff(val: string): boolean {
  const v = val.toLowerCase().trim()
  return !v || ['insufficient data', 'unknown', 'not available', '---', 'n/a', 'not provided'].some(s => v === s || v.includes(s))
}

// Extract a ## or ### section by heading keyword, returns { heading, body }
// Get all top-level sections from markdown
interface Section { heading: string; level: number; body: string }
function getAllSections(content: string): Section[] {
  const sections: Section[] = []
  const re = /^(#{1,3})\s+(.+)$/gm
  let match: RegExpExecArray | null
  const indices: { idx: number; level: number; heading: string }[] = []
  while ((match = re.exec(content)) !== null) {
    indices.push({ idx: match.index, level: match[1].length, heading: clean(match[2]) })
  }
  for (let i = 0; i < indices.length; i++) {
    const start = content.indexOf('\n', indices[i].idx) + 1
    const end = i + 1 < indices.length ? indices[i + 1].idx : content.length
    sections.push({ heading: indices[i].heading, level: indices[i].level, body: content.slice(start, end).trim() })
  }
  return sections
}

function getPartSections(content: string): Section[] {
  const sections: Section[] = []
  const re = /^\s*(?:\*{0,2})?(PART\s+[-â€“â€”]?\s*(?:[IVX]+|\d+)[^:\n]*)(?::)?(?:\*{0,2})?\s*$/gim
  const matches = Array.from(content.matchAll(re))

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const start = (match.index ?? 0) + match[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? content.length) : content.length
    const heading = clean(match[1])
    const body = content.slice(start, end).trim()
    if (body) {
      sections.push({ heading, level: 2, body })
    }
  }

  return sections
}

// Extract bullet lines from body text
function extractBullets(body: string): string[] {
  return body.split('\n')
    .filter(l => /^[-*â€¢]/.test(l.trim()))
    .map(l => clean(l.replace(/^[-*â€¢]\s*/, '')))
    .filter(l => l && !isInsuff(l))
}

// Extract sub-sections (### inside a section body)
function extractSubSections(body: string): { title: string; lines: string[] }[] {
  const result: { title: string; lines: string[] }[] = []
  const re = /\*\*([^*]+)\*\*[:\s]*([\s\S]*?)(?=\*\*[^*]+\*\*[:\s]|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const title = m[1].trim()
    const lines = m[2].split('\n')
      .map(l => clean(l.replace(/^[-*â€¢]\s*/, '')))
      .filter(l => l && !isInsuff(l))
    if (lines.length > 0) result.push({ title, lines })
  }
  return result
}

interface MarkdownTable {
  headers: string[]
  rows: string[][]
}

function isMarkdownTableLine(line: string): boolean {
  const trimmed = line.trim()
  return /^\|.+\|$/.test(trimmed)
}

function parseMarkdownTableBlock(lines: string[]): MarkdownTable {
  const parsedRows = lines
    .map(line => line.trim())
    .map(line => line.replace(/^\|/, '').replace(/\|$/, ''))
    .map(line => line.split('|').map(cell => clean(cell)))

  const contentRows = parsedRows.filter(cells => {
    const joined = cells.join('').replace(/\s/g, '')
    if (!joined) return false
    return !cells.every(cell => /^:?-{3,}:?$/.test(cell))
  })

  if (contentRows.length < 2) {
    return { headers: [], rows: [] }
  }

  const headers = contentRows[0]
  const rows = contentRows.slice(1).map((row) => {
    if (row.length === headers.length) return row
    if (row.length < headers.length) {
      return [...row, ...Array(headers.length - row.length).fill('')]
    }
    return [...row.slice(0, headers.length - 1), row.slice(headers.length - 1).join(' | ')]
  })

  return { headers, rows }
}

function parseMarkdownTables(body: string): MarkdownTable[] {
  const lines = body.split('\n')
  const blocks: string[][] = []
  let current: string[] = []

  for (const line of lines) {
    if (isMarkdownTableLine(line)) {
      current.push(line)
      continue
    }
    if (current.length > 0) {
      blocks.push(current)
      current = []
    }
  }

  if (current.length > 0) {
    blocks.push(current)
  }

  return blocks
    .map(parseMarkdownTableBlock)
    .filter(table => table.headers.length >= 2 && table.rows.length > 0)
}

function parseMarkdownTable(body: string): MarkdownTable {
  return parseMarkdownTables(body)[0] ?? { headers: [], rows: [] }
}

// Extract inline value after a label - handles bold labels and multi-word label variants
function extractInline(content: string, label: string): string {
  const re = new RegExp(`(?:^|\\n)[-*â€¢]?\\s*\\*?\\*?${label}\\*?\\*?[:\\s]+([^\\n]+)`, 'i')
  const m = content.match(re)
  return m ? clean(m[1]) : ''
}

// Extract subject name - handles many label variants the LLM uses
function extractSubjectName(content: string): string {
  const patterns = [
    /\*\*Full\s+Name\s*[/\\|]?\s*Identifier\*\*[:\s]+([^\n]+)/i,
    /\*\*Full\s+Name\*\*[:\s]+([^\n]+)/i,
    /\*\*Name\*\*[:\s]+([^\n]+)/i,
    /\*\*Subject\s+Name\*\*[:\s]+([^\n]+)/i,
    /\*\*Subject\*\*[:\s]+([^\n]+)/i,
    /Full\s+Name\s*[/\\|]?\s*Identifier[:\s]+([^\n]+)/i,
    /Full\s+Name[:\s]+([^\n]+)/i,
    /Subject\s+Name[:\s]+([^\n]+)/i,
    /^[-*â€¢]\s*Name[:\s]+([^\n]+)/im,
    // Flat prose patterns
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)'s\s+personal\s+details/,
    /report\s+on\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /profile\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+was\s+convicted/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)'s\s+father/,
    /including\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+who/,
  ]
  for (const re of patterns) {
    const m = content.match(re)
    if (m) {
      const val = clean(m[1])
      if (val && !isInsuff(val)) return val
    }
  }

  // Frequency-based fallback: find the most mentioned 2-word capitalized name
  const nameRe = /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g
  const freq = new Map<string, number>()
  let nm: RegExpExecArray | null
  while ((nm = nameRe.exec(content)) !== null) {
    const candidate = nm[1]
    if (!candidate.match(/^(The|This|These|Those|Their|There|When|Where|While|After|Before|During|Since|Until)\s/)) {
      freq.set(candidate, (freq.get(candidate) ?? 0) + 1)
    }
  }
  if (freq.size > 0) {
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]
    if (top[1] >= 2) return top[0]
  }

  return ''
}

// Derive a display title from the first sentence when no name is found
function deriveTitleFromContent(content: string): string {
  const firstSentence = content.trim().split(/[.!?\n]/)[0] ?? ''
  const snippet = firstSentence.trim().slice(0, 60)
  return snippet.length > 5 ? snippet : 'Subject Profile'
}

// â”€â”€ Section icon map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SECTION_ICONS: { keywords: string[]; icon: React.ElementType; color: string }[] = [
  { keywords: ['subject', 'identification', 'bio', 'personal'], icon: User, color: 'text-blue-400' },
  { keywords: ['physical'], icon: Eye, color: 'text-violet-400' },
  { keywords: ['modus', 'operandi', 'behavioral', 'behaviour'], icon: TrendingUp, color: 'text-orange-400' },
  { keywords: ['chronological', 'case', 'history', 'criminal record'], icon: FileText, color: 'text-rose-400' },
  { keywords: ['organizational', 'network', 'associate', 'gang'], icon: Network, color: 'text-cyan-400' },
  { keywords: ['digital', 'operational', 'evasion', 'footprint'], icon: Smartphone, color: 'text-indigo-400' },
  { keywords: ['risk', 'threat', 'assessment'], icon: Shield, color: 'text-rose-500' },
  { keywords: ['actionable', 'directive', 'field'], icon: Target, color: 'text-red-400' },
  { keywords: ['gap', 'unknown', 'missing', 'confidence'], icon: AlertTriangle, color: 'text-amber-400' },
  { keywords: ['key insight', 'insight', 'finding'], icon: Brain, color: 'text-purple-400' },
  { keywords: ['follow', 'surveillance', 'next step'], icon: Search, color: 'text-cyan-400' },
  { keywords: ['network analysis'], icon: Network, color: 'text-teal-400' },
  { keywords: ['violent', 'incident', 'activity'], icon: Activity, color: 'text-rose-400' },
  { keywords: ['location', 'address', 'place'], icon: MapPin, color: 'text-green-400' },
  { keywords: ['education', 'academic'], icon: BookOpen, color: 'text-blue-300' },
  { keywords: ['family', 'relative'], icon: Users, color: 'text-teal-300' },
  { keywords: ['point', 'follow-up'], icon: Crosshair, color: 'text-red-400' },
]

function getSectionIcon(heading: string): { icon: React.ElementType; color: string } {
  const h = heading.toLowerCase()
  for (const entry of SECTION_ICONS) {
    if (entry.keywords.some(k => h.includes(k))) return { icon: entry.icon, color: entry.color }
  }
  return { icon: ChevronRight, color: 'text-slate-400' }
}

// â”€â”€ UI primitives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SectionCard({ icon: Icon, title, iconColor, badge, children, delay = 0 }: {
  icon: React.ElementType; title: string; iconColor: string
  badge?: React.ReactNode; children: React.ReactNode; delay?: number
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300"
    >
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
        <h3 className="text-sm font-semibold text-slate-800 tracking-wide">{title}</h3>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      <div className="p-4 text-slate-700">{children}</div>
    </motion.div>
  )
}

function BulletList({ items, color = 'text-indigo-500' }: { items: string[]; color?: string }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2.5 text-xs">
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${color}`} />
          <span className="leading-relaxed text-slate-700">{item}</span>
        </div>
      ))}
    </div>
  )
}

// Render a generic section body - handles bullets, sub-sections, tables, plain text
function GenericSectionBody({ body }: { body: string }) {
  const bullets = extractBullets(body)
  const tables = parseMarkdownTables(body)
  const subSections = extractSubSections(body)
  const plainLines = body.split('\n')
    .filter(l => l.trim() && !/^#{1,3}/.test(l.trim()) && !isMarkdownTableLine(l) && !/^[-*â€¢]/.test(l.trim()))
    .map(l => clean(l))
    .filter(l => l && !isInsuff(l))

  // Table rendering
  if (tables.length > 0) {
    return (
      <div className="space-y-4">
        {tables.map((table, tableIndex) => (
          <div key={tableIndex} className="overflow-x-auto -mx-4 px-4 scrollbar-thin scrollbar-thumb-slate-200">
            <table className="w-full text-xs text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {table.headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left font-semibold text-slate-800 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-3 text-xs leading-relaxed">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    )
  }

  // Sub-sections with bullets
  if (subSections.length > 0) {
    return (
      <div className="space-y-4">
        {subSections.map((sub, i) => (
          <div key={i}>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-2">{sub.title}</p>
            <BulletList items={sub.lines} />
          </div>
        ))}
        {bullets.length > 0 && !subSections.some(s => s.lines.join(' ').includes(bullets[0])) && (
          <div className="mt-4"><BulletList items={bullets} /></div>
        )}
      </div>
    )
  }

  // Bullet list
  if (bullets.length > 0) {
    return <BulletList items={bullets} />
  }

  // Plain text paragraphs
  if (plainLines.length > 0) {
    return (
      <div className="space-y-3">
        {plainLines.map((line, i) => (
          <p key={i} className="text-sm text-slate-700 leading-relaxed">{line}</p>
        ))}
      </div>
    )
  }

  return <p className="text-xs text-slate-400 italic">No data available.</p>
}

// â”€â”€ Collapsible section card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CollapsibleSectionCard({
  icon: Icon,
  title,
  iconColor,
  accent,
  badge,
  children,
  delay = 0,
  defaultOpen = true,
}: {
  icon: React.ElementType
  title: string
  iconColor: string
  accent: string
  badge?: React.ReactNode
  children: React.ReactNode
  delay?: number
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
        >
          <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
        </div>
        <h3 className="text-sm font-semibold text-slate-800 tracking-wide flex-1">{title}</h3>
        {badge && <div className="mr-2">{badge}</div>}
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-4 text-slate-700">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// â”€â”€ Stat pill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatPill({ icon: Icon, label, value, color }: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
}) {
  if (!value || value === 0) return null
  return (
    <div className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border ${color} bg-slate-50 min-w-[80px]`}>
      <Icon className="h-4 w-4 opacity-80" />
      <span className="text-lg font-black leading-none">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 text-center leading-tight">{label}</span>
    </div>
  )
}

// â”€â”€ Named persons tag cloud â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PersonTagCloud({ names }: { names: string[] }) {
  if (!names.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {names.map((name, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-default"
        >
          <User className="h-2.5 w-2.5 text-indigo-500 shrink-0" />
          {name}
        </span>
      ))}
    </div>
  )
}



// ── Data-storytelling infographic layer ──────────────────────────────────────────────
// This layer does not replace the original parser or section renderer.
// It converts the already-parsed investigative profile into a NotebookLM-style
// narrative canvas: cover insight, evidence bento, chronology, relationship surface,
// and analyst caution. The original hero, section cards, tables, flat segments, and
// fallback UI continue to render below this board.

type StoryMetric = {
  label: string
  value: string | number
  icon: React.ElementType
  tone: string
  note?: string
}

type StoryBlock =
  | {
      type: 'storyCover'
      subject: string
      subtitle: string
      signal: string
      confidence?: string
      metrics: StoryMetric[]
      accentTone: string
    }
  | {
      type: 'evidenceBento'
      title: string
      cards: { label: string; value: string; icon: React.ElementType; tone: string; emphasis?: boolean }[]
    }
  | {
      type: 'timeline'
      title: string
      events: string[]
    }
  | {
      type: 'network'
      title: string
      people: string[]
      subject: string
    }
  | {
      type: 'caseIntensity'
      title: string
      count: number
      description: string
    }
  | {
      type: 'intelligenceGaps'
      title: string
      gaps: string[]
    }

function isUsableStoryValue(value?: string): value is string {
  return Boolean(value && !isInsuff(value))
}

function findSectionByKeywords(sections: Section[], keywords: string[]): Section | undefined {
  return sections.find(section => {
    const heading = section.heading.toLowerCase()
    return keywords.some(keyword => heading.includes(keyword))
  })
}

function getTimelineEventsFromParsed(parsed: {
  sections: Section[]
  flatSegments: FlatSegment[]
}): string[] {
  const flatTimeline = parsed.flatSegments.find(segment =>
    segment.title.toLowerCase().includes('timeline')
  )
  if (flatTimeline?.items?.length) return flatTimeline.items.slice(0, 6)

  const timelineSection = findSectionByKeywords(parsed.sections, [
    'timeline',
    'chronological',
    'case history',
    'criminal record',
    'incident',
  ])

  if (!timelineSection) return []

  const tables = parseMarkdownTables(timelineSection.body)
  const tableEvents = tables.flatMap(table =>
    table.rows.map(row => row.filter(Boolean).join(' — '))
  )
  if (tableEvents.length > 0) return tableEvents.slice(0, 6)

  const bullets = extractBullets(timelineSection.body)
  if (bullets.length > 0) return bullets.slice(0, 6)

  return timelineSection.body
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(item => clean(item))
    .filter(item => item.length > 20 && !isInsuff(item))
    .slice(0, 6)
}

function getIntelligenceGapsFromParsed(parsed: {
  sections: Section[]
  flatSegments: FlatSegment[]
}): string[] {
  const gapSection = findSectionByKeywords(parsed.sections, [
    'gap',
    'unknown',
    'missing',
    'confidence',
  ])

  if (gapSection) {
    const bullets = extractBullets(gapSection.body)
    if (bullets.length > 0) return bullets.slice(0, 4)

    return gapSection.body
      .split(/(?<=[.!?])\s+/)
      .map(item => clean(item))
      .filter(item => item.length > 15 && !isInsuff(item))
      .slice(0, 4)
  }

  const inferredGaps: string[] = []
  const allFlatText = parsed.flatSegments.flatMap(segment => segment.items).join(' ')
  if (/unknown|not available|insufficient|unverified|missing/i.test(allFlatText)) {
    inferredGaps.push('Some profile fields contain unknown, insufficient, or unverified information.')
  }
  return inferredGaps
}

function countCaseRowsFromSections(sections: Section[]): number {
  return sections.reduce((count, section) => {
    if (!/chronological|case history|criminal record|case|crime/i.test(section.heading)) return count
    return count + parseMarkdownTables(section.body).reduce((rowCount, table) => rowCount + table.rows.length, 0)
  }, 0)
}

function getStorySignal(threatLevel: string, caseCount: number, peopleCount: number): string {
  if (isUsableStoryValue(threatLevel)) {
    if (threatLevel.toLowerCase().includes('high')) return 'High-priority threat pattern detected'
    if (threatLevel.toLowerCase().includes('low')) return 'Lower immediate threat pattern detected'
    return 'Moderate or qualified threat pattern detected'
  }
  if (caseCount >= 10 && peopleCount >= 6) return 'Dense case and relationship pattern detected'
  if (caseCount > 0) return 'Case-heavy profile narrative detected'
  if (peopleCount > 0) return 'Relationship-led profile narrative detected'
  return 'Profile narrative assembled from available evidence'
}

function getStoryAccentTone(threatLevel: string): string {
  if (threatLevel.toLowerCase().includes('high')) return 'from-rose-500 via-orange-400 to-amber-300'
  if (threatLevel.toLowerCase().includes('low')) return 'from-emerald-500 via-teal-400 to-cyan-300'
  return 'from-indigo-500 via-violet-400 to-cyan-300'
}

function buildStoryBlocks(parsed: {
  sections: Section[]
  hasStructuredContent: boolean
  name: string
  prisonerId: string
  dob: string
  address: string
  education: string
  threatLevel: string
  confidence: string
  flatSegments: FlatSegment[]
  stats: {
    totalIndividuals: number
    totalCases: number
    gangsCount: number
    timelineEvents: number
  }
  namedPersons: string[]
}): StoryBlock[] {
  const blocks: StoryBlock[] = []
  const structuredCaseCount = countCaseRowsFromSections(parsed.sections)
  const caseCount = structuredCaseCount || parsed.stats.totalCases || parsed.stats.timelineEvents
  const peopleCount = parsed.namedPersons.length || parsed.stats.totalIndividuals
  const timelineEvents = getTimelineEventsFromParsed(parsed)
  const signal = getStorySignal(parsed.threatLevel, caseCount, peopleCount)

  const coverMetrics: StoryMetric[] = [
    { label: 'People', value: peopleCount, icon: Users, tone: 'text-cyan-700 bg-cyan-50 border-cyan-200', note: 'mentioned entities' },
    { label: 'Cases', value: caseCount, icon: Gavel, tone: 'text-rose-700 bg-rose-50 border-rose-200', note: 'detected records' },
    { label: 'Events', value: timelineEvents.length, icon: Clock, tone: 'text-amber-700 bg-amber-50 border-amber-200', note: 'story beats' },
    { label: 'Sections', value: parsed.sections.length || parsed.flatSegments.length, icon: FileText, tone: 'text-indigo-700 bg-indigo-50 border-indigo-200', note: 'evidence areas' },
  ].filter(metric => Number(metric.value) > 0)

  blocks.push({
    type: 'storyCover',
    subject: parsed.name,
    subtitle: 'AI-assembled investigative narrative from the available profile text',
    signal,
    confidence: parsed.confidence,
    metrics: coverMetrics,
    accentTone: getStoryAccentTone(parsed.threatLevel),
  })

  const snapshotCards = [
    { label: 'Subject', value: parsed.name, icon: User, tone: 'bg-indigo-50 text-indigo-700 border-indigo-200', emphasis: true },
    { label: 'Threat Level', value: parsed.threatLevel, icon: Shield, tone: 'bg-rose-50 text-rose-700 border-rose-200', emphasis: true },
    { label: 'Prisoner ID', value: parsed.prisonerId, icon: Hash, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'DOB', value: parsed.dob, icon: Calendar, tone: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Education', value: parsed.education, icon: BookOpen, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Address', value: parsed.address, icon: MapPin, tone: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  ].filter(card => isUsableStoryValue(card.value))

  if (snapshotCards.length > 1) {
    blocks.push({
      type: 'evidenceBento',
      title: 'Evidence Bento',
      cards: snapshotCards,
    })
  }

  if (timelineEvents.length > 0) {
    blocks.push({
      type: 'timeline',
      title: 'Chronology Storyline',
      events: timelineEvents,
    })
  }

  if (parsed.namedPersons.length > 0) {
    blocks.push({
      type: 'network',
      title: 'Relationship Surface',
      people: parsed.namedPersons.slice(0, 12),
      subject: parsed.name,
    })
  }

  if (caseCount > 0) {
    blocks.push({
      type: 'caseIntensity',
      title: 'Case Pressure',
      count: caseCount,
      description: structuredCaseCount
        ? 'Structured case rows detected from the criminal or chronological history section.'
        : 'Case or incident references detected from the flat profile narrative.',
    })
  }

  const gaps = getIntelligenceGapsFromParsed(parsed)
  if (gaps.length > 0) {
    blocks.push({
      type: 'intelligenceGaps',
      title: 'Analyst Caution',
      gaps,
    })
  }

  return blocks
}

function StoryBadge({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm backdrop-blur">
      <Icon className="h-3 w-3 text-indigo-500" />
      {label}
    </span>
  )
}

function StoryCoverInfographic({ block }: { block: Extract<StoryBlock, { type: 'storyCover' }> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"
    >
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${block.accentTone}`} />
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-100 blur-3xl opacity-80" />
      <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-cyan-100 blur-3xl opacity-70" />
      <div className="relative grid gap-6 p-5 lg:grid-cols-[1.15fr_0.85fr] lg:p-7">
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap gap-2">
            <StoryBadge icon={Brain} label="Story Mode" />
            <StoryBadge icon={Fingerprint} label="Investigative Profile" />
          </div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-indigo-500">Primary narrative</p>
          <h3 className="text-2xl font-black tracking-tight text-slate-950 lg:text-4xl">{block.signal}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">{block.subtitle}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Subject</p>
              <p className="mt-1 text-lg font-black text-slate-900">{block.subject}</p>
            </div>
            {isUsableStoryValue(block.confidence) && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 shadow-sm">
                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Confidence</p>
                <p className="mt-1 text-lg font-black text-indigo-700">{block.confidence}</p>
              </div>
            )}
          </div>
        </div>

        <div className="relative min-h-[230px] rounded-[1.5rem] border border-slate-200 bg-slate-950 p-4 shadow-inner overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.38),transparent_30%),radial-gradient(circle_at_80%_70%,rgba(34,211,238,0.24),transparent_28%)]" />
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-white/10 backdrop-blur-md flex items-center justify-center">
            <User className="h-10 w-10 text-white" />
          </div>
          <div className="relative z-10 grid grid-cols-2 gap-3">
            {block.metrics.map((metric, i) => {
              const Icon = metric.icon
              return (
                <motion.div
                  key={`${metric.label}-${i}`}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.08 + i * 0.05 }}
                  className="rounded-2xl border border-white/10 bg-white/10 p-3 text-white shadow-sm backdrop-blur"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-cyan-200" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/60">{metric.label}</span>
                  </div>
                  <p className="text-3xl font-black tracking-tighter">{metric.value}</p>
                  {metric.note && <p className="mt-1 text-[10px] font-semibold text-white/55">{metric.note}</p>}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function StoryBlockHeader({ icon: Icon, title, eyebrow, color }: {
  icon: React.ElementType
  title: string
  eyebrow: string
  color: string
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-8 w-8 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 leading-none mb-1">{eyebrow}</p>
        <h3 className="text-sm font-black tracking-wide text-slate-900">{title}</h3>
      </div>
    </div>
  )
}

function EvidenceBentoInfographic({ block }: { block: Extract<StoryBlock, { type: 'evidenceBento' }> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 }}
      className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm"
    >
      <StoryBlockHeader icon={Fingerprint} title={block.title} eyebrow="Extracted profile atoms" color="text-indigo-500" />
      <div className="grid auto-rows-[minmax(96px,auto)] gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {block.cards.map((card, i) => {
          const Icon = card.icon
          return (
            <motion.div
              key={`${card.label}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.035 }}
              className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm ${card.tone} ${card.emphasis ? 'sm:col-span-2' : ''}`}
            >
              <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/40" />
              <div className="relative flex items-center gap-2 mb-3">
                <Icon className="h-4 w-4 shrink-0" />
                <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{card.label}</p>
              </div>
              <p className={`${card.emphasis ? 'text-lg' : 'text-sm'} relative font-black leading-snug text-slate-800 break-words`}>{card.value}</p>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

function TimelineInfographic({ block }: { block: Extract<StoryBlock, { type: 'timeline' }> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="rounded-[1.5rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-5 shadow-sm"
    >
      <StoryBlockHeader icon={Clock} title={block.title} eyebrow="Sequence of events" color="text-amber-500" />
      <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-amber-200">
        <div className="flex min-w-[720px] gap-3">
          {block.events.map((event, i) => (
            <motion.div
              key={`${event}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative w-[280px] shrink-0 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm"
            >
              {i < block.events.length - 1 && <div className="absolute left-full top-8 h-px w-3 bg-amber-200" />}
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-white shadow-sm">{i + 1}</div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Story beat</p>
              </div>
              <p className="text-sm leading-relaxed text-slate-700 line-clamp-5">{event}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function NetworkInfographic({ block }: { block: Extract<StoryBlock, { type: 'network' }> }) {
  const visible = block.people.slice(0, 12)
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="rounded-[1.5rem] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 p-5 shadow-sm"
    >
      <StoryBlockHeader icon={Network} title={block.title} eyebrow="Relationship surface" color="text-cyan-600" />
      <div className="relative min-h-[280px] overflow-hidden rounded-[1.35rem] border border-cyan-100 bg-white/70 p-4">
        <svg className="absolute inset-0 h-full w-full opacity-55" viewBox="0 0 800 280" preserveAspectRatio="none">
          {visible.map((_, i) => {
            const angle = (i / Math.max(visible.length, 1)) * Math.PI * 2
            const x = 400 + Math.cos(angle) * 290
            const y = 140 + Math.sin(angle) * 95
            return <line key={i} x1="400" y1="140" x2={x} y2={y} stroke="#67e8f9" strokeWidth="1" strokeDasharray="4 6" />
          })}
        </svg>
        <div className="absolute left-1/2 top-1/2 z-10 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-center shadow-md">
          <User className="h-7 w-7 text-indigo-600" />
          <span className="mt-1 max-w-[90px] truncate text-[10px] font-black text-indigo-700">{block.subject}</span>
        </div>
        <div className="relative z-20 grid min-h-[240px] grid-cols-2 content-between gap-3 md:grid-cols-4">
          {visible.map((person, i) => (
            <motion.div
              key={`${person}-${i}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.035 }}
              className={`rounded-2xl border border-cyan-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm ${i % 3 === 0 ? 'md:translate-y-5' : i % 3 === 1 ? 'md:-translate-y-1' : 'md:translate-y-10'}`}
            >
              <div className="flex items-center gap-1.5">
                <Users className="h-3 w-3 shrink-0 text-cyan-600" />
                <span className="truncate">{person}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function CaseIntensityInfographic({ block }: { block: Extract<StoryBlock, { type: 'caseIntensity' }> }) {
  const bars = Array.from({ length: Math.min(block.count, 10) })
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16 }}
      className="rounded-[1.5rem] border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-slate-50 p-5 shadow-sm"
    >
      <StoryBlockHeader icon={Gavel} title={block.title} eyebrow="Case pressure" color="text-rose-500" />
      <div className="grid gap-5 md:grid-cols-[150px_1fr] md:items-end">
        <div>
          <p className="text-6xl font-black tracking-tighter text-rose-600">{block.count}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">Detected items</p>
        </div>
        <div>
          <div className="mb-4 flex h-24 items-end gap-2 rounded-2xl border border-rose-100 bg-white/70 p-3">
            {bars.map((_, i) => (
              <motion.div
                key={i}
                initial={{ height: 6 }}
                animate={{ height: `${24 + i * 6}%` }}
                transition={{ delay: i * 0.04 }}
                className="flex-1 rounded-t-lg bg-gradient-to-t from-rose-400 to-rose-200"
              />
            ))}
          </div>
          <p className="text-sm leading-relaxed text-slate-700">{block.description}</p>
        </div>
      </div>
    </motion.div>
  )
}

function IntelligenceGapsInfographic({ block }: { block: Extract<StoryBlock, { type: 'intelligenceGaps' }> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 shadow-sm"
    >
      <StoryBlockHeader icon={AlertTriangle} title={block.title} eyebrow="Analyst caution" color="text-amber-500" />
      <div className="grid gap-2">
        {block.gaps.map((gap, i) => (
          <div key={`${gap}-${i}`} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <Crosshair className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm leading-relaxed text-slate-700">{gap}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function StoryBlockRenderer({ block }: { block: StoryBlock }) {
  switch (block.type) {
    case 'storyCover':
      return <StoryCoverInfographic block={block} />
    case 'evidenceBento':
      return <EvidenceBentoInfographic block={block} />
    case 'timeline':
      return <TimelineInfographic block={block} />
    case 'network':
      return <NetworkInfographic block={block} />
    case 'caseIntensity':
      return <CaseIntensityInfographic block={block} />
    case 'intelligenceGaps':
      return <IntelligenceGapsInfographic block={block} />
    default:
      return null
  }
}

function StoryInfographicBoard({ blocks }: { blocks: StoryBlock[] }) {
  if (!blocks.length) return null

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-3 shadow-sm lg:p-4">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300 to-transparent" />
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-purple-200 bg-purple-50">
            <Brain className="h-4 w-4 text-purple-500" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Data Storytelling View</p>
            <p className="text-xs text-slate-500">Narrative canvas generated from the same parsed profile data</p>
          </div>
        </div>
        <Badge variant="secondary" className="hidden border-indigo-200 bg-indigo-50 text-[10px] font-black uppercase tracking-widest text-indigo-600 sm:inline-flex">
          Notebook-style
        </Badge>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {blocks.map((block, i) => {
          const isWide = block.type === 'storyCover' || block.type === 'timeline' || block.type === 'network'
          return (
            <div key={`${block.type}-${i}`} className={isWide ? 'xl:col-span-2' : undefined}>
              <StoryBlockRenderer block={block} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// â”€â”€ Flat segment renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function FlatSegmentBody({ items, accent }: { items: string[]; accent: string }) {
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 group">
          <div
            className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 group-hover:scale-125 transition-transform"
            style={{ background: accent, boxShadow: `0 0 6px ${accent}88` }}
          />
          <p className="text-sm text-slate-700 leading-relaxed">{item}</p>
        </div>
      ))}
    </div>
  )
}

// â”€â”€ main viewer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function InvestigativeProfileInsightViewer({ content }: InvestigativeProfileInsightViewerProps) {
  // Pre-process: unescape JSON-encoded string (\\n -> newline, \\" -> ")
  const processedContent = useMemo(() => {
    let c = content
    const trimmed = c.trim()

    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (typeof parsed === 'string') {
          c = parsed
        } else if (parsed && typeof parsed === 'object') {
          const record = parsed as Record<string, unknown>
          const candidate =
            record.content ??
            record.markdown ??
            record.text ??
            record.profile ??
            record.output
          if (typeof candidate === 'string' && candidate.trim()) {
            c = candidate
          }
        }
      } catch {
        // Keep original content and continue with string unescaping.
      }
    }

    // If content looks like an escaped JSON string, unescape it
    if (c.includes('\\n') || c.includes('\\"')) {
      try {
        // Try parsing as JSON string value
        const unescaped = JSON.parse('"' + c.replace(/^"|"$/g, '').replace(/\n/g, '\\n') + '"')
        if (typeof unescaped === 'string' && unescaped.length > 10) c = unescaped
      } catch {
        // Manual unescape fallback
        c = c
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
      }
    }
    return c
  }, [content])
  const parsed = useMemo(() => {
    const markdownSections = getAllSections(processedContent)
    const sections = markdownSections.length > 0 ? markdownSections : getPartSections(processedContent)
    const hasStructuredContent = sections.length > 0
    // Use broad name extraction to handle all LLM label variants
    const name        = extractSubjectName(processedContent)
                      || extractInline(processedContent, 'Name')
                      || extractInline(processedContent, 'Subject')
                      || deriveTitleFromContent(processedContent)
    const prisonerId  = processedContent.match(/Prisoner\s*ID[:\s#]+(\w+)/i)?.[1] ?? ''
    const dob         = extractInline(processedContent, 'DOB')
                      || extractInline(processedContent, 'Date of Birth')
                      || extractInline(processedContent, 'Date\\s+of\\s+Birth')
    const address     = extractInline(processedContent, 'Last known address')
                      || extractInline(processedContent, 'Address')
                      || extractInline(processedContent, 'Current\\s+Address')
    const education   = extractInline(processedContent, 'Education')
                      || extractInline(processedContent, 'Academic')
    const threatLevel = extractInline(processedContent, 'Threat Level')
                      || (processedContent.match(/Threat\s+Level[:\s*]+([^\n]+)/i)?.[1]?.replace(/\*\*/g, '').trim() ?? '')
    const confidence  = extractInline(processedContent, 'Confidence Level')
                      || extractInline(processedContent, 'Overall Confidence')
                      || extractInline(processedContent, 'Confidence')
    // For flat text: parse into topic segments
    const flatSegments = !hasStructuredContent ? parseFlatTextToSegments(processedContent) : []
    const stats = extractStatsFromFlat(processedContent)
    const namedPersons = extractNamedPersons(processedContent)
    return { sections, hasStructuredContent, name, prisonerId, dob, address, education, threatLevel, confidence, flatSegments, stats, namedPersons }
  }, [processedContent])

  const { sections, hasStructuredContent, name, prisonerId, dob, address, education, threatLevel, confidence, flatSegments, stats, namedPersons } = parsed
  const storyBlocks = useMemo(() => buildStoryBlocks(parsed), [parsed])

  const threatColor = threatLevel.toLowerCase().includes('low')
    ? 'from-emerald-50 to-emerald-100 border-emerald-300 text-emerald-800'
    : threatLevel.toLowerCase().includes('high')
      ? 'from-rose-50 to-rose-100 border-rose-300 text-rose-800'
      : 'from-amber-50 to-amber-100 border-amber-300 text-amber-800'

  // Sections to skip from generic rendering (shown in hero)
  const HERO_KEYWORDS = ['subject identification', 'bio']

  return (
    <div className="space-y-4 pb-6 px-1 bg-white">
      {/* â”€â”€ Hero banner â”€â”€ */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-gradient-to-br from-slate-50 to-indigo-50"
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-300/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-300/40 to-transparent" />
        </div>
        <div className="relative p-5 lg:p-7">
          {/* Top row: badges + threat */}
          <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-full px-3.5 py-1.5">
                <Shield className="h-3.5 w-3.5 text-indigo-600" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Investigative Profile</span>
              </div>
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-full px-3 py-1.5">
                <Fingerprint className="h-3 w-3 text-rose-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Intelligence Report</span>
              </div>
            </div>
            {threatLevel && !isInsuff(threatLevel) && (
              <motion.div whileHover={{ scale: 1.03 }} className={`rounded-xl px-4 py-2.5 bg-gradient-to-br ${threatColor} backdrop-blur-md border flex items-center gap-2.5`}>
                <AlertTriangle className="h-4 w-4 opacity-90 shrink-0" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-80 leading-none mb-0.5">Threat Level</p>
                  <p className="text-sm font-black leading-tight tracking-wide">{threatLevel}</p>
                </div>
                {confidence && !isInsuff(confidence) && (
                  <>
                    <div className="w-px h-8 bg-white/20 mx-1" />
                    <div>
                      <p className="text-[9px] opacity-70 uppercase tracking-widest leading-none mb-0.5">Confidence</p>
                      <p className="text-xs font-bold opacity-95">{confidence}</p>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </div>
          {/* Subject identity */}
          <div className="flex items-center gap-5 mb-5">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shadow-sm overflow-hidden">
                <User className="h-8 w-8 text-indigo-600 relative z-10" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-tight break-words">
                {name}
              </h2>
              {prisonerId && (
                <div className="flex items-center gap-2 mt-1.5 bg-slate-100 w-fit px-2.5 py-1 rounded-md border border-slate-200">
                  <Hash className="h-3 w-3 text-amber-600" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">Prisoner ID:</span>
                  <span className="text-xs font-bold text-amber-600 font-mono tracking-wider">{prisonerId}</span>
                </div>
              )}
            </div>
          </div>
          {/* Meta chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {dob && !isInsuff(dob) && (
              <span className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 hover:border-blue-300 transition-colors">
                <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" /><span className="font-medium">{dob}</span>
              </span>
            )}
            {education && !isInsuff(education) && (
              <span className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 hover:border-emerald-300 transition-colors">
                <BookOpen className="h-3.5 w-3.5 text-emerald-500 shrink-0" /><span className="font-medium">{education}</span>
              </span>
            )}
            {address && !isInsuff(address) && (
              <span className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 hover:border-rose-300 transition-colors">
                <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" /><span className="font-medium truncate max-w-[220px]">{address}</span>
              </span>
            )}
          </div>
          {/* Stats row for flat text */}
          {!hasStructuredContent && (stats.totalIndividuals > 0 || stats.totalCases > 0 || stats.gangsCount > 0) && (
            <div className="flex flex-wrap gap-2">
              <StatPill icon={Users} label="Individuals" value={stats.totalIndividuals} color="border-slate-200 text-cyan-700" />
              <StatPill icon={Gavel} label="Convictions" value={stats.totalCases} color="border-slate-200 text-rose-700" />
              <StatPill icon={Network} label="Gangs/Groups" value={stats.gangsCount} color="border-slate-200 text-violet-700" />
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Dynamic data-storytelling infographic board ── */}
      <StoryInfographicBoard blocks={storyBlocks} />

      {/* â”€â”€ Named persons tag cloud (flat text only) â”€â”€ */}
      {!hasStructuredContent && namedPersons.length > 2 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Mentioned Individuals</span>
          </div>
          <PersonTagCloud names={namedPersons} />
        </motion.div>
      )}

      {/* â”€â”€ Structured markdown sections â”€â”€ */}
      {hasStructuredContent && sections
        .filter(s => !HERO_KEYWORDS.some(k => s.heading.toLowerCase().includes(k)))
        .filter(s => s.body.trim().length > 10)
        .map((section, i) => {
          const { icon, color } = getSectionIcon(section.heading)
          const isCase = /chronological|case history|criminal record/i.test(section.heading)
          const table = parseMarkdownTable(section.body)
          const caseRowCount = parseMarkdownTables(section.body).reduce((count, t) => count + t.rows.length, 0)
          const hasCaseTable = isCase && (table.headers.length >= 2 && table.rows.length > 0)
          const isAssoc = /associate|network|organizational/i.test(section.heading)
          const bullets = extractBullets(section.body)
          const badge = hasCaseTable
            ? <Badge variant="destructive" className="text-[10px] font-bold bg-rose-100 text-rose-700 border-rose-300">{caseRowCount} cases</Badge>
            : isAssoc && bullets.length > 0
              ? <Badge variant="secondary" className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border-indigo-200">{bullets.length}</Badge>
              : undefined
          return (
            <CollapsibleSectionCard key={i} icon={icon} title={section.heading} iconColor={color} accent="#60a5fa" badge={badge} delay={0.08 * (i + 1)} defaultOpen={i < 3}>
              <GenericSectionBody body={section.body} />
            </CollapsibleSectionCard>
          )
        })}

      {/* â”€â”€ Flat text segments â”€â”€ */}
      {!hasStructuredContent && flatSegments.map((seg, i) => (
        <CollapsibleSectionCard key={i} icon={seg.icon} title={seg.title} iconColor={seg.color} accent={seg.accent} badge={<Badge variant="secondary" className="text-[10px] font-bold bg-slate-100 text-slate-600 border-slate-200">{seg.items.length}</Badge>} delay={0.08 * (i + 1)} defaultOpen={i < 4}>
          <FlatSegmentBody items={seg.items} accent={seg.accent} />
        </CollapsibleSectionCard>
      ))}

      {/* â”€â”€ Fallback â”€â”€ */}
      {!hasStructuredContent && flatSegments.length === 0 && processedContent.trim() && (
        <CollapsibleSectionCard icon={FileText} title="Comprehensive Profile Overview" iconColor="text-indigo-500" accent="#6366f1" delay={0.2}>
          <GenericSectionBody body={processedContent} />
        </CollapsibleSectionCard>
      )}
    </div>
  )
}
