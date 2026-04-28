import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVaultTasks } from './useVaultTasks'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const { invoke } = await import('@tauri-apps/api/core')

describe('useVaultTasks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches tasks on mount', async () => {
    const mockTasks = [
      { notePath: '/v/note.md', noteTitle: 'Note', text: 'Do thing',
        completed: false, deadline: '2025-06-01', lineNumber: 3 },
    ]
    vi.mocked(invoke).mockResolvedValue(mockTasks)

    const { result } = renderHook(() => useVaultTasks('/vault'))
    expect(result.current.loading).toBe(true)

    await act(async () => {})
    expect(result.current.tasks).toEqual(mockTasks)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(invoke).toHaveBeenCalledWith('get_vault_tasks', { vaultPath: '/vault' })
  })

  it('sets error on fetch failure', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('scan failed'))
    const { result } = renderHook(() => useVaultTasks('/vault'))
    await act(async () => {})
    expect(result.current.error).toBe('Error: scan failed')
    expect(result.current.tasks).toEqual([])
  })

  it('does not fetch when vaultPath is null', () => {
    renderHook(() => useVaultTasks(null))
    expect(invoke).not.toHaveBeenCalled()
  })

  it('toggleTask invokes backend and flips completed locally (optimistic)', async () => {
    const mockTasks = [
      { notePath: '/v/note.md', noteTitle: 'Note', text: 'A',
        completed: false, deadline: null, lineNumber: 3 },
      { notePath: '/v/note.md', noteTitle: 'Note', text: 'B',
        completed: false, deadline: null, lineNumber: 4 },
    ]
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_vault_tasks') return mockTasks
      if (cmd === 'toggle_task_completion') return true
      return undefined
    })

    const { result } = renderHook(() => useVaultTasks('/vault'))
    await act(async () => {})

    await act(async () => {
      await result.current.toggleTask('/v/note.md', 3)
    })

    expect(invoke).toHaveBeenCalledWith('toggle_task_completion', {
      notePath: '/v/note.md', lineNumber: 3,
    })
    expect(result.current.tasks[0].completed).toBe(true)
    expect(result.current.tasks[1].completed).toBe(false)
  })

  it('toggleTask reverts local flip when backend fails', async () => {
    const mockTasks = [
      { notePath: '/v/note.md', noteTitle: 'Note', text: 'A',
        completed: false, deadline: null, lineNumber: 3 },
    ]
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_vault_tasks') return mockTasks
      if (cmd === 'toggle_task_completion') throw new Error('write failed')
      return undefined
    })

    const { result } = renderHook(() => useVaultTasks('/vault'))
    await act(async () => {})

    await act(async () => {
      await expect(result.current.toggleTask('/v/note.md', 3)).rejects.toThrow('write failed')
    })

    expect(result.current.tasks[0].completed).toBe(false)
  })

  it('refetches when externalRevision changes', async () => {
    vi.mocked(invoke).mockResolvedValue([])
    const { rerender } = renderHook(
      ({ rev }: { rev: number }) => useVaultTasks('/vault', rev),
      { initialProps: { rev: 0 } },
    )
    await act(async () => {})
    expect(invoke).toHaveBeenCalledTimes(1)

    rerender({ rev: 1 })
    await act(async () => {})
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('does not flag loading on refetch after initial load', async () => {
    const initial = [
      { notePath: '/v/a.md', noteTitle: 'A', text: 'A', completed: false, deadline: null, lineNumber: 1 },
    ]
    vi.mocked(invoke).mockResolvedValue(initial)
    const { result, rerender } = renderHook(
      ({ rev }: { rev: number }) => useVaultTasks('/vault', rev),
      { initialProps: { rev: 0 } },
    )
    expect(result.current.loading).toBe(true)
    await act(async () => {})
    expect(result.current.loading).toBe(false)

    rerender({ rev: 1 })
    // Refetch in flight: existing tasks remain visible, loading stays false.
    expect(result.current.loading).toBe(false)
    expect(result.current.tasks).toEqual(initial)
    await act(async () => {})
    expect(result.current.loading).toBe(false)
  })

  it('preserves optimistic flip when refetch resolves before backend write', async () => {
    const stale = [
      { notePath: '/v/a.md', noteTitle: 'A', text: 'A', completed: false, deadline: null, lineNumber: 1 },
    ]
    let resolveToggle: ((value: boolean) => void) | null = null

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_vault_tasks') return stale
      if (cmd === 'toggle_task_completion') {
        return new Promise<boolean>((res) => { resolveToggle = res })
      }
      return undefined
    })

    const { result } = renderHook(() => useVaultTasks('/vault'))
    await act(async () => {})
    expect(result.current.tasks[0].completed).toBe(false)

    // Start a toggle but DON'T let the backend resolve yet.
    let togglePromise: Promise<void> = Promise.resolve()
    act(() => {
      togglePromise = result.current.toggleTask('/v/a.md', 1)
    })
    expect(result.current.tasks[0].completed).toBe(true)

    // Trigger a refetch while toggle still pending — backend file still
    // shows completed=false, but pending-toggle protection keeps the flip.
    act(() => { result.current.reload() })
    await act(async () => {})
    expect(result.current.tasks[0].completed).toBe(true)

    // Backend completes; pending tracker clears; future refetches sync to disk.
    await act(async () => {
      resolveToggle!(true)
      await togglePromise
    })
  })
})
