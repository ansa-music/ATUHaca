import '../landing.css'
import Hero from '../components/landing/Hero'
import ProductFilm from '../components/landing/ProductFilm'
import LiveNumbers, { usePublicStats } from '../components/landing/LiveNumbers'
import ScrollStory from '../components/landing/ScrollStory'
import PaperToDigital from '../components/landing/PaperToDigital'
import { AutomationStrip, FinalCta, Footer } from '../components/landing/AutomationStrip'

/** Публичная главная: кинематографичный герой, продуктовый фильм, живые цифры и история продукта. */
export default function Landing() {
  const { stats, failed } = usePublicStats()
  return (
    <div className="lp-root flex min-h-full flex-col bg-paper">
      <Hero />
      <main className="flex-1">
        <ProductFilm />
        <LiveNumbers stats={stats} failed={failed} />
        <ScrollStory />
        <PaperToDigital />
        <AutomationStrip />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
