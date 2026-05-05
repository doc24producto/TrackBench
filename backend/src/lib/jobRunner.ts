import logger from './logger';

type JobFn = () => Promise<void>;

interface Job {
  name: string;
  fn: JobFn;
  retries: number;
}

const queue: Job[] = [];
let running = false;

async function processQueue(): Promise<void> {
  if (running) return;
  running = true;
  while (queue.length > 0) {
    const job = queue.shift()!;
    let attempt = 0;
    while (attempt <= job.retries) {
      try {
        await job.fn();
        break;
      } catch (err) {
        attempt++;
        if (attempt > job.retries) {
          logger.error(`Job "${job.name}" failed after ${attempt} attempts`, err);
        } else {
          logger.warn(`Job "${job.name}" attempt ${attempt} failed, retrying...`);
          await new Promise((r) => setTimeout(r, attempt * 2000));
        }
      }
    }
  }
  running = false;
}

export function enqueue(name: string, fn: JobFn, retries = 2): void {
  queue.push({ name, fn, retries });
  setImmediate(processQueue);
}
