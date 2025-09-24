'use client'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

export function SignOutButton() {
  const router = useRouter()
  async function signOut() {
    await getSupabase().auth.signOut()
    router.replace('/auth/signin?message=Signed out')
  }
  return (
    <button onClick={signOut} className='text-sm font-medium text-nhome-primary hover:text-nhome-secondary'>
      Sign out
    </button>
  )
}
