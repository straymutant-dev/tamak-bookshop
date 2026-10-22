// STRAYMUTANT.DEV — Tamak Bookshop
// Path: src/components/notifications/NotificationsList.tsx
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notifications';

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

// Only unread notifications are ever passed in (see NotificationsPanel), so
// once one is marked read it simply won't be in the list on the next fetch
// — that's what makes it "disappear" after it's been attended to.
export default function NotificationsList({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function openItem(item: NotificationItem) {
    setOpen(false);
    startTransition(async () => {
      try {
        await markNotificationRead(item.id);
      } finally {
        if (item.link) router.push(item.link);
        router.refresh();
      }
    });
  }

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <div ref={panelRef} className="md:relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-ink hover:bg-surface-cream"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-terracotta px-1 text-[10px] font-medium leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        // Below md the wrapper is not positioned, so the panel spans the viewport (12px margins, right-aligned,
        // max 24rem) and can never run off the screen. From md up it hangs under the bell as before (w-80).
        <div className="absolute inset-x-3 z-30 mt-2 ml-auto max-w-sm rounded-md border border-border-beige bg-surface-card shadow-lg md:inset-x-auto md:right-0 md:top-full md:w-80">
          <div className="flex items-center justify-between border-b border-border-beige px-4 py-3">
            <span className="text-sm font-medium text-ink">
              Notifications
              {unread > 0 && <span className="ml-2 text-xs text-ink-muted">({unread} unread)</span>}
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                disabled={isPending}
                className="text-xs text-brand-green hover:underline disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[min(24rem,calc(100dvh-9rem))] overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openItem(item)}
                className="flex w-full items-start gap-3 border-b border-border-beige px-4 py-3 text-left last:border-b-0 hover:bg-surface-cream/60"
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-terracotta" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{item.title}</span>
                  {item.body && <span className="block text-xs text-ink-muted">{item.body}</span>}
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {new Date(item.createdAt).toLocaleString('en-GH', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'UTC',
                    })}
                  </span>
                </span>
              </button>
            ))}
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-ink-muted">Nothing new. You&rsquo;re all caught up.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}