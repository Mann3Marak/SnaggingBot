'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { NHomeLogo } from '@/components/NHomeLogo'
import { useAuthUser } from '@/hooks/useAuthUser'
import { SignOutButton } from '@/components/auth/SignOutButton'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/inspection/start', label: 'Inspection' },
]

export function NHomeHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, loading } = useAuthUser()
  const pathname = usePathname()

  const isAuthenticated = Boolean(user)
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'NHome user'

  const toggleMenu = () => setMenuOpen((open) => !open)
  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname, isAuthenticated])

  const desktopMenuClasses = [
    'absolute right-0 top-12 z-30 hidden w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg',
    menuOpen ? 'md:block' : 'md:hidden',
  ].join(' ')

  return (
    <header className='border-b border-slate-200 bg-white/90 backdrop-blur'>
      <div className='mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8'>
        <div className='flex items-center gap-6'>
          <Link href='/' aria-label='NHome home'>
            <NHomeLogo variant='primary' size='sm' />
          </Link>
          {isAuthenticated && (
            <nav className='hidden md:flex items-center gap-6 text-sm font-medium text-slate-700'>
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={isActive ? 'text-nhome-primary' : 'text-slate-600 hover:text-nhome-primary'}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>

        <div className='relative flex items-center gap-3'>
          {loading ? (
            <span className='text-sm font-medium text-slate-500'>Checking access...</span>
          ) : isAuthenticated ? (
            <>
              <span className='hidden text-sm font-medium text-slate-600 sm:inline'>{displayName}</span>
              <button
                type='button'
                onClick={toggleMenu}
                className='inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-nhome-primary hover:text-nhome-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nhome-primary'
                aria-expanded={menuOpen}
                aria-haspopup='true'
              >
                <span className='sr-only'>Toggle navigation menu</span>
                {menuOpen ? <XMarkIcon className='h-5 w-5' /> : <Bars3Icon className='h-5 w-5' />}
              </button>
              <div className={desktopMenuClasses}>
                <p className='mb-3 text-sm font-medium text-slate-600'>Signed in as {displayName}</p>
                <nav className='flex flex-col gap-2 text-sm font-medium text-slate-700'>
                  {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMenu}
                        className={`rounded-lg px-3 py-2 transition ${
                          isActive ? 'bg-nhome-primary/10 text-nhome-primary' : 'hover:bg-slate-100'
                        }`}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </nav>
                <div className='mt-4 border-t border-slate-200 pt-4'>
                  <SignOutButton className='w-full rounded-lg bg-nhome-primary px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-nhome-primary-dark'>
                    Log out
                  </SignOutButton>
                </div>
              </div>
            </>
          ) : (
            <Link
              href='/auth/signin'
              className='inline-flex items-center justify-center rounded-full border border-nhome-primary px-4 py-2 text-sm font-semibold text-nhome-primary transition hover:bg-nhome-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nhome-primary'
            >
              Log in
            </Link>
          )}
        </div>
      </div>

      {isAuthenticated && (
        <div className={`md:hidden ${menuOpen ? 'block' : 'hidden'}`}>
          <div className='border-t border-slate-200 bg-white'>
            <div className='px-4 py-4 sm:px-6'>
              <p className='mb-4 text-sm font-medium text-slate-600'>Signed in as {displayName}</p>
              <nav className='flex flex-col gap-3 text-sm font-medium text-slate-700'>
                {navItems.map((item) => {
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMenu}
                      className={`rounded-lg px-3 py-2 transition ${
                        isActive ? 'bg-nhome-primary/10 text-nhome-primary' : 'hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
              <div className='mt-4 border-t border-slate-200 pt-4'>
                <SignOutButton className='w-full rounded-lg bg-nhome-primary px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-nhome-primary-dark'>
                  Log out
                </SignOutButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
