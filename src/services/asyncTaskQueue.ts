type QueueTask<T> = () => Promise<T>;

interface QueuedJob<T> {
  task: QueueTask<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

class AsyncTaskQueue {
  private readonly concurrency: number;
  private readonly queue: QueuedJob<any>[] = [];
  private activeCount = 0;

  constructor(concurrency: number) {
    this.concurrency = Math.max(1, Math.floor(concurrency));
  }

  enqueue<T>(task: QueueTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processNext();
    });
  }

  private processNext() {
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) return;

      this.activeCount += 1;

      Promise.resolve()
        .then(job.task)
        .then(job.resolve)
        .catch(job.reject)
        .finally(() => {
          this.activeCount -= 1;
          this.processNext();
        });
    }
  }
}

export const guardedNetworkQueue = new AsyncTaskQueue(2);
