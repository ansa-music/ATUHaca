// Qadir — ИИ-помощник на Claude API. Один вход, пять режимов:
//   recognize      — фото отходов → вид отхода, примерный вес, причина, новый вид при необходимости
//   parse_text     — фраза «хлеб 3 кг, гарнир 2,5» (или голос) → записи
//   parse_journal  — фото бумажного журнала → записи с датами
//   review         — заключение для проверяющего по отчёту
//   insight        — вывод аналитика по принятым данным за период
// Ключ хранится только в секретах Supabase. Данные читаются с правами вызывающего пользователя (RLS),
// поэтому ИИ видит ровно то, что пользователю и так разрешено видеть.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5-5";
const MAX_IMAGE_CHARS = 2_000_000;
const REASONS = ["overproduction", "expired", "spoilage", "plate", "trimmings"] as const;
const CATEGORIES = ["avoidable", "unavoidable", "packaging"] as const;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type WType = { id: string; name: string; unit?: string };
type Mode = "recognize" | "parse_text" | "parse_journal" | "review" | "insight";

function apiKey(): string {
  const keys = ["ANTHROPIC_API_KEY2", "ANTHROPIC_API_KEY"]
    .map((n) => (Deno.env.get(n) ?? "").replace(/[\s\u200B-\u200F\u2060\uFEFF"'«»]/g, ""))
    .filter(Boolean);
  return keys.find((k) => !/[^\x21-\x7E]/.test(k)) ?? "";
}

function cleanTypes(types: unknown): WType[] {
  if (!Array.isArray(types)) return [];
  return types
    .filter((t) => typeof t?.id === "string" && typeof t?.name === "string")
    .slice(0, 80)
    .map((t) => ({ id: t.id.slice(0, 64), name: t.name.slice(0, 120), unit: t.unit === "l" ? "л" : "кг" }));
}

function imageBlock(image: unknown) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(typeof image === "string" ? image : "");
  if (!m || (image as string).length > MAX_IMAGE_CHARS) return null;
  return { type: "image" as const, source: { type: "base64" as const, media_type: m[1] as "image/jpeg", data: m[2] } };
}

/** Один вызов Claude со строгим JSON на выходе. */
async function ask(client: Anthropic, opts: {
  system: string; content: Anthropic.Beta.BetaContentBlockParam[]; schema: Record<string, unknown>;
  effort: "low" | "medium"; maxTokens?: number;
}) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: opts.effort, format: { type: "json_schema", schema: opts.schema } },
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
  });
  if (response.stop_reason === "refusal") throw new Error("refused");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("empty");
  return JSON.parse(text.text);
}

const typeList = (list: WType[]) => list.map((t) => `${t.id} — ${t.name} (${t.unit})`).join("\n");
const entrySchema = (list: WType[], withDate: boolean) => ({
  type: "object",
  properties: {
    ...(withDate ? { entry_date: { type: "string", description: "YYYY-MM-DD или пустая строка, если дату не прочитать" } } : {}),
    waste_type_id: { type: "string", enum: [...list.map((t) => t.id), "new", "unknown"] },
    new_type_name: { type: "string", description: "Название нового вида, только если waste_type_id = new, иначе пустая строка" },
    new_type_category: { type: "string", enum: [...CATEGORIES, "none"] },
    quantity: { type: "number", description: "Количество в единицах вида; 0, если не указано" },
    reason: { type: "string", enum: [...REASONS, "none"] },
  },
  required: [...(withDate ? ["entry_date"] : []), "waste_type_id", "new_type_name", "new_type_category", "quantity", "reason"],
  additionalProperties: false,
});

function normEntry(e: Record<string, unknown>) {
  const id = String(e.waste_type_id ?? "unknown");
  const qty = Number(e.quantity);
  const name = String(e.new_type_name ?? "").trim();
  return {
    ...(e.entry_date !== undefined ? { entry_date: /^\d{4}-\d{2}-\d{2}$/.test(String(e.entry_date)) ? String(e.entry_date) : null } : {}),
    waste_type_id: id === "new" || id === "unknown" ? null : id,
    new_type_name: id === "new" && name ? name.slice(0, 80) : null,
    new_type_category: CATEGORIES.includes(e.new_type_category as never) ? e.new_type_category : null,
    quantity: Number.isFinite(qty) && qty > 0 && qty <= 500 ? Math.round(qty * 100) / 100 : null,
    reason: REASONS.includes(e.reason as never) ? e.reason : null,
  };
}

