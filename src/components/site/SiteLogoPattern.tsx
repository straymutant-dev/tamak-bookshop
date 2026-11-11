export default function SiteLogoPattern({ variant = 'site' }: { variant?: 'site' | 'auth' }) {
  return <div className={`site-logo-pattern site-logo-pattern--${variant}`} aria-hidden="true" />;
}
