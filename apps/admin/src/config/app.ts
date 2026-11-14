/**
 * アプリの名前と表示の設定。プロジェクトで最初に書き換える
 *
 * - name: サイドバー・ヘッダー・サインイン画面のロゴの文字、タブのタイトル（`<ページ名> | <name>`）
 * - description: サインイン画面の説明文、ページの description
 * - lang / locale: `<html lang>` と、日時の表示の書式
 * - timeZone: 日時の表示と、日付の絞り込みの日の区切り
 *
 * client component からも import する（秘密の値は置かない。env は src/env.ts）
 */
export const appConfig = {
  description: "管理画面",
  lang: "ja",
  locale: "ja-JP",
  name: "Admin",
  timeZone: "Asia/Tokyo",
} as const
