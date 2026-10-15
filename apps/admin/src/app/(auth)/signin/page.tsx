import { Metadata } from "next"

import SignInForm from "@/components/features/auth/SignInForm"

export const metadata: Metadata = {
  title: "サインイン",
}

export default function SignIn() {
  return <SignInForm />
}
