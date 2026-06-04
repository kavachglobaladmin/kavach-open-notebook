'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Manages parent-child notebook relationships entirely on the client side.
 * Relationships are persisted in localStorage under the key `notebook_subfolders`.
 *
 * Structure stored:
 *   { [parentId: string]: string[] }   — array of child notebook IDs
 */

const STORAGE_KEY = 'notebook_subfolders'

function loadMap(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveMap(map: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Silently ignore storage errors
  }
}

/**
 * Returns the list of child notebook IDs for a given parent notebook, along
 * with helpers to add / remove children.
 */
export function useSubFolders(parentId: string) {
  const [childIds, setChildIds] = useState<string[]>([])

  // Load from localStorage on mount / when parentId changes
  useEffect(() => {
    const map = loadMap()
    setChildIds(map[parentId] ?? [])
  }, [parentId])

  const addChild = useCallback(
    (childId: string) => {
      const map = loadMap()
      const existing = map[parentId] ?? []
      if (existing.includes(childId)) return
      const updated = [...existing, childId]
      map[parentId] = updated
      saveMap(map)
      setChildIds(updated)
    },
    [parentId],
  )

  const removeChild = useCallback(
    (childId: string) => {
      const map = loadMap()
      const existing = map[parentId] ?? []
      const updated = existing.filter((id) => id !== childId)
      map[parentId] = updated
      saveMap(map)
      setChildIds(updated)
    },
    [parentId],
  )

  return { childIds, addChild, removeChild }
}

/**
 * Returns the parent notebook ID for a given child, or null if none.
 */
export function getParentId(childId: string): string | null {
  const map = loadMap()
  for (const [parentId, children] of Object.entries(map)) {
    if (children.includes(childId)) return parentId
  }
  return null
}

/**
 * Returns a flat Set of ALL notebook IDs that are registered as children
 * of any parent. Used to exclude sub-folders from the top-level Cases list.
 */
export function getAllChildIds(): Set<string> {
  const map = loadMap()
  const ids = new Set<string>()
  for (const children of Object.values(map)) {
    children.forEach((id) => ids.add(id))
  }
  return ids
}

/**
 * Returns all descendant notebook IDs for a given parent notebook, including
 * children, grandchildren, and so on.
 */
export function getDescendantIds(parentId: string): string[] {
  const map = loadMap()
  const collected = new Set<string>()

  const visit = (currentParentId: string) => {
    const children = map[currentParentId] ?? []
    children.forEach((childId) => {
      if (collected.has(childId)) return
      collected.add(childId)
      visit(childId)
    })
  }

  visit(parentId)
  return Array.from(collected)
}
