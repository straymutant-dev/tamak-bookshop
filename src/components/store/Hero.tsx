// STRAYMUTANT.DEV — Tamak Bookshop
import Link from 'next/link';
import { ArrowDownRight, ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import HeroImage from './HeroImage';
import HeroSearch from './HeroSearch';

export default function Hero() {
  return (
    <section className="home-hero">
      <div className="home-hero__texture" aria-hidden="true" />
      <div className="home-hero__inner">
        <div className="home-hero__copy">
          <p className="home-hero__eyebrow">
            <Sparkles size={15} aria-hidden="true" />
            Kasoa&rsquo;s home for school books
          </p>
          <h1 className="home-hero__title">
            Great books.
            <br />
            <span>Brighter</span> futures.
          </h1>
          <p className="home-hero__description">
            From KG workbooks to SHS core texts, find the books your learner needs
            for a confident start to the term.
          </p>

          <div className="home-hero__search">
            <HeroSearch />
          </div>

          <div className="home-hero__actions">
            <Link href="/store" className="home-hero__button">
              Browse the collection
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/auth/register?type=vendor" className="home-hero__secondary">
              School &amp; wholesale orders
              <ArrowDownRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="home-hero__note">
            <BookOpen size={17} strokeWidth={1.7} aria-hidden="true" />
            <span>Easy pickup in Kasoa · Mobile money accepted</span>
          </div>
        </div>

        <div className="home-hero__art" aria-label="Students learning with books">
          <div className="home-hero__art-orbit" aria-hidden="true" />
          <div className="home-hero__image">
            <HeroImage />
          </div>
          <div className="home-hero__badge">
            <span className="home-hero__badge-icon">
              <BookOpen size={18} aria-hidden="true" />
            </span>
            <span>
              <strong>Ready for the term</strong>
              <small>Books for every class level</small>
            </span>
          </div>
        </div>
      </div>
      <div className="home-hero__bottom" aria-hidden="true">
        <span>Books for every stage</span>
        <span className="home-hero__bottom-line" />
        <span>One good book can change everything.</span>
      </div>
    </section>
  );
}
