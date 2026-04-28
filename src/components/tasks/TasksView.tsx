import { useState, useCallback, memo } from 'react'
import { CheckSquare, CaretDown, CaretRight, FileText } from '@phosphor-icons/react'
import { useVaultTasks } from '../../hooks/useVaultTasks'
import { useDragRegion } from '../../hooks/useDragRegion'
import { translate, type AppLocale } from '../../lib/i18n'
import { dueBucket, type DueBucket } from './dueBucket'
import { formatDeadline } from './formatDeadline'
import type { CheckboxTask } from '../../types'
import './TasksView.css'

interface TasksViewProps {
  vaultPath: string
  locale?: AppLocale
  onOpenNote?: (notePath: string) => void
  sidebarCollapsed?: boolean
  onExpandSidebar?: () => void
  /** Bump from the parent (e.g. on vault save) to force a task refetch. */
  revisionKey?: number
  /** Called after a successful task toggle so the parent can refresh
   *  derived state (open editor tabs, vault entry taskCount, etc). */
  onTaskWritten?: (notePath: string) => void
}

const BUCKET_ORDER: DueBucket[] = ['overdue', 'today', 'tomorrow', 'thisweek', 'later', 'none']

const BUCKET_LABEL_KEY: Record<DueBucket, Parameters<typeof translate>[1]> = {
  overdue: 'tasks.groupOverdue',
  today: 'tasks.groupToday',
  tomorrow: 'tasks.groupTomorrow',
  thisweek: 'tasks.groupThisWeek',
  later: 'tasks.groupLater',
  none: 'tasks.groupNoDue',
}

const BUCKET_ACCENT_COLOR: Record<DueBucket, string> = {
  overdue: 'var(--accent-red, #ef4444)',
  today: 'var(--accent-blue, #3b82f6)',
  tomorrow: 'var(--accent-orange, #f97316)',
  thisweek: 'var(--muted-foreground)',
  later: 'var(--muted-foreground)',
  none: 'var(--muted-foreground)',
}

function getTodayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface TaskRowProps {
  task: CheckboxTask
  checked: boolean
  justChecked: boolean
  locale: AppLocale
  onToggle: () => void
  onOpenNote?: (notePath: string) => void
  bucket: DueBucket
}

function DueChip({ bucket, deadline, locale }: { bucket: DueBucket; deadline: string | null; locale: AppLocale }) {
  if (!deadline || bucket === 'none') return null
  const chipClass = `task-due-chip task-due-chip--${bucket}`
  return <span className={chipClass}>{formatDeadline(deadline, locale)}</span>
}

function TaskRow({ task, checked, justChecked, locale, onToggle, onOpenNote, bucket }: TaskRowProps) {
  const rowClass = [
    'task-row',
    checked ? 'task-row--done' : '',
    justChecked ? 'task-row--just-checked' : '',
  ].filter(Boolean).join(' ')

  const taskId = `${task.notePath}-${task.lineNumber}`

  const handleOpenNote = useCallback(() => {
    onOpenNote?.(task.notePath)
  }, [onOpenNote, task.notePath])

  return (
    <div className={rowClass} data-testid={`task-row-${taskId}`}>
      <button
        type="button"
        className={`tk-check ${checked ? 'tk-check--checked' : ''}`}
        onClick={onToggle}
        aria-checked={checked}
        role="checkbox"
        aria-label={task.text}
        data-testid={`task-checkbox-${taskId}`}
      >
        <svg className="tk-check__mark" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <polyline points="1.5,5 4,7.5 8.5,2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="task-row__body">
        <p className={`task-row__text ${checked ? 'task-row__text--done' : ''}`}>
          {task.text}
        </p>
        <div className="task-row__chips">
          <button
            type="button"
            className="task-chip"
            onClick={handleOpenNote}
            title={translate(locale, 'tasks.openNote')}
            disabled={!onOpenNote}
            data-testid={`task-note-chip-${taskId}`}
          >
            <FileText size={10} aria-hidden="true" />
            <span className="truncate">{task.noteTitle}</span>
          </button>
          <DueChip bucket={bucket} deadline={task.deadline} locale={locale} />
        </div>
      </div>
    </div>
  )
}

