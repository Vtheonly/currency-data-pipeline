import { BaseDataSource } from "../base.data-source";
import { StandardizedData } from "@/lib/core/data-contracts";
import { SarfCurrencyAdapter, SarfRawResponse } from "./sarf-currency.adapter";

export class SarfCurrencySource extends BaseDataSource {
  private readonly apiUrl = "https://sarfegp.com/rates.json";
  private adapter: SarfCurrencyAdapter;

  constructor() {
    super("Sarf-EGP-API");
    this.adapter = new SarfCurrencyAdapter(this.name);
  }

  protected async executeFetch(): Promise<SarfRawResponse> {
    const response = await fetch(this.apiUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`HTTP status ${response.status}`);
    return response.json();
  }

  protected adaptToStandardizedFormat(rawData: unknown): StandardizedData {
    // Delegate the complex transformation logic to the dedicated adapter
    return this.adapter.adapt(rawData as SarfRawResponse);
  }

  public async checkHealth(): Promise<void> {
    const startTime = Date.now();
    try {
      const res = await fetch(this.apiUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok)
        throw new Error(`Health check failed with status ${res.status}`);
      this.updateHealth(true, Date.now() - startTime);
    } catch (e: any) {
      this.updateHealth(false, Date.now() - startTime, e.message);
    }
  }
}
