// Mirror of api/src/db.ts's Task type. Boundary mapping happens server-side
// (architecture.md#4.5) — the JSON wire format is the contract here.
export type Task = {
  id: number;
  description: string;
  completed: boolean;
  createdAt: string;
};

// Same-origin contract: relative URL only (architecture.md#3.4, #4.2).
// In dev, Vite's server.proxy forwards /api/* to localhost:3000.
// In prod, Caddy serves web/dist and proxies /api/* to the api container.
export async function fetchTasks(): Promise<Task[]> {
  const response = await fetch('/api/tasks');
  if (!response.ok) {
    throw new Error(`GET /api/tasks failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as Task[];
}
