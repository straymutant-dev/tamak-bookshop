// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useRouter } from 'next/navigation';
import { CLASS_LEVELS } from '@/lib/types';

export default function HeroSearch() {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = String(formData.get('q') ?? '').trim();
    router.push(q ? `/store?search=${encodeURIComponent(q)}` : '/store');
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex overflow-hidden rounded-md border border-brand-sage bg-surface-card">
        <input
          name="q"
          type="text"
          placeholder="Search by title, author or class level"
          className="w-full px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
        <button type="submit" className="bg-brand-green px-5 text-sm font-medium text-white">
          Search
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {CLASS_LEVELS.map((level) => (
            
            <a key={level}
            href={`/store?class_level=${encodeURIComponent(level)}`}
            className="rounded-full border border-border-beige bg-surface-card px-3 py-1 text-xs text-ink-muted hover:border-brand-sage hover:text-ink"
            >
            {level}
          </a>
        ))}
      </div>
    </div>
  );
}