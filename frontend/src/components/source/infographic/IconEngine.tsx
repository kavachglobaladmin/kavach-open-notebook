'use client'

// ── Dynamic Icon Engine ───────────────────────────────────────────────────────
// Maps semantic string names → Lucide icons with fallback to emoji

import React from 'react'
import {
  User, Phone, MapPin, Calendar, FileText, AlertTriangle,
  TrendingUp, TrendingDown, DollarSign, CreditCard, Building,
  Search, Link, Lightbulb, Shield, Activity, BarChart2,
  Clock, Hash, Info, Star, Zap, Globe, Lock, Eye,
  ArrowUpRight, ArrowDownLeft, MessageSquare, Wifi,
  Users, Briefcase, Home, Car, Fingerprint, Database,
} from 'lucide-react'

type LucideComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>

const ICON_MAP: Record<string, LucideComponent> = {
  // Identity / person
  user: User, person: User, subject: User, identity: Fingerprint,
  // Communication
  phone: Phone, call: Phone, sms: MessageSquare, data: Wifi, network: Wifi,
  // Location
  location: MapPin, map: MapPin, area: MapPin, cell: MapPin,
  // Time
  date: Calendar, timeline: Clock, time: Clock,
  // Documents
  file: FileText, document: FileText, fir: FileText, case: FileText,
  // Alerts
  alert: AlertTriangle, warning: AlertTriangle, crime: AlertTriangle,
  // Finance
  credit: TrendingUp, debit: TrendingDown, money: DollarSign,
  bank: Building, account: CreditCard, transaction: DollarSign,
  financial: BarChart2, balance: BarChart2,
  // Analysis
  search: Search, finding: Search, insight: Lightbulb,
  link: Link, associate: Users, relation: Users,
  // Security
  shield: Shield, criminal: Shield, intelligence: Eye,
  // General
  activity: Activity, stat: BarChart2, summary: Hash,
  info: Info, highlight: Star, key: Zap,
  global: Globe, lock: Lock, incoming: ArrowDownLeft,
  outgoing: ArrowUpRight, contact: Phone, address: Home,
  vehicle: Car, job: Briefcase, database: Database,
}

const EMOJI_FALLBACK: Record<string, string> = {
  user: '👤', person: '👤', subject: '🧑', identity: '🪪',
  phone: '📞', call: '📞', sms: '💬', data: '📶', network: '🌐',
  location: '📍', map: '🗺️', area: '📍', cell: '📡',
  date: '📅', timeline: '⏱️', time: '🕐',
  file: '📄', document: '📋', fir: '📋', case: '⚖️',
  alert: '⚠️', warning: '🚨', crime: '🚔',
  credit: '📈', debit: '📉', money: '💰',
  bank: '🏦', account: '💳', transaction: '💸', financial: '📊', balance: '⚖️',
  search: '🔍', finding: '🔎', insight: '💡',
  link: '🔗', associate: '👥', relation: '🤝',
  shield: '🛡️', criminal: '🚔', intelligence: '🕵️',
  activity: '⚡', stat: '📊', summary: '📝',
  info: 'ℹ️', highlight: '⭐', key: '🔑',
  incoming: '📥', outgoing: '📤', contact: '📱',
}

export function getSemanticIcon(
  name: string,
  size = 16,
  color = 'currentColor',
): React.ReactNode {
  const key = name.toLowerCase().replace(/[^a-z]/g, '')
  const LucideIcon = ICON_MAP[key]
  if (LucideIcon) {
    return <LucideIcon size={size} color={color} strokeWidth={1.8} />
  }
  // Partial match
  for (const [k, Icon] of Object.entries(ICON_MAP)) {
    if (key.includes(k) || k.includes(key)) {
      return <Icon size={size} color={color} strokeWidth={1.8} />
    }
  }
  // Emoji fallback
  const emoji = EMOJI_FALLBACK[key] ?? EMOJI_FALLBACK[Object.keys(EMOJI_FALLBACK).find(k => key.includes(k) || k.includes(key)) ?? ''] ?? '📌'
  return <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{emoji}</span>
}

// Section-level icon mapping based on section label keywords
export function getSectionIcon(label: string, size = 14, color = 'currentColor'): React.ReactNode {
  const l = label.toLowerCase()
  if (l.includes('subject') || l.includes('personal') || l.includes('profile')) return getSemanticIcon('user', size, color)
  if (l.includes('account') || l.includes('bank') || l.includes('financial')) return getSemanticIcon('bank', size, color)
  if (l.includes('transaction') || l.includes('payment')) return getSemanticIcon('transaction', size, color)
  if (l.includes('call') || l.includes('cdr') || l.includes('contact')) return getSemanticIcon('phone', size, color)
  if (l.includes('location') || l.includes('area') || l.includes('cell')) return getSemanticIcon('location', size, color)
  if (l.includes('timeline') || l.includes('event') || l.includes('date')) return getSemanticIcon('timeline', size, color)
  if (l.includes('case') || l.includes('fir') || l.includes('crime')) return getSemanticIcon('case', size, color)
  if (l.includes('associate') || l.includes('alliance') || l.includes('network')) return getSemanticIcon('associate', size, color)
  if (l.includes('finding') || l.includes('insight') || l.includes('key')) return getSemanticIcon('finding', size, color)
  if (l.includes('summary') || l.includes('overview')) return getSemanticIcon('summary', size, color)
  if (l.includes('alert') || l.includes('warning') || l.includes('risk')) return getSemanticIcon('alert', size, color)
  return getSemanticIcon('info', size, color)
}
