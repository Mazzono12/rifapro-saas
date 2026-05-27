export class RetryService {
  constructor(private retries = 2, private delayMs = 150) {}

  async run<T>(operation: () => Promise<T>) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < this.retries) await new Promise(resolve => setTimeout(resolve, this.delayMs * (attempt + 1)));
      }
    }
    throw lastError;
  }
}
