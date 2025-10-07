// src/app/page.tsx

"use client";
import { useState, useEffect } from "react";
import { StandardizedAsset } from "@/lib/core/data-contracts";
import { AssetChart } from "./components/AssetChart";

export default function HomePage() {
  const [assets, setAssets] = useState<Record<string, StandardizedAsset>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const assetIds = "USD_EGP,OIL_WTI,GOLD_XAU";
    fetch(`/api/v1/assets/demo?ids=${assetIds}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAssets(data.data);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <main className="container">
        <h1>Loading Asset Data...</h1>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header">
        <h1>Financial Data Dashboard</h1>
        <p>
          Displaying live and historical data from the aggregation pipeline.
        </p>
      </header>

      <div className="asset-grid">
        {Object.values(assets).map((asset) => (
          <div key={asset.identifier} className="asset-card">
            <div className="asset-header">
              <h2>{asset.name}</h2>
              <span>{asset.identifier}</span>
            </div>
            <div className="asset-rate">
              <p>
                <strong>Price:</strong> {asset.rateData.midRate.toFixed(2)}{" "}
                {asset.rateData.unit}
              </p>
              <p>
                <small>Source: {asset.source}</small>
              </p>
            </div>
            <div className="asset-chart">
              <AssetChart asset={asset} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}