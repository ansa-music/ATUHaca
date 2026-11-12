import { Link } from 'react-router-dom'
import { Icon, Logo } from '../Icon'
import { useLang } from '../../lib/i18n'
import { SectionTitle } from './shared'

/** Бегущая строка серверных автоматизаций, которые уже работают в Qadir. */
export function AutomationStrip() {
  const { L } = useLang()
  const items: [string, string, string][] = [
    ['🛡️', 'Автопроверка отчёта', 'Есепті автотексеру'],
    ['⚖️', 'Нетипичный вес', 'Әдеттен тыс салмақ'],
    ['⏰', 'Напоминание в 18:00', '18:00-де еске салу'],
    ['📅', 'Контроль срока 5 числа', 'Айдың 5-і мерзімін бақылау'],
    ['📊', 'Недельная сводка руководству', 'Басшылыққа апталық жиынтық'],
    ['📂', 'Открытие отчётов месяца', 'Ай есептерін ашу'],
    ['🍲', 'Закрытие «Спасённых порций»', '«Құтқарылған порцияларды» жабу'],
  ]
  const row = (reverse: boolean) => (
    <div className="lp-marquee overflow-hidden py-1.5">
      <div className={`lp-marquee-track gap-3 ${reverse ? 'is-reverse' : ''}`}>
        {[0, 1].map((copy) => (
          <div key={copy} className={`flex shrink-0 gap-3 pr-3 ${copy ? 'lp-dup' : ''}`} aria-hidden={copy ? true : undefined}>
            {(reverse ? [...items].reverse() : items).map(([e, ru, kk]) => (
              <span key={ru} className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 sm:text-base">
                <span aria-hidden="true">{e}</span>{L(ru, kk)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
  return (
    <section className="on-dark overflow-hidden bg-brand-900 py-14 text-white sm:py-20">
      <div className="px-4"><SectionTitle dark kicker={L('Работает само', 'Өздігінен жұмыс істейді')} title={L('Автоматизации на сервере', 'Сервердегі автоматтандырулар')} sub={L('Никто не забудет сдать отчёт — система напомнит, проверит и закроет.', 'Ешкім есепті ұмытпайды — жүйе еске салады, тексереді және жабады.')} /></div>
      {row(false)}
      <div className="hidden sm:block">{row(true)}</div>
    </section>
  )
}

export function FinalCta() {
  const { L } = useLang()
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
      <h2 className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">{L('Посмотрите Qadir изнутри', 'Qadir-ді ішінен көріңіз')}</h2>
      <p className="mt-3 text-slate-600 sm:text-lg">{L('Гостевой вход для жюри — без регистрации, на демо-данных.', 'Қазыларға қонақ кіру — тіркеусіз, демо-деректермен.')}</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/login?guest=1" className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.97]">
          {L('Войти как гость жюри', 'Қазылар қонағы ретінде кіру')} <Icon name="arrowRight" size={18} />
        </Link>
        <Link to="/rescue" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-50 active:scale-[0.97]">
          <Icon name="bowl" size={18} /> {L('Спасённые порции', 'Құтқарылған порциялар')}
        </Link>
      </div>
    </section>
  )
}

export function Footer() {
  const { L } = useLang()
  return (
    <footer className="on-dark bg-brand-950 text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center text-sm sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-3">
          <Logo size={28} />
          <span>{L('Qadir Team · хакатон ATU Smart Food Industries · Трек 1', 'Qadir Team · ATU Smart Food Industries хакатоны · 1-трек')}</span>
        </div>
        <div className="flex items-center gap-5 font-semibold text-white/85">
          <Link to="/rescue" className="transition-colors hover:text-white">{L('Спасённые порции', 'Құтқарылған порциялар')}</Link>
          <Link to="/login" className="transition-colors hover:text-white">{L('Войти', 'Кіру')}</Link>
        </div>
      </div>
    </footer>
  )
}
