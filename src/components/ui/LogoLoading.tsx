'use client';

import BrandMark from '@/components/store/BrandMark';

export default function LogoLoading({
  fixed = false,
  label = 'Loading',
}: {
  fixed?: boolean;
  label?: string;
}) {
  return (
    <div
      className={`logo-loading${fixed ? ' logo-loading--fixed' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="logo-loading__content">
        <div className="logo-loading__mark">
          <BrandMark className="h-14 sm:h-16" />
        </div>
        <span className="logo-loading__line" aria-hidden="true" />
        <span className="logo-loading__label">{label}</span>
      </div>
    </div>
  );
}
