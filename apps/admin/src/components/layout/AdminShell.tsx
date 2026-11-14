"use client"

import React from "react"

import AppHeader, { AppHeaderProps } from "@/components/layout/AppHeader"
import AppSidebar from "@/components/layout/AppSidebar"
import Backdrop from "@/components/layout/Backdrop"
import { useSidebar } from "@/features/sidebar/sidebar.context"

type AdminShellProps = AppHeaderProps & {
  children: React.ReactNode
}

export default function AdminShell({ children, ...headerProps }: AdminShellProps) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar()

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
      ? "lg:ml-[290px]"
      : "lg:ml-[90px]"

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      <div
        className={`flex-1 transition-all  duration-300 ease-in-out ${mainContentMargin}`}
      >
        <AppHeader {...headerProps} />
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">{children}</div>
      </div>
    </div>
  )
}
