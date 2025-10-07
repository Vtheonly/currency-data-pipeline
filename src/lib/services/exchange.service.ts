import { getAppConfig } from "@/lib/config/app-config";
import {
  IDataSource,
  StandardizedAsset,
  DataSourceHealth,
  AssetIdentifier,
} from "@/lib/core/data-contracts";
import { SarfCurrencySource, MockCommoditiesSource } from "@/lib/data-sources";
import { DataOrchestrator } from "./data.orchestrator";
import { Logger, LogEntry, LogLevel } from "@/lib/utils/logger";

export interface ServiceHealth {
  status: "healthy" | "degraded" | "failed";
  sources: DataSourceHealth[];
}

export class ExchangeService {
  private static instance: ExchangeService;
  private orchestrator: DataOrchestrator;
  private logger = new Logger("ExchangeService");

  private constructor() {
    const config = getAppConfig();
    const sources: IDataSource[] = [];

    // Define the priority of data source modules here
    if (config.mode === "production" || config.mode === "hybrid") {
      sources.push(new SarfCurrencySource());
      sources.push(new MockCommoditiesSource()); // Add other sources here
    }

    this.orchestrator = new DataOrchestrator(sources);
    setInterval(
      this.orchestrator.runHealthChecks,
      config.healthCheckIntervalMs
    );
    this.logger.info(`Service initialized in ${config.mode} mode.`);
  }

  public static getInstance(): ExchangeService {
    if (!ExchangeService.instance)
      ExchangeService.instance = new ExchangeService();
    return ExchangeService.instance;
  }

  public async getAssetData(
    ids: AssetIdentifier[]
  ): Promise<Record<AssetIdentifier, StandardizedAsset>> {
    const data = await this.orchestrator.getStandardizedData();
    return ids.reduce((acc, id) => {
      if (data.assets[id]) acc[id] = data.assets[id];
      return acc;
    }, {} as Record<AssetIdentifier, StandardizedAsset>);
  }

  public getServiceHealth(): ServiceHealth {
    const sources = this.orchestrator.getHealth();
    const status = sources.every((s) => s.status === "failed")
      ? "failed"
      : sources.some((s) => s.status !== "healthy")
      ? "degraded"
      : "healthy";
    return { status, sources };
  }

  public getLogs = (level?: LogLevel): LogEntry[] => Logger.getLogs(level);
}
