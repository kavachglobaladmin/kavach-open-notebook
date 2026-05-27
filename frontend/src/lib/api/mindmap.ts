import apiClient from './client'

export interface MindMapNode {
  label: string
  children?: MindMapNode[]
}

export interface MindMapResponse {
  mind_map: MindMapNode
  source_id: string
}

export interface MindMapRequest {
  model_name?: string
  temperature?: number
}

/* -------------------------------------------------- */
/* 🔥 NORMALIZE ANY RESPONSE FORMAT */
/* -------------------------------------------------- */
function normalizeMindMap(data: unknown): MindMapResponse {
  const parsed = data as {
    mind_map?: MindMapNode
    label?: string
    source_id?: string
    data?: MindMapNode
  }

  // case 1: already correct
  if (parsed?.mind_map?.label) {
    return parsed as MindMapResponse
  }

  // case 2: backend returned direct node
  if (parsed?.label) {
    return {
      mind_map: parsed as unknown as MindMapNode,
      source_id: parsed.source_id || 'unknown',
    }
  }

  // case 3: string JSON from LLM
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      return normalizeMindMap(parsed)
    } catch {}
  }

  // case 4: wrapped response
  if (parsed?.data?.label) {
    return {
      mind_map: parsed.data,
      source_id: parsed.source_id || 'unknown',
    }
  }

  console.error('Invalid mindmap response:', data)
  throw new Error('Invalid mindmap structure')
}

/* -------------------------------------------------- */

export const mindmapApi = {
  /* ---------------- GENERATE ---------------- */
  generate: async (
    sourceId: string,
    options: MindMapRequest = {}
  ): Promise<MindMapResponse> => {
    const response = await apiClient.post(
      `/sources/${encodeURIComponent(sourceId)}/mindmap`,
      { model_name: 'qwen3', temperature: 0.2, ...options },
      { timeout: 0 }
    )

    // ✅ IMPORTANT FIX
    return normalizeMindMap(response.data)
  },

  /* ---------------- IMAGES ---------------- */
  getImages: async (sourceId: string) => {
    const response = await apiClient.get(
      `/sources/${encodeURIComponent(sourceId)}/images`
    )
    return response.data
  },

  /* ---------------- NODE SUMMARY ---------------- */
  getNodeSummary: async (
    sourceId: string,
    nodeName: string,
    rootSubject: string
  ) => {
    const response = await apiClient.post(
      `/sources/${encodeURIComponent(sourceId)}/node-summary`,
      { node_name: nodeName, root_subject: rootSubject }
    )
    return response.data
  },

  /* ---------------- SOURCE SUMMARY ---------------- */
  getSourceSummary: async (sourceId: string) => {
    const response = await apiClient.post(
      `/sources/${encodeURIComponent(sourceId)}/summary`,
      {}
    )
    return response.data
  },

  /* ---------------- STATUS ---------------- */
  getStatus: async (sourceId: string) => {
    try {
      const response = await apiClient.get(
        `/sources/${encodeURIComponent(sourceId)}/status`
      )
      return response.data
    } catch {
      return { status: null }
    }
  },
}
