import { NHomeAuthForm } from '@/components/auth/NHomeAuthForm'

export const metadata = { title: 'Sign In - NHome' }
export const dynamic = 'force-dynamic'

export default function SignInPage() {
  return <NHomeAuthForm />
}