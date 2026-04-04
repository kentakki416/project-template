import { useRouter } from "expo-router"

import MemoForm from "@/components/features/memo/MemoForm"
import { memoApi } from "@/modules/memo/memo.api"
import { useMemoStore } from "@/modules/memo/memo.state"

export default function MemoNewScreen() {
  const router = useRouter()
  const addStoreMemo = useMemoStore((state) => state.addStoreMemo)

  const createMemo = async (title: string, body: string) => {
    try {
      const memo = await memoApi.create(title, body)
      addStoreMemo(memo)
      router.back()
    } catch (err) {
      alert(err)
    }
  }

  return (
    <MemoForm onSave={createMemo} />
  )
}
