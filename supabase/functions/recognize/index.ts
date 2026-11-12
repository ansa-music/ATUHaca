// Qadir — распознавание вида отхода по фото через Claude API.
// Вызывается из формы ввода: supabase.functions.invoke('recognize', { body: { image, types } }).
// Ключ API хранится только в секретах Supabase (ANTHROPIC_API_KEY) и в браузер не попадает.
// Доступ только для вошедших пользователей: функция развёрнута с проверкой JWT.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const MAX_IMAGE_CHARS = 2_000_000; // ~1,5 МБ JPEG; форма сжимает фото до 720 px, это ~60–120 КБ
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // При вставке ключа в секреты легко захватить пробел, перенос строки или невидимый символ — убираем их.
  // Берём первый корректный ключ: ANTHROPIC_API_KEY2 (запасной), затем ANTHROPIC_API_KEY.
  const keys = ["ANTHROPIC_API_KEY2", "ANTHROPIC_API_KEY"]
    .map((name) => (Deno.env.get(name) ?? "").replace(/[\s\u200B-\u200F\u2060\uFEFF"'«»]/g, ""))
    .filter(Boolean);
  const apiKey = keys.find((k) => !/[^\x21-\x7E]/.test(k)) ?? keys[0] ?? "";
  if (!apiKey) return json({ error: "not_configured" }, 503);
  if (/[^\x21-\x7E]/.test(apiKey)) {
    // Сам ключ не раскрываем: только длину и позиции недопустимых символов.
    const bad = [...apiKey].map((ch, i) => (/[^\x21-\x7E]/.test(ch) ? i : -1)).filter((i) => i >= 0);
    return json({ error: "bad_key_format", length: apiKey.length, bad_positions: bad.slice(0, 10) }, 503);
  }

  let image: string, types: { id: string; name: string }[];
  try {
    ({ image, types } = await req.json());
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(image ?? "");
  if (!m || image.length > MAX_IMAGE_CHARS) return json({ error: "bad_image" }, 400);
  if (!Array.isArray(types) || types.length === 0 || types.length > 60) return json({ error: "bad_types" }, 400);
  const list = types
    .filter((t) => typeof t?.id === "string" && typeof t?.name === "string")
    .map((t) => ({ id: t.id.slice(0, 64), name: t.name.slice(0, 120) }));

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              waste_type_id: { type: "string", enum: [...list.map((t) => t.id), "unknown"] },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              note_ru: { type: "string" },
            },
            required: ["waste_type_id", "confidence", "note_ru"],
            additionalProperties: false,
          },
        },
      },
      system:
        "Ты помогаешь сотрудникам столовых и лабораторий университета учитывать пищевые отходы. " +
        "По фото контейнера или подноса выбери один вид отхода из списка организации. " +
        "Если на фото нет отходов или ни один вид не подходит, верни unknown. " +
        "note_ru — одна короткая фраза о том, что видно на фото.",
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[2] } },
          { type: "text", text: "Виды отходов организации:\n" + list.map((t) => `${t.id} — ${t.name}`).join("\n") },
        ],
      }],
    });

    if (response.stop_reason === "refusal") return json({ waste_type_id: null, confidence: "low", note_ru: "" });
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return json({ waste_type_id: null });
    const out = JSON.parse(text.text) as { waste_type_id: string; confidence: string; note_ru: string };
    return json({
      waste_type_id: out.waste_type_id === "unknown" ? null : out.waste_type_id,
      confidence: out.confidence,
      note_ru: out.note_ru,
    });
  } catch (e) {
    console.error("recognize failed:", e);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "rate_limited" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "bad_api_key" }, 502);
    if (e instanceof Anthropic.APIError) return json({ error: "api_error", status: e.status }, 502);
    return json({ error: "internal" }, 500);
  }
});
