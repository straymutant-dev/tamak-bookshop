// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useRef, useState } from 'react';

/**
 * Six separate digit boxes. Works inside a normal <form>: the joined digits are
 * sent as one hidden field (default name "code"), exactly like the old single input.
 * Supports typing, backspace, arrow keys, pasting a whole code, and SMS auto-fill.
 */
export default function OtpInput({
  name = 'code',
  length = 6,
  error = false,
}: {
  name?: string;
  length?: number;
  error?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function focusAt(i: number) {
    refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();
  }

  // Put a run of digits into the boxes starting at `start`.
  function fillFrom(start: number, text: string) {
    const next = [...digits];
    let last = start;
    for (let k = 0; k < text.length && start + k < length; k++) {
      next[start + k] = text[k];
      last = start + k;
    }
    setDigits(next);
    focusAt(last + 1);
  }

  function handleChange(i: number, raw: string) {
    const value = raw.replace(/\D/g, '');
    if (!value) {
      const next = [...digits];
      next[i] = '';
      setDigits(next);
      return;
    }
    fillFrom(i, value);
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      const next = [...digits];
      next[i - 1] = '';
      setDigits(next);
      focusAt(i - 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAt(i + 1);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!text) return;
    e.preventDefault();
    setDigits(Array.from({ length }, (_, k) => text[k] ?? ''));
    focusAt(text.length);
  }

  return (
    <div>
      <input type="hidden" name={name} value={digits.join('')} />
      <div role="group" aria-label="Verification code" className="flex gap-2 sm:gap-3">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${i + 1}`}
            required
            className={`h-14 w-11 rounded-xl border bg-surface-card text-center font-serif text-2xl outline-none focus:border-brand-green focus:shadow-[0_0_0_4px_rgba(23,74,64,0.12)] sm:w-12 ${
              error ? 'border-accent-terracotta bg-red-50 text-accent-terracotta' : 'border-brand-sage text-brand-green'
            }`}
          />
        ))}
      </div>
    </div>
  );
}