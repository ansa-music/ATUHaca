-- Qadir — автоматизации: уведомления, автопроверка отчёта, напоминания и расписание.
-- Порядок запуска: 001_schema.sql → 002_seed.sql → 003_automations.sql.
-- Файл можно запускать повторно. Для сброса демо достаточно снова выполнить 002_seed.sql.

set search_path = public, extensions;
create extension if not exists pg_cron;

-- ---------- Таблицы ----------

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  title_ru text not null,
  title_kk text not null,
  body_ru text,
  body_kk text,
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.automation_runs (
  id bigint generated always as identity primary key,
  job text not null,
  forced boolean not null default false,
  created integer not null default 0,
  details text,
  ran_at timestamptz not null default now()
);

alter table public.reports add column if not exists trust_score integer;

alter table public.notifications enable row level security;
alter table public.automation_runs enable row level security;

drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists runs_read on public.automation_runs;
create policy runs_read on public.automation_runs for select to authenticated using (public.is_staff());

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null; end $$;

-- ---------- Вспомогательные функции ----------

create or replace function public._almaty_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Almaty')::date $$;

create or replace function public._is_seeding() returns boolean
language sql stable as $$ select coalesce(current_setting('qadir.seeding', true), '') = 'on' $$;

create or replace function public._month_name(p date, p_lang text) returns text
language sql immutable as $$
  select case when p_lang = 'kk'
    then (array['қаңтар','ақпан','наурыз','сәуір','мамыр','маусым','шілде','тамыз','қыркүйек','қазан','қараша','желтоқсан'])[extract(month from p)::int]
    else (array['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'])[extract(month from p)::int]
  end || ' ' || extract(year from p)::int
$$;

-- Число в русском формате: 1 234,5
create or replace function public._fmt(p numeric, p_digits int default 0) returns text
language sql immutable as $$
  select replace(replace(to_char(round(p, p_digits),
    case when p_digits > 0 then 'FM999G999G990D0' else 'FM999G999G990' end), ',', ' '), '.', ',')
$$;

create or replace function public._users_by_role(p_roles public.user_role[]) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role = any(p_roles)
$$;

