'use client'

import React, { useMemo } from 'react'
import { getSectionIcon, getSemanticIcon } from './infographic/IconEngine'
import {
  clean,
  extractAndMergeJson,
  flattenSubject,
  hasValue,
  normalizeInfographicBlock,
  parseMarkdownToInfographic,
  resolveTheme,
  resolveType,
} from './infographic/helpers'
import type { DocumentType, InfographicColumn, InfographicResponse } from './infographic/types'

export type { InfographicColumn, InfographicResponse } from './infographic/types'

type KeyValue = { key: string; value: string }

function titleCaseWords(value: string): string {
  return value
    .split(' ')
    .map(word => {
      const trimmed = word.trim()
      if (!trimmed) return ''
      if (trimmed.toUpperCase() === trimmed && trimmed.length <= 3) return trimmed
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
    })
    .filter(Boolean)
    .join(' ')
}

function normalizeForMatch(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function tokenizeName(value: string): string[] {
  return normalizeForMatch(value)
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 3)
}

function deriveSubjectFromSourceTitle(sourceTitle?: string): string {
  if (!hasValue(sourceTitle)) return ''

  const normalized = clean(sourceTitle)
    .replace(/\.[a-z0-9]{2,6}$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const withoutPrefix = normalized.replace(/^[a-z]{1,5}\s*-\s*/i, '')
  const withoutSuffix = withoutPrefix
    .replace(/\(\d+\)\s*$/g, '')
    .replace(/\[[^\]]+\]\s*$/g, '')
    .trim()
  const primary = withoutSuffix.split('@')[0]?.trim() ?? ''

  return titleCaseWords(primary)
}

function hasNameOverlap(a: string, b: string): boolean {
  const aTokens = tokenizeName(a)
  const bTokens = new Set(tokenizeName(b))
  return aTokens.some(token => bTokens.has(token))
}

function pickValueFromKeys(
  source: Record<string, string>,
  keys: string[]
): string {
  for (const key of keys) {
    const target = normalizeForMatch(key)
    const exact = Object.entries(source).find(([k]) => normalizeForMatch(k) === target)
    if (exact && hasValue(exact[1])) return clean(exact[1])

    const loose = Object.entries(source).find(([k]) => normalizeForMatch(k).includes(target))
    if (loose && hasValue(loose[1])) return clean(loose[1])
  }
  return ''
}

function resolvePosterTitle(data: InfographicResponse, sourceTitle?: string): string {
  const sourceSubject = deriveSubjectFromSourceTitle(sourceTitle)
  const subjectMap = flattenSubject(data.subject)
  const subjectName = pickValueFromKeys(subjectMap, ['name', 'subject', 'primary subject', 'title'])
  const candidate = clean(data.header?.title || subjectName || data.personal?.name || '')

  if (sourceSubject && (!candidate || !hasNameOverlap(candidate, sourceSubject))) {
    return sourceSubject
  }
  if (candidate) return candidate
  return sourceSubject || 'Criminal Intelligence Profile'
}

function PosterVector({
  kind,
  accent,
}: {
  kind: 'evolution' | 'footprint' | 'command' | 'resources' | 'tactical'
  accent: string
}) {
  if (kind === 'footprint') {
    return (
      <svg viewBox="0 0 140 90" className="h-16 w-24" aria-hidden="true">
        <rect x="8" y="8" width="124" height="74" rx="10" fill="#f8fafc" stroke="#cbd5e1" />
        <circle cx="34" cy="30" r="7" fill="#fee2e2" stroke={accent} strokeWidth="2" />
        <circle cx="70" cy="22" r="7" fill="#e0e7ff" stroke={accent} strokeWidth="2" />
        <circle cx="102" cy="34" r="7" fill="#fef3c7" stroke={accent} strokeWidth="2" />
        <circle cx="72" cy="58" r="8" fill="#dcfce7" stroke={accent} strokeWidth="2" />
        <path d="M34 30 L70 22 L102 34 L72 58 L34 30" fill="none" stroke="#64748b" strokeWidth="1.8" />
      </svg>
    )
  }
  if (kind === 'command') {
    return (
      <svg viewBox="0 0 120 90" className="h-16 w-24" aria-hidden="true">
        <rect x="14" y="14" width="70" height="50" rx="8" fill="#e2e8f0" stroke="#64748b" />
        <rect x="24" y="24" width="50" height="6" rx="3" fill="#94a3b8" />
        <rect x="24" y="36" width="34" height="6" rx="3" fill="#94a3b8" />
        <rect x="90" y="24" width="18" height="26" rx="4" fill="#fde68a" stroke="#d97706" />
        <rect x="86" y="56" width="26" height="16" rx="4" fill="#e2e8f0" stroke="#64748b" />
      </svg>
    )
  }
  if (kind === 'resources') {
    return (
      <svg viewBox="0 0 120 90" className="h-16 w-24" aria-hidden="true">
        <rect x="10" y="18" width="46" height="30" rx="5" fill="#e2e8f0" stroke="#475569" />
        <rect x="18" y="52" width="36" height="18" rx="4" fill="#bbf7d0" stroke="#16a34a" />
        <rect x="60" y="28" width="18" height="42" rx="4" fill="#fee2e2" stroke="#be123c" />
        <rect x="82" y="22" width="28" height="18" rx="4" fill="#e0e7ff" stroke="#4338ca" />
        <rect x="82" y="46" width="28" height="24" rx="4" fill="#fef3c7" stroke="#d97706" />
      </svg>
    )
  }
  if (kind === 'tactical') {
    return (
      <svg viewBox="0 0 120 90" className="h-16 w-24" aria-hidden="true">
        <rect x="12" y="40" width="60" height="12" rx="4" fill="#1e293b" />
        <rect x="70" y="44" width="30" height="6" rx="3" fill="#334155" />
        <circle cx="28" cy="62" r="10" fill="#fee2e2" stroke="#be123c" />
        <circle cx="58" cy="62" r="10" fill="#fee2e2" stroke="#be123c" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 90" className="h-16 w-24" aria-hidden="true">
      <circle cx="34" cy="46" r="14" fill="#e2e8f0" stroke="#475569" />
      <path d="M34 18 L52 30 L52 62 L16 62 L16 30 Z" fill="#f8fafc" stroke="#64748b" />
      <rect x="66" y="26" width="42" height="36" rx="6" fill="#fde68a" stroke="#d97706" />
      <path d="M66 44 H108" stroke="#d97706" strokeWidth="2" />
    </svg>
  )
}

function prettyKey(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

function toPairs(input?: Record<string, string>): KeyValue[] {
  if (!input) return []
  return Object.entries(input)
    .map(([key, value]) => ({ key: prettyKey(key), value: clean(value) }))
    .filter(item => hasValue(item.key) && hasValue(item.value))
}

function currencyText(value?: string): string {
  const normalized = clean(value ?? '')
  if (!normalized) return '-'
  return normalized
}

function DataCard({
  title,
  accent,
  textColor,
  borderColor,
  surfaceColor = '#ffffff',
  headerSurfaceColor,
  children,
}: {
  title: string
  accent: string
  textColor: string
  borderColor: string
  surfaceColor?: string
  headerSurfaceColor?: string
  children: React.ReactNode
}) {
  return (
    <section
      className="rounded-2xl border shadow-sm"
      style={{ borderColor, backgroundColor: surfaceColor }}
    >
      <header
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ borderColor, backgroundColor: headerSurfaceColor ?? `${accent}12` }}
      >
        <span className="shrink-0">{getSectionIcon(title, 15, accent)}</span>
        <h3 className="text-sm font-semibold tracking-wide" style={{ color: accent }}>
          {title}
        </h3>
      </header>
      <div className="p-4 text-sm" style={{ color: textColor }}>
        {children}
      </div>
    </section>
  )
}

