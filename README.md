# Project: Asset Data Aggregation Pipeline

## 1. Overview

This project is a flexible, backend-oriented data aggregation pipeline designed to fetch, standardize, merge, and serve financial data from multiple, diverse sources. It is built to be **asset-agnostic**, capable of handling currencies (USD/EGP, DZD/EUR), commodities (Oil, Gold), and more.

The core purpose is to provide a unified data layer that can consume information from various origins—such as official bank APIs, parallel market data providers, and scraped websites—and present it in a single, clean, and consistent format. This architecture is specifically designed to handle assets that have multiple pricing contexts, such as an **official rate** and a **parallel market (black market) rate**.

## 2. Core Architectural Philosophy

The pipeline is built on a foundation of modularity, abstraction, and separation of concerns, ensuring it is maintainable, scalable, and easy to extend.

- **Modular Sources:** Each data source is a completely self-contained module. The logic for fetching and interpreting data from one source is entirely isolated from all others.
- **Asset-Agnostic Design:** The system does not have hardcoded knowledge of "currencies" or "oil." It operates on a generic `Asset` model, identified by a unique string like `USD_EGP` or `OIL_WTI`.
- **The Adapter Pattern:** This is the heart of the system's flexibility. Each source has a dedicated **Adapter** whose sole responsibility is to translate messy, inconsistent raw data into the single, universal `StandardizedAsset` format that the rest of the application uses.
- **Intelligent Aggregation:** The system is designed to fetch data from multiple sources and intelligently **deep-merge** it. If one source provides the `official` rate for `USD_EGP` and another provides the `parallel_market` rate, the final output will be a single `USD_EGP` asset object containing both.

---

## 3. Architecture Deep Dive: The Data Factory

The architecture is best understood as a factory assembly line for producing clean, standardized asset data.

#### **The Universal Blueprint: `data-contracts.ts`**

This file defines the final product. Every piece of data, regardless of its origin, must be transformed to match the `StandardizedAsset` interface. Crucially, an asset does not have a single price; it has a dictionary of rates:

```typescript
export interface StandardizedAsset {
  identifier: AssetIdentifier; // "USD_EGP"
  name: string; // "US Dollar to Egyptian Pound"
  type: AssetType; // "currency"
  // ...
  rates: Partial<Record<RateType, StandardizedRate>>; // The dictionary of rates
  historicalData: StandardizedHistoricalPoint[];
}

export type RateType = "official" | "parallel_market" | "interbank" | "market";
```

#### **Specialized Workstations: Data Source Modules**

Each directory in `/src/lib/data-sources/` is a specialized workstation on the assembly line. It contains two key parts:

1.  **The Source (`.source.ts`):** An expert at fetching the raw material (data) from one specific place.
2.  **The Adapter (`.adapter.ts`):** An expert at taking that specific raw material and shaping it to match the Universal Blueprint.

#### **The Factory Manager: `DataOrchestrator`**

This class manages the entire assembly line. Its key responsibilities are:

- **Managing Workstations:** It knows about all available data sources and their health.
- **Deep-Merging:** Its most important job. After collecting standardized data from all healthy sources, it merges the results. If it receives two `USD_EGP` objects, it combines their `rates` dictionaries into one, creating a complete view of the asset.
- **Caching:** It stores the final, merged product for a configurable duration to reduce load on the data sources.

#### **The Public Showroom: `ExchangeService`**

This is the clean, simple `Singleton` facade for the entire pipeline. The rest of the application (e.g., your API routes) interacts only with this service. It hides all the complexity of the factory, providing simple methods like `getAssetData()`.

### Data Flow Diagram

