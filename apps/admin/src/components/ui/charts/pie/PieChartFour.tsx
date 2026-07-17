"use client"

import { ApexOptions } from "apexcharts"
import dynamic from "next/dynamic"
import React from "react"

/**
 * Dynamically import the ReactApexChart component
 */
const ReactApexChart = dynamic(async () => import("react-apexcharts"), {
  ssr: false,
})

export default function PieChartFour() {
  const options: ApexOptions = {
    colors: ["#c2d6ff", "#7592ff", "#465fff", "#1e2a5a"],
    labels: ["Image", "Video", "Audio", "Documents"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "pie",
      height: 300,
    },
    stroke: {
      colors: ["#fff"],
      width: 2,
    },
    dataLabels: {
      enabled: false,
    },
    legend: {
      show: true,
      position: "bottom",
      fontFamily: "Outfit",
    },
  }
  const series = [30, 25, 20, 25]
  return (
    <div className="mx-auto max-w-[420px]">
      <ReactApexChart
        options={options}
        series={series}
        type="pie"
        height={300}
      />
    </div>
  )
}
