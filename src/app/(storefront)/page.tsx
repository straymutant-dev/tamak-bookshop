// STRAYMUTANT.DEV — Tamak Bookshop
import Hero from '@/components/store/Hero';
import FeaturedBooks from '@/components/store/FeaturedBooks';
import ValueStrip from '@/components/store/ValueStrip';
import ScrollReveal from '@/components/ui/ScrollReveal';

export default function Home() {
  return (
    <>
      <Hero />
      <ScrollReveal>
        <FeaturedBooks />
      </ScrollReveal>
      <ScrollReveal>
        <ValueStrip />
      </ScrollReveal>
    </>
  );
}