// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notifications';

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsList({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function open(item: NotificationItem) {
    startTransition(async () => {
      try {
        if (!item.readAt) await markNotificationRead(item.id);
      } finally {
        if (item.link) router.push(item.link);
        else router.refresh();
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
    <div className="mb-8 rounded-md border border-border-beige bg-surface-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-muted">
          Notifications
          {unread > 0 && (
            <span className="ml-2 rounded-full bg-accent-terracotta px-2 py-0.5 text-xs font-medium text-white">
              {unread}
            </span>
          )}
        </h2>
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

      <div className="flex flex-col">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => open(item)}
            className="flex items-start gap-3 border-t border-border-beige py-3 text-left first:border-t-0 first:pt-0 hover:bg-surface-cream/60"
          >
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-transparent' : 'bg-accent-terracotta'}`}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className={`block text-sm ${item.readAt ? 'text-ink-muted' : 'font-medium text-ink'}`}>
                {item.title}
              </span>
              {item.body && <span className="block text-xs text-ink-muted">{item.body}</span>}
            </span>
            <span className="shrink-0 text-xs text-ink-muted">
              {new Date(item.createdAt).toLocaleString('en-GH', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'UTC',
              })}
            </span>
          </button>
        ))}
        {items.length === 0 && <p className="text-sm text-ink-muted">Nothing new. You&rsquo;re all caught up.</p>}
      </div>
    </div>
  );
}