import "./globals.css"

import type { Metadata } from "next"
import NextTopLoader from "nextjs-toploader"
import type { PropsWithChildren } from "react"

import { Header } from "@/components/Layouts/header"
import { Sidebar } from "@/components/Layouts/sidebar"

import { Providers } from "./providers"

export const metadata: Metadata = {
  title: {
    template: "%s | NextAdmin - Next.js Dashboard Kit",
    default: "NextAdmin - Next.js Dashborad Kit"
  },
  description: "Next.js admin dashboard toolkit with 200+ templates, UI components, and integrations for fast dashboard development.",
}

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <Providers>
          <NextTopLoader color="#5750F1" showSpinner={false} />

          <div className="flex min-h-screen">

            <Sidebar />

            <div className="w-full bg-gray-1 dark:bg-[#020d1a]">
              <Header />

              <main className="isolate mx-auto w-full max-w-screen-2xl overflow-hidden p-4 md:p-6 2xl:p-10">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}