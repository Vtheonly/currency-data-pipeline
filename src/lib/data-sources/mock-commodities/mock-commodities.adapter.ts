import { StandardizedData, StandardizedAsset } from "@/lib/core/data-contracts";

// The unique shape of raw data for this source
export interface MockCommodityRawData {
  timestamp: string;
  commodities: {
    name: string;
    id: string;
    price: number;
    unit: string;
    change: number;
  }[];
}

export class MockCommoditiesAdapter {
  constructor(private readonly sourceName: string) {}

  public adapt(rawData: MockCommodityRawData): StandardizedData {
    const adapted: StandardizedData = { assets: {} };
    const timestamp = new Date(rawData.timestamp).getTime();

    for (const commodity of rawData.commodities) {
      const identifier = commodity.id;
      const asset: StandardizedAsset = {
        identifier,
        name: commodity.name,
        type: "commodity",
        source: this.sourceName,
        timestamp,
        rates: {
          'market': { // Commodities have a general market rate
            buying: commodity.price * 0.998,
            selling: commodity.price * 1.002,
            midRate: commodity.price,
            unit: commodity.unit,
          }
        }, // <-- THIS COMMA WAS MISSING
        // Simulate some historical data
        historicalData: Array.from({ length: 30 }, (_, i) => ({
          timestamp: timestamp - (30 - i) * 86400000,
          value: commodity.price * (1 + (Math.random() - 0.5) * 0.1),
        })),
      };
      adapted.assets[identifier] = asset;
    }
    return adapted;
  }
}