// src/app/api/v1/assets/demo/route.ts

import { NextResponse } from "next/server";
import {
  StandardizedAsset,
  StandardizedData,
} from "@/lib/core/data-contracts";

// Function to generate mock historical data for charts
const generateMockHistoricalData = (baseValue: number) => {
  const data = [];
  const now = Date.now();
  for (let i = 30; i > 0; i--) {
    const timestamp = now - i * 24 * 60 * 60 * 1000; // One point per day for 30 days
    const value = baseValue * (1 + (Math.random() - 0.5) * 0.1); // Fluctuate by +/- 5%
    data.push({ timestamp, value });
  }
  return data;
};

// Create a collection of mock assets
const mockAssets: Record<string, StandardizedAsset> = {
  USD_EGP: {
    identifier: "USD_EGP",
    name: "USD to EGP",
    type: "currency",
    source: "Mock-API",
    timestamp: Date.now(),
    rateData: {
      buying: 50.5,
      selling: 50.7,
      midRate: 50.6,
      unit: "EGP",
    },
    historicalData: generateMockHistoricalData(50.6),
  },
  OIL_WTI: {
    identifier: "OIL_WTI",
    name: "WTI Crude Oil",
    type: "commodity",
    source: "Mock-API",
    timestamp: Date.now(),
    rateData: {
      midRate: 78.5,
      buying: 78.4,
      selling: 78.6,
      unit: "USD/bbl",
    },
    historicalData: generateMockHistoricalData(78.5),
  },
  GOLD_XAU: {
    identifier: "GOLD_XAU",
    name: "Gold Spot",
    type: "commodity",
    source: "Mock-API",
    timestamp: Date.now(),
    rateData: {
      midRate: 2350.75,
      buying: 2349.5,
      selling: 2352.0,
      unit: "USD/oz",
    },
    historicalData: generateMockHistoricalData(2350.75),
  },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids")?.split(",") || [];

  const requestedAssets: Record<string, StandardizedAsset> = {};
  for (const id of ids) {
    if (mockAssets[id]) {
      requestedAssets[id] = mockAssets[id];
    }
  }

  if (Object.keys(requestedAssets).length === 0) {
    return NextResponse.json({
      success: false,
      message: "No assets found for the given IDs.",
    });
  }

  return NextResponse.json({
    success: true,
    data: requestedAssets,
  });
}