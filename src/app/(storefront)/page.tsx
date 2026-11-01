// STRAYMUTANT.DEV — Tamak Bookshop
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Books in Kasoa, Ghana',
  description: 'Shop textbooks, workbooks and storybooks online from Tamak Bookshop, with pickup, delivery and wholesale accounts.',
};
import Hero from '@/components/store/Hero';
import FeaturedBooks from '@/components/store/FeaturedBooks';
import ValueStrip from '@/components/store/ValueStrip';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { CLASS_LEVELS } from '@/lib/types';

export default function Home() {
  return (
    <>
      <Hero />
      <nav className="home-levels" aria-label="Browse books by class level">
        <div className="home-levels__inner">
          <span className="home-levels__label">Find books for</span>
          {CLASS_LEVELS.slice(0, 6).map((level) => (
            <Link
              key={level}
              href={`/store?class_level=${encodeURIComponent(level)}`}
              className="home-levels__link"
            >
              {level}
            </Link>
          ))}
        </div>
      </nav>
      <ScrollReveal>
        <FeaturedBooks />
      </ScrollReveal>
      <ScrollReveal>
        <section className="home-wholesale">
          <div className="home-wholesale__ornament" aria-hidden="true">T</div>
          <div className="home-wholesale__content">
            <p>For schools &amp; bookshops</p>
            <h2>More books. Better terms.</h2>
            <span>
              Get wholesale pricing and flexible credit options for your school or
              business.
            </span>
          </div>
          <Link href="/auth/register?type=vendor" className="home-wholesale__button">
            Explore wholesale
            <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </ScrollReveal>
      <ScrollReveal>
        <ValueStrip />
      </ScrollReveal>
    </>
  );
}