interface TaskGroupProps {
  bucket: DueBucket
  tasks: CheckboxTask[]
  justCheckedPaths: Set<string>
  locale: AppLocale
  onToggle: (notePath: string, lineNumber: number) => void
  onOpenNote?: (notePath: string) => void
}

function TaskGroup({ bucket, tasks, justCheckedPaths, locale, onToggle, onOpenNote }: TaskGroupProps) {
  const [collapsed, setCollapsed] = useState(false)
  const Chevron = collapsed ? CaretRight : CaretDown
  const label = translate(locale, BUCKET_LABEL_KEY[bucket])
  const accentColor = BUCKET_ACCENT_COLOR[bucket]

  return (
    <div>
      <div
        className="tasks-group-header"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed((v) => !v) } }}
      >
        <div className="tasks-group-header__accent" style={{ background: accentColor }} />
        <Chevron size={12} aria-hidden="true" style={{ color: 'var(--muted-foreground)' }} />
        <span className="tasks-group-header__label" style={{ color: accentColor }}>{label}</span>
        <span className="tasks-group-header__count">({tasks.length})</span>
      </div>
      {!collapsed && tasks.map((task) => {
        const key = `${task.notePath}-${task.lineNumber}`
        return (
          <TaskRow
            key={key}
            task={task}
            checked={task.completed}
            justChecked={justCheckedPaths.has(key)}
            locale={locale}
            onToggle={() => onToggle(task.notePath, task.lineNumber)}
            onOpenNote={onOpenNote}
            bucket={bucket}
          />
        )
      })}
    </div>
  )
}

function TasksHeader({
  openCount,
  showCompleted,
  onToggleCompleted,
  sidebarCollapsed,
  onExpandSidebar,
  locale,
}: {
  openCount: number
  showCompleted: boolean
  onToggleCompleted: () => void
  sidebarCollapsed?: boolean
  onExpandSidebar?: () => void
  locale: AppLocale
}) {
  const { onMouseDown } = useDragRegion()

  return (
    <div className="tasks-header" onMouseDown={onMouseDown} data-testid="tasks-header">
      <div className="tasks-header__left">
        {sidebarCollapsed && onExpandSidebar && (
          <button
            type="button"
            className="flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            style={{ width: 24, height: 24 }}
            onClick={onExpandSidebar}
            aria-label={translate(locale, 'sidebar.action.expand')}
          >
            <CaretRight size={14} weight="bold" />
          </button>
        )}
        <CheckSquare size={16} style={{ color: 'var(--accent-blue, #3b82f6)' }} aria-hidden="true" />
        <span className="tasks-header__title">{translate(locale, 'tasks.title')}</span>
        {openCount > 0 && (
          <span className="tasks-header__count">{openCount}</span>
        )}
      </div>
      <div className="tasks-header__right">
        <button
          type="button"
          className={`tasks-toggle-btn ${showCompleted ? 'tasks-toggle-btn--active' : ''}`}
          onClick={onToggleCompleted}
          aria-pressed={showCompleted}
          data-testid="tasks-toggle-completed"
        >
          {translate(locale, 'tasks.showCompleted')}
        </button>
      </div>
    </div>
  )
}

function EmptyState({ locale }: { locale: AppLocale }) {
  return (
    <div className="tasks-state" data-testid="tasks-empty">
      <CheckSquare size={32} className="tasks-state__icon" aria-hidden="true" />
      <p className="tasks-state__title">{translate(locale, 'tasks.empty')}</p>
      <p className="tasks-state__description">{translate(locale, 'tasks.emptyDescription')}</p>
    </div>
  )
}

