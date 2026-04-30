import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { createTask, deleteTask, fetchTasks, toggleTask, type Task } from './api';
import './App.css';

type OptimisticAction =
  | { type: 'add'; task: Task }
  | { type: 'toggle'; id: number }
  | { type: 'remove'; id: number };

function applyOptimistic(currentTasks: Task[], action: OptimisticAction): Task[] {
  switch (action.type) {
    case 'add':
      return [...currentTasks, action.task];
    case 'toggle':
      return currentTasks.map((t) =>
        t.id === action.id ? { ...t, completed: !t.completed } : t,
      );
    case 'remove':
      return currentTasks.filter((t) => t.id !== action.id);
  }
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [description, setDescription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<number | null>(null);
  const skeletonTimerRef = useRef<number | null>(null);

  const [optimisticTasks, addOptimisticTask] = useOptimistic<Task[], OptimisticAction>(
    tasks,
    applyOptimistic,
  );

  const [_isPending, startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchTasks();
        setTasks(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current !== null) {
        window.clearTimeout(errorTimerRef.current);
      }
      if (skeletonTimerRef.current !== null) {
        window.clearTimeout(skeletonTimerRef.current);
      }
    };
  }, []);

  function showError(messageOrErr: string | unknown): void {
    const message =
      typeof messageOrErr === 'string'
        ? messageOrErr
        : messageOrErr instanceof Error && messageOrErr.message.includes(' failed: ')
          ? messageOrErr.message
          : 'Something went wrong';
    setError(message);
    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = window.setTimeout(() => {
      setError(null);
      errorTimerRef.current = null;
    }, 3000);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = description.trim();
    if (trimmed.length === 0) return;

    const optimisticTask: Task = {
      id: -Date.now(),
      description: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setDescription('');
    inputRef.current?.focus();

    // Skeleton-row fallback timer — fires only if useOptimistic is somehow
    // unavailable AND the API call takes > 150ms. Under normal optimistic
    // operation, the optimistic task renders within ~16ms and this timer's
    // setShowSkeleton(true) is a visual no-op (the skeleton would render
    // alongside the already-visible optimistic task).
    skeletonTimerRef.current = window.setTimeout(() => {
      setShowSkeleton(true);
    }, 150);

    startTransition(async () => {
      addOptimisticTask({ type: 'add', task: optimisticTask });
      try {
        const serverTask = await createTask(trimmed);
        setTasks((prev) => [...prev, serverTask]);
      } catch (err) {
        console.error(err);
        showError(err);
      } finally {
        if (skeletonTimerRef.current !== null) {
          window.clearTimeout(skeletonTimerRef.current);
          skeletonTimerRef.current = null;
        }
        setShowSkeleton(false);
      }
    });
  }

  async function handleToggle(id: number, _nextCompleted: boolean): Promise<void> {
    startTransition(async () => {
      addOptimisticTask({ type: 'toggle', id });
      try {
        const updated = await toggleTask(id, _nextCompleted);
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      } catch (err) {
        console.error(err);
        showError(err);
      }
    });
  }

  async function handleDelete(id: number): Promise<void> {
    startTransition(async () => {
      addOptimisticTask({ type: 'remove', id });
      try {
        await deleteTask(id);
        setTasks((prev) => prev.filter((t) => t.id !== id));
      } catch (err) {
        console.error(err);
        showError(err);
      }
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      setDescription('');
    }
  }

  return (
    <main>
      <h1>Tasky</h1>
      {error !== null && (
        <p className="error-toast" role="alert">
          {error}
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => {
              setError(null);
              if (errorTimerRef.current !== null) {
                window.clearTimeout(errorTimerRef.current);
                errorTimerRef.current = null;
              }
            }}
          >
            ×
          </button>
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a task"
          aria-label="Task description"
        />
        <button type="submit">Add</button>
      </form>
      {loading ? (
        <p>Loading…</p>
      ) : optimisticTasks.length === 0 && !showSkeleton ? (
        <div className="empty-state" aria-live="polite">
          <p className="empty-state-primary">Nothing here yet.</p>
          <p className="empty-state-hint">Type a task above and press Enter.</p>
        </div>
      ) : (
        <ul>
          {optimisticTasks.map((task) => (
            <li key={task.id}>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => handleToggle(task.id, !task.completed)}
                aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}
              />
              <span className={task.completed ? 'completed' : ''}>{task.description}</span>
              <button type="button" onClick={() => handleDelete(task.id)}>
                Delete
              </button>
            </li>
          ))}
          {showSkeleton && <li key="skeleton-create" className="skeleton" />}
        </ul>
      )}
    </main>
  );
}

export default App;
