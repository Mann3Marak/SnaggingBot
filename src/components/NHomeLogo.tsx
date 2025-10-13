'use client';

import Image from 'next/image';

type NHomeLogoVariant = 'primary' | 'white' | 'icon' | 'wordmark';
type NHomeLogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface NHomeLogoProps {
  variant?: NHomeLogoVariant;
  size?: NHomeLogoSize;
  className?: string;
  priority?: boolean;
}

const VARIANT_PATH: Record<NHomeLogoVariant, string> = {
  primary: '/icons/NHome_V4__Logo.png',
  white: '/branding/logos/nhome-logo-white.svg',
  icon: '/branding/logos/nhome-icon.svg',
  wordmark: '/branding/logos/nhome-wordmark.svg',
};

const LOGO_WIDTHS: Record<NHomeLogoSize, number> = {
  sm: 100,
  md: 160,
  lg: 220,
  xl: 280,
};

const WORDMARK_WIDTHS: Record<NHomeLogoSize, number> = {
  sm: 200,
  md: 260,
  lg: 220,
  xl: 400,
};

const ICON_SIZES: Record<NHomeLogoSize, number> = {
  sm: 56,
  md: 72,
  lg: 96,
  xl: 128,
};

const LOGO_RATIO = 120 / 320;
const PRIMARY_LOGO_RATIO = 1;
const WORDMARK_RATIO = 200 / 720;

export function NHomeLogo({
  variant = 'primary',
  size = 'md',
  className,
  priority,
}: NHomeLogoProps) {
  const computedClassName = ['inline-flex items-center', className].filter(Boolean).join(' ');
  const isIcon = variant === 'icon';
  const isWordmark = variant === 'wordmark';

  const width = isIcon
    ? ICON_SIZES[size]
    : isWordmark
      ? WORDMARK_WIDTHS[size]
      : LOGO_WIDTHS[size];

  const height = isIcon
    ? ICON_SIZES[size]
    : isWordmark
      ? Math.round(width * WORDMARK_RATIO)
      : variant === 'primary'
        ? Math.round(width * PRIMARY_LOGO_RATIO)
        : Math.round(width * LOGO_RATIO);
  return (
    <span className={computedClassName} aria-label='NHome Inspection Pro logo'>
      <Image
        src={VARIANT_PATH[variant]}
        alt='NHome Inspection Pro logo'
        width={width}
        height={height}
        priority={priority}
      />
    </span>
  );
}

