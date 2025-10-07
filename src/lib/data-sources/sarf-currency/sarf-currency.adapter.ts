import { StandardizedData, StandardizedAsset } from "@/lib/core/data-contracts";
import { Logger } from "@/lib/utils/logger";

// Define the unique shape of the raw data from this specific source
export interface SarfRawRate {
  buying: number;
  selling: number;
  chart?: { times: number[]; buyingPrices: number[] };
}
export interface SarfRawResponse {
  rates: { [currencyCode: string]: SarfRawRate };
}

/**
 * The adapter's only job is to translate the raw Sarf response
 * into our clean, standardized format.
 */
export class SarfCurrencyAdapter {
  private readonly logger: Logger;
  constructor(private readonly sourceName: string) {
    this.logger = new Logger(`adapter:${sourceName}`);
  }

  public adapt(rawData: SarfRawResponse): StandardizedData {
    this.logger.info(`Adapting data from ${this.sourceName}`);
    const adapted: StandardizedData = { assets: {} };
    const now = Date.now();

    for (const code in rawData.rates) {
      const rawRate = rawData.rates[code];
      const identifier = `${code.toUpperCase()}_EGP`;

      const chart = rawRate.chart;
      const historicalData = chart
        ? chart.times.map((t, i) => ({
            timestamp: t * 1000,
            value: chart.buyingPrices[i],
          }))
        : [];

      const asset: StandardizedAsset = {
        identifier,
        name: `${code.toUpperCase()} to EGP`,
        type: "currency",
        source: this.sourceName,
        timestamp: now,
        rates: {
          parallel_market: {
            // This source provides parallel market rates
            buying: rawRate.buying,
            selling: rawRate.selling,
            midRate: (rawRate.buying + rawRate.selling) / 2,
            unit: "EGP",
          },
        },
        historicalData,
      };
      adapted.assets[identifier] = asset;
    }
    this.logger.info(`Adapted ${Object.keys(adapted.assets).length} assets.`);
    return adapted;
  }
}