function renderThemeBackground(type: DocumentType): string {
  if (type === 'criminal') {
    return 'linear-gradient(145deg, #f8fafc 0%, #eef2ff 40%, #f8fafc 100%)'
  }
  if (type === 'bank') {
    return 'linear-gradient(145deg, #031525 0%, #0b2238 50%, #062033 100%)'
  }
  if (type === 'cdr') {
    return 'linear-gradient(145deg, #030d1d 0%, #0b1930 50%, #031528 100%)'
  }
  return 'linear-gradient(145deg, #0c1220 0%, #1a1f2e 55%, #101726 100%)'
}

type StoryItem = { title: string; subtitle?: string; description: string; iconKey: string }

function toStoryItems(data: InfographicResponse): StoryItem[] {
  const fromColumns = [...(data.left_column ?? []), ...(data.right_column ?? [])]
    .filter(item => hasValue(item.title) || hasValue(item.description))
    .map(item => ({
      title: clean(item.title || 'Key Point'),
      subtitle: undefined,
      description: clean(item.description || '-'),
      iconKey: clean(item.icon || item.title || 'info').toLowerCase(),
    }))

  const fromHighlights = (data.highlights ?? [])
    .filter(item => hasValue(item.title) || hasValue(item.description))
    .map(item => ({
      title: clean(item.title || 'Finding'),
      subtitle: hasValue(item.subtitle) ? clean(item.subtitle) : undefined,
      description: clean(item.description || '-'),
      iconKey: clean(item.title || 'finding').toLowerCase(),
    }))

  return [...fromColumns, ...fromHighlights]
}


type OperationRow = { crime: string; location: string; figure: string }

function inferOperationRows(data: InfographicResponse, stories: StoryItem[]): OperationRow[] {
  const cases = (data.case_details ?? []).filter(
    item => hasValue(item.fir_no) || hasValue(item.section) || hasValue(item.police_station)
  )
  const locations = (data.key_locations ?? []).filter(
    item => hasValue(item.area) || hasValue(item.cell_id)
  )
  const associates = (data.associates ?? []).filter(
    item => hasValue(item.name) || hasValue(item.relation)
  )
  const contacts = (data.top_contacts ?? []).filter(item => hasValue(item.number) || hasValue(item.type))

  const maxRows = Math.min(6, Math.max(cases.length, locations.length, associates.length, contacts.length, 0))
  const structured = Array.from({ length: maxRows }).map((_, index) => ({
    crime: clean(cases[index]?.section || cases[index]?.fir_no || ''),
    location: clean(locations[index]?.area || cases[index]?.police_station || locations[index]?.cell_id || ''),
    figure: clean(associates[index]?.name || associates[index]?.relation || contacts[index]?.number || ''),
  })).filter(row => hasValue(row.crime) || hasValue(row.location) || hasValue(row.figure))

  if (structured.length > 0) {
    return structured.map((row, index) => ({
      crime: row.crime || `Operation ${index + 1}`,
      location: row.location || '-',
      figure: row.figure || '-',
    }))
  }

  return stories
    .map((item, index) => {
      return {
        crime: clean(item.title || `Operation ${index + 1}`),
        location: '-',
        figure: '-',
      }
    })
    .filter(row => hasValue(row.crime))
    .slice(0, 5)
}

function inferLocationLabels(data: InfographicResponse, rows: OperationRow[]): string[] {
  const explicit = (data.key_locations ?? [])
    .map(item => clean(item.area || item.cell_id || ''))
    .filter(hasValue)

  if (explicit.length > 0) return explicit.slice(0, 5)

  const fromRows = rows
    .flatMap(row => row.location.split(','))
    .map(value => clean(value))
    .filter(value => hasValue(value) && value !== '-')

  return Array.from(new Set(fromRows)).slice(0, 5)
}

function deriveBadgeValue(raw: string, fallbackCount: number): string {
  const fallback = `${Math.max(fallbackCount, 1)}+`
  if (!hasValue(raw)) return fallback

  const normalized = clean(raw)
  const numberMatch = normalized.match(/\d+(?:,\d+)*(?:\.\d+)?/)
  if (!numberMatch) return fallback

  const numeric = Number(numberMatch[0].replace(/,/g, ''))
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback

  const lowered = normalized.toLowerCase()
  if (lowered.includes('month')) return `${Math.round(numeric)}m`
  if (lowered.includes('year') || lowered.includes('yr')) return `${Math.round(numeric)}y`
  if (numeric >= 1000) return `${Math.round(numeric / 1000)}k+`
  return `${Math.round(numeric)}+`
}

