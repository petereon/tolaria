import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TasksView } from './TasksView'
import type { CheckboxTask } from '../../types'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const { invoke } = await import('@tauri-apps/api/core')

const baseTask: CheckboxTask = {
  notePath: '/vault/notes/todo.md',
  noteTitle: 'Todo Note',
  text: 'Buy groceries',
  completed: false,
  deadline: null,
  lineNumber: 3,
}

const todayTask: CheckboxTask = {
  notePath: '/vault/notes/today.md',
  noteTitle: 'Today Note',
  text: 'Call dentist',
  completed: false,
  deadline: '2026-04-28',
  lineNumber: 1,
}

const overdueTask: CheckboxTask = {
  notePath: '/vault/notes/overdue.md',
  noteTitle: 'Overdue Note',
  text: 'File taxes',
  completed: false,
  deadline: '2026-04-20',
  lineNumber: 2,
}

const completedTask: CheckboxTask = {
  notePath: '/vault/notes/done.md',
  noteTitle: 'Done Note',
  text: 'Already done',
  completed: true,
  deadline: null,
  lineNumber: 5,
}

describe('TasksView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(invoke).mockResolvedValue([])
  })

  it('shows loading state initially', () => {
    vi.mocked(invoke).mockImplementation(() => new Promise(() => {}))
    render(<TasksView vaultPath="/vault" />)
    expect(screen.getByTestId('tasks-loading')).toBeInTheDocument()
  })

  it('shows empty state when no open tasks', async () => {
    vi.mocked(invoke).mockResolvedValue([completedTask])
    const { findByTestId } = render(<TasksView vaultPath="/vault" />)
    expect(await findByTestId('tasks-empty')).toBeInTheDocument()
  })

  it('renders task items after loading', async () => {
    vi.mocked(invoke).mockResolvedValue([baseTask])
    const { findByText } = render(<TasksView vaultPath="/vault" />)
    expect(await findByText('Buy groceries')).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('network error'))
    const { findByTestId } = render(<TasksView vaultPath="/vault" />)
    expect(await findByTestId('tasks-error')).toBeInTheDocument()
  })

  it('retry button reloads tasks', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('fail'))
    const { findByTestId } = render(<TasksView vaultPath="/vault" />)
    await findByTestId('tasks-error')
    vi.mocked(invoke).mockResolvedValue([baseTask])
    const retryBtn = screen.getByTestId('tasks-retry')
    fireEvent.click(retryBtn)
    expect(await screen.findByText('Buy groceries')).toBeInTheDocument()
  })

  it('groups tasks by due date bucket headers', async () => {
    vi.mocked(invoke).mockResolvedValue([overdueTask, todayTask, baseTask])
    const { findByText } = render(<TasksView vaultPath="/vault" />)
    expect(await findByText('Overdue')).toBeInTheDocument()
    expect(await findByText('Today')).toBeInTheDocument()
    expect(await findByText('No due date')).toBeInTheDocument()
  })

  it('completed tasks are hidden by default', async () => {
    vi.mocked(invoke).mockResolvedValue([baseTask, completedTask])
    const { findByText } = render(<TasksView vaultPath="/vault" />)
    await findByText('Buy groceries')
    expect(screen.queryByText('Already done')).not.toBeInTheDocument()
  })

  it('show completed toggle reveals completed tasks', async () => {
    vi.mocked(invoke).mockResolvedValue([baseTask, completedTask])
    const { findByText } = render(<TasksView vaultPath="/vault" />)
    await findByText('Buy groceries')
    const toggle = screen.getByTestId('tasks-toggle-completed')
    fireEvent.click(toggle)
    expect(await screen.findByText('Already done')).toBeInTheDocument()
  })

  it('clicking checkbox toggles completed state locally', async () => {
    vi.mocked(invoke).mockResolvedValue([baseTask])
    render(<TasksView vaultPath="/vault" />)
    await screen.findByText('Buy groceries')
    // Show completed so the task stays visible after checking
    fireEvent.click(screen.getByTestId('tasks-toggle-completed'))
    const taskId = `${baseTask.notePath}-${baseTask.lineNumber}`
    const checkbox = screen.getByTestId(`task-checkbox-${taskId}`)
    fireEvent.click(checkbox)
    // Re-query to get the updated element reference
    const updatedCheckbox = screen.getByTestId(`task-checkbox-${taskId}`)
    expect(updatedCheckbox).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onOpenNote when source chip is clicked', async () => {
    const onOpenNote = vi.fn()
    vi.mocked(invoke).mockResolvedValue([baseTask])
    const { findByText } = render(<TasksView vaultPath="/vault" onOpenNote={onOpenNote} />)
    await findByText('Buy groceries')
    const chip = screen.getByTestId(`task-note-chip-${baseTask.notePath}-${baseTask.lineNumber}`)
    fireEvent.click(chip)
    expect(onOpenNote).toHaveBeenCalledWith('/vault/notes/todo.md')
  })
})
