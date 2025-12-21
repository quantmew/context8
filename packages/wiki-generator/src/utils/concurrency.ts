/**
 * Simple concurrency limiter similar to p-limit
 * Limits the number of concurrent async operations
 */
export function pLimit(concurrency: number) {
  if (concurrency < 1) {
    throw new Error('Concurrency must be at least 1');
  }

  const queue: (() => void)[] = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      queue.shift()!();
    }
  };

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    activeCount++;
    try {
      return await fn();
    } finally {
      next();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const execute = () => {
        run(fn).then(resolve, reject);
      };

      if (activeCount < concurrency) {
        execute();
      } else {
        queue.push(execute);
      }
    });
  };
}
