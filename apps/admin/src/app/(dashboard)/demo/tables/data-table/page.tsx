import { Metadata } from "next"
import React from "react"

import DataTableExample from "@/components/demo/example/DataTableExample"
import ComponentCard from "@/components/layout/ComponentCard"
import PageBreadcrumb from "@/components/layout/PageBreadCrumb"

export const metadata: Metadata = {
  title: "Data Table",
}

export default function DataTablePage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Data Table" />
      <ComponentCard title="Data Table（client モード）">
        <DataTableExample />
      </ComponentCard>
    </div>
  )
}
