// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import HeroImage from './HeroImage';
import HeroSearch from './HeroSearch';

const SPINE_COLORS = [
  { color: 'var(--color-brand-green)', height: '3rem' },
  { color: 'var(--color-accent-terracotta)', height: '4rem' },
  { color: 'var(--color-accent-gold)', height: '2.5rem' },
  { color: 'var(--color-brand-sage)', height: '4.5rem' },
];

function HeroContent({ light = false }: { light?: boolean }) {
  return (
    <div>
      <div className="mb-5 flex items-end gap-1.5">
        {SPINE_COLORS.map((spine, i) => (
          <span
            key={i}
            className="w-1.5 rounded-full"
            style={{ backgroundColor: spine.color, height: spine.height }}
          />
        ))}
      </div>

      <h1
        className={`max-w-md font-serif text-4xl leading-[1.1] md:text-5xl ${light ? 'text-white' : 'text-ink'}`}
      >
        The textbooks Kasoa&rsquo;s schools are already assigning this term
      </h1>

      <p className={`mt-5 max-w-md text-base leading-7 ${light ? 'text-white/85' : 'text-ink-muted'}`}>
        Search by title, author or class level — from KG workbooks to SHS core texts —
        and get exactly what your child needs before the first week. Schools and
        vendors can also order wholesale on credit.
      </p>

      <div className="mt-8 max-w-md">
        <HeroSearch />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/store"
          className="rounded-md bg-brand-green px-5 py-3 text-sm font-medium text-white hover:bg-brand-green/90"
        >
          Browse textbooks
        </Link>
        <Link
          href="/auth/register?type=vendor"
          className={
            light
              ? 'rounded-md border border-white/60 px-5 py-3 text-sm font-medium text-white hover:border-white'
              : 'rounded-md border border-brand-sage px-5 py-3 text-sm font-medium text-ink hover:border-brand-green hover:text-brand-green'
          }
        >
          Apply for a wholesale account
        </Link>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section>
      {/* Mobile: image as a full-bleed backdrop, content overlaid on top */}
      <div className="relative min-h-[85vh] overflow-hidden md:hidden">
        <div className="absolute inset-0">
          <HeroImage className="h-full rounded-none" />
          <div className="absolute inset-0 bg-linear-to-t from-ink/90 via-ink/40 to-ink/10" />
        </div>
        <div className="relative flex min-h-[85vh] flex-col justify-end px-6 pb-10 pt-24">
          <HeroContent light />
        </div>
      </div>

      {/* Desktop/tablet: original side-by-side layout, unchanged */}
      <div className="mx-auto hidden max-w-6xl px-6 py-12 md:grid md:grid-cols-[55%_45%] md:items-center md:gap-10 md:py-20">
        <HeroContent />
        <HeroImage />
      </div>
    </section>
  );
}