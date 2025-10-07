import { StandardizedData, StandardizedAsset } from "@/lib/core/data-contracts";
import { Logger } from "@/lib/utils/logger";

// The raw data from this source is the full HTML page content.
export type ForexAlgerieRawData = string;

// A map to link currency codes to their full names found on the page.
const currencyNameMap: Record<string, string> = {
  EUR: "Euro",
  USD: "Dollar US",
  CAD: "Dollar Canadien",
  GBP: "Livre Sterling",
  CHF: "Franc Suisse",
  TRY: "Livre Turque",
  CNY: "Yuan Chinois",
  SAR: "Rial Saoudien",
  AED: "Dirham Emirati",
  TND: "Dinar Tunisien",
  MAD: "Dirham Marocain",
};

export class ForexAlgerieAdapter {
  private readonly logger: Logger;
  constructor(private readonly sourceName: string) {
    this.logger = new Logger(`adapter:${sourceName}`);
  }

  // A helper to extract a numeric value from the HTML using its specific ID.
  private extractPrice(html: string, id: string): number | null {
    const regex = new RegExp(`id="${id}"[^>]*>([\\d.]+)`);
    const match = html.match(regex);
    if (match && match[1]) {
      return parseFloat(match[1]);
    }
    this.logger.warn(`Could not extract price for ID: ${id}`);
    return null;
  }

  public adapt(rawData: ForexAlgerieRawData): StandardizedData {
    this.logger.info(`Adapting data from ${this.sourceName}`);
    const adapted: StandardizedData = { assets: {} };
    const now = Date.now();

    for (const code of Object.keys(currencyNameMap)) {
      const lowerCode = code.toLowerCase();
      const buying = this.extractPrice(rawData, `${lowerCode}Buy`);
      const selling = this.extractPrice(rawData, `${lowerCode}Sell`);

      if (buying !== null && selling !== null) {
        const identifier = `${code}_DZD`; // All rates are against Algerian Dinar
        const asset: StandardizedAsset = {
          identifier,
          name: `${currencyNameMap[code]} to DZD`,
          type: "currency",
          source: this.sourceName,
          timestamp: now,
          rates: {
            parallel_market: {
              // This source provides parallel market rates
              buying,
              selling,
              midRate: (buying + selling) / 2,
              unit: "DZD",
            },
          },
          historicalData: [], // This source does not provide historical data
        };
        adapted.assets[identifier] = asset;
      }
    }
    this.logger.info(`Adapted ${Object.keys(adapted.assets).length} assets.`);
    return adapted;
  }
}