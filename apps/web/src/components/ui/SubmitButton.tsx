"use client"

import type { ReactNode } from "react"
import { useFormStatus } from "react-dom"

type SubmitButtonProps = {
  children: ReactNode
}

/**
 * <form> の子孫として描画する。form の外に置くと、useFormStatus の pending が常に false になる
 */
export function SubmitButton({ children }: SubmitButtonProps) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
    >
      {pending ? "送信中..." : children}
    </button>
  )
}
