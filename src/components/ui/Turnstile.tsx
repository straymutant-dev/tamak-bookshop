// STRAYMUTANT.DEV — Tamak Bookshop
// Path: src/components/ui/Turnstile.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** False when no site key is configured (the widget then renders nothing). */
export const TURNSTILE_ENABLED = Boolean(SITE_KEY);

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Turnstile failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * Cloudflare Turnstile widget. Put it INSIDE a <form>: it adds a hidden
 * `captchaToken` field that the server actions pass on to Supabase.
 *
 * - Runs in the background; only shows a challenge when Cloudflare wants one.
 * - A token works once, so the widget fetches a fresh one after every submit.
 * - `onToken` fires with the token (or '' while a new one is being fetched),
 *   handy for disabling the submit button until the check has passed.
 */
export default function Turnstile({ onToken }: { onToken?: (token: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const [token, setToken] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const box = boxRef.current;
    if (!SITE_KEY || !box) return;

    let widgetId: string | undefined;
    let cancelled = false;
    const form = box.closest('form');

    const update = (value: string) => {
      setToken(value);
      onTokenRef.current?.(value);
    };

    loadTurnstile()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetId = window.turnstile.render(box, {
          sitekey: SITE_KEY,
          appearance: 'interaction-only',
          size: 'flexible',
          callback: (t: string) => {
            setFailed(false);
            update(t);
          },
          'expired-callback': () => update(''),
          'error-callback': () => {
            setFailed(true);
            update('');
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    // The form has read the token by the time this timeout runs.
    const onSubmit = () => {
      setTimeout(() => {
        if (widgetId === undefined || !window.turnstile) return;
        update('');
        window.turnstile.reset(widgetId);
      }, 0);
    };
    form?.addEventListener('submit', onSubmit);

    return () => {
      cancelled = true;
      form?.removeEventListener('submit', onSubmit);
      if (widgetId !== undefined) window.turnstile?.remove(widgetId);
    };
  }, []);

  if (!SITE_KEY) return null;

  return (
    <>
      <div ref={boxRef} className="empty:hidden" />
      <input type="hidden" name="captchaToken" value={token} />
      {failed && (
        <p className="text-xs text-red-700">
          The security check could not load. Check your connection and refresh the page.
        </p>
      )}
    </>
  );
}