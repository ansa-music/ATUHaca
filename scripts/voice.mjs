// Генерация озвучки презентации через ElevenLabs API (запасной путь, если коннектор недоступен).
// Ключ берётся из .env.local (ELEVENLABS_API_KEY) — в репозиторий не попадает.
// Запуск: node scripts/voice.mjs [номера слайдов через запятую]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]))
const KEY = env.ELEVENLABS_API_KEY
if (!KEY) { console.error('Нет ELEVENLABS_API_KEY в .env.local'); process.exit(1) }

const VOICE_ID = 'Wa1HorICOC58Tie62cWB' // «Ерсұлтан», казахский мужской
const MODEL = process.env.MODEL || 'eleven_v4'
const lines = JSON.parse(readFileSync('scripts/voice-lines.json', 'utf8'))
const only = process.argv[2]?.split(',').map(Number)

mkdirSync('public/pitch/voice', { recursive: true })
for (let k = 0; k < lines.length; k++) {
  if (only && !only.includes(k + 1)) continue
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: lines[k], model_id: MODEL, language_code: 'kk' }),
  })
  if (!r.ok) { console.error(k + 1, r.status, await r.text()); continue }
  writeFileSync(`public/pitch/voice/${k + 1}.mp3`, Buffer.from(await r.arrayBuffer()))
  console.log('ok', k + 1)
}
