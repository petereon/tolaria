import { createExtension } from '@blocknote/core'
import type { useCreateBlockNote } from '@blocknote/react'

// Matches a complete due: token at the very end of the cursor text.
// Captures the ISO value (date or datetime).
const DUE_TOKEN_AT_END_RE = /due:(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?)$/
const INLINE_WHITESPACE_RE = /^[^\S\r\n]$/
const NEWLINE_INPUT_TYPES = new Set(['insertParagraph', 'insertLineBreak'])

type EditorViewLike = NonNullable<ReturnType<typeof useCreateBlockNote>['prosemirrorView']>

interface DueChipReplacement {
  from: number
  to: number
  isoValue: string
}

function isInsertedInlineWhitespace(event: InputEvent): event is InputEvent & { data: string } {
  return (
    event.inputType === 'insertText' &&
    typeof event.data === 'string' &&
    INLINE_WHITESPACE_RE.test(event.data)
  )
}

function shouldHandleInput(event: InputEvent): boolean {
  return isInsertedInlineWhitespace(event) || NEWLINE_INPUT_TYPES.has(event.inputType)
}

function shouldSkipInput(event: InputEvent, view: EditorViewLike): boolean {
  if (event.isComposing) return true
  if (view.composing) return true
  return !shouldHandleInput(event)
}

function readDueTokenAtEnd(view: EditorViewLike): DueChipReplacement | null {
  const { from, to, $from } = view.state.selection
  if (from !== to) return null
  if (!$from.parent.isTextblock) return null

  const beforeText = $from.parent.textBetween(0, $from.parentOffset, '', '')
  const parentStart = from - $from.parentOffset

  const match = DUE_TOKEN_AT_END_RE.exec(beforeText)
  if (!match) return null

  return {
    from: parentStart + match.index,
    to: parentStart + beforeText.length,
    isoValue: match[1],
  }
}

function replaceCompletedDueToken(
  view: EditorViewLike,
  trailingText?: string,
): EditorViewLike['state']['tr'] | null {
  const replacement = readDueTokenAtEnd(view)
  const dueChipNodeType = view.state.schema.nodes['dueChip']
  if (!replacement || !dueChipNodeType) return null

  const dueChipNode = dueChipNodeType.createChecked({ value: replacement.isoValue })
  const transaction = view.state.tr.replaceWith(replacement.from, replacement.to, dueChipNode)

  if (trailingText !== undefined) {
    transaction.insertText(trailingText, replacement.from + dueChipNode.nodeSize)
  }

  return transaction.scrollIntoView()
}

export const createDueChipInputExtension = createExtension(({ editor }) => {
  const readView = () => editor._tiptapEditor?.view ?? editor.prosemirrorView

  return {
    key: 'dueChipInput',
    mount: ({ dom, signal }) => {
      const handleBeforeInput = (event: InputEvent) => {
        const view = readView()
        if (!view || shouldSkipInput(event, view)) return

        const trailingText = isInsertedInlineWhitespace(event) ? event.data : undefined
        const transaction = replaceCompletedDueToken(view, trailingText)
        if (!transaction) return

        view.dispatch(transaction)
        if (trailingText !== undefined) {
          event.preventDefault()
        }
      }

      dom.addEventListener('beforeinput', handleBeforeInput as EventListener, {
        capture: true,
        signal,
      })
    },
  } as const
})
