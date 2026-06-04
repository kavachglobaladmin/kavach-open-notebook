import { describe, expect, it } from 'vitest'

import {
  convertReferencesToCompactMarkdown,
  parseSourceReferences,
} from './source-references'

describe('source references', () => {
  it('parses citations even when the model adds spaces after the colon', () => {
    const references = parseSourceReferences(
      'Date of Birth: 21/06/1992 (source: s5mpvnf8j8ft1dvqt61i) and note: note456',
    )

    expect(references).toEqual([
      expect.objectContaining({ type: 'source', id: 's5mpvnf8j8ft1dvqt61i' }),
      expect.objectContaining({ type: 'note', id: 'note456' }),
    ])
  })

  it('converts spaced citations into compact clickable markdown references', () => {
    const result = convertReferencesToCompactMarkdown(
      'DOB found in source: s5mpvnf8j8ft1dvqt61i and [note: note456].',
      'References',
    )

    expect(result).toContain('[1](#ref-source-s5mpvnf8j8ft1dvqt61i)')
    expect(result).toContain('[2](#ref-note-note456)')
    expect(result).toContain('[source:s5mpvnf8j8ft1dvqt61i](#ref-source-s5mpvnf8j8ft1dvqt61i)')
    expect(result).toContain('[note:note456](#ref-note-note456)')
  })
})
