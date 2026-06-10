const STORAGE_ALERT_MAX_BAND_KEY = 'open_i_Notes_storage_alert_max_band_v1'

type BandKey = `${string}` // i_Notes id → max band alerted (50 | 75 | 100), 0 = none

/** Highest warning band derived from usage (matches i_NotesCard thresholds). */
export function i_NotestorageBandFromPct(usedPct: number): 0 | 50 | 75 | 100 {
  if (usedPct >= 100) return 100
  if (usedPct >= 75) return 75
  if (usedPct >= 50) return 50
  return 0
}

export function takei_NotestorageToastBand(i_NotesId: string, usedPct: number): 50 | 75 | 100 | null {
  if (typeof window === 'undefined') return null

  const band = i_NotestorageBandFromPct(usedPct)
  let map: Record<BandKey, number>
  try {
    const raw = localStorage.getItem(STORAGE_ALERT_MAX_BAND_KEY)
    map = raw ? (JSON.parse(raw) as Record<BandKey, number>) : {}
    if (!map || typeof map !== 'object') map = {}
  } catch {
    map = {}
  }

  let maxAlerted = map[i_NotesId] ?? 0
  if (!Number.isFinite(maxAlerted) || maxAlerted < 0) maxAlerted = 0

  // Fell below storage warning bands → reset ascent tracking (future crossings may notify again).
  if (band < maxAlerted) {
    maxAlerted = band
    map[i_NotesId] = maxAlerted
    try {
      localStorage.setItem(STORAGE_ALERT_MAX_BAND_KEY, JSON.stringify(map))
    } catch {
      // ignore quota / private mode
    }
  }

  if (band <= 0 || band <= maxAlerted) return null

  map[i_NotesId] = band
  try {
    localStorage.setItem(STORAGE_ALERT_MAX_BAND_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }

  return band as 50 | 75 | 100
}