```
[UI Component] -> [API Route] -> [ExchangeService] -> [DataOrchestrator]
                                                              |
            +-------------------------------------------------+-------------------------------------------------+
            |                                                                                                 |
            v                                                                                                 v
+-----------+-----------------------+                                                       +-----------+-------------------------+
| Source A (Sarf API)               |                                                       | Source B (Official Bank API)      |
| - Fetches raw parallel rates      |                                                       | - Fetches raw official rates        |
| - Adapter produces:               |                                                       | - Adapter produces:                 |
|   { USD_EGP: { rates: {            |                                                       |   { USD_EGP: { rates: {              |
|     parallel_market: { ... } } } } |                                                       |     official: { ... } } } }         |
+-----------------------------------+                                                       +-------------------------------------+
            |                                                                                                 |
            |                             +---------------------------------+                                 |
            +---------------------------->|         DataOrchestrator        | <-------------------------------+
                                          | - MERGES into single asset:     |
                                          |   { USD_EGP: { rates: {          |
                                          |     parallel_market: { ... },   |
                                          |     official: { ... } } } }     |
                                          | - Caches the result             |
                                          +---------------------------------+


```

## 4. Extending the Pipeline: A "How-To" Guide

This is the most important part of the documentation. Here’s how to add new functionality.

### **How to Add a New Data Source (e.g., an Official Bank API)**

Let's assume you have an API endpoint from a central bank that provides official exchange rates.

#### Step 1: Create the New Source Module

In your terminal, create a new directory for your source:

```bash
mkdir -p src/lib/data-sources/central-bank-api
```

#### Step 2: Create the Adapter (`.adapter.ts`)

This class will translate the bank's JSON response into our standard format, specifically tagging the rates as `'official'`.

```typescript
// src/lib/data-sources/central-bank-api/central-bank.adapter.ts
import { StandardizedData, StandardizedAsset } from "@/lib/core/data-contracts";

// Assume the bank's API returns data in this shape
export interface BankRawResponse {
  date: string;
  rates: { [currency: string]: number }; // e.g., { "USD": 30.90, "EUR": 33.25 }
}

export class CentralBankAdapter {
  constructor(private readonly sourceName: string) {}

  public adapt(rawData: BankRawResponse): StandardizedData {
    const adapted: StandardizedData = { assets: {} };
    const timestamp = new Date(rawData.date).getTime();

    for (const code in rawData.rates) {
      const identifier = `${code.toUpperCase()}_EGP`;
      const price = rawData.rates[code];

      const asset: StandardizedAsset = {
        identifier,
        name: `${code.toUpperCase()} to EGP (Official)`,
        type: "currency",
        source: this.sourceName,
        timestamp,
        rates: {
          official: {
            // <-- Tagging the rate type
            midRate: price,
            buying: price * 0.999, // Bank buy/sell spreads are usually tight
            selling: price * 1.001,
            unit: "EGP",
          },
        },
        historicalData: [], // This source provides no historical data
      };
      adapted.assets[identifier] = asset;
    }
    return adapted;
  }
}
```

#### Step 3: Create the Source (`.source.ts`)

This class contains the logic to call the bank's API endpoint.

```typescript
// src/lib/data-sources/central-bank-api/central-bank.source.ts
import { BaseDataSource } from "../base.data-source";
import { StandardizedData } from "@/lib/core/data-contracts";
import { CentralBankAdapter, BankRawResponse } from "./central-bank.adapter";

export class CentralBankSource extends BaseDataSource {
  private readonly apiUrl = "https://api.centralbank.gov/official-rates";
  private adapter: CentralBankAdapter;

  constructor() {
    super("Central-Bank-API");
    this.adapter = new CentralBankAdapter(this.name);
  }

  protected async executeFetch(): Promise<BankRawResponse> {
    const response = await fetch(this.apiUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`HTTP status ${response.status}`);
    return response.json();
  }

  protected adaptToStandardizedFormat(rawData: unknown): StandardizedData {
    return this.adapter.adapt(rawData as BankRawResponse);
  }

  public async checkHealth(): Promise<void> {
    // A simple health check could be a HEAD request
    const startTime = Date.now();
    try {
      const res = await fetch(this.apiUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
      this.updateHealth(true, Date.now() - startTime);
    } catch (e: any) {
      this.updateHealth(false, Date.now() - startTime, e.message);
    }
  }
}
```

#### Step 4: Plug the New Source into the Service

1.  **Export from the barrel file:**
    ```typescript
    // src/lib/data-sources/index.ts
    export { SarfCurrencySource } from "./sarf-currency/sarf-currency.source";
    export { MockCommoditiesSource } from "./mock-commodities/mock-commodities.source";
    export { CentralBankSource } from "./central-bank-api/central-bank.source"; // <-- ADD THIS
    ```