create or replace function public._org_users(p_org uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.profiles where org_id = p_org and role = 'responsible'
$$;

create or replace function public._notify_users(p_users uuid[], p_kind text, p_title_ru text, p_title_kk text,
  p_body_ru text, p_body_kk text, p_link text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_users is null or cardinality(p_users) = 0 then return 0; end if;
  insert into public.notifications (user_id, kind, title_ru, title_kk, body_ru, body_kk, link)
  select u, p_kind, p_title_ru, p_title_kk, p_body_ru, p_body_kk, p_link from unnest(p_users) u;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public._log_run(p_job text, p_forced boolean, p_created int, p_details text) returns void
language sql security definer set search_path = public as $$
  insert into public.automation_runs (job, forced, created, details) values (p_job, p_forced, p_created, p_details)
$$;

-- ---------- Автопроверка: индекс достоверности на сервере ----------
-- Та же методика, что в карточке проверяющего (src/lib/trust.ts): записи задним числом и пачкой,
-- круглые и повторяющиеся значения, пропущенные рабочие дни, выбросы к среднему за 3 месяца.

create or replace function public.report_trust(p_report uuid) returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  r public.reports; v_type text; n int; v_late int; v_round int; v_burst int; v_missing int := 0; v_out int;
  v_repeat numeric; pen numeric := 0;
begin
  select * into r from public.reports where id = p_report;
  if r.id is null then return null; end if;
  select type into v_type from public.organizations where id = r.org_id;

  select count(*),
         count(*) filter (where e.created_at - e.entry_date::timestamptz > interval '3 days'),
         count(*) filter (where e.quantity % 1 = 0)
    into n, v_late, v_round
  from public.entries e where e.report_id = p_report;
  if n = 0 then return 0; end if;

  select coalesce(max(c), 0) into v_burst from (
    select (select count(*) from public.entries e2
            where e2.report_id = p_report and e2.created_at >= e1.created_at
              and e2.created_at <= e1.created_at + interval '1 hour') as c
    from public.entries e1 where e1.report_id = p_report) s;

  if v_late::numeric / n > 0.3 then
    pen := pen + round(least(35, v_late::numeric / n * 35 + case when v_burst::numeric / n > 0.5 then 10 else 0 end));
  end if;
  if n >= 8 and v_round::numeric / n > 0.5 then
    pen := pen + round(least(20, (v_round::numeric / n - 0.3) * 30));
  end if;

  select avg(share) into v_repeat from (
    select max(cnt)::numeric / sum(cnt) as share
    from (select waste_type_id, quantity, count(*) as cnt from public.entries
          where report_id = p_report group by waste_type_id, quantity) q
    group by waste_type_id having sum(cnt) >= 4) s;
  if coalesce(v_repeat, 0) > 0.5 then pen := pen + round(least(20, (v_repeat - 0.3) * 30)); end if;

  if v_type <> 'lab' then
    select count(*) into v_missing
    from generate_series(r.period_start, least(r.period_end, public._almaty_today() - 1), interval '1 day') d
    where extract(isodow from d) < 6
      and not exists (select 1 from public.entries e where e.report_id = p_report and e.entry_date = d::date);
    pen := pen + least(15, v_missing * 3);
  end if;

  select count(*) into v_out
  from public.entries e
  join (select waste_type_id, avg(quantity) as m from public.registry
        where org_id = r.org_id and entry_date >= (r.period_start - interval '3 months')::date and entry_date < r.period_start
        group by waste_type_id) h on h.waste_type_id = e.waste_type_id
  where e.report_id = p_report and (e.quantity > h.m * 2.5 or e.quantity < h.m * 0.25);
  pen := pen + least(10, v_out * 2);

  return greatest(0, 100 - pen)::int;
end $$;

-- ---------- Событийные автоматизации ----------

-- Смена статуса отчёта → автопроверка и уведомления участникам.
create or replace function public.on_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r public.reports; o public.organizations; v_score int; v_m_ru text; v_m_kk text; v_month text; v_all boolean;
begin
  if public._is_seeding() then return new; end if;
  select * into r from public.reports where id = new.report_id;
  select * into o from public.organizations where id = r.org_id;
  v_m_ru := public._month_name(r.period_start, 'ru');
  v_m_kk := public._month_name(r.period_start, 'kk');
  v_month := to_char(r.period_start, 'YYYY-MM');

  if new.to_status = 'submitted' then
    v_score := public.report_trust(r.id);
    update public.reports set trust_score = v_score where id = r.id;
    perform public._notify_users(public._users_by_role(array['reviewer']::public.user_role[]), 'report_submitted',
      'Новый отчёт на проверку: ' || o.name_ru,
      'Тексеруге жаңа есеп: ' || o.name_kk,
      'Отчёт за ' || v_m_ru || '. Автопроверка: индекс достоверности ' || v_score
        || case when v_score < 55 then ' — проверьте внимательно.' else '.' end,
      v_m_kk || ' есебі. Автотексеру: сенімділік индексі ' || v_score
        || case when v_score < 55 then ' — мұқият тексеріңіз.' else '.' end,
      '/review/' || r.id);

  elsif new.to_status = 'returned' then
    perform public._notify_users(public._org_users(r.org_id), 'report_returned',
      'Отчёт за ' || v_m_ru || ' возвращён на доработку',
      v_m_kk || ' есебі пысықтауға қайтарылды',
      '«' || coalesce(new.comment, '') || '»', '«' || coalesce(new.comment, '') || '»',
      '/entry?month=' || v_month);

  elsif new.to_status = 'accepted' then
    perform public._notify_users(public._org_users(r.org_id), 'report_accepted',
      'Отчёт за ' || v_m_ru || ' принят', v_m_kk || ' есебі қабылданды',
      'Данные попали в единый реестр.', 'Деректер бірыңғай тізілімге түсті.', '/reports');
    -- Последняя организация сдала месяц → свод готов.
    select not exists (
      select 1 from public.organizations x
      where x.is_active and not x.is_demo
        and not exists (select 1 from public.reports y
                        where y.org_id = x.id and y.period_start = r.period_start
                          and (y.status = 'accepted' or y.id = r.id)))
      into v_all;
    if v_all and not o.is_demo then
      perform public._notify_users(public._users_by_role(array['management', 'admin', 'reviewer']::public.user_role[]),
        'month_complete',
        'Все организации сдали отчёт за ' || v_m_ru, 'Барлық ұйымдар ' || v_m_kk || ' есебін тапсырды',
        'Сводный отчёт готов к выгрузке.', 'Жиынтық есепті жүктеуге болады.', '/summary');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists status_notify on public.status_history;
create trigger status_notify after insert on public.status_history
  for each row execute function public.on_status_change();

-- Новая запись с нетипичным весом → сразу просим перепроверить.
create or replace function public.on_entry_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_mean numeric; v_n int; o public.organizations; w public.waste_types; v_unit text; v_x text;
begin
  if public._is_seeding() then return new; end if;
  select avg(quantity), count(*) into v_mean, v_n from public.registry
  where org_id = new.org_id and waste_type_id = new.waste_type_id and entry_date >= new.entry_date - 90;
  if v_n >= 5 and v_mean > 0 and new.quantity > v_mean * 2.5 then
    select * into o from public.organizations where id = new.org_id;
    select * into w from public.waste_types where id = new.waste_type_id;
    v_unit := case w.unit when 'l' then ' л' else ' кг' end;
    v_x := public._fmt(new.quantity / v_mean, 1);
    perform public._notify_users(public._org_users(new.org_id), 'anomaly_self',
      'Проверьте запись: ' || w.name_ru, 'Жазбаны тексеріңіз: ' || w.name_kk,
      public._fmt(new.quantity, 1) || v_unit || ' — в ' || v_x || ' раза больше обычного (' || public._fmt(v_mean, 1) || v_unit || '). Если это ошибка, исправьте запись.',
      public._fmt(new.quantity, 1) || v_unit || ' — әдеттегіден ' || v_x || ' есе көп (' || public._fmt(v_mean, 1) || v_unit || '). Қате болса, жазбаны түзетіңіз.',
      '/entry');
    perform public._notify_users(public._users_by_role(array['reviewer']::public.user_role[]), 'anomaly',
      'Нетипичный вес: ' || o.name_ru, 'Әдеттен тыс салмақ: ' || o.name_kk,
      w.name_ru || ': ' || public._fmt(new.quantity, 1) || v_unit || ' при обычных ' || public._fmt(v_mean, 1) || v_unit || ' (×' || v_x || ').',
      w.name_kk || ': ' || public._fmt(new.quantity, 1) || v_unit || ', әдетте ' || public._fmt(v_mean, 1) || v_unit || ' (×' || v_x || ').',
      '/review');
  end if;
  return new;
end $$;

drop trigger if exists entries_anomaly on public.entries;
create trigger entries_anomaly after insert on public.entries
  for each row execute function public.on_entry_insert();

-- ---------- Автоматизации по расписанию ----------

-- 1. Каждый день в 00:05 (Алматы): открыть отчёты нового месяца для всех организаций.
create or replace function public.auto_open_month(p_force boolean default false) returns integer
language plpgsql security definer set search_path = public as $$
declare v_start date := date_trunc('month', public._almaty_today())::date; o record; r public.reports; n int := 0;
begin
  for o in select * from public.organizations where is_active and not is_demo loop
    if not exists (select 1 from public.reports where org_id = o.id and period_start = v_start) then
      insert into public.reports (org_id, period_start, period_end)
      values (o.id, v_start, (v_start + interval '1 month - 1 day')::date) returning * into r;
      insert into public.status_history (report_id, from_status, to_status, comment)
      values (r.id, null, 'draft', 'Создан автоматически');
      perform public._notify_users(public._org_users(o.id), 'month_opened',
        'Открыт отчёт за ' || public._month_name(v_start, 'ru'), public._month_name(v_start, 'kk') || ' есебі ашылды',
        'Вносите взвешивания каждый день — итоги посчитаются сами.', 'Өлшеулерді күн сайын енгізіңіз — қорытынды өзі есептеледі.',
        '/entry');
      n := n + 1;
    end if;
  end loop;
  perform public._log_run('open_month', p_force, n,
    case when n = 0 then 'Отчёты за ' || public._month_name(v_start, 'ru') || ' уже открыты у всех' else 'Открыто отчётов: ' || n end);
  return n;
end $$;

-- 2. Каждый день в 18:00: напомнить, если за сегодня нет записей; сообщить о долгой проверке.
create or replace function public.auto_daily_reminder(p_force boolean default false) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_today date := public._almaty_today(); v_dow int := extract(isodow from public._almaty_today());
  v_start date := date_trunc('month', public._almaty_today())::date; o record; s record; n int := 0; v_orgs int := 0;
begin
  if v_dow = 7 and not p_force then
    perform public._log_run('daily_reminder', p_force, 0, 'Воскресенье — напоминаний нет');
    return 0;
  end if;
  for o in
    select x.* from public.organizations x
    where x.is_active and not x.is_demo and x.type <> 'lab'
      and (v_dow < 6 or x.type in ('hotel', 'cafe') or p_force)
      and not exists (select 1 from public.entries e where e.org_id = x.id and e.entry_date = v_today)
      and not exists (select 1 from public.reports y where y.org_id = x.id and y.period_start = v_start
                      and y.status not in ('draft', 'returned'))
  loop
    n := n + public._notify_users(public._org_users(o.id), 'daily_reminder',
      'Сегодня ещё нет взвешиваний', 'Бүгін әлі өлшеу жоқ',
      'Внесите отходы за ' || to_char(v_today, 'DD.MM') || ', пока данные свежие: запись занимает несколько секунд.',
      to_char(v_today, 'DD.MM') || ' қалдықтарын енгізіңіз: жазба бірнеше секунд алады.',
      '/entry');
    v_orgs := v_orgs + 1;
  end loop;
  for s in
    select r.id, r.period_start, x.name_ru, x.name_kk from public.reports r join public.organizations x on x.id = r.org_id
    where r.status in ('submitted', 'in_review') and r.submitted_at < now() - interval '2 days'
  loop
    n := n + public._notify_users(public._users_by_role(array['reviewer']::public.user_role[]), 'review_overdue',
      'Отчёт ждёт проверки больше 2 дней', 'Есеп 2 күннен артық тексеруді күтуде',
      s.name_ru || ', ' || public._month_name(s.period_start, 'ru'), s.name_kk || ', ' || public._month_name(s.period_start, 'kk'),
      '/review/' || s.id);
  end loop;
  perform public._log_run('daily_reminder', p_force, n, 'Организаций без записей за сегодня: ' || v_orgs);
  return n;
end $$;

-- 3. 3, 5 и 6 числа в 10:00: срок сдачи отчёта за прошлый месяц (5 число); 6 числа — эскалация руководству.
create or replace function public.auto_deadline_reminder(p_force boolean default false) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_today date := public._almaty_today(); v_day int := extract(day from public._almaty_today());
  v_prev date := (date_trunc('month', public._almaty_today()) - interval '1 month')::date;
  o record; n int := 0; v_ru text; v_kk text; v_status public.report_status;
begin
  if v_day not in (3, 5, 6) and not p_force then
    perform public._log_run('deadline_reminder', p_force, 0, 'Не день напоминаний (3, 5 и 6 числа)');
    return 0;
  end if;
  for o in
    select x.* from public.organizations x
    where x.is_active and not x.is_demo
      and not exists (select 1 from public.reports y where y.org_id = x.id and y.period_start = v_prev
                      and y.status in ('submitted', 'in_review', 'accepted'))
  loop
    select status into v_status from public.reports where org_id = o.id and period_start = v_prev;
    n := n + public._notify_users(public._org_users(o.id), 'deadline',
      'Срок сдачи отчёта за ' || public._month_name(v_prev, 'ru') || ' — 5 число',
      public._month_name(v_prev, 'kk') || ' есебін тапсыру мерзімі — 5-і',
      case when v_status = 'returned' then 'Отчёт возвращён на доработку: исправьте записи и отправьте повторно.'
           else 'Проверьте записи и отправьте отчёт на проверку одним нажатием.' end,
      case when v_status = 'returned' then 'Есеп пысықтауға қайтарылды: жазбаларды түзетіп, қайта жіберіңіз.'
           else 'Жазбаларды тексеріп, есепті бір басумен тексеруге жіберіңіз.' end,
      '/entry?month=' || to_char(v_prev, 'YYYY-MM'));
  end loop;
  select string_agg(x.name_ru, '; ' order by x.name_ru), string_agg(x.name_kk, '; ' order by x.name_ru) into v_ru, v_kk
  from public.organizations x
  where x.is_active and not x.is_demo
    and not exists (select 1 from public.reports y where y.org_id = x.id and y.period_start = v_prev
                    and y.status in ('submitted', 'in_review', 'accepted'));
  if v_ru is not null then
    n := n + public._notify_users(
      public._users_by_role(case when v_day >= 6 or p_force
        then array['reviewer', 'management', 'admin']::public.user_role[]
        else array['reviewer']::public.user_role[] end),
      'not_submitted',
      'Не сдали отчёт за ' || public._month_name(v_prev, 'ru'), public._month_name(v_prev, 'kk') || ' есебін тапсырмағандар',
      v_ru, v_kk, '/summary');
  end if;
  perform public._log_run('deadline_reminder', p_force, n, coalesce('Не сдали: ' || v_ru, 'Все организации сдали отчёт'));
  return n;
end $$;

-- 4. Каждые 15 минут: снять с продажи истёкшие и распроданные «Спасённые порции».
create or replace function public.auto_close_offers(p_force boolean default false) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.surplus_offers set is_active = false
  where is_active and (available_until < now() or sold >= portions);
  get diagnostics n = row_count;
  if n > 0 or p_force then perform public._log_run('close_offers', p_force, n, 'Снято с продажи: ' || n); end if;
  return n;
end $$;

-- 5. По понедельникам в 09:00: недельная сводка руководству по оперативным данным.
create or replace function public.auto_weekly_digest(p_force boolean default false) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_today date := public._almaty_today(); v_from date := public._almaty_today() - 7;
  v_mass numeric; v_avoid numeric; v_cost numeric; v_prev numeric; v_top_ru text; v_top_kk text;
  v_delta_ru text := ''; v_delta_kk text := ''; n int;
begin
  if extract(isodow from v_today) <> 1 and not p_force then
    perform public._log_run('weekly_digest', p_force, 0, 'Сводка отправляется по понедельникам');
    return 0;
  end if;
  select coalesce(sum(e.quantity * w.kg_per_unit), 0),
         coalesce(sum(e.quantity * w.kg_per_unit) filter (where w.category = 'avoidable'), 0),
         coalesce(sum(e.quantity * w.cost_per_unit), 0)
    into v_mass, v_avoid, v_cost
  from public.entries e
  join public.waste_types w on w.id = e.waste_type_id
  join public.organizations o on o.id = e.org_id and not o.is_demo
  where e.entry_date >= v_from and e.entry_date < v_today;
  select coalesce(sum(e.quantity * w.kg_per_unit), 0) into v_prev
  from public.entries e
  join public.waste_types w on w.id = e.waste_type_id
  join public.organizations o on o.id = e.org_id and not o.is_demo
  where e.entry_date >= v_from - 7 and e.entry_date < v_from;
  select o.name_ru, o.name_kk into v_top_ru, v_top_kk
  from public.entries e
  join public.waste_types w on w.id = e.waste_type_id and w.category = 'avoidable'
  join public.organizations o on o.id = e.org_id and not o.is_demo
  where e.entry_date >= v_from and e.entry_date < v_today
  group by o.id, o.name_ru, o.name_kk order by sum(e.quantity * w.kg_per_unit) desc limit 1;
  if v_prev > 0 then
    v_delta_ru := ' (' || case when v_mass >= v_prev then '+' else '−' end || public._fmt(abs(v_mass - v_prev) / v_prev * 100) || '% к прошлой неделе)';
    v_delta_kk := ' (өткен аптамен салыстырғанда ' || case when v_mass >= v_prev then '+' else '−' end || public._fmt(abs(v_mass - v_prev) / v_prev * 100) || '%)';
  end if;
  n := public._notify_users(public._users_by_role(array['management', 'admin']::public.user_role[]), 'weekly_digest',
    'Сводка за неделю: ' || public._fmt(v_mass) || ' кг отходов', 'Апта қорытындысы: ' || public._fmt(v_mass) || ' кг қалдық',
    'Отходов ' || public._fmt(v_mass) || ' кг' || v_delta_ru || ', предотвратимых '
      || public._fmt(case when v_mass > 0 then v_avoid / v_mass * 100 else 0 end) || '%, потери ≈ ' || public._fmt(v_cost) || ' ₸.'
      || coalesce(' Больше всего предотвратимых отходов — ' || v_top_ru || '.', '') || ' По оперативным данным, включая ещё не принятые отчёты.',
    'Қалдық ' || public._fmt(v_mass) || ' кг' || v_delta_kk || ', алдын алуға болатыны '
      || public._fmt(case when v_mass > 0 then v_avoid / v_mass * 100 else 0 end) || '%, шығын ≈ ' || public._fmt(v_cost) || ' ₸.'
      || coalesce(' Алдын алуға болатын қалдық ең көп — ' || v_top_kk || '.', '') || ' Жедел деректер бойынша.',
    '/dashboard');
  perform public._log_run('weekly_digest', p_force, n, 'За ' || to_char(v_from, 'DD.MM') || '–' || to_char(v_today - 1, 'DD.MM') || ': ' || public._fmt(v_mass) || ' кг');
  return n;
end $$;

-- Ручной запуск любой автоматизации из админки (для демонстрации и проверки).
create or replace function public.run_automation(p_job text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if public.my_role() is distinct from 'admin' then raise exception 'Доступно только администратору'; end if;
  n := case p_job
    when 'open_month' then public.auto_open_month(true)
    when 'daily_reminder' then public.auto_daily_reminder(true)
    when 'deadline_reminder' then public.auto_deadline_reminder(true)
    when 'close_offers' then public.auto_close_offers(true)
    when 'weekly_digest' then public.auto_weekly_digest(true)
  end;
  if n is null then raise exception 'Неизвестная автоматизация: %', p_job; end if;
  return n;
end $$;

-- ---------- Права: внутренние функции недоступны через API ----------

revoke all on function
  public._almaty_today(), public._is_seeding(), public._month_name(date, text), public._fmt(numeric, int),
  public._users_by_role(public.user_role[]), public._org_users(uuid),
  public._notify_users(uuid[], text, text, text, text, text, text), public._log_run(text, boolean, int, text),
  public.report_trust(uuid), public.on_status_change(), public.on_entry_insert(),
  public.auto_open_month(boolean), public.auto_daily_reminder(boolean), public.auto_deadline_reminder(boolean),
  public.auto_close_offers(boolean), public.auto_weekly_digest(boolean)
from public, anon, authenticated;
revoke all on function public.run_automation(text) from public, anon;
grant execute on function public.run_automation(text) to authenticated;

-- ---------- Расписание (pg_cron работает по UTC; Алматы = UTC+5) ----------

select cron.schedule('qadir-open-month',      '5 19 * * *',   $$select public.auto_open_month()$$);
select cron.schedule('qadir-daily-reminder',  '0 13 * * *',   $$select public.auto_daily_reminder()$$);
select cron.schedule('qadir-deadline',        '0 5 * * *',    $$select public.auto_deadline_reminder()$$);
select cron.schedule('qadir-close-offers',    '*/15 * * * *', $$select public.auto_close_offers()$$);
select cron.schedule('qadir-weekly-digest',   '0 4 * * 1',    $$select public.auto_weekly_digest()$$);

-- Индекс достоверности для уже существующих отчётов.
update public.reports set trust_score = public.report_trust(id) where status <> 'draft';
