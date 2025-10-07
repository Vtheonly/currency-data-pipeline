// (This file remains the same - a solid utility doesn't need frequent changes)
import { getAppConfig } from "@/lib/config/app-config";

export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
}

export class Logger {
  private static logs: LogEntry[] = [];
  private static maxLogs = 500;
  private static logLevel: LogLevel = getAppConfig().logLevel;
  constructor(private readonly component: string) {}
  public debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }
  public info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }
  public warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }
  public error(message: string, data?: unknown): void {
    this.log("error", message, data);
  }
  private log(level: LogLevel, message: string, data?: unknown): void {
    const priority = { debug: 0, info: 1, warn: 2, error: 3 };
    if (priority[level] < priority[Logger.logLevel]) return;
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      component: this.component,
      message,
    };
    if (data !== undefined) {
      entry.data = data;
    }
    Logger.logs.push(entry);
    if (Logger.logs.length > Logger.maxLogs) Logger.logs.shift();
    console[level](
      `[${new Date(entry.timestamp).toISOString()}] [${level.toUpperCase()}] [${
        this.component
      }] ${message}`,
      data ?? ""
    );
  }
  static getLogs(level?: LogLevel): LogEntry[] {
    if (!level) return Logger.logs;
    const priority = { debug: 0, info: 1, warn: 2, error: 3 };
    return Logger.logs.filter((log) => priority[log.level] >= priority[level]);
  }
}
