import { render, screen } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { ChatColumn } from './ChatColumn'
import { useNotes } from '@/lib/hooks/use-notes'
import { useNotebookChat } from '@/lib/hooks/useNotebookChat'

const chatPanelSpy = vi.fn()

// Mock the hooks
vi.mock('@/lib/hooks/use-notes')
vi.mock('@/lib/hooks/useNotebookChat')
vi.mock('@/components/source/ChatPanel', () => ({
  ChatPanel: (props: Record<string, unknown>) => {
    chatPanelSpy(props)
    return <div data-testid="chat-panel" />
  }
}))

// Type-safe mock factory for useNotes hook
function createNotesMock(overrides: { isLoading?: boolean } = {}) {
  return {
    data: [],
    isLoading: overrides.isLoading ?? false,
  } as unknown as ReturnType<typeof useNotes>
}

// Type-safe mock factory for useNotebookChat hook
function createChatMock() {
  return {
    messages: [],
    isSending: false,
    tokenCount: 0,
    charCount: 0,
    sessions: [],
    currentSessionId: null,
  } as unknown as ReturnType<typeof useNotebookChat>
}

describe('ChatColumn', () => {
  const baseProps = {
    notebookId: 'test-notebook',
    contextSelections: {
      sources: {},
      notes: {}
    },
    sources: [],
  }

  beforeEach(() => {
    chatPanelSpy.mockClear()
  })

  it('shows loading spinner when fetching data', () => {
    vi.mocked(useNotes).mockReturnValue(createNotesMock({ isLoading: true }))
    vi.mocked(useNotebookChat).mockReturnValue(createChatMock())

    render(<ChatColumn {...baseProps} sourcesLoading={true} />)

    // Should show loading spinner
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders chat panel when data is loaded', () => {
    vi.mocked(useNotes).mockReturnValue(createNotesMock({ isLoading: false }))
    vi.mocked(useNotebookChat).mockReturnValue(createChatMock())

    render(<ChatColumn {...baseProps} sourcesLoading={false} />)

    // Should show chat panel
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('normalizes folder citation ids before passing the reference catalog to ChatPanel', () => {
    vi.mocked(useNotes).mockReturnValue(createNotesMock({ isLoading: false }))
    vi.mocked(useNotebookChat).mockReturnValue(createChatMock())

    render(
      <ChatColumn
        {...baseProps}
        sourcesLoading={false}
        folderContexts={[
          {
            id: 'notebook:ir',
            name: 'IR',
            sources: [{ id: 'source:fir123', title: 'FIR Copy' }] as never[],
            notes: [{ id: 'note:note456', title: 'Officer note' }] as never[],
          },
        ]}
      />,
    )

    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    expect(chatPanelSpy).toHaveBeenCalled()

    const lastCall = chatPanelSpy.mock.calls.at(-1)?.[0] as {
      referenceCatalog?: Array<{ type: string; id: string; title?: string | null }>
    }

    expect(lastCall.referenceCatalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'source', id: 'fir123', title: 'FIR Copy' }),
        expect.objectContaining({ type: 'note', id: 'note456', title: 'Officer note' }),
      ]),
    )
  })
})
