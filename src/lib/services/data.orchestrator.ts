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

  /**
   * Fetches data from all healthy sources and intelligently merges them into a single dataset.
   * This method now supports deep-merging of different rate types (e.g., official, parallel_market)
   * for the same asset.
   */
  public async getStandardizedData(): Promise<StandardizedData> {
    if (this.cachedData && Date.now() < this.cacheExpiry) {
      this.logger.debug("Returning fresh data from cache.");
      return this.cachedData;
    }

    const successfulFetches: StandardizedData[] = [];

    for (const source of this.sources) {
      if (source.getHealth().status === "failed") {
        this.logger.warn(`Skipping failed source: ${source.name}`);
        continue;
      }
      try {
        this.logger.debug(`Fetching from source: ${source.name}`);
        const sourceData = await source.fetchStandardizedData();
        successfulFetches.push(sourceData);
      } catch (error) {
        this.logger.warn(`Source ${source.name} failed during fetch.`, {
          error,
        });
      }
    }

    // Use the helper method to deeply merge all successful fetches
    const mergedData = this.mergeData(successfulFetches);

    if (Object.keys(mergedData.assets).length === 0) {
      if (this.cachedData) {
        this.logger.error(
          "All sources failed to provide data. Returning stale cache."
        );
        return this.cachedData;
      }
      throw new Error("All data sources are unavailable and no cache exists.");
    }

    this.logger.info(
      `Successfully merged data. Total unique assets: ${
        Object.keys(mergedData.assets).length
      }`
    );
    this.cachedData = mergedData;
    this.cacheExpiry = Date.now() + this.config.cacheTimeoutMs;
    return this.cachedData;
  }

  public getHealth = (): DataSourceHealth[] =>
    this.sources.map((s) => s.getHealth());

  public runHealthChecks = async (): Promise<void> => {
    this.logger.debug("Running periodic health checks.");
    await Promise.all(this.sources.map((s) => s.checkHealth()));
  };

  /**
   * Deep-merges data from multiple sources. If an asset exists in multiple sources,
   * it combines their `rates` dictionaries, allowing for a single asset object
   * to hold both 'official' and 'parallel_market' rates.
   * @param sourcesData An array of standardized data objects from successful source fetches.
   * @returns A single, deeply merged standardized data object.
   */
  private mergeData(sourcesData: StandardizedData[]): StandardizedData {
    const merged: StandardizedData = { assets: {} };

    for (const sourceData of sourcesData) {
      for (const assetId in sourceData.assets) {
        const newAsset = sourceData.assets[assetId];
        const existingAsset = merged.assets[assetId];

        if (existingAsset) {
          // Asset already exists, so we merge its `rates` dictionary.
          // Object.assign will overwrite keys in `existingAsset.rates` with values from `newAsset.rates`.
          Object.assign(existingAsset.rates, newAsset.rates);
        } else {
          // This is a new asset, so add it directly.
          merged.assets[assetId] = newAsset;
        }
      }
    }
    return merged;
  }
}
