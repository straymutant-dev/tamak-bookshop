'use client';

import { useSyncExternalStore } from 'react';
import LegalDocumentModal from './LegalDocumentModal';

const COOKIE_NOTICE_KEY = 'tamak-cookie-notice-accepted';
const COOKIE_NOTICE_EVENT = 'tamak-cookie-notice-change';
let dismissedInMemory = false;

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(COOKIE_NOTICE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(COOKIE_NOTICE_EVENT, onChange);
  };
}

function getSnapshot() {
  if (dismissedInMemory) return false;

  try {
    return window.localStorage.getItem(COOKIE_NOTICE_KEY) !== 'true';
  } catch {
    return true;
  }
}

function getServerSnapshot() {
  return false;
}

export default function CookieNotice() {
  const visible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function accept() {
    dismissedInMemory = true;
    try {
      window.localStorage.setItem(COOKIE_NOTICE_KEY, 'true');
    } finally {
      window.dispatchEvent(new Event(COOKIE_NOTICE_EVENT));
    }
  }

  if (!visible) return null;

  return (
    <aside
      role="region"
      aria-label="Cookie notice"
      className="fixed bottom-3 left-3 right-3 z-80 mx-auto max-w-xl rounded-2xl border border-border-beige bg-surface-card p-4 shadow-xl sm:bottom-5 sm:left-auto sm:right-5 sm:max-w-md"
    >
      <h2 className="font-serif text-lg text-brand-green">Your privacy matters</h2>
      <p className="mt-1.5 text-sm leading-5 text-ink-muted">
        We use essential cookies and browser storage for sign-in, account security, hCaptcha, and your shopping cart. We do not use advertising or optional analytics cookies.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <LegalDocumentModal
          label="Privacy Policy"
          title="Privacy Policy"
          href="/privacy"
          className="text-sm font-medium text-brand-green hover:underline"
        />
        <button
          type="button"
          onClick={accept}
          className="rounded-xl bg-brand-green px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-green/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
        >
          Continue with essential cookies
        </button>
      </div>
    </aside>
  );
}
