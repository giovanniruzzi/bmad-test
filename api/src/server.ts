import express, { type Request, type Response, type NextFunction } from 'express';
import { createTask, listTasks, pool, toggleTask, waitForDb } from './db.js';

const PORT = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '10kb' }));

// Single route. Mutations (POST/PATCH/DELETE) are Stories 2.1 / 2.3 / 2.4.
app.get('/api/tasks', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = await listTasks();
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks — create one task. Validation is manual per architecture.md#3.2
// (no Zod/Joi/Yup in Phase 0). Validation errors are thrown with `.status = 400`
// so the single error middleware below formats them as {error: message} — the
// same {error: ...} shape used by 5xx errors. Body parsing is already enabled
// globally by app.use(express.json({ limit: '10kb' })) on line 11, so a
// non-application/json request lands here with req.body undefined and trips
// the typeof check.
app.post('/api/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description } = (req.body ?? {}) as { description?: unknown };
    if (typeof description !== 'string') {
      const err: Error & { status?: number } = new Error('description must be a string');
      err.status = 400;
      throw err;
    }
    if (description.length < 1 || description.length > 500) {
      const err: Error & { status?: number } = new Error(
        'description must be between 1 and 500 characters',
      );
      err.status = 400;
      throw err;
    }
    const task = await createTask(description);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id — toggle completion. Validates id (regex + safe-integer),
// then body (typeof boolean), then calls toggleTask. Returns 404 with the
// {error:"task not found"} shape when no row matches. Validation errors are
// thrown with .status = 4xx so the single error middleware below formats them
// consistently with POST. Order: id → body → DB (architecture.md#4.4).
app.patch('/api/tasks/:id', async (req, res: Response, next: NextFunction) => {
  try {
    const idStr = req.params.id;
    if (!/^[1-9][0-9]*$/.test(idStr)) {
      const err: Error & { status?: number } = new Error('id must be a positive integer');
      err.status = 400;
      throw err;
    }
    const id = Number(idStr);
    if (!Number.isSafeInteger(id)) {
      const err: Error & { status?: number } = new Error('id must be a positive integer');
      err.status = 400;
      throw err;
    }
    const { completed } = (req.body ?? {}) as { completed?: unknown };
    if (typeof completed !== 'boolean') {
      const err: Error & { status?: number } = new Error('completed must be a boolean');
      err.status = 400;
      throw err;
    }
    const updated = await toggleTask(id, completed);
    if (updated === null) {
      const err: Error & { status?: number } = new Error('task not found');
      err.status = 404;
      throw err;
    }
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

// Single error middleware — the only place 5xx is returned. Honors a `.status`
// property on the error so future validation errors (400) work without a second
// middleware (architecture.md#4.4).
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const status = err.status ?? 500;
  const message = status < 500 ? (err.message ?? 'Bad request') : 'Internal server error';
  res.status(status).json({ error: message });
});

async function main(): Promise<void> {
  // Idempotency guard: a second signal during shutdown must not call
  // pool.end() twice (pg throws "Called end on pool more than once").
  let shuttingDown = false;
  let httpServer: ReturnType<typeof app.listen> | null = null;

  const shutdown = (signal: 'SIGTERM' | 'SIGINT') => {
    return async () => {
      if (shuttingDown) {
        console.log(`${signal} received again during shutdown, ignoring`);
        return;
      }
      shuttingDown = true;
      console.log(`${signal} received, shutting down...`);
      try {
        if (httpServer) {
          await new Promise<void>((resolve, reject) => {
            httpServer!.close((err) => (err ? reject(err) : resolve()));
          });
        }
        await pool.end();
        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    };
  };

  // Install signal handlers BEFORE waitForDb so SIGTERM during the up-to-30s
  // startup window is honored instead of ignored until the kill timeout.
  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));

  await waitForDb();

  httpServer = app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
