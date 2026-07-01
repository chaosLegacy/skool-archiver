import type { LogEntry } from "@/types";

export function createLogEntry(level: LogEntry["level"], message: string): LogEntry {
  return { timestamp: Date.now(), level, message };
}

export const logger = {
  info(message: string): LogEntry {
    console.info(`[SkoolArchiver] ${message}`);
    return createLogEntry("info", message);
  },
  warn(message: string): LogEntry {
    console.warn(`[SkoolArchiver] ${message}`);
    return createLogEntry("warn", message);
  },
  error(message: string): LogEntry {
    console.error(`[SkoolArchiver] ${message}`);
    return createLogEntry("error", message);
  }
};
