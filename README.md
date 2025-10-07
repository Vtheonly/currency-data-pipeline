# Project: Modular Data Aggregation Pipeline

## 1. Overview

This project is a flexible, backend-oriented data aggregation pipeline designed to fetch, standardize, and serve data from multiple, diverse sources. It is built to be asset-agnostic, meaning it can handle currencies (USD/EGP), commodities (Oil, Gold), or any other data type with minimal changes.

The core philosophy is **modularity and separation of concerns**. The logic for handling each unique data source is completely isolated, while a central orchestrator manages the overall process of fetching, merging, and caching data. This creates a system that is highly maintainable, scalable, and easy to extend.

---

## 2. Core Architecture: The Factory Assembly Line

The best way to understand the architecture is to think of it as a factory assembly line for producing clean, standardized data.

- **Raw Materials (The Data):** Each data source (APIs, scraped websites) provides raw data in different, often inconsistent, formats.
- **Specialized Workstations (`DataSource` Modules):** Each module in `/src/lib/data-sources/` is an expert at handling one specific type of raw material. It contains:
  - A **Source (`.source.ts`):** Knows _how_ to fetch the raw data.
  - An **Adapter (`.adapter.ts`):** Knows _how_ to transform that specific raw data into our universal standard.
- **The Universal Blueprint (`data-contracts.ts`):** This file defines the `StandardizedAsset`—the single, non-negotiable format that every piece of data must conform to before it leaves the assembly line.
- **The Factory Manager (`DataOrchestrator`):** This class manages the entire assembly line. It calls upon different workstations, merges their outputs, handles caching, and manages fallbacks if a workstation breaks down.
- **The Public Showroom (`ExchangeService`):** This is the clean, simple `Singleton` facade that the rest of the application interacts with. It hides all the factory's complexity and provides simple methods like `getAssetData()`.

### Data Flow Diagram

```
[UI Component] -> [API Route (/api/v1/assets)] -> [ExchangeService (Singleton)] -> [DataOrchestrator]
                                                                                            |
            +-------------------------------------------------------------------------------+
            |
            v
+-----------+-----------+      +-----------+-----------+      +-----------+-----------+
| Source A (Sarf API)   |----->| Source B (Commodities)|----->| Source C (Scraped)    |
| - Fetch Raw JSON      |      | - Fetch Raw JSON      |      | - Fetch Raw HTML      |
| - Adapt to Standard   |      | - Adapt to Standard   |      | - Adapt to Standard   |
+-----------------------+      +-----------------------+      +-----------------------+
            ^
            |
            +-------------------------------------------------+
            | (Merged into a single, clean dataset)           |
            |                                                 |
            +------------------ [DataOrchestrator] <-----------+
```

---

## 3. Extending the Pipeline: A "How-To" Guide

This is the most important part of the documentation. Here’s how to add new functionality.

### **How to Add a New Data Source (e.g., a Scraped Website for Silver Prices)**

Let's say you found a website, `silversite.com`, that you want to scrape for silver prices.

#### Step 1: Create the New Source Module

In your terminal, create a new directory for your source:

```bash
mkdir -p src/lib/data-sources/silversite-scrape
```

#### Step 2: Create the Adapter (`.adapter.ts`)

This class translates the messy scraped data into our clean `StandardizedAsset` format.

```typescript
// src/lib/data-sources/silversite-scrape/silversite.adapter.ts

import { StandardizedData, StandardizedAsset } from "@/lib/core/data-contracts";

// Define the shape of the raw data you expect to scrape
export interface SilverSiteRawData {
  last_updated: number; // Unix timestamp
  silver_spot_price: string; // e.g., "29.55 USD"
}

export class SilverSiteAdapter {
  constructor(private readonly sourceName: string) {}

  public adapt(rawData: SilverSiteRawData): StandardizedData {
    const priceString = rawData.silver_spot_price; // "29.55 USD"
    const price = parseFloat(priceString);
    const unit = priceString.split(" "); // "USD"

    const silverAsset: StandardizedAsset = {
      identifier: "SILVER_XAG",
      name: "Silver Spot Price",
      type: "commodity",
      source: this.sourceName,
      timestamp: rawData.last_updated * 1000, // Convert to ms
      rateData: {
        midRate: price,
        buying: price * 0.997, // Your own logic for buy/sell spread
        selling: price * 1.003,
        unit: `${unit}/oz`,
      },
      historicalData: [], // This source doesn't provide historical data
    };

    return {
      assets: {
        SILVER_XAG: silverAsset,
      },
    };
  }
}
```

#### Step 3: Create the Source (`.source.ts`)

This class contains the actual fetching/scraping logic.

