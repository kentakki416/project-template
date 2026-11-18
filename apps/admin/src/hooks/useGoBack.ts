import { useRouter } from "next/navigation"

/**
 * 履歴が無い（URL を直接開いた）ときは fallbackPath に移る
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
