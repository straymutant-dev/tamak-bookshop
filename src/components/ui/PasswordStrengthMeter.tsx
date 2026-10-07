// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

const LEVELS = [
  { label: 'Very weak', color: 'bg-red-500' },
  { label: 'Weak', color: 'bg-accent-terracotta' },
  { label: 'Fair', color: 'bg-accent-gold' },
  { label: 'Good', color: 'bg-brand-sage' },
  { label: 'Strong', color: 'bg-brand-green' },
];

function scorePassword(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

export default function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const score = scorePassword(password);
  const level = LEVELS[score];
  const filledCount = score === 0 ? 1 : score;

  return (
    <div className="mt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < filledCount ? level.color : 'bg-border-beige'}`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-muted">{level.label}</p>
    </div>
  );
}