```typescript
// src/lib/data-sources/silversite-scrape/silversite.source.ts

import { BaseDataSource } from "../base.data-source";
import { StandardizedData } from "@/lib/core/data-contracts";
import { SilverSiteAdapter, SilverSiteRawData } from "./silversite.adapter";

export class SilverSiteSource extends BaseDataSource {
  private adapter: SilverSiteAdapter;

  constructor() {
    super("SilverSite-Scrape");
    this.adapter = new SilverSiteAdapter(this.name);
  }

  // Contains the unique logic for fetching from this site
  protected async executeFetch(): Promise<SilverSiteRawData> {
    this.logger.info("Executing scrape on silversite.com...");
    // In a real scenario, you would use a library like Cheerio or Puppeteer here.
    // For this example, we'll return mock data.
    await new Promise((res) => setTimeout(res, 80)); // Simulate scrape time

    return {
      last_updated: Math.floor(Date.now() / 1000),
      silver_spot_price: "29.55 USD",
    };
  }

  // The BaseDataSource calls this to standardize the fetched data
  protected adaptToStandardizedFormat(rawData: unknown): StandardizedData {
    return this.adapter.adapt(rawData as SilverSiteRawData);
  }

  // Logic to check if the site is up
  public async checkHealth(): Promise<void> {
    // A real check might just fetch the homepage and look for a 200 status
    this.updateHealth(true, 40, "Site is reachable.");
  }
}
```

#### Step 4: Plug the New Source into the Service

The final step is to tell the `ExchangeService` that this new source exists.

1.  **Export from the barrel file:**
    ```typescript
    // src/lib/data-sources/index.ts
    export { SarfCurrencySource } from "./sarf-currency/sarf-currency.source";
    export { MockCommoditiesSource } from "./mock-commodities/mock-commodities.source";
    export { SilverSiteSource } from "./silversite-scrape/silversite.source"; // <-- ADD THIS LINE
    ```
2.  **Add it to the `sources` array in the `ExchangeService`:**

    ```typescript
    // src/lib/services/exchange.service.ts
    import {
      SarfCurrencySource,
      MockCommoditiesSource,
      SilverSiteSource,
    } from "@/lib/data-sources"; // <-- IMPORT IT

    // ... inside the ExchangeService constructor ...
    if (config.mode === "production" || config.mode === "hybrid") {
      sources.push(new SarfCurrencySource());
      sources.push(new MockCommoditiesSource());
      sources.push(new SilverSiteSource()); // <-- ADD IT TO THE ARRAY
    }
    ```

**That's it!** Your new data source is now fully integrated. The orchestrator will automatically fetch, adapt, merge, and cache its data.

---

## 4. How to Consume Data in the UI

Your UI components (built with React, Vue, etc.) should **never** interact directly with the service layer. They should only call your API endpoints.

**Example React Component:**

```jsx
"use client";
import { useState, useEffect } from "react";

function AssetDisplay() {
  const [assets, setAssets] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // We want data for USD currency, WTI Oil, and now Silver
    const assetIds = "USD_EGP,OIL_WTI,SILVER_XAG";

    fetch(`/api/v1/assets?ids=${assetIds}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAssets(data.data);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <p>Loading assets...</p>;
  if (!assets) return <p>No asset data found.</p>;

  return (
    <div>
      <h1>Live Asset Prices</h1>
      {Object.values(assets).map((asset) => (
        <div key={asset.identifier}>
          <h2>
            {asset.name} ({asset.identifier})
          </h2>
          <p>
            Price: {asset.rateData.midRate.toFixed(2)} {asset.rateData.unit}
          </p>
          <p>Source: {asset.source}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 5. API Endpoints

### Get Asset Data

- **Endpoint:** `/api/v1/assets`
- **Method:** `GET`
- **Query Parameters:**
  - `ids` (required): A comma-separated list of asset identifiers.
- **Example:** `http://localhost:3000/api/v1/assets?ids=USD_EGP,OIL_WTI,SILVER_XAG`
- **Success Response (200):**
  ```json
  {
    "success": true,
    "data": {
      "USD_EGP": {
        "identifier": "USD_EGP",
        "name": "USD to EGP",
        "type": "currency",
        "source": "Sarf-EGP-API",
        "timestamp": 1672531200000,
        "rateData": {
          "buying": 50.5,
          "selling": 50.7,
          "midRate": 50.6,
          "unit": "EGP"
        },
        "historicalData": [
          /* ... */
        ]
      },
      "OIL_WTI": {
        /* ... */
      }
    }
  }
  ```
- **Error Response (400, 404, 503):**
  ```json
  {
    "success": false,
    "message": "Error message explaining what went wrong."
  }
  ```

### Get Service Health

- **Endpoint:** `/api/v1/health`
- **Method:** `GET`
- **Example:** `http://localhost:3000/api/v1/health`
- **Response (200 or 503):**
  ```json
  {
    "status": "healthy",
    "sources": [
      {
        "source": "Sarf-EGP-API",
        "status": "healthy",
        "lastCheck": 1672531200000,
        "latency": 120,
        "message": "OK"
      },
      {
        "source": "Mock-Commodities-API",
        "status": "degraded",
        "lastCheck": 1672531200000,
        "latency": 55,
        "message": "Fetch timed out"
      }
    ]
  }
  ```

---

## 6. Project Configuration

All major settings are located in `/src/lib/config/app-config.ts`. You can easily change caching duration, health check intervals, and logging levels for different environments (`development` vs. `production`).
