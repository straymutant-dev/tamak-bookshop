// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Search } from 'lucide-react';
import { searchBooksPreview, type BookPreview } from '@/lib/actions/storeSearch';

export default function BookSearchBox({
  defaultValue = '',
  classLevel,
  placeholder = 'Search by title',
  size = 'md',
}: {
  defaultValue?: string;
  classLevel?: string;
  placeholder?: string;
  size?: 'md' | 'lg';
}) {
  const router = useRouter();
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const [value, setValue] = useState(defaultValue);
  const [results, setResults] = useState<BookPreview[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);

  const query = value.trim();
  const canSearch = query.length >= 2;
  const showPanel = open && canSearch;

  // Look up matches shortly after the shopper stops typing.
  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchBooksPreview(query);
        if (id === requestId.current) {
          setResults(rows);
          setActive(-1);
        }
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, canSearch]);

  // Close the dropdown when the shopper clicks elsewhere.
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // There is no single-book page, so picking a book searches its exact title.
  function pickBook(book: BookPreview) {
    setValue(book.title);
    setOpen(false);
    router.push(`/store?search=${encodeURIComponent(book.title)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  // Enter on a highlighted row picks it; otherwise the normal search runs, as before.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (showPanel && active >= 0 && results[active]) {
      e.preventDefault();
      pickBook(results[active]);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <form
        action="/store"
        method="GET"
        onSubmit={handleSubmit}
        className="flex items-center overflow-hidden rounded-xl border border-brand-sage bg-surface-card focus-within:border-brand-green"
      >
        <Search size={18} className="ml-4 shrink-0 text-ink-muted" aria-hidden="true" />
        <input
          name="search"
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-transparent px-3 text-sm text-ink outline-none placeholder:text-ink-muted ${
            size === 'lg' ? 'py-3.5' : 'py-3'
          }`}
        />
        {classLevel && <input type="hidden" name="class_level" value={classLevel} />}
        <button type="submit" className="m-1.5 shrink-0 rounded-lg bg-brand-green px-5 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border-beige bg-surface-card shadow-lg">
          <div className="px-4 pb-1 pt-3 text-[11px] font-semibold tracking-wider text-ink-muted">BOOKS</div>

          {loading && results.length === 0 && <p className="px-4 pb-4 text-sm text-ink-muted">Searching…</p>}

          {!loading && results.length === 0 && (
            <p className="px-4 pb-4 text-sm text-ink-muted">No books match “{query}”. Press Enter to search anyway.</p>
          )}

          {results.length > 0 && (
            <ul id={listId} role="listbox" className="px-2 pb-2">
              {results.map((book, i) => (
                <li
                  key={book.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pickBook(book)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 ${
                    i === active ? 'bg-surface-cream' : ''
                  }`}
                >
                  {book.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.cover_image_url} alt="" className="h-12 w-9 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded bg-surface-cream">
                      <BookOpen size={16} className="text-ink-muted" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{book.title}</div>
                    <div className="truncate text-xs text-ink-muted">
                      {[book.class_level, book.subject].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {book.stock_quantity <= 0 && (
                    <span className="shrink-0 rounded-full border border-border-beige px-2 py-0.5 text-xs text-accent-terracotta">
                      Sold out
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="hidden gap-4 border-t border-border-beige px-4 py-2.5 text-xs text-ink-muted sm:flex">
            <span>↑ ↓ to move</span>
            <span>Enter to select</span>
            <span>Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
}