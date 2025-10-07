/** Defines the type of asset we are handling. */
export type AssetType = "currency" | "commodity";

/** A unique identifier for an asset, e.g., "USD_EGP" or "OIL_WTI". */
export type AssetIdentifier = string;

export type RateType = "official" | "parallel_market" | "interbank" | "market";

/** The clean, standardized data for a single asset's current state. */
export interface StandardizedRate {
  buying: number;
  selling: number;
  midRate: number;
  unit: string; // e.g., "EGP" for currency, "USD/bbl" for oil
}

/** The clean, unified historical data point structure for charting. */
export interface StandardizedHistoricalPoint {
  timestamp: number;
  value: number;
}

/** The complete, standardized representation of a single asset. */
export interface StandardizedAsset {
  identifier: AssetIdentifier;
  name: string;
  type: AssetType;
  source: string;
  timestamp: number;
  rates: Partial<Record<RateType, StandardizedRate>>;
  historicalData: StandardizedHistoricalPoint[];
}

/** The final, unified data object produced by the orchestrator. */
export interface StandardizedData {
  assets: Record<AssetIdentifier, StandardizedAsset>;
}

/** The contract (interface) that all data source strategies must adhere to. */
export interface IDataSource {
  readonly name: string;
  fetchStandardizedData(): Promise<StandardizedData>;
  checkHealth(): Promise<void>;
  getHealth(): DataSourceHealth;
}

/** Represents the health status of a single data source. */
export interface DataSourceHealth {
  source: string;
  status: "healthy" | "degraded" | "failed";
  lastCheck: number;
  latency: number;
  message?: string;
}
