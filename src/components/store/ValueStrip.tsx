// STRAYMUTANT.DEV — Tamak Bookshop

import { MapPin, Wallet, Briefcase } from 'lucide-react';

const ITEMS = [
  {
    icon: MapPin,
    title: 'Pickup in Kasoa',
    text: 'Walk in and collect same day — no delivery wait.',
  },
  {
    icon: Wallet,
    title: 'Mobile money & more',
    text: 'Cash, MoMo, bank transfer, cheque, or an approved credit account.',
  },
  {
    icon: Briefcase,
    title: 'Business accounts',
    text: 'Schools and vendors can apply for wholesale pricing and credit terms.',
  },
];

export default function ValueStrip() {
  return (
    <section className="border-y border-border-beige bg-brand-sage/10">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 sm:grid-cols-3 sm:gap-8 sm:py-12">
        {ITEMS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-4">
            <Icon className="mt-0.5 h-6 w-6 shrink-0 text-brand-green" strokeWidth={1.6} aria-hidden="true" />
            <div>
              <h3 className="text-base font-medium text-ink">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}