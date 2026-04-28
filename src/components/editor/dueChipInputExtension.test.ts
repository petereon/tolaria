import { describe, expect, it, vi } from 'vitest'
import { createDueChipInputExtension } from './dueChipInputExtension'

function createTransaction() {
  const transaction = {
    replaceWith: vi.fn(() => transaction),
    insertText: vi.fn(() => transaction),
    scrollIntoView: vi.fn(() => transaction),
  }
  return transaction
}

function createView(beforeText: string, transaction: ReturnType<typeof createTransaction>) {
  const dueChipNode = { nodeSize: 1 }
  const selection = {
    from: beforeText.length,
    to: beforeText.length,
    $from: {
      parent: {
        isTextblock: true,
        textBetween: vi.fn(() => beforeText),
      },
      parentOffset: beforeText.length,
    },
  }
  const dueChipNodeType = { createChecked: vi.fn(() => dueChipNode) }
  const view = {
    composing: false,
    dispatch: vi.fn(),
    state: {
      schema: { nodes: { dueChip: dueChipNodeType } },
      selection,
      tr: transaction,
    },
  }

  return { dueChipNode, dueChipNodeType, view }
}

function createDom(registerBeforeInput: (listener: (event: InputEvent) => void) => void) {
  return {
    addEventListener: vi.fn((type: string, listener: (event: InputEvent) => void) => {
      if (type === 'beforeinput') registerBeforeInput(listener)
    }),
  }
}

function createFixture(beforeText = 'call dentist due:2025-01-15') {
  let beforeInputListener: ((event: InputEvent) => void) | null = null
  const transaction = createTransaction()
  const { dueChipNode, dueChipNodeType, view } = createView(beforeText, transaction)
  const dom = createDom((listener) => { beforeInputListener = listener })
  const editor = {
    _tiptapEditor: { view },
    prosemirrorView: view,
  }
  const extension = createDueChipInputExtension()({ editor: editor as never })

  return {
    dom,
    extension,
    fireInput(event: Partial<InputEvent> = {}) {
      if (!beforeInputListener) throw new Error('no beforeinput listener registered')
      const inputEvent = {
        data: ' ',
        inputType: 'insertText',
        isComposing: false,
        preventDefault: vi.fn(),
        ...event,
      }
      beforeInputListener(inputEvent as InputEvent)
      return inputEvent
    },
    dueChipNode,
    dueChipNodeType,
    mount() {
      const controller = new AbortController()
      extension.mount?.({
        dom: dom as never,
        root: document,
        signal: controller.signal,
      })
      return controller
    },
    transaction,
    view,
  }
}

describe('createDueChipInputExtension', () => {
  it('registers a beforeinput listener on mount', () => {
    const fixture = createFixture()
    fixture.mount()

    expect(fixture.dom.addEventListener).toHaveBeenCalledWith(
      'beforeinput',
      expect.any(Function),
      expect.objectContaining({ capture: true, signal: expect.any(AbortSignal) }),
    )
  })

  it('replaces a due: token with a chip before inserting whitespace', () => {
    const fixture = createFixture()
    fixture.mount()

    const event = fixture.fireInput()

    expect(fixture.dueChipNodeType.createChecked).toHaveBeenCalledWith({ value: '2025-01-15' })
    expect(fixture.transaction.replaceWith).toHaveBeenCalledWith(
      'call dentist '.length,
      'call dentist due:2025-01-15'.length,
      fixture.dueChipNode,
    )
    expect(fixture.transaction.insertText).toHaveBeenCalledWith(' ', 'call dentist '.length + 1)
    expect(fixture.transaction.scrollIntoView).toHaveBeenCalled()
    expect(fixture.view.dispatch).toHaveBeenCalledWith(fixture.transaction)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('replaces a due: token with datetime before inserting whitespace', () => {
    const fixture = createFixture('meeting due:2025-01-15T14:30')
    fixture.mount()

    const event = fixture.fireInput()

    expect(fixture.dueChipNodeType.createChecked).toHaveBeenCalledWith({ value: '2025-01-15T14:30' })
    expect(fixture.transaction.replaceWith).toHaveBeenCalledWith(
      'meeting '.length,
      'meeting due:2025-01-15T14:30'.length,
      fixture.dueChipNode,
    )
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('replaces a due: token before a new paragraph without swallowing the newline', () => {
    const fixture = createFixture()
    fixture.mount()

    const event = fixture.fireInput({ data: null, inputType: 'insertParagraph' })

    expect(fixture.transaction.replaceWith).toHaveBeenCalled()
    expect(fixture.transaction.insertText).not.toHaveBeenCalled()
    expect(fixture.view.dispatch).toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('does nothing when cursor text has no due: token', () => {
    const fixture = createFixture('buy groceries')
    fixture.mount()

    const event = fixture.fireInput()

    expect(fixture.transaction.replaceWith).not.toHaveBeenCalled()
    expect(fixture.view.dispatch).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('does nothing for non-whitespace text input', () => {
    const fixture = createFixture()
    fixture.mount()

    const event = fixture.fireInput({ data: '.', inputType: 'insertText' })

    expect(fixture.transaction.replaceWith).not.toHaveBeenCalled()
    expect(fixture.view.dispatch).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('does nothing when composing', () => {
    const fixture = createFixture()
    fixture.view.composing = true
    fixture.mount()

    const event = fixture.fireInput()

    expect(fixture.transaction.replaceWith).not.toHaveBeenCalled()
    expect(fixture.view.dispatch).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('does nothing when dueChip node type is missing from schema', () => {
    const fixture = createFixture()
    // @ts-expect-error intentional schema corruption for test
    fixture.view.state.schema.nodes.dueChip = undefined
    fixture.mount()

    const event = fixture.fireInput()

    expect(fixture.transaction.replaceWith).not.toHaveBeenCalled()
    expect(fixture.view.dispatch).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('ignores a partial due: token that is not at end of text', () => {
    const fixture = createFixture('due:2025-01-15 buy groceries')
    fixture.mount()

    const event = fixture.fireInput()

    expect(fixture.transaction.replaceWith).not.toHaveBeenCalled()
    expect(fixture.view.dispatch).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
