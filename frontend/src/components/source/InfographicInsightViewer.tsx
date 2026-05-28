'use client'

import React, { useMemo } from 'react'
import { getSectionIcon, getSemanticIcon } from './infographic/IconEngine'
import {
  clean,
  extractAndMergeJson,
  flattenSubject,
  hasValue,
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

  const ringStyle = {
    background: `conic-gradient(${accent} 0 76%, #e5e7eb 76% 100%)`,
  }

  const knownAliasesCandidate = clean(
    pickValueFromKeys(subjectMap, ['aliases', 'alias', 'known aliases']) ||
    data.personal?.aliases ||
    pickValueFromKeys(subjectMap, ['name', 'subject', 'primary subject']) ||
    data.personal?.name ||
    ''
  )
  const knownAliases = knownAliasesCandidate || displayTitle || '-'
  const evolutionHeading = normalizeHeadingFromStory(leftLead.title, 'Profile Evolution')
  const operationHeading = normalizeHeadingFromStory(rightLead.title, 'Network Operations & Logistics')

  const MiniPin = ({ label, className }: { label: string; className: string }) => (
    <div className={`absolute flex flex-col items-center ${className}`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] bg-white shadow-md" style={{ borderColor: accent }}>
        {getSemanticIcon('map', 20, accent)}
      </div>
      <span className="mt-1 max-w-[78px] truncate rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
        {label}
      </span>
    </div>
  )

  const StoryCard = ({
    item,
    tone = 'rose',
    large = false,
  }: {
    item: StoryItem
    tone?: 'rose' | 'slate'
    large?: boolean
  }) => {
    const color = tone === 'rose' ? '#9f1239' : '#475569'
    const bg = tone === 'rose' ? '#fff1f2' : '#eef2ff'
    const title = item.title.toLowerCase()
    const vectorKind: 'evolution' | 'footprint' | 'command' | 'resources' | 'tactical' | null =
      large && tone === 'rose'
        ? 'evolution'
        : title.includes('footprint') || title.includes('location')
          ? 'footprint'
          : title.includes('command') || title.includes('control') || title.includes('signal')
            ? 'command'
            : title.includes('resource') || title.includes('logistic') || title.includes('finance')
              ? 'resources'
              : title.includes('tactical') || title.includes('weapon') || title.includes('skill')
                ? 'tactical'
                : null

    return (
      <article className="group rounded-[22px] border border-slate-200 bg-white/95 p-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="flex items-start gap-4">
          <div
            className={`${large ? 'h-22 w-22' : 'h-14 w-14'} shrink-0 rounded-2xl flex items-center justify-center`}
            style={{ backgroundColor: bg }}
          >
            {vectorKind ? (
              <PosterVector kind={vectorKind} accent={color} />
            ) : (
              getSemanticIcon(item.iconKey, large ? 38 : 24, color)
            )}
          </div>
          <div className="min-w-0">
            <h4 className={`${large ? 'text-[1.45rem]' : 'text-[1.08rem]'} line-clamp-2 font-black leading-tight text-slate-950`} title={item.title}>
              {item.title}
            </h4>
            {item.subtitle && (
              <p className="mt-1 text-[13px] font-bold text-slate-600">{item.subtitle}</p>
            )}
            <p className="mt-2 line-clamp-4 text-[14px] font-medium leading-relaxed text-slate-700" title={item.description}>
              {compactText(item.description, large ? 220 : 170)}
            </p>
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 sm:p-3 lg:p-4">
      <div
        className="mx-auto w-full max-w-none overflow-hidden rounded-[18px] border border-slate-100 px-5 py-5 sm:px-7 lg:px-9"
        style={{
          backgroundColor: '#ffffff',
          backgroundImage:
            'radial-gradient(#e8edf3 0.8px, transparent 0.8px), radial-gradient(#e8edf3 0.8px, #ffffff 0.8px)',
          backgroundSize: '14px 14px',
          backgroundPosition: '0 0, 7px 7px',
        }}
      >
        <div className="mb-5">
          <h2 className="max-w-none break-words text-[clamp(2rem,5.1vw,4.3rem)] font-black leading-[1.02] tracking-tight text-slate-950">
            {displayTitle}
          </h2>
          {hasValue(data.header?.subtitle) && (
            <p className="mt-3 max-w-none text-[15px] font-medium leading-relaxed text-slate-700 sm:text-[16px] lg:text-[17px]">
              {compactText(clean(data.header?.subtitle), 360)}
            </p>
          )}
        </div>

        <div className="relative grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:gap-16">
          <div className="pointer-events-none absolute left-1/2 top-[86px] hidden h-[560px] w-[250px] -translate-x-1/2 opacity-75 xl:block">
            <svg viewBox="0 0 250 560" className="h-full w-full">
              <path d="M22 28 H92 C128 28 128 72 128 110 V194 C128 232 96 238 70 238 H28" stroke={accent} strokeWidth="9" fill="none" strokeLinecap="round" />
              <path d="M28 238 H102 C138 238 138 280 138 318 V390 C138 426 106 432 78 432 H32" stroke={accent} strokeWidth="9" fill="none" strokeLinecap="round" />
              <path d="M228 28 H158 C122 28 122 72 122 110 V194 C122 232 154 238 180 238 H222" stroke="#475569" strokeWidth="9" fill="none" strokeLinecap="round" />
              <path d="M222 238 H148 C112 238 112 280 112 318 V390 C112 426 144 432 172 432 H218" stroke="#475569" strokeWidth="9" fill="none" strokeLinecap="round" />
            </svg>
          </div>

          <section className="relative z-10 space-y-4">
            <h3 className="text-[1.5rem] font-black leading-tight text-slate-950 sm:text-[1.95rem]">
              {evolutionHeading}
            </h3>

            <StoryCard item={leftLead} tone="rose" large />

            <article className="rounded-[22px] border border-slate-200 bg-white/95 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative flex h-34 w-34 shrink-0 items-center justify-center rounded-full p-3" style={ringStyle}>
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white shadow-inner">
                    <span className="text-[2.4rem] font-black tracking-tight text-slate-950">{statValue}</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-[1.45rem] font-black leading-tight text-slate-950">
                    Active Criminal Involvements
                  </h4>
                  <p className="mt-2 max-w-xl text-[14px] font-medium leading-relaxed text-slate-700">
                    {compactText(statLabel, 190)}
                  </p>
                </div>
              </div>
            </article>

            {leftSupport.map((item, index) => (
              <StoryCard key={`left-support-${index}`} item={item} tone="rose" />
            ))}
          </section>

          <section className="relative z-10 space-y-4">
            <h3 className="text-[1.5rem] font-black leading-tight text-slate-950 sm:text-[1.95rem]">
              {operationHeading}
            </h3>

            <article className="rounded-[22px] border border-slate-200 bg-white/95 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="grid gap-4 lg:grid-cols-[250px_1fr] xl:grid-cols-[280px_1fr]">
                <div className="relative h-[180px] rounded-2xl bg-slate-50">
                  <svg viewBox="0 0 240 190" className="absolute inset-0 h-full w-full">
                    <path d="M60 50 L130 35 L188 70 L122 128 L60 50" stroke="#94a3b8" strokeWidth="2" fill="none" />
                    <path d="M130 35 L122 128 M188 70 L70 132" stroke="#94a3b8" strokeWidth="2" fill="none" />
                  </svg>
                  <MiniPin label={clean(footprintLabels[0] || 'Zone A')} className="left-6 top-5" />
                  <MiniPin label={clean(footprintLabels[1] || 'Zone B')} className="left-[95px] top-0" />
                  <MiniPin label={clean(footprintLabels[2] || 'Zone C')} className="right-5 top-7" />
                  <MiniPin label={clean(footprintLabels[3] || 'Zone D')} className="left-[92px] bottom-2" />
                </div>

                <div className="flex flex-col justify-center">
                  <h4 className="text-[1.4rem] font-black leading-tight text-slate-950">
                    {rightLead.title}
                  </h4>
                  {rightLead.subtitle && (
                    <p className="mt-1 text-[13px] font-bold text-slate-600">{rightLead.subtitle}</p>
                  )}
                  <p className="mt-2 text-[14px] font-medium leading-relaxed text-slate-700">
                    {compactText(rightLead.description, 240)}
                  </p>
                </div>
              </div>
            </article>

            <div className="grid gap-4 lg:grid-cols-2">
              <StoryCard item={rightSupport[0]} tone="slate" />
              <StoryCard item={rightSupport[1]} tone="slate" />
            </div>

            <section className="rounded-[22px] border border-slate-200 bg-white/95 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <h4 className="mb-3 text-[1.25rem] font-black leading-tight text-slate-950">
                Key Syndicate Operations
              </h4>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-slate-700 text-white">
                      <th className="border-r border-slate-500 px-3 py-2 text-left font-black">Crime Type</th>
                      <th className="border-r border-slate-500 px-3 py-2 text-left font-black">Primary Location</th>
                      <th className="px-3 py-2 text-left font-black">Key Associated Figure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operationRows.map((row, index) => (
                      <tr key={`operation-${index}`} className="odd:bg-white even:bg-slate-50">
                        <td className="border-r border-t border-slate-200 px-3 py-2">
                          <div className="flex items-center gap-2 font-bold text-slate-900">
                            {getSemanticIcon('crime', 18, accent)}
                            {compactText(row.crime, 88)}
                          </div>
                        </td>
                        <td className="border-r border-t border-slate-200 px-3 py-2">
                          <div className="flex items-center gap-2 font-semibold text-slate-700">
                            {getSemanticIcon('map', 18, accent)}
                            {compactText(row.location, 72)}
                          </div>
                        </td>
                        <td className="border-t border-slate-200 px-3 py-2">
                          <div className="flex items-center gap-2 font-semibold text-slate-700">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200">
                              {getSemanticIcon('user', 15, '#111827')}
                            </span>
                            {compactText(row.figure, 78)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        </div>

        {extraStories.length > 0 && (
          <section className="mt-6 rounded-[22px] border border-slate-200 bg-white/95 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <h4 className="mb-3 text-[1.12rem] font-black text-slate-950">Additional Findings</h4>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {extraStories.map((item, index) => (
                <article key={`extra-story-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">{getSemanticIcon(item.iconKey, 14, accent)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-black leading-tight text-slate-900">{compactText(item.title, 70)}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{compactText(item.description, 120)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 grid rounded-[22px] border border-slate-200 bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:grid-cols-4">
          <div className="flex items-center gap-4 border-b border-slate-200 p-4 md:border-b-0 md:border-r">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50">{getSemanticIcon('calendar', 26, accent)}</span>
            <div>
              <p className="text-sm font-black text-slate-950">Date of Birth</p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {clean(data.personal?.date_of_birth || pickValueFromKeys(subjectMap, ['date of birth', 'dob']) || timeline[0]?.date || '-')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 border-b border-slate-200 p-4 md:border-b-0 md:border-r">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50">{getSemanticIcon('id', 26, '#111827')}</span>
            <div>
              <p className="text-sm font-black text-slate-950">Known Aliases</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700">{knownAliases}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 border-b border-slate-200 p-4 md:border-b-0 md:border-r">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50">{getSemanticIcon('target', 26, accent)}</span>
            <div>
              <p className="text-sm font-black text-slate-950">Known Expertise</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700">{clean(leftSupport[1]?.title || leftSupport[0]?.title || 'Operational coordination')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50">{getSemanticIcon('shield', 26, '#111827')}</span>
            <div>
              <p className="text-sm font-black text-slate-950">Current Status</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700">
                {clean(data.profile_summary?.status || pickValueFromKeys(subjectMap, ['status', 'current status']) || 'Active intelligence profile')}
              </p>
            </div>
          </div>
        </section>

        {timeline.length > 0 && (
          <section className="mt-6 rounded-[22px] border border-slate-200 bg-white/95 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <h4 className="mb-4 text-[1.25rem] font-black text-slate-950">Timeline of Events</h4>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {timeline.map((item, index) => (
                <div key={`timeline-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-black uppercase tracking-[0.12em]" style={{ color: accent }}>
                    {clean(item.date || `Event ${index + 1}`)}
                  </p>
                  <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-700">
                    {compactText(clean(item.event || '-'), 145)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          <span>Criminal Intelligence Profile</span>
          
        </div>
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

  const narrativeItems: InfographicColumn[] = [
    ...(data.left_column ?? []),
    ...(data.right_column ?? []),
  ].filter(item => hasValue(item.title) || hasValue(item.description))

  const highlights = (data.highlights ?? []).filter(
    item => hasValue(item.title) || hasValue(item.description)
  )

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

  if (type === 'criminal') {
    return (
      <CriminalPosterView
        data={data}
        accent={theme.accent}
        mutedColor={theme.textMuted}
        sourceTitle={sourceTitle}
      />
    )
  }
  if (type === 'cdr') {
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
        return direct
      }
    } catch {
      // Non-JSON payload, continue with robust extraction.
    }

    const extracted = extractAndMergeJson(content)
    if (extracted && (extracted.header || extracted.document_type)) {
      return extracted
    }

    return parseMarkdownToInfographic(content)
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
