import {
  IDataSource,
  StandardizedData,
  DataSourceHealth,
} from "@/lib/core/data-contracts";
import { Logger } from "@/lib/utils/logger";

export abstract class BaseDataSource implements IDataSource {
  public readonly name: string;
  protected health: DataSourceHealth;
  protected logger: Logger;

  constructor(name: string) {
    this.name = name;
    this.logger = new Logger(`DataSource:${name}`);
    this.health = {
      source: this.name,
      status: "healthy",
      lastCheck: 0,
      latency: 0,
    };
  }

  public async fetchStandardizedData(): Promise<StandardizedData> {
    const startTime = Date.now();
    try {
      const rawData = await this.executeFetch();
      const adaptedData = this.adaptToStandardizedFormat(rawData);
      this.updateHealth(true, Date.now() - startTime);
      return adaptedData;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown fetch error";
      this.updateHealth(false, Date.now() - startTime, message);
      this.logger.error("Failed to execute data fetch", { error: message });
      throw new Error(`[${this.name}] ${message}`);
    }
  }

  public abstract checkHealth(): Promise<void>;
  protected abstract executeFetch(): Promise<unknown>;
  protected abstract adaptToStandardizedFormat(
    rawData: unknown
  ): StandardizedData;

  public getHealth = (): DataSourceHealth => ({ ...this.health });

  protected updateHealth(
    isSuccess: boolean,
    latency: number,
    message?: string
  ): void {
    this.health = {
      source: this.name,
      lastCheck: Date.now(),
      latency,
      message: message || (isSuccess ? "OK" : "Failed"),
      status: isSuccess ? "healthy" : "degraded",
    };
  }
}
