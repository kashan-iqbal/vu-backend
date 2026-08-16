// In-process concurrency gate for live LLM calls. A deadline rush must not fan out
// hundreds of concurrent DeepSeek calls, so at most MAX_CONCURRENCY run at once and
// the rest WAIT in line (queued, not rejected). A MAX_WAITING cap keeps the backlog
// bounded — past it we shed load with a 503 rather than pile up unbounded promises.
//
// This is a single-process semaphore (no Redis). Fine for the current single Node
// process; if the API is ever horizontally scaled, move this to a shared queue.

export const MAX_CONCURRENCY = 3;
export const MAX_WAITING = 30;

export class QueueFullError extends Error {
  constructor() {
    super("GDB helper is busy right now. Please try again in a moment.");
    this.name = "QueueFullError";
  }
}

class Semaphore {
  private active = 0;
  private waiting: Array<() => void> = [];

  constructor(
    private readonly max: number,
    private readonly maxWaiting: number,
  ) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return;
    }
    if (this.waiting.length >= this.maxWaiting) throw new QueueFullError();
    // Wait for release() to HAND us its slot; active is not re-incremented here,
    // so the count can never overshoot `max` on the microtask resume.
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  release(): void {
    const next = this.waiting.shift();
    if (next) {
      next(); // pass the held slot straight to the next waiter (count unchanged)
    } else {
      this.active -= 1;
    }
  }

  /** Run `fn` while holding a slot, always releasing it. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

export const llmGate = new Semaphore(MAX_CONCURRENCY, MAX_WAITING);
