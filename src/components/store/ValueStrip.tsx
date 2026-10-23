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
    <section className="value-strip">
      <div className="value-strip__inner">
        {ITEMS.map(({ icon: Icon, title, text }, index) => (
          <div key={title} className="value-strip__item">
            <span className="value-strip__number">0{index + 1}</span>
            <div className="value-strip__icon">
              <Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
            </div>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}