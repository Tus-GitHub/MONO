export type UploadStatus = "queued" | "preparing" | "uploading" | "done" | "error" | "canceled";
export const UPLOAD_TRANSITIONS: Record<UploadStatus, readonly UploadStatus[]> = {
  queued: ["preparing", "canceled"], preparing: ["uploading", "error", "canceled"],
  uploading: ["done", "error", "canceled"], error: ["queued"], canceled: ["queued"], done: [],
};
export function canUploadTransition(from: UploadStatus, to: UploadStatus): boolean {
  return from === to || UPLOAD_TRANSITIONS[from].includes(to);
}

type Job<T> = { id: string; input: T; controller: AbortController };

/** Cancelled attempts retain their slot until settled. A retry always has a fresh identity. */
export class UploadQueue<T> {
  private waiting: Job<T>[] = [];
  private jobs = new Map<string, Job<T>>();
  private active = 0;

  constructor(private readonly concurrency: number, private work: (id: string, input: T, signal: AbortSignal) => Promise<void>) {
    if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Invalid upload concurrency.");
  }

  setWorker(work: (id: string, input: T, signal: AbortSignal) => Promise<void>): void { this.work = work; }

  enqueue(id: string, input: T): void {
    if (this.jobs.has(id)) return;
    const job = { id, input, controller: new AbortController() };
    this.jobs.set(id, job);
    this.waiting.push(job);
    this.pump();
  }

  cancel(id: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    this.jobs.delete(id);
    this.waiting = this.waiting.filter((candidate) => candidate !== job);
    job.controller.abort();
  }

  cancelAll(): void {
    for (const id of this.jobs.keys()) this.cancel(id);
  }

  private pump(): void {
    while (this.active < this.concurrency && this.waiting.length) {
      const job = this.waiting.shift()!;
      this.active++;
      void Promise.resolve().then(() => {
        if (!job.controller.signal.aborted) return this.work(job.id, job.input, job.controller.signal);
      }).catch(() => { /* The worker reports item failures; always release its slot. */ }).finally(() => {
        if (this.jobs.get(job.id) === job) this.jobs.delete(job.id);
        this.active--;
        this.pump();
      });
    }
  }
}
