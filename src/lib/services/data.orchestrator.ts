import {
  IDataSource,
  StandardizedData,
  DataSourceHealth,
} from "@/lib/core/data-contracts";
import { getAppConfig } from "@/lib/config/app-config";
import { Logger } from "@/lib/utils/logger";

export class DataOrchestrator {
  private logger = new Logger("DataOrchestrator");
  private cachedData: StandardizedData | null = null;
  private cacheExpiry = 0;
  private config = getAppConfig();

  constructor(private sources: IDataSource[]) {}

  public async getStandardizedData(): Promise<StandardizedData> {
    if (this.cachedData && Date.now() < this.cacheExpiry) {
      this.logger.debug("Returning fresh data from cache.");
      return this.cachedData;
    }

    const allFetchedAssets: StandardizedData = { assets: {} };
    // We will now attempt to merge data from ALL healthy sources
    for (const source of this.sources) {
      if (source.getHealth().status === "failed") {
        this.logger.warn(`Skipping failed source: ${source.name}`);
        continue;
      }
      try {
        this.logger.debug(`Fetching from source: ${source.name}`);
        const sourceData = await source.fetchStandardizedData();
        // Merge assets, giving priority to sources earlier in the array
        Object.assign(allFetchedAssets.assets, sourceData.assets);
      } catch (error) {
        this.logger.warn(`Source ${source.name} failed during fetch.`, {
          error,
        });
      }
    }

    if (Object.keys(allFetchedAssets.assets).length === 0) {
      if (this.cachedData) {
        this.logger.error(
          "All sources failed to provide data. Returning stale cache."
        );
        return this.cachedData;
      }
      throw new Error("All data sources are unavailable and no cache exists.");
    }

    this.logger.info(
      `Successfully merged data from sources. Total assets: ${
        Object.keys(allFetchedAssets.assets).length
      }`
    );
    this.cachedData = allFetchedAssets;
    this.cacheExpiry = Date.now() + this.config.cacheTimeoutMs;
    return this.cachedData;
  }

  public getHealth = (): DataSourceHealth[] =>
    this.sources.map((s) => s.getHealth());
  public runHealthChecks = async (): Promise<void> => {
    this.logger.debug("Running periodic health checks.");
    await Promise.all(this.sources.map((s) => s.checkHealth()));
  };
}
