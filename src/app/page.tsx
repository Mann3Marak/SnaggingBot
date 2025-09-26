import { ClipboardDocumentCheckIcon, MicrophoneIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { NHomeLogo } from '@/components/NHomeLogo';

const features = [
  {
    title: 'Guided inspections',
    description: 'Follow structured room-by-room workflows tailored for Algarve holiday apartments and villas.',
    icon: ClipboardDocumentCheckIcon,
  },
  {
    title: 'Voice capture ready',
    description: 'Log findings hands-free and let NHome AI translate voice notes into actionable punch lists.',
    icon: MicrophoneIcon,
  },
  {
    title: 'Instant client handoff',
    description: 'Generate branded summaries and share with owners before you leave the property.',
    icon: SparklesIcon,
  },
];

const quickActions = [
  {
    label: 'Start new inspection',
    description: 'Launch a fresh checklist and capture photos, notes, and assignments in minutes.',
  },
  {
    label: 'Resume draft',
    description: 'Pick up where you left off with autosaved progress in the field.',
  },
  {
    label: 'Review reports',
    description: 'Track completion status, outstanding defects, and contractor updates.',
  },
];

export default function Home() {
  return (
    <main className='flex flex-1 flex-col'>
      <section className='relative overflow-hidden bg-nhome-primary text-white'>
        <div
          className='absolute inset-0 opacity-70'
          style={{ backgroundImage: 'var(--nhome-gradient)' }}
          aria-hidden
        />
        <div className='relative mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-16 sm:px-10 lg:flex-row lg:items-center lg:py-20'>
          <div className='space-y-8 lg:w-1/2'>
            <div className='flex items-center gap-4'>
              <NHomeLogo variant='white' size='sm' />
              <span className='rounded-full border border-white/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-white/80'>
                Algarve specialists
              </span>
            </div>
            <h1 className='text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl'>
              Deliver flawless move-ins with the NHome Inspection Pro PWA
            </h1>
            <p className='text-base leading-relaxed text-white/90 sm:text-lg'>
              Optimised for onsite teams, the app keeps inspections consistent, captures every issue, and syncs securely with
              NHome Property Management.
            </p>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
              <a href='/inspection/start' className='rounded-full bg-white px-6 py-3 text-sm font-semibold text-nhome-primary shadow-sm transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'>Begin inspection</a>
              <button className='rounded-full border border-white/60 px-6 py-3 text-sm font-semibold text-white transition hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'>
                Watch 2-min overview
              </button>
              <a href='/auth/signin' className='rounded-full border border-white/60 px-6 py-3 text-sm font-semibold text-white transition hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'>
                Sign in
              </a>
            </div>
            <div className='grid gap-3 text-sm text-white/80 sm:grid-cols-3'>
              {['Offline ready', 'iOS & Android optimised', 'NHome-branded reports'].map((item) => (
                <span key={item} className='rounded-full border border-white/20 px-4 py-2 text-center font-medium backdrop-blur-sm'>
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className='lg:w-1/2'>
            <div className='grid gap-4 rounded-3xl bg-white/10 p-6 backdrop-blur-md sm:grid-cols-2'>
              {quickActions.map((action) => (
                <div
                  key={action.label}
                  className='rounded-2xl bg-white/90 p-4 text-sm text-nhome-foreground shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:p-6'
                >
                  <p className='text-base font-semibold text-nhome-primary'>{action.label}</p>
                  <p className='mt-2 text-sm text-slate-600'>{action.description}</p>
                </div>
              ))}
              <div className='rounded-2xl border border-white/50 p-4 sm:col-span-2 sm:p-6'>
                <p className='text-sm font-semibold uppercase tracking-wide text-white/80'>Voice Assist preview</p>
                <p className='mt-2 text-sm text-white/90'>
                  "Living room blinds misaligned, assign to maintenance for same-day fix."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className='px-6 py-16 sm:px-10 lg:px-16'>
        <div className='mx-auto grid w-full max-w-5xl gap-12 lg:grid-cols-[2fr_1fr]'>
          <div className='space-y-10'>
            <div className='space-y-3'>
              <h2 className='text-2xl font-semibold text-nhome-foreground sm:text-3xl'>
                Built for mobile inspections
              </h2>
              <p className='text-base text-slate-600 sm:text-lg'>
                Responsive layouts snap to iPhone and Android screens, with offline-ready caching so teams can keep collecting data even in
                underground garages.
              </p>
            </div>
            <div className='grid gap-6 sm:grid-cols-2'>
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className='flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md'
                >
                  <feature.icon className='h-8 w-8 text-nhome-primary' aria-hidden='true' />
                  <h3 className='text-lg font-semibold text-nhome-foreground'>{feature.title}</h3>
                  <p className='text-sm leading-relaxed text-slate-600'>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
          <aside className='flex flex-col gap-6 rounded-2xl bg-white p-6 shadow-sm'>
            <div>
              <h3 className='text-sm font-semibold uppercase tracking-wide text-nhome-secondary'>Upcoming</h3>
              <p className='mt-1 text-base font-semibold text-nhome-foreground'>Sunrise Villas handover</p>
              <p className='text-sm text-slate-600'>Tomorrow - 09:00 - Lagos</p>
            </div>
            <hr className='border-dashed border-slate-200' />
            <div>
              <h3 className='text-sm font-semibold uppercase tracking-wide text-nhome-secondary'>Team status</h3>
              <ul className='mt-2 space-y-2 text-sm text-slate-600'>
                <li>- Ana Martins: 2 inspections in progress</li>
                <li>- Rui Santos: awaiting contractor updates</li>
                <li>- Sofia Costa: final review and client sign-off</li>
              </ul>
            </div>
            <hr className='border-dashed border-slate-200' />
            <div>
              <h3 className='text-sm font-semibold uppercase tracking-wide text-nhome-secondary'>Offline ready</h3>
              <p className='mt-2 text-sm text-slate-600'>
                Cached checklists ensure you never lose progress when connectivity drops in thick concrete builds.
              </p>
            </div>
            <div className='rounded-2xl border border-dashed border-nhome-primary/50 bg-nhome-primary/5 p-4 text-sm text-slate-600'>
              <p className='font-semibold text-nhome-primary'>NHome brand promise</p>
              <p className='mt-1'>Every inspection closes with a polished, on-brand report that owners trust.</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}