const RULES =
  "Ты помогаешь сотрудникам столовых, кофейни, гостиницы и учебных лабораторий университета АТУ (Алматы) учитывать пищевые отходы. " +
  "Выбирай вид отхода только из списка организации. Новый вид (new) предлагай, только если отход явно есть, а подходящего вида в списке нет. " +
  "Причины: overproduction — приготовили больше, чем продали; expired — истёк срок; spoilage — порча; plate — остатки с тарелок; trimmings — очистки и обрезки при готовке.";
const NO_GUESS = " Никогда не выдумывай вес: если его не видно и не сказано, ставь 0.";

async function recognize(client: Anthropic, body: Record<string, unknown>) {
  const img = imageBlock(body.image);
  const list = cleanTypes(body.types);
  if (!img || !list.length) return json({ error: "bad_request" }, 400);
  const out = await ask(client, {
    effort: "low", maxTokens: 1024,
    system: RULES + " По фото контейнера, бака или подноса определи вид отхода. Если отходов на фото нет — unknown. note_ru — одна короткая фраза, что видно на фото. " +
      "Также оцени ПРИМЕРНЫЙ вес отходов на фото в единицах вида (кг или л) — по размеру и заполненности посуды, бака, ведра, пакета или подноса и типичной плотности продукта. " +
      "Ориентиры: полное ведро 10 л с очистками ≈ 4–5 кг; гастроёмкость GN 1/1 с остатками еды ≈ 3–6 кг; тарелка с недоеденным гарниром ≈ 0,2–0,3 кг; буханка хлеба ≈ 0,5 кг; стакан кофейного жмыха ≈ 0,1 кг. " +
      "Округляй до 0,1. Если оценить нельзя — 0. estimate_basis_ru — коротко, из чего получена оценка (например «полведра 10 л очисток»).",
    content: [img, { type: "text", text: "Виды отходов организации:\n" + typeList(list) }],
    schema: {
      type: "object",
      properties: {
        ...(entrySchema(list, false).properties as Record<string, unknown>),
        quantity: { type: "number", description: "Примерный вес (кг) или объём (л) отходов на фото; 0, если оценить нельзя" },
        estimate_basis_ru: { type: "string" },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        note_ru: { type: "string" },
      },
      required: ["waste_type_id", "new_type_name", "new_type_category", "quantity", "estimate_basis_ru", "reason", "confidence", "note_ru"],
      additionalProperties: false,
    },
  });
  const e = normEntry(out);
  return json({ ...e, quantity: undefined, quantity_estimate: e.quantity, estimate_basis_ru: e.quantity ? String(out.estimate_basis_ru ?? "") : "", confidence: out.confidence, note_ru: out.note_ru });
}

