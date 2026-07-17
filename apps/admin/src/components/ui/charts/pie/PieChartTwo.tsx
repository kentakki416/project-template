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

export default function PieChartTwo() {
  const options: ApexOptions = {
    colors: ["#a78bfa", "#fb923c", "#fbbf24", "#34d399"],
    labels: ["Storage", "Backup", "Media", "Other"],
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
          size: "70%",
          labels: {
            show: true,
            total: {
              show: true,
              showAlways: true,
              label: "Total 135 GB",
              fontFamily: "Outfit, sans-serif",
              formatter: () => "160",
            },
          },
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    legend: {
      show: false,
    },
  }
  const series = [40, 45, 35, 40]
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
