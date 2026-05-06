import type { Metadata } from "next"

import { startGoogleOAuth } from "./actions"

export const metadata: Metadata = {
  title: "サインイン",
}

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "認証に失敗しました。もう一度お試しください。",
  invalid_request: "リクエストが不正です。",
  oauth_denied: "Google アカウントへのアクセスが拒否されました。",
  state_mismatch: "セッションが切れました。もう一度お試しください。",
}

type Props = {
  searchParams: Promise<{ error?: string }>
}

export default async function SignInPage({ searchParams }: Props) {
  const { error } = await searchParams
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "エラーが発生しました。" : null

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">サインイン</h1>
          <p className="text-sm text-gray-500">アカウントに接続して始めましょう</p>
        </div>

        {errorMessage && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <form action={startGoogleOAuth}>
          <button
            className="w-full rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            type="submit"
          >
            Google でサインイン
          </button>
        </form>
      </div>
    </main>
  )
}
