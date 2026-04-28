import { describe, expect, it } from 'vitest'
import { injectDueChips, restoreDueChipsInBlocks } from './dueChipTransform'

type InlineItem = {
  type: string
  text?: string
  props?: Record<string, string>
  content?: unknown
  styles?: Record<string, unknown>
  [key: string]: unknown
}

type Block = {
  type?: string
  content?: InlineItem[]
  children?: Block[]
  [key: string]: unknown
}

describe('injectDueChips', () => {
  it('returns unchanged blocks when no due: token present', () => {
    const blocks: Block[] = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'hello world', styles: {} }],
        children: [],
      },
    ]
    const result = injectDueChips(blocks) as Block[]
    expect(result[0]?.content).toEqual([{ type: 'text', text: 'hello world', styles: {} }])
  })

  it('injects dueChip at the start of a line', () => {
    const blocks: Block[] = [
      {
        type: 'checkListItem',
        content: [{ type: 'text', text: 'due:2024-12-15 do something', styles: {} }],
        children: [],
      },
    ]
    const result = injectDueChips(blocks) as Block[]
    const content = result[0]?.content ?? []
    const chipItem = content.find((i) => i.type === 'dueChip')
    expect(chipItem).toBeDefined()
    expect(chipItem?.props?.value).toBe('2024-12-15')
  })

  it('injects dueChip in the middle of a line', () => {
    const blocks: Block[] = [
      {
        type: 'checkListItem',
        content: [{ type: 'text', text: 'do something due:2024-12-15 here', styles: {} }],
        children: [],
      },
    ]
    const result = injectDueChips(blocks) as Block[]
    const content = result[0]?.content ?? []
    expect(content.some((i) => i.type === 'dueChip')).toBe(true)
    const textItems = content.filter((i) => i.type === 'text')
    expect(textItems.some((i) => (i.text ?? '').includes('do something'))).toBe(true)
    expect(textItems.some((i) => (i.text ?? '').includes('here'))).toBe(true)
  })

  it('injects dueChip at the end of a line', () => {
    const blocks: Block[] = [
      {
        type: 'checkListItem',
        content: [{ type: 'text', text: 'do something due:2024-12-15', styles: {} }],
        children: [],
      },
    ]
    const result = injectDueChips(blocks) as Block[]
    const content = result[0]?.content ?? []
    const lastItem = content[content.length - 1]
    expect(lastItem?.type).toBe('dueChip')
    expect(lastItem?.props?.value).toBe('2024-12-15')
  })

  it('injects multiple dueChip tokens in one line', () => {
    const blocks: Block[] = [
      {
        type: 'checkListItem',
        content: [{ type: 'text', text: 'due:2024-01-01 and due:2024-12-15', styles: {} }],
        children: [],
      },
    ]
    const result = injectDueChips(blocks) as Block[]
    const content = result[0]?.content ?? []
    const chips = content.filter((i) => i.type === 'dueChip')
    expect(chips.length).toBe(2)
    expect(chips[0]?.props?.value).toBe('2024-01-01')
    expect(chips[1]?.props?.value).toBe('2024-12-15')
  })

  it('injects dueChip for datetime form', () => {
    const blocks: Block[] = [
      {
        type: 'checkListItem',
        content: [{ type: 'text', text: 'task due:2024-12-15T17:00', styles: {} }],
        children: [],
      },
    ]
    const result = injectDueChips(blocks) as Block[]
    const content = result[0]?.content ?? []
    const chip = content.find((i) => i.type === 'dueChip')
    expect(chip?.props?.value).toBe('2024-12-15T17:00')
  })

  it('preserves text styles from original node in split fragments', () => {
    const blocks: Block[] = [
      {
        type: 'checkListItem',
        content: [{ type: 'text', text: 'task due:2024-12-15 end', styles: { bold: true } }],
        children: [],
      },
    ]
    const result = injectDueChips(blocks) as Block[]
    const content = result[0]?.content ?? []
    const textItems = content.filter((i) => i.type === 'text')
    expect(textItems.every((i) => (i.styles as Record<string, unknown>)?.bold === true)).toBe(true)
  })
})

describe('restoreDueChipsInBlocks', () => {
  it('replaces dueChip node with due:<value> text', () => {
    const blocks: Block[] = [
      {
        type: 'checkListItem',
        content: [
          { type: 'text', text: 'task ', styles: {} },
          { type: 'dueChip', props: { value: '2024-12-15' }, content: undefined },
        ],
        children: [],
      },
    ]
    const result = restoreDueChipsInBlocks(blocks) as Block[]
    const content = result[0]?.content ?? []
    expect(content.some((i) => i.type === 'dueChip')).toBe(false)
    expect(content.some((i) => i.type === 'text' && i.text === 'due:2024-12-15')).toBe(true)
  })

  it('restores datetime dueChip to due:YYYY-MM-DDTHH:MM text', () => {
    const blocks: Block[] = [
      {
        type: 'checkListItem',
        content: [
          { type: 'dueChip', props: { value: '2024-12-15T17:00' }, content: undefined },
        ],
        children: [],
      },
    ]
    const result = restoreDueChipsInBlocks(blocks) as Block[]
    const content = result[0]?.content ?? []
    expect(content[0]).toEqual({ type: 'text', text: 'due:2024-12-15T17:00' })
  })

  it('round-trip: inject then restore produces original text', () => {
    const original = 'task due:2024-12-15T09:30'
    const blocks: Block[] = [
      {
        type: 'checkListItem',
        content: [{ type: 'text', text: original, styles: {} }],
        children: [],
      },
    ]

    const injected = injectDueChips(blocks) as Block[]
    const restored = restoreDueChipsInBlocks(injected) as Block[]
    const content = restored[0]?.content ?? []
    const reconstructed = content
      .filter((i) => i.type === 'text')
      .map((i) => i.text ?? '')
      .join('')
    expect(reconstructed).toBe(original)
  })
})
