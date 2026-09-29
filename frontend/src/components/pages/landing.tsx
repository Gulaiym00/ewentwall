import { getFeaturedReviews, getSiteContent } from '@/api/site';
import type { Language } from '@/api/types';
import Footer from '@/layout/footer';
import Header from '@/layout/header';
import { landingDict } from '@/utils/i18n';
import EventTypes from '@/widgets/event-types';
import Faq from '@/widgets/faq';
import Features from '@/widgets/features';
import FinalCta from '@/widgets/final-cta';
import Hero from '@/widgets/hero';
import HowItWorks from '@/widgets/how-it-works';
import LiveWallPreview from '@/widgets/live-wall-preview';
import Testimonials from '@/widgets/testimonials';

export default async function Landing({ locale }: { locale: Language }) {
  const [content, reviews] = await Promise.all([getSiteContent(locale), getFeaturedReviews()]);
  const t = landingDict[locale];

  return (
    <div lang={locale} style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <Header locale={locale} t={t.header} />
      <main>
        <Hero content={content} t={t.hero} />
        <EventTypes t={t.eventTypes} />
        <HowItWorks t={t.howItWorks} />
        <Features t={t.features} />
        <LiveWallPreview t={t.wallPreview} />
        <Testimonials reviews={reviews} t={t.testimonials} locale={locale} />
        <Faq items={content.faq} t={t.faq} />
        <FinalCta t={t.finalCta} />
      </main>
      <Footer t={t.footer} />
    </div>
  );
}
