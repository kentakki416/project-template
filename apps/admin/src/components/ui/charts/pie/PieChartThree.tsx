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

export default function PieChartThree() {
  const options: ApexOptions = {
    colors: ["#465fff", "#38bdf8", "#c4b5fd"],
    labels: ["ChatGPT", "Gemini", "xAI"],
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
              label: "Total API Token used",
              fontFamily: "Outfit, sans-serif",
              formatter: () => "13.5M",
            },
          },
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
  const series = [40, 33, 27]
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
