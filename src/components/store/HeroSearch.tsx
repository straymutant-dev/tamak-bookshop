// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { CLASS_LEVELS } from '@/lib/types';
import BookSearchBox from './BookSearchBox';

export default function HeroSearch() {
  return (
    <div>
      <BookSearchBox size="lg" placeholder="Search by title, author or class level" />

      <div className="mt-3 flex flex-wrap gap-2">
        {CLASS_LEVELS.map((level) => (
          <a
            key={level}
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