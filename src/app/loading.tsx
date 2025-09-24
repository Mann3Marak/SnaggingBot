'use client';

import { NHomeLogo } from '@/components/NHomeLogo';

export default function Loading() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-nhome-background px-6 py-12 text-center text-nhome-foreground'>
      <div className='flex flex-col items-center gap-8'>
        <NHomeLogo variant='primary' size='md' priority />
        <div className='relative h-16 w-16'>
          <span className='absolute inset-0 rounded-full border-4 border-nhome-primary/10'></span>
          <span className='absolute inset-0 rounded-full border-4 border-transparent border-t-nhome-primary border-l-nhome-secondary animate-spin [animation-duration:1.2s]'></span>
        </div>
        <div className='max-w-xs space-y-2'>
          <p className='text-lg font-semibold'>Preparing your workspace…</p>
          <p className='text-sm text-slate-600'>Loading inspection templates and syncing the latest snag lists from NHome cloud.</p>
        </div>
      </div>
    </div>
  );
}
