import { useEffect, useRef } from "react"

/**
 * 指定した要素の外側がクリックされたときにコールバックを実行するカスタムフック
 * ドロップダウンやモーダルの「外側クリックで閉じる」機能に使用する
 */
export function useClickOutside<T extends HTMLElement>(callback: () => void) {
  // 対象の要素を設定
  const ref = useRef<T>(null)

  useEffect(() => {
    // mousedownイベントで、クリック対象がref要素の外側かどうかを判定する
    function handleEvent(event: MouseEvent) {
      // 要素がページ上に存在していて、かつクリックした要素がその要素の外側ならば
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback()
      }
    }

    document.addEventListener("mousedown", handleEvent)

    return () => {
      document.removeEventListener("mousedown", handleEvent)
    }
  }, [callback, ref])

  return ref
}
