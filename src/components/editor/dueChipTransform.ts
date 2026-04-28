// Due-chip placeholder transforms for markdown round-trip
// Pattern: due:YYYY-MM-DD or due:YYYY-MM-DDTHH:MM
const DUE_CHIP_RE = /due:(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?)\b/g

// Minimal shape of a BlockNote block for due-chip processing
interface BlockLike {
  content?: InlineItem[]
  children?: BlockLike[]
  [key: string]: unknown
}

interface InlineItem {
  type: string
  text?: string
  props?: Record<string, string>
  content?: unknown
  [key: string]: unknown
}

type ContentTransform = (content: InlineItem[]) => InlineItem[]

function walkBlocks(blocks: unknown[], transform: ContentTransform, clone = false): unknown[] {
  return (blocks as BlockLike[]).map(block => {
    const b = clone ? { ...block } : block
    if (b.content && Array.isArray(b.content)) {
      b.content = transform(b.content)
    }
    if (b.children && Array.isArray(b.children)) {
      b.children = walkBlocks(b.children, transform, clone) as BlockLike[]
    }
    return b
  })
}

function expandDueChipsInContent(content: InlineItem[]): InlineItem[] {
  const result: InlineItem[] = []
  for (const item of content) {
    if (item.type !== 'text' || typeof item.text !== 'string' || !item.text.includes('due:')) {
      result.push(item)
      continue
    }
    const text = item.text
    let lastIndex = 0
    DUE_CHIP_RE.lastIndex = 0
    let match
    while ((match = DUE_CHIP_RE.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ ...item, text: text.slice(lastIndex, match.index) })
      }
      result.push({
        type: 'dueChip',
        props: { value: match[1] },
        content: undefined,
      })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) {
      result.push({ ...item, text: text.slice(lastIndex) })
    }
  }
  return result
}

function collapseDueChipsInContent(content: InlineItem[]): InlineItem[] {
  const result: InlineItem[] = []
  for (const item of content) {
    if (item.type === 'dueChip' && item.props?.value) {
      result.push({ type: 'text', text: `due:${item.props.value}` })
    } else {
      result.push(item)
    }
  }
  return result
}

/** Walk blocks and replace due: text tokens with dueChip inline content */
export function injectDueChips(blocks: unknown[]): unknown[] {
  return walkBlocks(blocks, expandDueChipsInContent)
}

/**
 * Deep-clone blocks and convert dueChip inline content back to due:<value> text.
 * This is the reverse of injectDueChips — used before blocksToMarkdownLossy
 * so that due: tokens survive the markdown round-trip.
 */
export function restoreDueChipsInBlocks(blocks: unknown[]): unknown[] {
  return walkBlocks(blocks, collapseDueChipsInContent, true)
}
