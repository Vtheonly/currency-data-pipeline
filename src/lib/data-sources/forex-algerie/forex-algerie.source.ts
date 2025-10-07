import { BaseDataSource } from "../base.data-source";
import { StandardizedData } from "@/lib/core/data-contracts";
import { ForexAlgerieAdapter, ForexAlgerieRawData } from "./forex-algerie.adapter";

export class ForexAlgerieSource extends BaseDataSource {
  // The URL of the website to be scraped
  private readonly webUrl = "http://www.forexalgerie.com/";
  private adapter: ForexAlgerieAdapter;

  constructor() {
    super("Forex-Algerie-Web");
    this.adapter = new ForexAlgerieAdapter(this.name);
  }

  protected async executeFetch(): Promise<ForexAlgerieRawData> {
    this.logger.info(`Fetching HTML content from ${this.webUrl}`);
    const response = await fetch(this.webUrl, {
      // Use a timeout to prevent long hangs
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from ${this.webUrl}. HTTP status ${response.status}`);
    }
    
    // Return the full HTML content as a string
    return response.text();
  }

  protected adaptToStandardizedFormat(rawData: unknown): StandardizedData {
    // The adapter is responsible for parsing the HTML string
    return this.adapter.adapt(rawData as ForexAlgerieRawData);
  }

  public async checkHealth(): Promise<void> {
    const startTime = Date.now();
    try {
      // A simple health check can be a HEAD request to ensure the site is reachable
      const res = await fetch(this.webUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        throw new Error(`Health check failed with status ${res.status}`);
      }
      this.updateHealth(true, Date.now() - startTime, "Site is reachable.");
    } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown health check error";
        this.updateHealth(false, Date.now() - startTime, message);
    }
  }
}