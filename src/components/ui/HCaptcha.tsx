// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useRef, useState } from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

export const HCAPTCHA_ENABLED = Boolean(SITE_KEY);

interface HCaptchaApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string | number;
  reset: (widgetId?: string | number) => void;
  remove: (widgetId?: string | number) => void;
}

declare global {
  interface Window {
    hcaptcha?: HCaptchaApi;
    onHCaptchaApiLoaded?: () => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadHCaptcha(): Promise<void> {
  if (window.hcaptcha) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      window.onHCaptchaApiLoaded = () => {
        delete window.onHCaptchaApiLoaded;
        resolve();
      };
      script.src = 'https://js.hcaptcha.com/1/api.js?onload=onHCaptchaApiLoaded&render=explicit&hl=en';
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        delete window.onHCaptchaApiLoaded;
        scriptPromise = null;
        reject(new Error('hCaptcha failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export default function HCaptcha({ onToken }: { onToken?: (token: string) => void }) {
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

    let widgetId: string | number | undefined;
    let cancelled = false;
    const form = box.closest('form');

    const update = (value: string) => {
      setToken(value);
      onTokenRef.current?.(value);
    };

    loadHCaptcha()
      .then(() => {
        if (cancelled || !window.hcaptcha) return;
        widgetId = window.hcaptcha.render(box, {
          sitekey: SITE_KEY,
          size: 'normal',
          callback: (value: string) => {
            setFailed(false);
            update(value);
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

    const onSubmit = () => {
      setTimeout(() => {
        if (widgetId === undefined || !window.hcaptcha) return;
        update('');
        window.hcaptcha.reset(widgetId);
      }, 0);
    };
    form?.addEventListener('submit', onSubmit);

    return () => {
      cancelled = true;
      form?.removeEventListener('submit', onSubmit);
      if (widgetId !== undefined) window.hcaptcha?.remove(widgetId);
    };
  }, []);

  if (!SITE_KEY) return null;

  return (
    <>
      <div ref={boxRef} />
      <input type="hidden" name="captchaToken" value={token} readOnly />
      {failed && (
        <p className="text-xs text-red-700">
          The security check could not load. Check your connection and refresh the page.
        </p>
      )}
    </>
  );
}