2.  **Add it to the `sources` array in the `ExchangeService`:**

    ```typescript
    // src/lib/services/exchange.service.ts
    import {
      SarfCurrencySource,
      MockCommoditiesSource,
      CentralBankSource,
    } from "@/lib/data-sources"; // <-- IMPORT

    // ... inside the ExchangeService constructor ...
    if (config.mode === "production" || config.mode === "hybrid") {
      sources.push(new SarfCurrencySource());
      sources.push(new CentralBankSource()); // <-- ADD IT TO THE ARRAY
      sources.push(new MockCommoditiesSource());
    }
    ```

**Done.** Your pipeline will now automatically fetch from both the Sarf API and the Central Bank API, and the `DataOrchestrator` will merge their data into single asset objects.

---

## 5. How to Consume Data in the UI

Your UI components only need to call a single endpoint and can then access all available rate types for an asset.

**Example React Component:**

```jsx
"use client";
import { useState, useEffect } from "react";

function UsdToEgpDisplay() {
  const [asset, setAsset] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // We only need to request the asset once
    fetch(`/api/v1/assets?ids=USD_EGP`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data["USD_EGP"]) {
          setAsset(data.data["USD_EGP"]);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <p>Loading USD/EGP rates...</p>;
  if (!asset) return <p>No data found for USD_EGP.</p>;

  // Access the different rate types from the single asset object
  const officialRate = asset.rates.official;
  const parallelRate = asset.rates.parallel_market;

  return (
    <div>
      <h1>{asset.name}</h1>
      {officialRate && (
        <div>
          <h2>Official Bank Rate</h2>
          <p>
            Buy: {officialRate.buying.toFixed(2)} {officialRate.unit}
          </p>
          <p>
            Sell: {officialRate.selling.toFixed(2)} {officialRate.unit}
          </p>
        </div>
      )}
      {parallelRate && (
        <div>
          <h2>Parallel Market Rate</h2>
          <p>
            Buy: {parallelRate.buying.toFixed(2)} {parallelRate.unit}
          </p>
          <p>
            Sell: {parallelRate.selling.toFixed(2)} {parallelRate.unit}
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## 6. API Endpoints

### Get Asset Data

- **Endpoint:** `/api/v1/assets`
- **Method:** `GET`
- **Query Parameters:**
  - `ids` (required): A comma-separated list of asset identifiers (e.g., `USD_EGP,OIL_WTI`).
- **Success Response (200):** A dictionary of asset objects. Notice how `USD_EGP` contains both `official` and `parallel_market` rates.
  ```json
  {
    "success": true,
    "data": {
      "USD_EGP": {
        "identifier": "USD_EGP",
        "name": "USD to EGP",
        "type": "currency",
        "source": "Sarf-EGP-API", // Primary source
        "timestamp": 1672531200000,
        "rates": {
          "parallel_market": {
            "buying": 50.5,
            "selling": 50.7,
            "midRate": 50.6,
            "unit": "EGP"
          },
          "official": {
            "buying": 30.89,
            "selling": 30.91,
            "midRate": 30.9,
            "unit": "EGP"
          }
        },
        "historicalData": [
          /* ... */
        ]
      },
      "OIL_WTI": {
        "identifier": "OIL_WTI",
        "name": "WTI Crude Oil",
        "type": "commodity",
        // ...
        "rates": {
          "market": {
            "midRate": 78.5,
            "unit": "USD/bbl"
            // ...
          }
        },
        "historicalData": [
          /* ... */
        ]
      }
    }
  }
  ```

### Get Service Health

- **Endpoint:** `/api/v1/health`
- **Method:** `GET`
- **Description:** Returns the health status of the entire service and a breakdown of each individual data source. Returns an HTTP status of `200` if healthy, `503` if degraded or failed.

---

## 7. Project Configuration

All major settings are located in `/src/lib/config/app-config.ts`. You can easily change caching duration, health check intervals, and logging levels for different environments (`development` vs. `production`).