async function parseEntries(client: Anthropic, body: Record<string, unknown>, journal: boolean) {
  const list = cleanTypes(body.types);
  if (!list.length) return json({ error: "bad_request" }, 400);
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (journal) {
    const img = imageBlock(body.image);
    if (!img) return json({ error: "bad_image" }, 400);
    content.push(img);
  } else {
    const text = String(body.text ?? "").trim().slice(0, 1000);
    if (!text) return json({ error: "empty_text" }, 400);
    content.push({ type: "text", text: "Фраза сотрудника:\n" + text });
  }
  content.push({ type: "text", text: "Виды отходов организации:\n" + typeList(list) + (journal ? `\nТекущий год: ${new Date().getFullYear()}.` : "") });
  const out = await ask(client, {
    effort: "low",
    system: RULES + NO_GUESS + (journal
      ? " На фото — заполненный от руки или напечатанный журнал учёта пищевых отходов (дата, наименование, вес/объём, способ утилизации). Перепиши каждую строку журнала в отдельную запись. Итоговые строки («итого», «всего») пропускай. Даты переводи в YYYY-MM-DD."
      : " Разбери фразу (русский или казахский, возможно с ошибками распознавания речи) на отдельные записи: вид отхода и количество. «келі» — килограмм, «литр» — литр."),
    content,
    schema: {
      type: "object",
      properties: { entries: { type: "array", items: entrySchema(list, journal) }, note_ru: { type: "string" } },
      required: ["entries", "note_ru"],
      additionalProperties: false,
    },
  });
  const entries = (Array.isArray(out.entries) ? out.entries : []).slice(0, 60).map(normEntry);
  return json({ entries, note_ru: out.note_ru });
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const r1 = (n: number) => Math.round(n * 10) / 10;

async function review(client: Anthropic, db: SupabaseClient, body: Record<string, unknown>) {
  const id = String(body.report_id ?? "");
  const { data: rep, error } = await db.from("reports").select("*").eq("id", id).maybeSingle();
  if (error || !rep) return json({ error: "not_found" }, 404);
  const from = new Date(rep.period_start + "T00:00:00Z"); from.setUTCMonth(from.getUTCMonth() - 3);
  const [{ data: org }, { data: entries }, { data: types }, { data: hist }] = await Promise.all([
    db.from("organizations").select("name_ru,type").eq("id", rep.org_id).maybeSingle(),
    db.from("entries").select("entry_date,waste_type_id,quantity,created_at,has_photo,source,qty_estimated").eq("report_id", id).limit(3000),
    db.from("waste_types").select("id,name_ru,unit"),
    db.from("registry").select("waste_type_id,quantity,entry_date").eq("org_id", rep.org_id)
      .gte("entry_date", ymd(from)).lt("entry_date", rep.period_start).limit(5000),
  ]);
  const list = entries ?? [];
  const names = new Map((types ?? []).map((t) => [t.id, `${t.name_ru} (${t.unit === "l" ? "л" : "кг"})`]));
  // Статистика для ИИ: те же признаки, что у индекса достоверности.
  const n = list.length;
  const late = list.filter((e) => new Date(e.created_at).getTime() - new Date(e.entry_date + "T00:00:00Z").getTime() > 3 * 86400000).length;
  const round = list.filter((e) => Number(e.quantity) % 1 === 0).length;
  const times = list.map((e) => new Date(e.created_at).getTime()).sort((a, b) => a - b);
  let burst = 0;
  for (let i = 0, j = 0; i < times.length; i++) { while (times[i] - times[j] > 3600000) j++; burst = Math.max(burst, i - j + 1); }
  const days = new Set(list.map((e) => e.entry_date));
  const last = rep.period_end < ymd(new Date()) ? rep.period_end : ymd(new Date(Date.now() - 86400000));
  const missing: string[] = [];
  if (org?.type !== "lab") {
    for (let d = new Date(rep.period_start + "T00:00:00Z"); ymd(d) <= last; d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6 && !days.has(ymd(d))) missing.push(ymd(d).slice(5));
    }
  }
  const prevMean = new Map<string, number[]>();
  for (const h of hist ?? []) prevMean.set(h.waste_type_id, [...(prevMean.get(h.waste_type_id) ?? []), Number(h.quantity)]);
  const byType = new Map<string, number[]>();
  for (const e of list) byType.set(e.waste_type_id, [...(byType.get(e.waste_type_id) ?? []), Number(e.quantity)]);
  const typeLines = [...byType].map(([t, q]) => {
    const prev = prevMean.get(t);
    const mean = q.reduce((a, b) => a + b, 0) / q.length;
    const pm = prev ? prev.reduce((a, b) => a + b, 0) / prev.length : null;
    const freq = new Map<number, number>(); q.forEach((x) => freq.set(x, (freq.get(x) ?? 0) + 1));
    return `- ${names.get(t) ?? t}: записей ${q.length}, сумма ${r1(q.reduce((a, b) => a + b, 0))}, в среднем ${r1(mean)} за взвешивание` +
      (pm ? `, обычно ${r1(pm)} (${pm ? Math.round(((mean - pm) / pm) * 100) : 0}%)` : ", истории нет") +
      `, самое частое значение повторяется ${Math.max(...freq.values())} раз`;
  });
  const stats = [
    `Организация: ${org?.name_ru ?? "—"} (${org?.type ?? "—"}). Период: ${rep.period_start} — ${rep.period_end}. Статус: ${rep.status}.`,
    `Индекс достоверности (0–100, автоматический): ${rep.trust_score ?? "не рассчитан"}.`,
    `Записей: ${n}. Внесено позже чем через 3 дня после взвешивания: ${n ? Math.round((late / n) * 100) : 0}%.`,
    `Больше всего записей внесено в течение одного часа: ${burst}. Целых (круглых) значений: ${n ? Math.round((round / n) * 100) : 0}%.`,
    `Записей с фото: ${list.filter((e) => e.has_photo).length}; с электронных весов: ${list.filter((e) => e.source === "scale").length}; вес оценён ИИ по фото без взвешивания: ${list.filter((e) => e.qty_estimated).length}.`,
    org?.type === "lab" ? "Это учебная лаборатория: записи только в дни занятий, пропуски дней — норма." : `Рабочие дни без записей: ${missing.length ? missing.join(", ") : "нет"}.`,
    "По видам отходов:", ...typeLines,
  ].join("\n");
  const out = await ask(client, {
    effort: "low", maxTokens: 2500,
    system: "Ты помогаешь проверяющему (эколог, завхоз) решить, принять ли месячный отчёт об отходах точки питания университета. " +
      "Оцени, похоже ли, что журнал вели честно и каждый день: записи пачкой задним числом, круглые и повторяющиеся значения, пропуски рабочих дней, резкие отклонения от обычного — признаки, что журнал заполняли «на глаз». " +
      "Вес, оценённый ИИ по фото, — приблизительный: если таких записей много, посоветуй взвешивать на весах. " +
      "verdict: accept — замечаний нет или они мелкие; return — есть серьёзные признаки недостоверности, отчёт нужно вернуть; check — сомнительно, нужно посмотреть вручную. " +
      "Пиши простыми короткими фразами, без терминов. comment — вежливый конкретный комментарий для возврата ответственному (что исправить), даже если verdict = accept. Тексты на русском (ru) и казахском (kk).",
    content: [{ type: "text", text: stats }],
    schema: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["accept", "return", "check"] },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        summary_ru: { type: "string" }, summary_kk: { type: "string" },
        comment_ru: { type: "string" }, comment_kk: { type: "string" },
        points: {
          type: "array",
          items: {
            type: "object",
            properties: { ru: { type: "string" }, kk: { type: "string" }, tone: { type: "string", enum: ["good", "warn", "bad"] } },
            required: ["ru", "kk", "tone"], additionalProperties: false,
          },
        },
      },
      required: ["verdict", "confidence", "summary_ru", "summary_kk", "comment_ru", "comment_kk", "points"],
      additionalProperties: false,
    },
  });
  return json({ ...out, points: (out.points ?? []).slice(0, 5) });
}

