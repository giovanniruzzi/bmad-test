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

// POST /api/tasks — create one task. The Content-Type header is REQUIRED;
// without it Express's express.json() does not populate req.body and the
// server returns 400 "description must be a string" (Story 2.1 AC #5).
// On non-2xx, try to extract the server's {error: string} message before
// falling back to status text — this is what lets Story 2.5's toast show
// the real reason instead of a generic "request failed."
export async function createTask(description: string): Promise<Task> {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  if (!response.ok) {
    let serverMessage: string | null = null;
    try {
      const body = (await response.json()) as unknown;
      if (
        body !== null &&
        typeof body === 'object' &&
        'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
      ) {
        serverMessage = (body as { error: string }).error;
      }
    } catch {
      // body was not JSON (proxy 502, empty body, HTML error page) — fall
      // through to the status-text path.
    }
    const detail = serverMessage ?? `${response.status} ${response.statusText}`;
    throw new Error(`POST /api/tasks failed: ${detail}`);
  }
  return (await response.json()) as Task;
}
