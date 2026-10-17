const LOG_LEVELS: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const getLevel = () => {
  const level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL.toLowerCase() : 'info';
  return LOG_LEVELS[level] ?? LOG_LEVELS.info;
};

import { inspect } from 'util';

function formatMessage(level: string, message: string, meta: unknown = null) {
  const timestamp = new Date().toISOString();
  let metaStr = "";
  
  if (meta) {
    if (meta instanceof Error) {
      metaStr = ` ${inspect(meta, { depth: 3, colors: false })}`;
    } else {
      metaStr = ` ${inspect(meta, { depth: 5, colors: false, compact: true })}`;
    }
  }
  
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  error: (message: string, error: unknown = null) => {
    if (getLevel() >= LOG_LEVELS.error) {
      console.error(formatMessage("error", message, error));
    }
  },

  warn: (message: string, meta: unknown = null) => {
    if (getLevel() >= LOG_LEVELS.warn) {
      console.warn(formatMessage("warn", message, meta));
    }
  },

  info: (message: string, meta: unknown = null) => {
    if (getLevel() >= LOG_LEVELS.info) {
      console.log(formatMessage("info", message, meta));
    }
  },

  debug: (message: string, meta: unknown = null) => {
    if (getLevel() >= LOG_LEVELS.debug) {
      console.log(formatMessage("debug", message, meta));
    }
  },
};
