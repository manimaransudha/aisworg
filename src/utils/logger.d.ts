// Type declaration for logger.js — doesn't change its runtime behavior at all.
// Without this, TS infers each meta/error param's type from its `= null` default,
// rejecting real Error/object arguments passed from TS call sites.
export const logger: {
  error(message: string, error?: unknown): void;
  warn(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
};
