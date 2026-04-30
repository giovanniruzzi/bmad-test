import { useEffect, useRef, useState } from 'react';
import { createTask, deleteTask, fetchTasks, toggleTask, type Task } from './api';
import './App.css';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [description, setDescription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // useEffect callbacks cannot be async (returning a Promise breaks the
    // cleanup-function contract). Wrap the async work in a nested function.
    async function load() {
      try {
        const result = await fetchTasks();
        setTasks(result);
      } catch (err) {
        // FR40: console.* only. Toast region arrives in Story 2.5.
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
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Without preventDefault the browser navigates to "/?" and loses state.
    event.preventDefault();
    const trimmed = description.trim();
    // Whitespace-only / empty = silent no-op. NOT an error toast, NOT a
    // disabled button — the user just sees nothing happen. Server-side 400
    // is the safety net (Story 2.1 AC #6).
    if (trimmed.length === 0) {
      return;
    }
    try {
      const task = await createTask(trimmed);
      // Functional updater: two rapid submits would otherwise race on the
      // stale `tasks` closure.
      setTasks((prev) => [...prev, task]);
      setDescription('');
      // Re-focus so the user can keep typing without reaching for the mouse
      // (PRD NFR15 keyboard-first ergonomics).
      inputRef.current?.focus();
    } catch (err) {
      // FR40: console.* only. Toast region arrives in Story 2.5. Leave the
      // input value AND focus untouched so the user can retry without retyping.
      console.error(err);
      showError(err);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Escape clears the input. Enter is handled by the <form>'s native submit
    // behavior (do NOT add an Enter case here — it would shadow the native
    // submit and complicate the trim/ignore logic).
    if (event.key === 'Escape') {
      setDescription('');
    }
  }

  async function handleToggle(id: number, nextCompleted: boolean): Promise<void> {
    try {
      const updated = await toggleTask(id, nextCompleted);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      // FR40: console.* only. Toast surfacing arrives in Story 2.5.
      console.error(err);
      showError(err);
    }
  }

  async function handleDelete(id: number): Promise<void> {
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      // FR40: console.* only. Toast surfacing arrives in Story 2.5.
      console.error(err);
      showError(err);
    }
  }

  function showError(messageOrErr: string | unknown): void {
    let message: string;
    if (typeof messageOrErr === 'string') {
      message = messageOrErr;
    } else if (
      messageOrErr instanceof Error &&
      messageOrErr.message.includes(' failed: ')
    ) {
      message = messageOrErr.message;
    } else {
      message = 'Something went wrong';
    }
    setError(message);
    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = window.setTimeout(() => {
      setError(null);
      errorTimerRef.current = null;
    }, 3000);
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
      ) : tasks.length === 0 ? (
        <p aria-live="polite">No tasks</p>
      ) : (
        <ul>
          {tasks.map((task) => (
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
        </ul>
      )}
    </main>
  );
}

export default App;
