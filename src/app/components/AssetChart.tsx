// src/app/components/AssetChart.tsx

"use client";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { StandardizedAsset } from "@/lib/core/data-contracts";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface AssetChartProps {
  asset: StandardizedAsset;
}

export const AssetChart = ({ asset }: AssetChartProps) => {
  const data = {
    labels: asset.historicalData.map((d) =>
      new Date(d.timestamp).toLocaleDateString()
    ),
    datasets: [
      {
        label: `${asset.name} Price (${asset.rateData.unit})`,
        data: asset.historicalData.map((d) => d.value),
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: `Historical Data for ${asset.name}`,
      },
    },
  };

  return <Line options={options} data={data} />;
};