async function insight(client: Anthropic, db: SupabaseClient, body: Record<string, unknown>) {
  const from = String(body.from ?? ""), to = String(body.to ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return json({ error: "bad_period" }, 400);
  const rows: Record<string, unknown>[] = [];
  for (let page = 0; page < 10; page++) {
    let q = db.from("registry")
      .select("entry_date,org_ru,waste_ru,category,mass_kg,cost_kzt,co2_kg,reason,diverts,recyclable")
      .gte("entry_date", from).lte("entry_date", to).order("id").range(page * 1000, page * 1000 + 999);
    if (typeof body.org_id === "string" && body.org_id) q = q.eq("org_id", body.org_id);
    const { data, error } = await q;
    if (error) return json({ error: "db" }, 500);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  if (!rows.length) return json({ headline_ru: "За выбранный период принятых данных нет.", headline_kk: "Таңдалған кезеңде қабылданған дерек жоқ.", findings: [], actions: [], generated_at: new Date().toISOString() });
  const sum = (f: (r: Record<string, unknown>) => number, filter?: (r: Record<string, unknown>) => boolean) =>
    r1(rows.filter(filter ?? (() => true)).reduce((s, r) => s + f(r), 0));
  const group = (key: (r: Record<string, unknown>) => string, filter?: (r: Record<string, unknown>) => boolean) => {
    const m = new Map<string, number>();
    for (const r of rows) if (!filter || filter(r)) m.set(key(r), (m.get(key(r)) ?? 0) + Number(r.mass_kg));
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}: ${r1(v)} кг`).join("; ");
  };
  const DOW = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const mass = sum((r) => Number(r.mass_kg));
  const avoid = sum((r) => Number(r.mass_kg), (r) => r.category === "avoidable");
  const stats = [
    `Период: ${from} — ${to}. Взвешиваний: ${rows.length}.`,
    `Всего отходов: ${mass} кг; предотвратимых: ${avoid} кг (${mass ? Math.round((avoid / mass) * 100) : 0}%).`,
    `Оценка потерь: ${Math.round(sum((r) => Number(r.cost_kzt)))} тенге (цены — допущения). CO2-экв.: ${sum((r) => Number(r.co2_kg))} кг.`,
    `Пригодно к переработке: ${sum((r) => Number(r.mass_kg), (r) => Boolean(r.recyclable))} кг; реально направлено на переработку/компост: ${sum((r) => Number(r.mass_kg), (r) => Boolean(r.diverts))} кг.`,
    `По месяцам: ${group((r) => String(r.entry_date).slice(0, 7))}.`,
    `По организациям: ${group((r) => String(r.org_ru))}.`,
    `Главные виды отходов: ${group((r) => String(r.waste_ru))}.`,
    `Предотвратимые по видам: ${group((r) => String(r.waste_ru), (r) => r.category === "avoidable")}.`,
    `Предотвратимые по причинам: ${group((r) => String(r.reason ?? "не указана"), (r) => r.category === "avoidable")}.`,
    `Предотвратимые по дням недели (сумма): ${group((r) => DOW[new Date(String(r.entry_date) + "T00:00:00Z").getUTCDay()], (r) => r.category === "avoidable")}.`,
  ].join("\n");
  const out = await ask(client, {
    effort: "low", maxTokens: 2500,
    system: "Ты — аналитик по пищевым отходам для руководства университета АТУ. По сводке данных напиши: headline — один главный вывод одной фразой с цифрой; findings — 2–4 конкретных наблюдения с цифрами (рост, лидеры, закономерности по дням недели, переработка); actions — 1–3 практических шага на ближайшую неделю (сначала сокращение отходов, затем переработка — по иерархии Экологического кодекса РК). " +
      "Опирайся только на цифры из сводки, ничего не выдумывай. Коротко, простыми словами, без терминов. Каждый текст на русском (ru) и казахском (kk).",
    content: [{ type: "text", text: stats }],
    schema: {
      type: "object",
      properties: {
        headline_ru: { type: "string" }, headline_kk: { type: "string" },
        findings: { type: "array", items: { type: "object", properties: { ru: { type: "string" }, kk: { type: "string" } }, required: ["ru", "kk"], additionalProperties: false } },
        actions: { type: "array", items: { type: "object", properties: { ru: { type: "string" }, kk: { type: "string" } }, required: ["ru", "kk"], additionalProperties: false } },
      },
      required: ["headline_ru", "headline_kk", "findings", "actions"],
      additionalProperties: false,
    },
  });
  return json({ ...out, findings: (out.findings ?? []).slice(0, 4), actions: (out.actions ?? []).slice(0, 3), generated_at: new Date().toISOString() });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const key = apiKey();
  if (!key) return json({ error: "not_configured" }, 503);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const client = new Anthropic({ apiKey: key });
  const mode = body.mode as Mode;
  try {
    switch (mode) {
      case "recognize": return await recognize(client, body);
      case "parse_text": return await parseEntries(client, body, false);
      case "parse_journal": return await parseEntries(client, body, true);
      case "review": return await review(client, db, body);
      case "insight": return await insight(client, db, body);
      default: return json({ error: "unknown_mode" }, 400);
    }
  } catch (e) {
    console.error("ai failed:", mode, e);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "rate_limited" }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: "api_error", status: e.status }, 502);
    if (e instanceof Error && e.message === "refused") return json({ error: "refused" }, 422);
    return json({ error: "internal" }, 500);
  }
});
