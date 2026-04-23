export class Logger {
  error(_message: string, _error?: unknown): void {
    // Intentionally silent — errors are non-fatal and logging to stderr
    // causes noise in Pi's UI chat bar.
  }
}

export const logger = new Logger();
