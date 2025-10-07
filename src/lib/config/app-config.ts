export interface AppConfig {
  mode: "demo" | "production" | "hybrid";
  cacheTimeoutMs: number;
  healthCheckIntervalMs: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

const configs: Record<string, AppConfig> = {
  development: {
    mode: "hybrid",
    cacheTimeoutMs: 60000,
    healthCheckIntervalMs: 30000,
    logLevel: "debug",
  },
  production: {
    mode: "production",
    cacheTimeoutMs: 300000,
    healthCheckIntervalMs: 120000,
    logLevel: "warn",
  },
};

export function getAppConfig(): AppConfig {
  const env = process.env.NODE_ENV || "development";
  return configs[env] || configs.development;
}
