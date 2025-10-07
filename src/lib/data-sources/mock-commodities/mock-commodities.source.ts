import { BaseDataSource } from "../base.data-source";
import { StandardizedData } from "@/lib/core/data-contracts";
import {
  MockCommoditiesAdapter,
  MockCommodityRawData,
} from "./mock-commodities.adapter";

export class MockCommoditiesSource extends BaseDataSource {
  private adapter: MockCommoditiesAdapter;
  constructor() {
    super("Mock-Commodities-API");
    this.adapter = new MockCommoditiesAdapter(this.name);
  }

  protected async executeFetch(): Promise<MockCommodityRawData> {
    this.logger.info("Simulating fetch for commodity data...");
    await new Promise((res) => setTimeout(res, 50)); // Simulate latency
    return {
      timestamp: new Date().toISOString(),
      commodities: [
        {
          name: "WTI Crude Oil",
          id: "OIL_WTI",
          price: 78.5,
          unit: "USD/bbl",
          change: 1.25,
        },
        {
          name: "Gold Spot",
          id: "GOLD_XAU",
          price: 2350.75,
          unit: "USD/oz",
          change: -10.5,
        },
      ],
    };
  }

  protected adaptToStandardizedFormat(rawData: unknown): StandardizedData {
    return this.adapter.adapt(rawData as MockCommodityRawData);
  }

  public async checkHealth(): Promise<void> {
    this.updateHealth(true, 20, "Mock source is always healthy.");
  }
}
