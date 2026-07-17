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

export default function PieChartOne() {
  const options: ApexOptions = {
    colors: ["#465fff", "#7592ff", "#c2d6ff"],
    labels: ["Desktop", "Mobile", "Tablet"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "donut",
      height: 300,
    },
    stroke: {
      colors: ["#fff"],
      width: 2,
    },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
        },
      },
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
  const series = [45, 35, 20]
  return (
    <div className="mx-auto max-w-[420px]">
      <ReactApexChart
        options={options}
        series={series}
        type="donut"
        height={300}
      />
    </div>
  )
}
