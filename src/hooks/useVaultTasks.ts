import { useReducer, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CheckboxTask } from '../types'

export interface UseVaultTasksResult {
  tasks: CheckboxTask[]
  loading: boolean
  error: string | null
  reload: () => void
}

type State = {
  tasks: CheckboxTask[]
  loading: boolean
  error: string | null
  rev: number
}

type Action =
  | { type: 'fetch_start' }
  | { type: 'fetch_success'; tasks: CheckboxTask[] }
  | { type: 'fetch_error'; error: string }
  | { type: 'reload' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'fetch_start':
      return { ...state, loading: true, error: null }
    case 'fetch_success':
      return { ...state, loading: false, tasks: action.tasks }
    case 'fetch_error':
      return { ...state, loading: false, tasks: [], error: action.error }
    case 'reload':
      return { ...state, rev: state.rev + 1 }
  }
}

const INITIAL_STATE: State = { tasks: [], loading: false, error: null, rev: 0 }

export function useVaultTasks(vaultPath: string | null): UseVaultTasksResult {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const reload = useCallback(() => dispatch({ type: 'reload' }), [])

  useEffect(() => {
    if (!vaultPath) return
    let cancelled = false

    dispatch({ type: 'fetch_start' })
    invoke<CheckboxTask[]>('get_vault_tasks', { vaultPath })
      .then(data => {
        if (!cancelled) dispatch({ type: 'fetch_success', tasks: data })
      })
      .catch(err => {
        if (!cancelled) dispatch({ type: 'fetch_error', error: String(err) })
      })

    return () => { cancelled = true }
  }, [vaultPath, state.rev])

  return { tasks: state.tasks, loading: state.loading, error: state.error, reload }
}
