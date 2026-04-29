import { useEffect, useState } from 'react';
import { fetchTasks, type Task } from './api';
import './App.css';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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

  return (
    <main>
      <h1>Tasky</h1>
      {loading ? (
        <p>Loading…</p>
      ) : tasks.length === 0 ? (
        <p aria-live="polite">No tasks</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>{task.description}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
