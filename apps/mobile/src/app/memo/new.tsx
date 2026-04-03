import MemoForm from "@/components/memo-form"
import { memoApi } from "@/modules/memo/memo.api"

export default function MemoNewScreen() {
  const createMemo = async(title: string, body: string) => {
    try {
      const memo = await memoApi.create(title, body)
      console.log(memo)
    } catch(err) {
      alert(err)
    }
  }

  return (
    <MemoForm onSave={createMemo} />
  )
}