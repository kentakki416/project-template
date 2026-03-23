"use client"

import { createContext, useContext, useState } from "react"

import { useIsMobile } from "@/hooks/use-mobile"

type SidebarState = "expanded" | "collapsed"

type SidebarContextType = {
  state: SidebarState;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextType | null>(null)

export const useSidebarContext = () => {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebarContext must be used withen a SidebarProvider")
  }
  return context
}

export const SidebarProvider = ({ children, defaultOpen = true }: { children: React.ReactNode, defaultOpen?: boolean}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const isMobile = useIsMobile()

  const [prevIsMobile, setPrevIsMobile] = useState(isMobile)
  if (prevIsMobile !== isMobile) {
    setPrevIsMobile(isMobile)
    setIsOpen(!isMobile)
  }

  return (
    <SidebarContext.Provider
      value={{
        state: isOpen ? "expanded" : "collapsed",
        isOpen,
        setIsOpen,
        isMobile,
        toggleSidebar: () => setIsOpen((prev) => !prev)
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}