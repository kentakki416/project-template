"use client"

import { ThemeProvider } from "next-themes"

import { SidebarProvider } from "@/components/Layouts/sidevar/sidevar-context"

export function Providers({ children }: {children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light" attribute="class">
      <SidevarProvider>{children}</SidevarProvider>
    </ThemeProvider>
  )
}