import { describe, expect, it, vi } from 'vitest'
import { getFormattingToolbarItems } from '@blocknote/react'
import {
  filterTolariaFormattingToolbarItems,
  filterTolariaSlashMenuItems,
  getTolariaBlockTypeSelectItems,
  getTolariaSlashMenuItems,
  dueSlashItem,
  shouldOfferDueSlashItem,
} from './tolariaEditorFormattingConfig'

vi.mock('@blocknote/react', async (importOriginal) => {
  const original = await importOriginal<typeof import('@blocknote/react')>()
  return {
    ...original,
    getDefaultReactSlashMenuItems: vi.fn(() => []),
  }
})

describe('tolariaEditorFormatting', () => {
  it('keeps the markdown-safe toolbar controls and block type select', () => {
    const itemKeys = filterTolariaFormattingToolbarItems(
      getFormattingToolbarItems(getTolariaBlockTypeSelectItems()),
    ).map((item) => String(item.key))

    expect(itemKeys).toContain('blockTypeSelect')
    expect(itemKeys).toContain('boldStyleButton')
    expect(itemKeys).toContain('italicStyleButton')
    expect(itemKeys).toContain('strikeStyleButton')
    expect(itemKeys).toContain('createLinkButton')
    expect(itemKeys).toContain('nestBlockButton')
    expect(itemKeys).toContain('unnestBlockButton')

    expect(itemKeys).not.toContain('underlineStyleButton')
    expect(itemKeys).not.toContain('colorStyleButton')
    expect(itemKeys).not.toContain('textAlignLeftButton')
    expect(itemKeys).not.toContain('textAlignCenterButton')
    expect(itemKeys).not.toContain('textAlignRightButton')
  })

  it('returns the audited markdown-safe block types for the toolbar select', () => {
    expect(getTolariaBlockTypeSelectItems()).toEqual([
      expect.objectContaining({ name: 'Paragraph', type: 'paragraph' }),
      expect.objectContaining({ name: 'Heading 1', type: 'heading', props: { level: 1 } }),
      expect.objectContaining({ name: 'Heading 2', type: 'heading', props: { level: 2 } }),
      expect.objectContaining({ name: 'Heading 3', type: 'heading', props: { level: 3 } }),
      expect.objectContaining({ name: 'Heading 4', type: 'heading', props: { level: 4 } }),
      expect.objectContaining({ name: 'Heading 5', type: 'heading', props: { level: 5 } }),
      expect.objectContaining({ name: 'Heading 6', type: 'heading', props: { level: 6 } }),
      expect.objectContaining({ name: 'Quote', type: 'quote' }),
      expect.objectContaining({ name: 'Bullet List', type: 'bulletListItem' }),
      expect.objectContaining({ name: 'Numbered List', type: 'numberedListItem' }),
      expect.objectContaining({ name: 'Checklist', type: 'checkListItem' }),
      expect.objectContaining({ name: 'Code Block', type: 'codeBlock' }),
    ])
  })

  it('filters unsupported toggle slash-menu variants and annotates supported markdown commands', () => {
    type TolariaSlashMenuTestItem = {
      key: string
      title: string
      onItemClick: () => void
      subtext?: string
    }

    const items = filterTolariaSlashMenuItems([
      { key: 'toggle_heading', title: 'Toggle heading', onItemClick: () => {} },
      { key: 'toggle_list', title: 'Toggle list', onItemClick: () => {} },
      { key: 'heading', title: 'Heading', onItemClick: () => {} },
      { key: 'bullet_list', title: 'Bullet List', onItemClick: () => {} },
      { key: 'code_block', title: 'Code Block', onItemClick: () => {} },
    ] satisfies TolariaSlashMenuTestItem[])

    expect(items.map((item) => item.key)).toEqual([
      'heading',
      'bullet_list',
      'code_block',
    ])
    expect(items.find((item) => item.key === 'heading')?.subtext).toContain(
      'Markdown-safe heading',
    )
    expect(items.find((item) => item.key === 'bullet_list')?.subtext).toContain(
      'Markdown-safe bullet list',
    )
    expect(items.find((item) => item.key === 'code_block')?.subtext).toContain(
      'Markdown-safe fenced code block',
    )
  })

  it('dueSlashItem onItemClick invokes the onTrigger callback', () => {
    const onTrigger = vi.fn()
    const item = dueSlashItem({ onTrigger, locale: 'en' })
    item.onItemClick()
    expect(onTrigger).toHaveBeenCalledOnce()
  })

  it('dueSlashItem has expected title, aliases, and group', () => {
    const item = dueSlashItem({ onTrigger: vi.fn(), locale: 'en' })
    expect(item.title).toBe('Date')
    expect(item.aliases).toEqual(expect.arrayContaining(['due', 'deadline', 'date', 'time']))
    expect(item.group).toBe('Tasks')
  })

  it('dueSlashItem has key "due"', () => {
    const item = dueSlashItem({ onTrigger: vi.fn(), locale: 'en' })
    expect(item.key).toBe('due')
  })

  it('getTolariaSlashMenuItems returns the due item when passed as extra', () => {
    const onTrigger = vi.fn()
    const extra = dueSlashItem({ onTrigger, locale: 'en' })

    // Use a minimal mock editor — getTolariaSlashMenuItems only passes it to BlockNote's
    // getDefaultReactSlashMenuItems which we cannot call without a full BlockNote instance.
    // Instead verify the extra item is included after filterSuggestionItems for query 'due'.
    const items = getTolariaSlashMenuItems(
      null as never,
      'due',
      [extra],
    )

    expect(items.some((item) => item.title === 'Date')).toBe(true)
  })

  describe('shouldOfferDueSlashItem', () => {
    it('returns false for paragraph block type', () => {
      expect(shouldOfferDueSlashItem('paragraph')).toBe(false)
    })

    it('returns true for checkListItem block type', () => {
      expect(shouldOfferDueSlashItem('checkListItem')).toBe(true)
    })

    it('returns false for heading block type', () => {
      expect(shouldOfferDueSlashItem('heading')).toBe(false)
    })

    it('returns false for bulletListItem block type', () => {
      expect(shouldOfferDueSlashItem('bulletListItem')).toBe(false)
    })
  })
})