function ErrorState({ locale, onRetry }: { locale: AppLocale; onRetry: () => void }) {
  return (
    <div className="tasks-state" data-testid="tasks-error">
      <p className="tasks-state__title">{translate(locale, 'tasks.loadError')}</p>
      <button
        type="button"
        className="tasks-retry-btn"
        onClick={onRetry}
        data-testid="tasks-retry"
      >
        {translate(locale, 'tasks.retry')}
      </button>
    </div>
  )
}

export const TasksView = memo(function TasksView({
  vaultPath,
  locale = 'en',
  onOpenNote,
  sidebarCollapsed,
  onExpandSidebar,
  revisionKey = 0,
  onTaskWritten,
}: TasksViewProps) {
  const { tasks, loading, error, reload, toggleTask } = useVaultTasks(vaultPath, revisionKey)
  const [showCompleted, setShowCompleted] = useState(false)
  const [justCheckedPaths, setJustCheckedPaths] = useState<Set<string>>(new Set())

  const today = getTodayString()

  const handleToggle = useCallback((notePath: string, lineNumber: number) => {
    const key = `${notePath}-${lineNumber}`
    setJustCheckedPaths((jp) => {
      const nextJp = new Set(jp)
      nextJp.add(key)
      return nextJp
    })
    setTimeout(() => {
      setJustCheckedPaths((jp) => {
        const nextJp = new Set(jp)
        nextJp.delete(key)
        return nextJp
      })
    }, 700)
    toggleTask(notePath, lineNumber)
      .then(() => onTaskWritten?.(notePath))
      .catch(() => {
        setJustCheckedPaths((jp) => {
          const nextJp = new Set(jp)
          nextJp.delete(key)
          return nextJp
        })
      })
  }, [toggleTask, onTaskWritten])

  const handleToggleCompleted = useCallback(() => setShowCompleted((v) => !v), [])

  const openTasks = tasks.filter((t) => !t.completed)
  const openCount = openTasks.length

  const displayedTasks = showCompleted ? tasks : openTasks

  // Group by bucket
  const bucketMap = new Map<DueBucket, CheckboxTask[]>()
  for (const task of displayedTasks) {
    const bucket = dueBucket(task.deadline, today)
    const existing = bucketMap.get(bucket)
    if (existing) {
      existing.push(task)
    } else {
      bucketMap.set(bucket, [task])
    }
  }

  // Show empty state when there are no open tasks and we're not showing completed ones
  const showEmptyState = openCount === 0 && (!showCompleted || tasks.length === 0)

  return (
    <div className="tasks-view">
      <TasksHeader
        openCount={openCount}
        showCompleted={showCompleted}
        onToggleCompleted={handleToggleCompleted}
        sidebarCollapsed={sidebarCollapsed}
        onExpandSidebar={onExpandSidebar}
        locale={locale}
      />
      <div className="tasks-feed">
        {loading && (
          <div className="tasks-state" data-testid="tasks-loading">
            <span className="tasks-state__title">{translate(locale, 'tasks.loading')}</span>
          </div>
        )}
        {!loading && error && (
          <ErrorState locale={locale} onRetry={reload} />
        )}
        {!loading && !error && showEmptyState && (
          <EmptyState locale={locale} />
        )}
        {!loading && !error && !showEmptyState && (
          <>
            {BUCKET_ORDER.map((bucket) => {
              const bucketTasks = bucketMap.get(bucket)
              if (!bucketTasks || bucketTasks.length === 0) return null
              return (
                <TaskGroup
                  key={bucket}
                  bucket={bucket}
                  tasks={bucketTasks}
                  justCheckedPaths={justCheckedPaths}
                  locale={locale}
                  onToggle={handleToggle}
                  onOpenNote={onOpenNote}
                />
              )
            })}
          </>
        )}
      </div>
    </div>
  )
})
