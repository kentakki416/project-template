import React from "react"

import { appConfig } from "@/config/app"

type AppLogoProps = {
  /** inverse は暗い背景（サインイン画面の右側）用に文字を白にする */
  tone?: "default" | "inverse"
  /** icon は折りたたんだサイドバー用に頭文字のアイコンだけを出す */
  variant?: "full" | "icon"
}

/**
 * アプリのロゴ。アプリ名の頭文字のアイコンとアプリ名の文字で描くので、
 * src/config/app.ts の name を変えればロゴも変わる。
 * 画像のロゴにしたいときは、この部品の中身を <Image> に差し替える（呼び出し側は変えない）
 */
export default function AppLogo({ tone = "default", variant = "full" }: AppLogoProps) {
  const icon = (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-lg font-bold text-white">
      {appConfig.name.charAt(0).toUpperCase()}
    </span>
  )

  if (variant === "icon") {
    return icon
  }

  return (
    <span className="flex items-center gap-2.5">
      {icon}
      <span
        className={`text-xl font-semibold ${
          tone === "inverse" ? "text-white" : "text-gray-800 dark:text-white/90"
        }`}
      >
        {appConfig.name}
      </span>
    </span>
  )
}
