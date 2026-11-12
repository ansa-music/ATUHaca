import type { ReactNode, SVGProps } from 'react'

/** Набор контурных иконок (24×24, stroke = currentColor). */
const PATHS = {
  // весы — ввод
  scale: (
    <>
      <path d="M12 4v16M7 20h10M5 7h14" />
      <path d="M5 7l-3 7a3 3 0 0 0 6 0L5 7zM19 7l-3 7a3 3 0 0 0 6 0l-3-7z" />
    </>
  ),
  // планшет с отчётом
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2.5" />
      <path d="M9 4.5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v.5M9 10.500h6M9 14.500h6M9 18h3" />
    </>
  ),
  chart: <path d="M4 20h16M7 20v-6M12 20V6M17 20v-9" />,
  // тарелка-чаша — порции
  bowl: (
    <>
      <path d="M3 11h18a9 9 0 0 1-18 0zM8 20h8" />
      <path d="M9 7c0-1.500 1.200-1.500 1.200-3M13.500 7c0-1.500 1.200-1.500 1.200-3" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.500l2.700 2.700L16 9.500" />
    </>
  ),
  folder: <path d="M3 7.500A2.500 2.500 0 0 1 5.500 5h3.600l2.200 2.500h7.200A2.500 2.500 0 0 1 21 10v7.500a2.500 2.500 0 0 1-2.500 2.500h-13A2.500 2.500 0 0 1 3 17.500v-10z" />,
  document: (
    <>
      <path d="M6.500 3h7.500l4.500 4.500V19a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M14 3v4.500h4.500M8.500 12.500h7M8.500 16.500h7" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.800 2.500 4 5.500 4 9s-1.200 6.500-4 9c-2.800-2.500-4-5.500-4-9s1.200-6.500 4-9z" />
    </>
  ),
  logout: <path d="M14 4h3.500A2.500 2.500 0 0 1 20 6.500v11a2.500 2.500 0 0 1-2.500 2.500H14M10 8l-4 4 4 4M6 12h10" />,
  camera: (
    <>
      <path d="M4 8.500A2.500 2.500 0 0 1 6.500 6h1.200l1.500-2h5.600l1.500 2h1.200A2.500 2.500 0 0 1 20 8.500v8a2.500 2.500 0 0 1-2.500 2.500h-11A2.500 2.500 0 0 1 4 16.500v-8z" />
      <circle cx="12" cy="12.500" r="3.200" />
    </>
  ),
  // эфир / табло
  live: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.800 7.800a6 6 0 0 0 0 8.400M16.200 7.800a6 6 0 0 1 0 8.400M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  phone: (
    <>
      <rect x="7" y="2.500" width="10" height="19" rx="2.500" />
      <path d="M11 18.500h2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.500 3v5.500c0 4.500-3 8-7.500 9.500-4.500-1.500-7.500-5-7.500-9.500V6L12 3z" />
      <path d="M8.800 12.200l2.300 2.300 4.200-4.500" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 17.500h6M10 21h4M12 3a6 6 0 0 0-3.500 10.900c.6.500 1 1.200 1 2v.600h5v-.600c0-.800.400-1.500 1-2A6 6 0 0 0 12 3z" />
    </>
  ),
  bolt: <path d="M13 2.500L5 13.500h6l-1 8 8-11h-6l1-8z" />,
  pencil: <path d="M4 20l1-4.500L16.500 4a2.100 2.100 0 0 1 3 3L8 18.500 4 20zM14.500 6l3 3" />,
  hourglass: <path d="M7 3h10M7 21h10M8 3v3.500c0 2 4 3.500 4 5.500s-4 3.500-4 5.500V21M16 3v3.500c0 2-4 3.500-4 5.500s4 3.500 4 5.500V21" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  leaf: <path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19c2-5 5-8 9-10" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, className = '', ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`} {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}

/** Знак Qadir — теперь тот же логотип-изображение (имя сохранено для совместимости). */
export function WheatMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  return <Logo size={size} className={className} />
}

/** Прежний контурный колос (не используется). */
export function WheatGlyph({ size = 24, className = '' }: { size?: number; className?: string }) {
  const grain = 'c-3.600.200-5.700-1.900-6-5.500 3.600-.200 5.700 1.900 6 5.500z'
  const grainR = 'c3.600.200 5.700-1.900 6-5.500-3.600-.200-5.700 1.900-6 5.500z'
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="currentColor" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M16 10.500c-2.700-2.500-2.700-5.700 0-8.500 2.700 2.800 2.700 6 0 8.500z" />
      <path d={`M15.300 16.500${grain}M15.300 22${grain}M15.300 27.500${grain}`} />
      <path d={`M16.700 16.500${grainR}M16.700 22${grainR}M16.700 27.500${grainR}`} />
      <rect x="15.300" y="9.500" width="1.400" height="21" rx="0.700" />
    </svg>
  )
}

/** Логотип Qadir: круговорот-«Q» с вилкой и листьями (public/logo.png). Докручивается при входе и «дышит» (q-logo). */
export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.png" alt="" aria-hidden="true" width={size} height={size} draggable={false}
      className={`q-logo inline-block shrink-0 select-none object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
