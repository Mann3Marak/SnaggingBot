import { NHomeLogo } from '@/components/NHomeLogo'

export function NHomeFooter() {
  return (
    <footer className='border-t border-slate-200 bg-white/80 py-6 text-sm text-slate-600'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8'>
        <div className='flex items-center gap-3 text-slate-700'>
          <NHomeLogo variant='icon' size='sm' />
          <span>&copy; {new Date().getFullYear()} NHome Property Setup &amp; Management</span>
        </div>
        <div className='flex items-center gap-4 text-xs uppercase tracking-wide text-slate-500'>
          <span>Version 2.3</span>
          <span>Inspection Pro Suite</span>
        </div>
      </div>
    </footer>
  )
}
