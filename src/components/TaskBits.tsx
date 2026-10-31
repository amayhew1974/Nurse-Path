import { useState } from 'react';
import type { Task, Course, Workspace } from '../lib/types';
import { TASK_TYPE_LABELS } from '../lib/types';
import { formatDate, formatDuration, formatTime, relativeDay, todayISO } from '../lib/dates';
import { useStore } from '../lib/store';
import { setTaskDone, deleteTask, updateTask, uid } from '../lib/workspace';
import { Modal, ConfirmButton, useToast } from './ui';
import { TaskForm } from './forms';
import type { TaskDraft } from './forms';
import { Icon } from './Icon';

export function courseOf(ws: Workspace, id: string | null): Course | undefined {
  return ws.courses.find((c) => c.id === id);
}

export function dueTone(t: Task, today: string): 'overdue' | 'today' | 'soon' | '' {
  if (t.status === 'done') return '';
  if (t.dueDate < today) return 'overdue';
  if (t.dueDate === today) return 'today';
  if (t.dueDate <= addDaysLocal(today, 3)) return 'soon';
  return '';
}
function addDaysLocal(d: string, n: number) {
  const x = new Date(d + 'T00:00:00');
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function useTaskActions() {
  const { ws, update } = useStore();
  const toast = useToast();
  return {
    toggle(t: Task) {
      const removed = t.status !== 'done' ? ws.sessions.filter((s) => s.taskId === t.id && s.status === 'planned' && !s.pinned).length : 0;
      update((w) => setTaskDone(w, t.id, t.status !== 'done'));
      toast(t.status === 'done' ? `“${t.title}” marked not done.` : `Completed “${t.title}”.${removed ? ` Removed ${removed} planned study session${removed === 1 ? '' : 's'} you no longer need.` : ''}`);
    },
  };
}

export function TaskRow({ task, onEdit, showCourse = true }: { task: Task; onEdit?: (t: Task) => void; showCourse?: boolean }) {
  const { ws } = useStore();
  const { toggle } = useTaskActions();
  const today = todayISO();
  const c = courseOf(ws, task.courseId);
  const tone = dueTone(task, today);
  const done = task.status === 'done';
  return (
    <div className={`item${done ? ' done' : ''}`}>
      <input type="checkbox" className="check" checked={done} onChange={() => toggle(task)} aria-label={`${done ? 'Mark not done' : 'Mark complete'}: ${task.title}`} />
      <div className="item-body">
        <span className="item-title">{task.title}</span>
        <span className="item-meta">
          {showCourse && c && <span className={`row c-${c.color}`} style={{ gap: 6 }}><span className="dot" />{c.code || c.name}</span>}
          <span>{TASK_TYPE_LABELS[task.type]}</span>
          <span>Due {formatDate(task.dueDate)}{task.dueTime ? `, ${formatTime(task.dueTime)}` : ''}</span>
          <span>{formatDuration(task.estimatedMinutes)}</span>
          {task.source === 'import' && <span className="pill">Imported · confirmed by you</span>}
        </span>
      </div>
      {tone && <span className={`pill ${tone}`}>{tone === 'overdue' ? 'Overdue' : relativeDay(task.dueDate, today).replace(/^in /, 'In ')}</span>}
      {done && task.completedAt && <span className="pill ok">Done</span>}
      {onEdit && <button type="button" className="icon-btn" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`}><Icon name="edit" /></button>}
    </div>
  );
}

/** Add/edit/delete dialog for tasks. Returns [openFn, dialogElement]. */
export function useTaskEditor(): [(t?: Partial<Task>) => void, JSX.Element] {
  const { ws, update } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const isNew = !editing?.id;
  const topicSuggestions = [...new Set([...ws.profile.challengingTopics, ...ws.reflections.map((r) => r.topic)])];

  const save = (d: TaskDraft) => {
    if (isNew) {
      const t: Task = { ...d, id: uid('tsk'), status: 'todo', completedAt: null, source: 'manual', createdAt: new Date().toISOString() };
      update((w) => ({ ...w, tasks: [...w.tasks, t] }));
      toast(`Added “${t.title}”.`);
    } else {
      const old = ws.tasks.find((t) => t.id === editing!.id)!;
      update((w) => updateTask(w, { ...old, ...d }));
      toast(old.dueDate !== d.dueDate ? `Saved. Due date changed to ${formatDate(d.dueDate)}.` : 'Saved.');
    }
    setEditing(null);
  };
  const remove = () => {
    const id = editing!.id!;
    update((w) => deleteTask(w, id));
    toast('Deleted.');
    setEditing(null);
  };

  const el = (
    <Modal
      open={!!editing}
      title={isNew ? 'Add an assignment, exam, or task' : 'Edit item'}
      onClose={() => setEditing(null)}
      footer={
        <>
          {!isNew && <span className="left"><ConfirmButton label="Delete" icon="trash" confirmLabel="Delete" onConfirm={remove} /></span>}
          <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
          <button type="submit" form="task-form" className="btn primary">{isNew ? 'Add' : 'Save changes'}</button>
        </>
      }
    >
      {editing && <TaskForm key={editing.id ?? 'new'} formId="task-form" initial={editing} courses={ws.courses} onSubmit={save} topicSuggestions={topicSuggestions} />}
    </Modal>
  );
  return [(t) => setEditing(t ?? {}), el];
}