function compactText(value: string, maxChars = 220): string {
  const normalized = clean(value)
  if (!normalized) return '-'
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, maxChars).trim()}...`
}

function normalizeHeadingFromStory(value: string, fallback: string): string {
  const normalized = clean(value).replace(/[:\-]/g, ' ').trim()
  if (!normalized) return fallback
  const words = normalized.split(/\s+/).slice(0, 5)
  const heading = words.join(' ')
  return heading.length >= 10 ? heading : fallback
}

function CriminalPosterView({
  data,
  accent,
  mutedColor,
  sourceTitle,
}: {
  data: InfographicResponse
  accent: string
  mutedColor: string
  sourceTitle?: string
}) {
  const storyItems = toStoryItems(data)
  const displayTitle = resolvePosterTitle(data, sourceTitle)
  const subjectMap = flattenSubject(data.subject)

  const associates = (data.associates ?? []).filter(
    item => hasValue(item.name) || hasValue(item.relation)
  )
  const locations = (data.key_locations ?? []).filter(
    item => hasValue(item.area) || hasValue(item.cell_id)
  )
  const cases = (data.case_details ?? []).filter(
    item => hasValue(item.fir_no) || hasValue(item.section) || hasValue(item.police_station)
  )
  const topContacts = (data.top_contacts ?? []).filter(item => hasValue(item.number))
  const timeline = (data.timeline_events ?? [])
    .filter(item => hasValue(item.date) || hasValue(item.event))
    .slice(0, 6)

  const fallbackStories: StoryItem[] = [
    {
      title: 'Profile Evolution',
      description: `Identity and activity trail indicate role progression across ${Math.max(locations.length, 1)} operational zones.`,
      iconKey: 'profile',
    },
    {
      title: 'Active Criminal Involvements',
      description: `${Math.max(cases.length, 1)} tracked case references and linked entities indicate ongoing operational relevance.`,
      iconKey: 'crime',
    },
    {
      title: 'Specialized Tactical Expertise',
      description: 'Signals indicate field coordination capability, mobility, and operational execution patterns.',
      iconKey: 'weapon',
    },
    {
      title: 'Interstate Operational Footprint',
      description: `${Math.max(locations.length, 1)} location clusters suggest cross-jurisdiction movement and network presence.`,
      iconKey: 'map',
    },
    {
      title: 'Encrypted Command and Control',
      description: `${Math.max(topContacts.length, 1)} communication links suggest remote coordination via trusted intermediaries.`,
      iconKey: 'phone',
    },
    {
      title: 'Sophisticated Resource Management',
      description: `${Math.max(associates.length, 1)} associate links indicate structured logistics and resource routing support.`,
      iconKey: 'money',
    },
  ]

  const mergedStories = (storyItems.length > 0 ? storyItems : fallbackStories)
    .filter(item => hasValue(item.title) || hasValue(item.description))
    .slice(0, 10)
  const leftLead = mergedStories[0] ?? fallbackStories[0]
  const leftSupport = [
    mergedStories[1] ?? fallbackStories[1],
    mergedStories[2] ?? fallbackStories[2],
  ]
  const rightLead = mergedStories[3] ?? fallbackStories[3]
  const rightSupport = [
    mergedStories[4] ?? fallbackStories[4],
    mergedStories[5] ?? fallbackStories[5],
  ]
  const extraStories = mergedStories.slice(6)

  const rawStatValue = clean(data.stat?.value || '')
  const statValue = deriveBadgeValue(rawStatValue, cases.length)
  const statLabel = clean(
    data.stat?.label ||
    rawStatValue ||
    'Involved in pending or reported cases across available source records.'
  )

  const operationRows = inferOperationRows(data, mergedStories)
  const footprintLabels = inferLocationLabels(data, operationRows)

  const knownAliasesCandidate = clean(
    pickValueFromKeys(subjectMap, ['aliases', 'alias', 'known aliases']) ||
    data.personal?.aliases ||
    pickValueFromKeys(subjectMap, ['name', 'subject', 'primary subject']) ||
    data.personal?.name ||
    ''
  )
  const knownAliases = knownAliasesCandidate || displayTitle || '-'
  const evolutionHeading = normalizeHeadingFromStory(leftLead.title, 'Narrative Findings')
  const operationHeading = normalizeHeadingFromStory(rightLead.title, 'Operational Pattern')

  const professionalAccent = '#334155'
  const editorialAccent = accent || '#4f46e5'
  const softAccent = '#eef2ff'
  const lineColor = '#d8dee8'

  const locationSummary = clean(footprintLabels.find(label => label !== '-') || locations[0]?.area || locations[0]?.cell_id || 'Location intelligence pending')

  const MiniPin = ({ label, className }: { label: string; className: string }) => (
    <div className={`absolute flex flex-col items-center ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm" style={{ borderColor: lineColor }}>
        {getSemanticIcon('map', 16, editorialAccent)}
      </div>
      <span className="mt-1 max-w-[76px] truncate rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold text-slate-600">
        {label}
      </span>
    </div>
  )

  const SectionKicker = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{children}</p>
  )

  const StoryCard = ({ item, index, featured = false }: { item: StoryItem; index: number; featured?: boolean }) => (
    <article className={`${featured ? 'md:col-span-2' : ''} rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]`}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
          {getSemanticIcon(item.iconKey, 19, editorialAccent)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-50 px-1.5 text-[10px] font-black text-indigo-600">
              {index + 1}
            </span>
            <SectionKicker>Evidence note</SectionKicker>
          </div>
          <h4 className="line-clamp-2 text-[15px] font-black leading-tight text-slate-950 sm:text-[16px]" title={item.title}>
            {item.title}
          </h4>
          {item.subtitle && (
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{item.subtitle}</p>
          )}
          <p className="mt-2 line-clamp-4 text-[13px] font-medium leading-relaxed text-slate-600" title={item.description}>
            {compactText(item.description, featured ? 230 : 160)}
          </p>
        </div>
      </div>
    </article>
  )

  const MetricTile = ({ label, value, icon }: { label: string; value: string; icon: string }) => (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50">
          {getSemanticIcon(icon, 18, professionalAccent)}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-1 truncate text-[13px] font-black text-slate-950">{value}</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="mx-auto w-full overflow-hidden rounded-[24px] border border-slate-200 bg-[#fbfaf7] shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-7 lg:px-9">
          <div className="grid gap-5 lg:grid-cols-[1.5fr_0.8fr] lg:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                  Intelligence Brief
                </span>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Visual Storyboard
                </span>
              </div>
              <h2 className="max-w-5xl break-words text-[clamp(2.2rem,5vw,4.6rem)] font-black leading-[0.96] tracking-tight text-slate-950">
                {displayTitle}
              </h2>
              {hasValue(data.header?.subtitle) && (
                <p className="mt-4 max-w-4xl text-[14px] font-medium leading-relaxed text-slate-600 sm:text-[15px]">
                  {compactText(clean(data.header?.subtitle), 360)}
                </p>
              )}
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <SectionKicker>Primary signal</SectionKicker>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-[1.65rem] font-black text-slate-950 shadow-sm">
                  {statValue}
                </div>
                <div className="min-w-0">
                  <h3 className="text-[17px] font-black leading-tight text-slate-950">Active Intelligence Weight</h3>
                  <p className="mt-2 text-[12px] font-medium leading-relaxed text-slate-600">{compactText(statLabel, 150)}</p>
                </div>
              </div>
            </aside>
          </div>
        </header>

        <section className="grid gap-3 border-b border-slate-200 bg-[#fbfaf7] px-5 py-4 sm:grid-cols-2 sm:px-7 lg:grid-cols-4 lg:px-9">
          <MetricTile label="Date of birth" value={clean(data.personal?.date_of_birth || pickValueFromKeys(subjectMap, ['date of birth', 'dob']) || timeline[0]?.date || '-')} icon="calendar" />
          <MetricTile label="Known aliases" value={knownAliases} icon="id" />
          <MetricTile label="Known expertise" value={clean(leftSupport[1]?.title || leftSupport[0]?.title || 'Operational coordination')} icon="target" />
          <MetricTile label="Current status" value={clean(data.profile_summary?.status || pickValueFromKeys(subjectMap, ['status', 'current status']) || 'Active intelligence profile')} icon="shield" />
        </section>

        <main className="grid gap-0 lg:grid-cols-[1fr_310px]">
          <section className="border-b border-slate-200 px-5 py-6 sm:px-7 lg:border-b-0 lg:border-r lg:px-9">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <SectionKicker>Narrative flow</SectionKicker>
                <h3 className="mt-2 text-[1.45rem] font-black leading-tight text-slate-950 sm:text-[1.8rem]">
                  {evolutionHeading}
                </h3>
              </div>
              <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-500 sm:inline-flex">
                {mergedStories.length} evidence notes
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <StoryCard item={leftLead} index={0} featured />
              {leftSupport.map((item, index) => (
                <StoryCard key={`left-support-${index}`} item={item} index={index + 1} />
              ))}
              {rightSupport.map((item, index) => (
                <StoryCard key={`right-support-${index}`} item={item} index={index + 3} />
              ))}
            </div>
          </section>

          <aside className="bg-white px-5 py-6 sm:px-7 lg:px-5">
            <div className="rounded-2xl border border-slate-200 bg-[#fbfaf7] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SectionKicker>Operational map</SectionKicker>
                  <h3 className="mt-2 text-[1.15rem] font-black leading-tight text-slate-950">{operationHeading}</h3>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                  {getSemanticIcon('map', 18, editorialAccent)}
                </span>
              </div>

              <div className="relative mt-4 h-[190px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <svg viewBox="0 0 280 190" className="absolute inset-0 h-full w-full">
                  <path d="M46 130 C86 78, 140 74, 232 95" stroke="#cbd5e1" strokeWidth="2" fill="none" />
                  <path d="M64 62 C118 24, 178 48, 240 83" stroke="#cbd5e1" strokeWidth="2" fill="none" />
                  <path d="M142 50 L142 146" stroke="#e2e8f0" strokeWidth="2" fill="none" />
                  <circle cx="142" cy="94" r="26" fill={softAccent} stroke="#c7d2fe" />
                  <circle cx="142" cy="94" r="9" fill={editorialAccent} opacity="0.85" />
                </svg>
                <MiniPin label={clean(footprintLabels[0] || 'Zone A')} className="left-5 top-7" />
                <MiniPin label={clean(footprintLabels[1] || 'Zone B')} className="left-[112px] top-4" />
                <MiniPin label={clean(footprintLabels[2] || 'Zone C')} className="right-5 top-[62px]" />
                <MiniPin label={clean(footprintLabels[3] || 'Zone D')} className="left-[120px] bottom-4" />
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <SectionKicker>Main footprint</SectionKicker>
                <h4 className="mt-2 text-[15px] font-black leading-tight text-slate-950">{rightLead.title}</h4>
                {rightLead.subtitle && <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{rightLead.subtitle}</p>}
                <p className="mt-2 text-[12px] font-medium leading-relaxed text-slate-600">{compactText(rightLead.description, 180)}</p>
                <p className="mt-3 text-[11px] font-bold text-slate-500">Primary location: {locationSummary}</p>
              </div>
            </div>
          </aside>
        </main>

        <section className="grid gap-4 border-t border-slate-200 bg-white px-5 py-6 sm:px-7 lg:grid-cols-[1fr_330px] lg:px-9">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <SectionKicker>Structured evidence</SectionKicker>
                <h3 className="mt-1 text-[1.25rem] font-black leading-tight text-slate-950">Key Syndicate Operations</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500">{operationRows.length} rows</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full border-collapse text-[12px] sm:text-[13px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="border-b border-slate-200 px-3 py-2 text-left font-black uppercase tracking-[0.12em]">Crime Type</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-left font-black uppercase tracking-[0.12em]">Primary Location</th>
                    <th className="border-b border-slate-200 px-3 py-2 text-left font-black uppercase tracking-[0.12em]">Key Associated Figure</th>
                  </tr>
                </thead>
                <tbody>
                  {operationRows.map((row, index) => (
                    <tr key={`operation-${index}`} className="odd:bg-white even:bg-slate-50/60">
                      <td className="border-b border-slate-100 px-3 py-2">
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          {getSemanticIcon('crime', 15, editorialAccent)}
                          {compactText(row.crime, 88)}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2">
                        <div className="flex items-center gap-2 font-semibold text-slate-600">
                          {getSemanticIcon('map', 15, editorialAccent)}
                          {compactText(row.location, 72)}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2">
                        <div className="flex items-center gap-2 font-semibold text-slate-600">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                            {getSemanticIcon('user', 13, professionalAccent)}
                          </span>
                          {compactText(row.figure, 78)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <SectionKicker>Snapshot</SectionKicker>
            <div className="mt-3 grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <p className="text-2xl font-black text-slate-950">{Math.max(associates.length, 1)}</p>
                <p className="mt-1 text-[12px] font-bold text-slate-500">Associate links</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <p className="text-2xl font-black text-slate-950">{Math.max(locations.length, 1)}</p>
                <p className="mt-1 text-[12px] font-bold text-slate-500">Location clusters</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <p className="text-2xl font-black text-slate-950">{Math.max(topContacts.length, 1)}</p>
                <p className="mt-1 text-[12px] font-bold text-slate-500">Communication links</p>
              </div>
            </div>
          </aside>
        </section>

        {extraStories.length > 0 && (
          <section className="border-t border-slate-200 bg-[#fbfaf7] px-5 py-5 sm:px-7 lg:px-9">
            <SectionKicker>Additional notes</SectionKicker>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {extraStories.map((item, index) => (
                <article key={`extra-story-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">{getSemanticIcon(item.iconKey, 14, editorialAccent)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-black leading-tight text-slate-900">{compactText(item.title, 70)}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{compactText(item.description, 120)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {timeline.length > 0 && (
          <section className="border-t border-slate-200 bg-white px-5 py-5 sm:px-7 lg:px-9">
            <SectionKicker>Chronology</SectionKicker>
            <h3 className="mt-1 text-[1.2rem] font-black text-slate-950">Timeline of Events</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {timeline.map((item, index) => (
                <div key={`timeline-${index}`} className="relative rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="absolute -top-2 left-4 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[10px] font-black text-white">
                    {index + 1}
                  </span>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: editorialAccent }}>
                    {clean(item.date || `Event ${index + 1}`)}
                  </p>
                  <p className="mt-2 text-[12px] font-medium leading-relaxed text-slate-600">
                    {compactText(clean(item.event || '-'), 155)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="flex items-center justify-between border-t border-slate-200 bg-[#fbfaf7] px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 sm:px-7 lg:px-9">
          <span>Criminal Intelligence Profile</span>
          <span>Professional Visual Brief</span>
        </footer>
      </div>

      <div className="mt-3 text-right text-xs" style={{ color: mutedColor }}>
        Theme: {clean(data.document_type || 'criminal')}
      </div>
    </div>
  )
}

type CdrPhase = {
  label: string
  title: string
  summary: string
  coords: string[]
  circle: string
}

function extractCoordsFromText(value: string): string[] {
  const matches = value.match(/\b\d{1,2}\.\d{2,6}\s*[/,]\s*\d{1,3}\.\d{2,6}\b/g) ?? []
  return Array.from(new Set(matches.map(item => item.replace(/\s+/g, '')))).slice(0, 3)
}

function buildCdrPhases(data: InfographicResponse): CdrPhase[] {
  const timeline = (data.timeline_events ?? []).filter(item => hasValue(item.date) || hasValue(item.event))
  const fallbackText = [
    ...(data.highlights ?? []).map(h => `${clean(h.title)} ${clean(h.description)}`),
    ...(data.left_column ?? []).map(h => `${clean(h.title)} ${clean(h.description)}`),
    ...(data.right_column ?? []).map(h => `${clean(h.title)} ${clean(h.description)}`),
  ].filter(hasValue)

  const sourceItems = timeline.length > 0
    ? timeline.map(item => ({
        date: clean(item.date || ''),
        text: clean(item.event || ''),
      }))
    : fallbackText.map((text, index) => ({ date: `Phase ${index + 1}`, text }))

  if (sourceItems.length === 0) {
    return [
      { label: 'Phase 1', title: 'Initial Signal Cluster', summary: 'No timeline events available.', coords: [], circle: 'Unknown' },
    ]
  }

  const bucketCount = Math.min(4, Math.max(1, sourceItems.length))
  const bucketSize = Math.ceil(sourceItems.length / bucketCount)

  return Array.from({ length: bucketCount }).map((_, idx) => {
    const start = idx * bucketSize
    const bucket = sourceItems.slice(start, start + bucketSize)
    const first = bucket[0]
    const last = bucket[bucket.length - 1]
    const combinedText = bucket.map(item => item.text).join(' ')
    const coords = extractCoordsFromText(combinedText)

    return {
      label: first?.date && last?.date ? `${first.date} - ${last.date}` : `Phase ${idx + 1}`,
      title: clean(first?.text || `Mobility phase ${idx + 1}`),
      summary: clean(combinedText || first?.text || '-'),
      coords,
      circle: clean((data.key_locations?.[idx]?.area || data.key_locations?.[idx]?.cell_id || 'Telecom circle')),
    }
  })
}

function CdrVector({ kind }: { kind: 'base' | 'move' | 'hop' | 'return' }) {
  if (kind === 'hop') {
    return (
      <svg viewBox="0 0 140 110" className="h-28 w-36" aria-hidden="true">
        <rect x="6" y="18" width="128" height="80" rx="14" fill="#e0f2fe" stroke="#67e8f9" />
        <path d="M16 70 H124" stroke="#0ea5e9" strokeWidth="3" />
        <path d="M22 58 Q44 28 66 58 T110 58" fill="none" stroke="#f97316" strokeWidth="3" />
        <circle cx="34" cy="70" r="7" fill="#22d3ee" />
        <circle cx="70" cy="70" r="7" fill="#0ea5e9" />
        <circle cx="106" cy="70" r="7" fill="#06b6d4" />
      </svg>
    )
  }
  if (kind === 'move') {
    return (
      <svg viewBox="0 0 140 110" className="h-28 w-36" aria-hidden="true">
        <rect x="8" y="14" width="124" height="84" rx="14" fill="#ecfccb" stroke="#84cc16" />
        <path d="M22 78 C40 28, 92 28, 116 74" fill="none" stroke="#0ea5e9" strokeWidth="4" />
        <circle cx="22" cy="78" r="6" fill="#16a34a" />
        <circle cx="116" cy="74" r="6" fill="#0284c7" />
      </svg>
    )
  }
  if (kind === 'return') {
    return (
      <svg viewBox="0 0 140 110" className="h-28 w-36" aria-hidden="true">
        <rect x="8" y="14" width="124" height="84" rx="14" fill="#cffafe" stroke="#06b6d4" />
        <path d="M24 72 C44 38, 92 38, 112 72" fill="none" stroke="#0ea5e9" strokeWidth="4" />
        <path d="M104 64 L112 72 L104 80" fill="none" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="72" r="6" fill="#0284c7" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 140 110" className="h-28 w-36" aria-hidden="true">
      <rect x="8" y="14" width="124" height="84" rx="14" fill="#dbeafe" stroke="#60a5fa" />
      <path d="M70 26 L84 52 H56 Z" fill="#0ea5e9" />
      <rect x="64" y="52" width="12" height="28" rx="3" fill="#0ea5e9" />
      <circle cx="70" cy="90" r="9" fill="#2563eb" />
    </svg>
  )
}

function CdrStoryboardView({ data }: { data: InfographicResponse }) {
  const phases = buildCdrPhases(data)
  const statValue = clean(data.stat?.value || `${phases.length}`)
  const statLabel = clean(data.stat?.label || 'Call and SMS interactions')
  const topContacts = (data.top_contacts ?? []).filter(item => hasValue(item.number))
  const callSummaryPairs = toPairs((data.call_summary ?? {}) as Record<string, string>)
  const highlights = (data.highlights ?? []).filter(item => hasValue(item.title) || hasValue(item.description))
  const timeline = (data.timeline_events ?? []).filter(item => hasValue(item.date) || hasValue(item.event)).slice(0, 10)
  const subtitle = clean(data.header?.subtitle || 'Device mobility analysis derived from call detail records.')
  const displayTitle = clean(data.header?.title || 'Mobility & Location Analysis')

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-cyan-900/40 bg-[#041329] p-4 sm:p-6">
      <div className="rounded-2xl border border-cyan-900/50 bg-gradient-to-r from-[#021127] via-[#072246] to-[#0a2f59] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cyan-500 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white">Mobile CDR Analysis</span>
          <span className="text-xs uppercase tracking-[0.12em] text-cyan-200">{clean(data.document_type || 'mobile_cdr')}</span>
        </div>
        <h2 className="mt-3 break-words text-[clamp(1.8rem,4vw,3rem)] font-black text-cyan-50">{displayTitle}</h2>
        <p className="mt-2 max-w-5xl text-[14px] leading-relaxed text-cyan-100/90 sm:text-[15px]">{compactText(subtitle, 340)}</p>
        <div className="mt-4 inline-flex items-center gap-3 rounded-xl border border-cyan-600/50 bg-[#061b34] px-4 py-2">
          <span>{getSemanticIcon('stat', 20, '#22d3ee')}</span>
          <div>
            <p className="text-xl font-black text-cyan-300">{statValue}</p>
            <p className="text-xs text-cyan-100/80">{statLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        {phases.map((phase, idx) => (
          <article key={`${phase.label}-${idx}`} className="rounded-2xl border border-cyan-800/50 bg-[#09203d] p-4 text-cyan-50 shadow-[0_8px_30px_rgba(2,6,23,0.35)]">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-cyan-300">{phase.label}</p>
            <h3 className="mt-2 line-clamp-2 text-[1.12rem] font-black leading-tight sm:text-xl">{compactText(phase.title, 68)}</h3>
            <div className="mt-3 flex justify-center">
              <CdrVector kind={idx === 0 ? 'base' : idx === phases.length - 1 ? 'return' : idx === 2 ? 'hop' : 'move'} />
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-cyan-100/90 sm:text-sm">{compactText(phase.summary, 170)}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-300">Telecom Circle: {phase.circle}</p>
            {phase.coords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {phase.coords.map(coord => (
                  <span key={coord} className="rounded-full bg-cyan-950/70 px-2 py-1 text-[11px] font-semibold text-cyan-200">{coord}</span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      {highlights.length > 0 && (
        <section className="mt-5 rounded-2xl border border-cyan-800/50 bg-[#09203d] p-4">
          <h4 className="text-sm font-bold uppercase tracking-[0.12em] text-cyan-300">Key Findings</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {highlights.slice(0, 4).map((item, index) => (
              <article key={`cdr-highlight-${index}`} className="rounded-lg border border-cyan-700/40 bg-[#0b2749] px-3 py-2">
                <p className="text-sm font-black text-cyan-100">{compactText(clean(item.title || `Finding ${index + 1}`), 65)}</p>
                {hasValue(item.subtitle) && (
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-300">{compactText(clean(item.subtitle), 52)}</p>
                )}
                <p className="mt-1 text-[13px] leading-relaxed text-cyan-100/90">{compactText(clean(item.description || '-'), 155)}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_1.8fr]">
        <section className="rounded-2xl border border-cyan-800/50 bg-[#09203d] p-4">
          <h4 className="text-sm font-bold uppercase tracking-[0.12em] text-cyan-300">Top Contacts</h4>
          <div className="mt-3 space-y-2">
            {topContacts.slice(0, 6).map((contact, idx) => (
              <div key={`${contact.number}-${idx}`} className="grid grid-cols-3 items-center rounded-lg border border-cyan-700/40 bg-[#0b2749] px-3 py-2 text-sm text-cyan-100">
                <span className="font-semibold">{clean(contact.number || '-')}</span>
                <span className="text-cyan-300">{clean(contact.type || '-')}</span>
                <span className="text-right font-black text-cyan-200">{clean(contact.calls || '-')}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-800/50 bg-[#09203d] p-4">
          <h4 className="text-sm font-bold uppercase tracking-[0.12em] text-cyan-300">Call Summary</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {callSummaryPairs.length > 0 ? callSummaryPairs.map(item => (
              <div key={item.key} className="rounded-lg border border-cyan-700/40 bg-[#0b2749] px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-300">{item.key}</p>
                <p className="mt-1 text-lg font-black text-cyan-100">{item.value}</p>
              </div>
            )) : (
              <p className="text-sm text-cyan-100/80">No call summary data available.</p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-cyan-800/50 bg-[#09203d] p-4">
        <h4 className="text-sm font-bold uppercase tracking-[0.12em] text-cyan-300">Mobility Matrix</h4>
        <div className="mt-3 overflow-hidden rounded-lg border border-cyan-700/40">
          <table className="min-w-full border-collapse text-[12px] text-cyan-100 sm:text-[13px]">
            <thead className="bg-[#0b2749] text-cyan-200">
              <tr>
                <th className="border-r border-cyan-700/40 px-2 py-2 text-left font-black">Date Range</th>
                <th className="border-r border-cyan-700/40 px-2 py-2 text-left font-black">Circle</th>
                <th className="px-2 py-2 text-left font-black">Primary Coordinates</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((phase, index) => (
                <tr key={`cdr-phase-row-${index}`} className="odd:bg-[#0c2a4c] even:bg-[#09203d]">
                  <td className="border-r border-t border-cyan-700/40 px-2 py-2 font-semibold">{compactText(phase.label, 46)}</td>
                  <td className="border-r border-t border-cyan-700/40 px-2 py-2">{compactText(phase.circle || '-', 44)}</td>
                  <td className="border-t border-cyan-700/40 px-2 py-2">{phase.coords.length ? phase.coords.join(' , ') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {timeline.length > 0 && (
        <section className="mt-5 rounded-2xl border border-cyan-800/50 bg-[#09203d] p-4">
          <h4 className="text-sm font-bold uppercase tracking-[0.12em] text-cyan-300">Event Timeline</h4>
          <div className="mt-3 space-y-2">
            {timeline.map((item, index) => (
              <div key={`cdr-timeline-${index}`} className="grid gap-1 rounded-lg border border-cyan-700/40 bg-[#0b2749] px-3 py-2 sm:grid-cols-[180px_1fr] sm:items-start">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-cyan-300">{clean(item.date || '-')}</p>
                <p className="text-[13px] leading-relaxed text-cyan-100">{compactText(clean(item.event || '-'), 240)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function InfographicLayout({ data, sourceTitle }: { data: InfographicResponse; sourceTitle?: string }) {
  const type = resolveType(data)
  const theme = resolveTheme(type)
  const isLight = type === 'criminal'
  const textColor = theme.textPrimary
  const mutedColor = theme.textMuted
  const borderColor = theme.cardBorder
  const cardSurface = isLight ? '#ffffff' : theme.cardBg
  const cardHeaderSurface = isLight ? '#ffffff' : 'rgba(2, 10, 24, 0.52)'
  const rowSurface = isLight ? '#f8fafc' : 'rgba(9, 24, 44, 0.68)'

  const subjectPairs = toPairs(flattenSubject(data.subject))
  const personalPairs = toPairs(data.personal)
  const profilePairs = toPairs(data.profile_summary)
  const accountPairs = toPairs(data.account)
  const financialPairs = toPairs(data.financial_summary)
  const callSummaryPairs = toPairs((data.call_summary ?? {}) as Record<string, string>)

  const detailBlocks = [
    { title: 'Subject Details', pairs: subjectPairs },
    { title: 'Personal Profile', pairs: personalPairs },
    { title: 'Profile Summary', pairs: profilePairs },
    { title: 'Account Details', pairs: accountPairs },
    { title: 'Financial Summary', pairs: financialPairs },
    { title: 'Call Summary', pairs: callSummaryPairs },
  ].filter(block => block.pairs.length > 0)

  const highlights = (data.highlights ?? []).filter(
    item => hasValue(item.title) || hasValue(item.description)
  )

  const narrativeItems: InfographicColumn[] = [
    ...(data.left_column ?? []),
    ...(data.right_column ?? []),
  ].filter(item => hasValue(item.title) || hasValue(item.description))

  if (narrativeItems.length === 0 && highlights.length > 0) {
    for (const finding of highlights.slice(0, 8)) {
      narrativeItems.push({
        title: clean(finding.title || 'Finding'),
        description: clean(finding.description || '-'),
        icon: clean(finding.title || 'finding'),
      })
    }
  }

  const dynamicSections = (data.dynamic_sections ?? [])
    .filter(section => hasValue(section.title) && Array.isArray(section.items) && section.items.length > 0)
    .map(section => ({
      title: clean(section.title),
      items: section.items
        .map(item => ({ key: clean(item.key), value: clean(item.value) }))
        .filter(item => hasValue(item.key) && hasValue(item.value)),
    }))
    .filter(section => section.items.length > 0)

  const associates = (data.associates ?? []).filter(
    item => hasValue(item.name) || hasValue(item.relation)
  )

  const topContacts = (data.top_contacts ?? []).filter(
    item => hasValue(item.number) || hasValue(item.type) || hasValue(item.calls)
  )

  const locations = (data.key_locations ?? []).filter(
    item => hasValue(item.area) || hasValue(item.cell_id) || hasValue(item.count)
  )

  const timeline = (data.timeline_events ?? []).filter(
    item => hasValue(item.date) || hasValue(item.event)
  )

  const cases = (data.case_details ?? []).filter(
    item =>
      hasValue(item.fir_no) ||
      hasValue(item.section) ||
      hasValue(item.date) ||
      hasValue(item.police_station) ||
      hasValue(item.status)
  )

  const transactions = (data.key_transactions ?? []).filter(
    item => hasValue(item.date) || hasValue(item.description) || hasValue(item.amount)
  )

  const forceCardLayout = clean((data.profile_summary as Record<string, string> | undefined)?.layout_mode || '').toLowerCase() === 'dynamic'
  if (!forceCardLayout && type === 'criminal') {
    return (
      <CriminalPosterView
        data={data}
        accent={theme.accent}
        mutedColor={theme.textMuted}
        sourceTitle={sourceTitle}
      />
    )
  }
  if (!forceCardLayout && type === 'cdr') {
    return <CdrStoryboardView data={data} />
  }

  return (
    <div
      className="w-full rounded-2xl border p-4 sm:p-5 lg:p-7"
      style={{
        background: renderThemeBackground(type),
        borderColor,
        color: textColor,
      }}
    >
      <div className="mb-5 rounded-2xl border px-4 py-4 sm:px-5" style={{ borderColor, background: isLight ? '#ffffff' : 'rgba(9, 16, 30, 0.5)' }}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ backgroundColor: theme.badge, color: theme.badgeText }}
          >
            {clean(theme.label || 'Infographic Report')}
          </span>
          {data.document_type && (
            <span className="text-xs font-medium uppercase tracking-[0.1em]" style={{ color: mutedColor }}>
              {clean(data.document_type)}
            </span>
          )}
        </div>
        <h2 className="text-2xl font-bold leading-tight sm:text-3xl">
          {clean(data.header?.title || 'Analysis Report')}
        </h2>
        {hasValue(data.header?.subtitle) && (
          <p className="mt-2 max-w-4xl text-sm sm:text-base" style={{ color: mutedColor }}>
            {clean(data.header?.subtitle)}
          </p>
        )}
        {data.stat && (
          <div className="mt-4 inline-flex items-center gap-3 rounded-xl border px-3 py-2" style={{ borderColor, background: isLight ? `${theme.accent}12` : 'rgba(15, 23, 42, 0.55)' }}>
            <span className="text-lg">{getSemanticIcon('stat', 20, theme.accent)}</span>
            <div>
              <div className="text-xl font-bold" style={{ color: theme.accent }}>
                {clean(data.stat.value)}
              </div>
              <div className="text-xs" style={{ color: mutedColor }}>
                {clean(data.stat.label)}
              </div>
            </div>
          </div>
        )}
      </div>

      {detailBlocks.length > 0 && (
        <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {detailBlocks.map(block => (
            <DataCard
              key={block.title}
              title={block.title}
              accent={theme.accent}
              textColor={textColor}
              borderColor={borderColor}
              surfaceColor={cardSurface}
              headerSurfaceColor={cardHeaderSurface}
            >
              <div className="grid grid-cols-1 gap-2">
                {block.pairs.map(item => (
                  <div
                    key={`${block.title}-${item.key}`}
                    className="grid gap-2 rounded-lg px-3 py-2"
                    style={{
                      gridTemplateColumns: 'minmax(130px, 0.8fr) 1.2fr',
                      backgroundColor: rowSurface,
                    }}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.accent }}>
                      {item.key}
                    </span>
                    <span className="text-sm leading-relaxed break-words">{item.value}</span>
                  </div>
                ))}
              </div>
            </DataCard>
          ))}
        </div>
      )}

      {narrativeItems.length > 0 && (
        <DataCard
          title="Narrative Analysis"
          accent={theme.accent}
          textColor={textColor}
          borderColor={borderColor}
          surfaceColor={cardSurface}
          headerSurfaceColor={cardHeaderSurface}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {narrativeItems.map((item, index) => (
              <article
                key={`${clean(item.title)}-${index}`}
                className="rounded-xl border px-3 py-2"
                style={{ borderColor, background: rowSurface }}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span>{getSemanticIcon(item.icon || item.title || 'info', 16, theme.accent)}</span>
                  <h4 className="text-sm font-semibold">{clean(item.title || `Point ${index + 1}`)}</h4>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: mutedColor }}>
                  {clean(item.description || '-')}
                </p>
              </article>
            ))}
          </div>
        </DataCard>
      )}

      {highlights.length > 0 && (
        <div className="mt-5">
          <DataCard
            title="Key Findings"
            accent={theme.accent}
            textColor={textColor}
            borderColor={borderColor}
            surfaceColor={cardSurface}
            headerSurfaceColor={cardHeaderSurface}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {highlights.map((item, index) => (
                <div
                  key={`${clean(item.title)}-${index}`}
                  className="rounded-xl border p-3"
                  style={{ borderColor, background: rowSurface }}
                >
                  <p className="text-sm font-semibold" style={{ color: theme.accent }}>
                    {clean(item.title || `Finding ${index + 1}`)}
                  </p>
                  {hasValue(item.subtitle) && (
                    <p className="mt-1 text-xs font-medium" style={{ color: mutedColor }}>
                      {clean(item.subtitle)}
                    </p>
                  )}
                  <p className="mt-2 text-sm leading-relaxed">
                    {clean(item.description || '-')}
                  </p>
                </div>
              ))}
            </div>
          </DataCard>
        </div>
      )}

      {dynamicSections.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {dynamicSections.map(section => (
            <DataCard
              key={`dynamic-${section.title}`}
              title={section.title}
              accent={theme.accent}
              textColor={textColor}
              borderColor={borderColor}
              surfaceColor={cardSurface}
              headerSurfaceColor={cardHeaderSurface}
            >
              <div className="space-y-2">
                {section.items.map((item, index) => (
                  <div
                    key={`${section.title}-${item.key}-${index}`}
                    className="grid gap-2 rounded-lg border px-3 py-2"
                    style={{
                      gridTemplateColumns: 'minmax(110px, 0.65fr) 1.35fr',
                      borderColor,
                      background: rowSurface,
                    }}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.accent }}>
                      {item.key}
                    </span>
                    <span className="text-sm leading-relaxed break-words">{item.value}</span>
                  </div>
                ))}
              </div>
            </DataCard>
          ))}
        </div>
      )}

      {(associates.length > 0 || topContacts.length > 0 || locations.length > 0) && (
        <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-3">
          {associates.length > 0 && (
            <DataCard
              title="Associates"
              accent={theme.accent}
              textColor={textColor}
              borderColor={borderColor}
              surfaceColor={cardSurface}
              headerSurfaceColor={cardHeaderSurface}
            >
              <div className="space-y-2">
                {associates.map((item, index) => (
                  <div key={`${clean(item.name)}-${index}`} className="rounded-lg border px-3 py-2" style={{ borderColor, background: rowSurface }}>
                    <div className="text-sm font-semibold">{clean(item.name || '-')}</div>
                    <div className="text-xs" style={{ color: mutedColor }}>
                      {clean(item.relation || '-')}
                    </div>
                  </div>
                ))}
              </div>
            </DataCard>
          )}
          {topContacts.length > 0 && (
            <DataCard
              title="Top Contacts"
              accent={theme.accent}
              textColor={textColor}
              borderColor={borderColor}
              surfaceColor={cardSurface}
              headerSurfaceColor={cardHeaderSurface}
            >
              <div className="space-y-2">
                {topContacts.map((item, index) => (
                  <div key={`${clean(item.number)}-${index}`} className="grid grid-cols-3 gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor, background: rowSurface }}>
                    <span className="font-medium">{clean(item.number || '-')}</span>
                    <span style={{ color: mutedColor }}>{clean(item.type || '-')}</span>
                    <span className="text-right font-semibold" style={{ color: theme.accent }}>
                      {clean(item.calls || '-')}
                    </span>
                  </div>
                ))}
              </div>
            </DataCard>
          )}
          {locations.length > 0 && (
            <DataCard
              title="Key Locations"
              accent={theme.accent}
              textColor={textColor}
              borderColor={borderColor}
              surfaceColor={cardSurface}
              headerSurfaceColor={cardHeaderSurface}
            >
              <div className="space-y-2">
                {locations.map((item, index) => (
                  <div key={`${clean(item.area || item.cell_id)}-${index}`} className="rounded-lg border px-3 py-2" style={{ borderColor, background: rowSurface }}>
                    <div className="text-sm font-medium">{clean(item.area || item.cell_id || '-')}</div>
                    <div className="mt-1 text-xs" style={{ color: mutedColor }}>
                      {clean(item.cell_id || '-')}
                    </div>
                    <div className="mt-1 text-xs font-semibold" style={{ color: theme.accent }}>
                      Count: {clean(item.count || '-')}
                    </div>
                  </div>
                ))}
              </div>
            </DataCard>
          )}
        </div>
      )}

      {timeline.length > 0 && (
        <div className="mt-5">
          <DataCard
            title={`Timeline (${timeline.length})`}
            accent={theme.accent}
            textColor={textColor}
            borderColor={borderColor}
            surfaceColor={cardSurface}
            headerSurfaceColor={cardHeaderSurface}
          >
            <div className="space-y-2">
              {timeline.map((item, index) => (
                <div key={`${clean(item.date)}-${index}`} className="grid gap-2 rounded-lg border px-3 py-2 sm:grid-cols-[150px_1fr]" style={{ borderColor, background: rowSurface }}>
                  <span className="text-xs font-semibold" style={{ color: theme.accent }}>
                    {clean(item.date || '-')}
                  </span>
                  <span className="text-sm leading-relaxed">{clean(item.event || '-')}</span>
                </div>
              ))}
            </div>
          </DataCard>
        </div>
      )}

      {transactions.length > 0 && (
        <div className="mt-5">
          <DataCard
            title="Key Transactions"
            accent={theme.accent}
            textColor={textColor}
            borderColor={borderColor}
            surfaceColor={cardSurface}
            headerSurfaceColor={cardHeaderSurface}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[13px]">
                <thead>
                  <tr style={{ color: mutedColor }}>
                    <th className="border-b px-3 py-2 text-left" style={{ borderColor }}>Date</th>
                    <th className="border-b px-3 py-2 text-left" style={{ borderColor }}>Description</th>
                    <th className="border-b px-3 py-2 text-left" style={{ borderColor }}>Type</th>
                    <th className="border-b px-3 py-2 text-right" style={{ borderColor }}>Amount</th>
                    <th className="border-b px-3 py-2 text-right" style={{ borderColor }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, index) => {
                    const isDebit = clean(tx.type).toLowerCase().includes('debit')
                    return (
                      <tr key={`${clean(tx.date)}-${index}`}>
                        <td className="border-b px-3 py-2" style={{ borderColor }}>{clean(tx.date || '-')}</td>
                        <td className="border-b px-3 py-2" style={{ borderColor }}>{clean(tx.description || '-')}</td>
                        <td className="border-b px-3 py-2 font-medium" style={{ borderColor, color: isDebit ? '#ef4444' : '#22c55e' }}>
                          {clean(tx.type || '-')}
                        </td>
                        <td className="border-b px-3 py-2 text-right font-semibold" style={{ borderColor }}>
                          {currencyText(tx.amount)}
                        </td>
                        <td className="border-b px-3 py-2 text-right" style={{ borderColor }}>
                          {currencyText(tx.balance)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </DataCard>
        </div>
      )}

      {cases.length > 0 && (
        <div className="mt-5">
          <DataCard
            title="Case Details"
            accent={theme.accent}
            textColor={textColor}
            borderColor={borderColor}
            surfaceColor={cardSurface}
            headerSurfaceColor={cardHeaderSurface}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[13px]">
                <thead>
                  <tr style={{ color: mutedColor }}>
                    <th className="border-b px-3 py-2 text-left" style={{ borderColor }}>FIR No.</th>
                    <th className="border-b px-3 py-2 text-left" style={{ borderColor }}>Section</th>
                    <th className="border-b px-3 py-2 text-left" style={{ borderColor }}>Date</th>
                    <th className="border-b px-3 py-2 text-left" style={{ borderColor }}>Police Station</th>
                    <th className="border-b px-3 py-2 text-left" style={{ borderColor }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((row, index) => (
                    <tr key={`${clean(row.fir_no)}-${index}`}>
                      <td className="border-b px-3 py-2" style={{ borderColor }}>{clean(row.fir_no || '-')}</td>
                      <td className="border-b px-3 py-2" style={{ borderColor }}>{clean(row.section || '-')}</td>
                      <td className="border-b px-3 py-2" style={{ borderColor }}>{clean(row.date || '-')}</td>
                      <td className="border-b px-3 py-2" style={{ borderColor }}>{clean(row.police_station || '-')}</td>
                      <td className="border-b px-3 py-2" style={{ borderColor }}>
                        <span className="rounded-full px-2 py-1 text-xs font-medium" style={{ background: `${theme.accent}20`, color: theme.accent }}>
                          {clean(row.status || '-')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataCard>
        </div>
      )}
    </div>
  )
}

export function isInfographicInsight(insightType: string): boolean {
  return insightType.toLowerCase().includes('infographic')
}

export function InfographicInsightViewer({ content, sourceTitle }: { content?: string; sourceTitle?: string }) {
  const data = useMemo<InfographicResponse | null>(() => {
    if (!content) return null

    try {
      const direct = JSON.parse(content) as InfographicResponse
      if (direct && (direct.header || direct.document_type || direct.source_id)) {
        return normalizeInfographicBlock(direct)
      }
    } catch {
      // Non-JSON payload, continue with robust extraction.
    }

    const extracted = extractAndMergeJson(content)
    if (extracted && (extracted.header || extracted.document_type)) {
      return extracted
    }

    return normalizeInfographicBlock(parseMarkdownToInfographic(content))
  }, [content])

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No infographic data available.
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden">
      <InfographicLayout data={data} sourceTitle={sourceTitle} />
    </div>
  )
}
