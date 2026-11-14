import { useRouter } from "next/navigation"

/**
 * 前の画面に戻る関数を返す。履歴が無い（URL を直接開いた）ときは fallbackPath に移る
 */
const useGoBack = (fallbackPath = "/") => {
  const router = useRouter()

  const goBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackPath)
    }
  }

  return goBack
}

export default useGoBack
