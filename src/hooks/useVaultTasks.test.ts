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
})
