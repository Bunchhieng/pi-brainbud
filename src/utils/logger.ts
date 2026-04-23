export class Logger {
  error(message: string, error?: unknown): void {
    console.error(`[BrainBud] ${message}`, error);
  }
}

export const logger = new Logger();
