-- Qadir — схема базы, права доступа и серверная логика.
-- Запуск: Supabase → SQL Editor → вставить файл целиком → Run. Затем 002_seed.sql.
-- Файл можно запускать повторно: он пересоздаёт объекты Qadir.

create extension if not exists pgcrypto;
set search_path = public, extensions;

drop view if exists public.registry;
drop table if exists public.scale_readings, public.org_secrets, public.surplus_offers, public.daily_portions,
  public.entry_photos, public.status_history, public.entries, public.reports, public.waste_types,
  public.disposal_methods, public.profiles, public.organizations cascade;
drop type if exists public.user_role cascade;
drop type if exists public.report_status cascade;

create type public.user_role as enum ('responsible', 'reviewer', 'admin', 'management');
create type public.report_status as enum ('draft', 'submitted', 'in_review', 'accepted', 'returned');

-- ---------- Таблицы ----------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name_ru text not null,
  name_kk text not null,
  type text not null check (type in ('lab', 'canteen', 'cafe', 'hotel', 'other')),
  building text,
  is_active boolean not null default true,
  is_demo boolean not null default false,          -- «Демо-точка жюри»: не попадает в сводные отчёты
  created_at timestamptz not null default now()
);

create table public.org_secrets (                   -- токен электронных весов, виден только администратору
  org_id uuid primary key references public.organizations on delete cascade,
  scale_token text not null default encode(gen_random_bytes(12), 'hex')
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role public.user_role not null default 'responsible',
  org_id uuid references public.organizations,
  created_at timestamptz not null default now()
);

create table public.disposal_methods (
  id uuid primary key default gen_random_uuid(),
  name_ru text not null,
  name_kk text not null,
  diverts boolean not null default false,          -- уводит отход от захоронения (переработка, компост, корм)
  is_active boolean not null default true
);

create table public.waste_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations,     -- null = общий вид для всех организаций
  name_ru text not null,
  name_kk text not null,
  unit text not null default 'kg' check (unit in ('kg', 'l')),
  kg_per_unit numeric not null default 1,          -- для литров: плотность, чтобы считать массу
  default_disposal_id uuid references public.disposal_methods,
  recyclable boolean not null default false,
  category text not null default 'avoidable' check (category in ('avoidable', 'unavoidable', 'packaging')),
  co2_factor numeric not null default 0,           -- кг CO2-экв. на 1 кг
  cost_per_unit numeric not null default 0,        -- оценка потери, тенге за единицу (допущение)
  is_active boolean not null default true,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations,
  period_start date not null,
  period_end date not null,
  status public.report_status not null default 'draft',
  submitted_at timestamptz,
  reviewer_id uuid references auth.users,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, period_start)
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports on delete cascade,
  org_id uuid not null references public.organizations,
  entry_date date not null default current_date,
  waste_type_id uuid not null references public.waste_types,
  quantity numeric not null check (quantity > 0 and quantity <= 500),
  disposal_id uuid references public.disposal_methods,
  reason text check (reason in ('overproduction', 'expired', 'spoilage', 'plate', 'trimmings', 'other')),
  user_id uuid references auth.users default auth.uid(),
  has_photo boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'photo', 'scale')),
  created_at timestamptz not null default now()
);
create index entries_report_idx on public.entries (report_id);
create index entries_org_date_idx on public.entries (org_id, entry_date);

create table public.entry_photos (
  entry_id uuid primary key references public.entries on delete cascade,
  org_id uuid not null references public.organizations,
  data text not null                               -- сжатое фото (JPEG, data URL)
);

create table public.status_history (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports on delete cascade,
  from_status public.report_status,
  to_status public.report_status not null,
  user_id uuid references auth.users,
  comment text,
  created_at timestamptz not null default now()
);

create table public.daily_portions (
  org_id uuid not null references public.organizations,
  day date not null,
  portions integer not null check (portions >= 0),
  primary key (org_id, day)
);

create table public.surplus_offers (               -- «Спасённые порции»
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations,
  title text not null,
  portions integer not null check (portions > 0),
  price numeric not null check (price >= 0),
  old_price numeric not null check (old_price >= 0),
  available_until timestamptz not null,
  sold integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.scale_readings (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations,
  weight numeric not null check (weight > 0),
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Вспомогательные функции для прав ----------

create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.my_org() returns uuid
language sql stable security definer set search_path = public as
$$ select org_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('reviewer', 'admin', 'management') from public.profiles where id = auth.uid()), false) $$;

-- Новый пользователь Auth получает профиль. Роль и организацию назначает только администратор.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Проверка записи: дата не в будущем и внутри периода отчёта, организация совпадает с отчётом.
create or replace function public.check_entry() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.reports;
begin
  select * into r from public.reports where id = new.report_id;
  if r.id is null then raise exception 'Отчёт не найден'; end if;
  if new.org_id <> r.org_id then raise exception 'Запись не относится к организации отчёта'; end if;
  if new.entry_date > current_date then raise exception 'Дата не может быть в будущем'; end if;
  if new.entry_date < r.period_start or new.entry_date > r.period_end then
    raise exception 'Дата вне периода отчёта';
  end if;
  return new;
end $$;

create trigger entries_check before insert or update on public.entries
  for each row execute function public.check_entry();

-- Триггерные функции не должны вызываться через API напрямую.
revoke all on function public.check_entry(), public.handle_new_user() from public, anon, authenticated;

-- ---------- Workflow отчёта: только через эти функции ----------

create or replace function public.get_or_create_report(p_month date) returns public.reports
language plpgsql security definer set search_path = public as $$
declare r public.reports; v_org uuid := public.my_org(); v_start date := date_trunc('month', p_month)::date;
begin
  if public.my_role() <> 'responsible' or v_org is null then
    raise exception 'Доступно только ответственному лицу организации';
  end if;
  if v_start > current_date then raise exception 'Период ещё не начался'; end if;
  select * into r from public.reports where org_id = v_org and period_start = v_start;
  if r.id is null then
    insert into public.reports (org_id, period_start, period_end)
    values (v_org, v_start, (v_start + interval '1 month - 1 day')::date) returning * into r;
    insert into public.status_history (report_id, from_status, to_status, user_id, comment)
    values (r.id, null, 'draft', auth.uid(), 'Отчёт создан');
  end if;
  return r;
end $$;

create or replace function public.submit_report(p_report uuid) returns public.reports
language plpgsql security definer set search_path = public as $$
declare r public.reports;
begin
  select * into r from public.reports where id = p_report for update;
  if r.id is null then raise exception 'Отчёт не найден'; end if;
  if public.my_role() <> 'responsible' or r.org_id <> public.my_org() then
    raise exception 'Отправить отчёт может только ответственное лицо своей организации';
  end if;
  if r.status not in ('draft', 'returned') then raise exception 'Отчёт уже отправлен'; end if;
  if not exists (select 1 from public.entries where report_id = r.id) then
    raise exception 'В отчёте нет записей';
  end if;
  insert into public.status_history (report_id, from_status, to_status, user_id)
  values (r.id, r.status, 'submitted', auth.uid());
  update public.reports set status = 'submitted', submitted_at = now(), decided_at = null
  where id = r.id returning * into r;
  return r;
end $$;

create or replace function public.start_review(p_report uuid) returns public.reports
language plpgsql security definer set search_path = public as $$
declare r public.reports;
begin
  if public.my_role() <> 'reviewer' then raise exception 'Доступно только проверяющему'; end if;
  select * into r from public.reports where id = p_report for update;
  if r.status = 'submitted' then
    insert into public.status_history (report_id, from_status, to_status, user_id)
    values (r.id, r.status, 'in_review', auth.uid());
    update public.reports set status = 'in_review', reviewer_id = auth.uid() where id = r.id returning * into r;
  end if;
  return r;
end $$;

create or replace function public.decide_report(p_report uuid, p_accept boolean, p_comment text default null)
returns public.reports
language plpgsql security definer set search_path = public as $$
declare r public.reports; v_to public.report_status;
begin
  if public.my_role() <> 'reviewer' then raise exception 'Доступно только проверяющему'; end if;
  select * into r from public.reports where id = p_report for update;
  if r.id is null then raise exception 'Отчёт не найден'; end if;
  if r.status not in ('submitted', 'in_review') then raise exception 'Отчёт не находится на проверке'; end if;
  if not p_accept and coalesce(trim(p_comment), '') = '' then
    raise exception 'При возврате комментарий обязателен';
  end if;
  v_to := case when p_accept then 'accepted' else 'returned' end;
  insert into public.status_history (report_id, from_status, to_status, user_id, comment)
  values (r.id, r.status, v_to, auth.uid(), nullif(trim(coalesce(p_comment, '')), ''));
  update public.reports set status = v_to, reviewer_id = auth.uid(), decided_at = now()
  where id = r.id returning * into r;
  return r;
end $$;

revoke all on function public.get_or_create_report(date), public.submit_report(uuid), public.start_review(uuid),
  public.decide_report(uuid, boolean, text) from public, anon;
grant execute on function public.get_or_create_report(date), public.submit_report(uuid), public.start_review(uuid),
  public.decide_report(uuid, boolean, text) to authenticated;

-- ---------- Row Level Security ----------

alter table public.organizations enable row level security;
alter table public.org_secrets enable row level security;
alter table public.profiles enable row level security;
alter table public.disposal_methods enable row level security;
alter table public.waste_types enable row level security;
alter table public.reports enable row level security;
alter table public.entries enable row level security;
alter table public.entry_photos enable row level security;
alter table public.status_history enable row level security;
alter table public.daily_portions enable row level security;
alter table public.surplus_offers enable row level security;
alter table public.scale_readings enable row level security;

-- Организации: названия видны всем (нужны открытой странице «Спасённые порции»), меняет только администратор.
create policy org_read on public.organizations for select using (true);
create policy org_write on public.organizations for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy secrets_admin on public.org_secrets for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Профили: свой — каждому, все — сотрудникам; роль и организацию меняет только администратор.
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_admin on public.profiles for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy disposal_read on public.disposal_methods for select to authenticated using (true);
create policy disposal_write on public.disposal_methods for all to authenticated
  using (public.my_role() in ('admin', 'reviewer')) with check (public.my_role() in ('admin', 'reviewer'));

-- Виды отходов: ответственный видит общие и свои, добавляет только в свою организацию.
-- Политики на удаление нет: вид можно только деактивировать.
create policy waste_read on public.waste_types for select to authenticated
  using (org_id is null or org_id = public.my_org() or public.is_staff());
create policy waste_insert on public.waste_types for insert to authenticated
  with check (
    (public.my_role() = 'responsible' and org_id = public.my_org())
    or public.my_role() in ('admin', 'reviewer')
  );
create policy waste_update on public.waste_types for update to authenticated
  using (public.my_role() in ('admin', 'reviewer')) with check (public.my_role() in ('admin', 'reviewer'));

-- Отчёты: чтение — своя организация или сотрудники. Прямой записи нет, только функции workflow.
create policy reports_read on public.reports for select to authenticated
  using (org_id = public.my_org() or public.is_staff());

-- Записи: менять может только ответственный своей организации и только пока отчёт в черновике или возвращён.
create policy entries_read on public.entries for select to authenticated
  using (org_id = public.my_org() or public.is_staff());
create policy entries_insert on public.entries for insert to authenticated
  with check (
    public.my_role() = 'responsible' and org_id = public.my_org()
    and exists (select 1 from public.reports r where r.id = entries.report_id and r.org_id = entries.org_id and r.status in ('draft', 'returned'))
  );
create policy entries_update on public.entries for update to authenticated
  using (
    public.my_role() = 'responsible' and org_id = public.my_org()
    and exists (select 1 from public.reports r where r.id = entries.report_id and r.status in ('draft', 'returned'))
  )
  with check (
    public.my_role() = 'responsible' and org_id = public.my_org()
    and exists (select 1 from public.reports r where r.id = entries.report_id and r.org_id = entries.org_id and r.status in ('draft', 'returned'))
  );
create policy entries_delete on public.entries for delete to authenticated
  using (
    public.my_role() = 'responsible' and org_id = public.my_org()
    and exists (select 1 from public.reports r where r.id = entries.report_id and r.status in ('draft', 'returned'))
  );

create policy photos_read on public.entry_photos for select to authenticated
  using (org_id = public.my_org() or public.is_staff());
create policy photos_insert on public.entry_photos for insert to authenticated
  with check (
    public.my_role() = 'responsible' and org_id = public.my_org()
    and exists (select 1 from public.entries e where e.id = entry_photos.entry_id and e.org_id = entry_photos.org_id)
  );

create policy history_read on public.status_history for select to authenticated
  using (exists (select 1 from public.reports r where r.id = status_history.report_id and (r.org_id = public.my_org() or public.is_staff())));

create policy portions_read on public.daily_portions for select to authenticated
  using (org_id = public.my_org() or public.is_staff());
create policy portions_insert on public.daily_portions for insert to authenticated
  with check (public.my_role() = 'responsible' and org_id = public.my_org());
create policy portions_update on public.daily_portions for update to authenticated
  using (public.my_role() = 'responsible' and org_id = public.my_org())
  with check (public.my_role() = 'responsible' and org_id = public.my_org());

-- «Спасённые порции»: активные предложения видны всем, управляет ответственный своей организации.
create policy offers_read on public.surplus_offers for select using (is_active or org_id = public.my_org() or public.is_staff());
create policy offers_insert on public.surplus_offers for insert to authenticated
  with check (public.my_role() = 'responsible' and org_id = public.my_org());
create policy offers_update on public.surplus_offers for update to authenticated
  using (public.my_role() = 'responsible' and org_id = public.my_org())
  with check (public.my_role() = 'responsible' and org_id = public.my_org());

-- Показания весов: читает и помечает использованными своя организация; вставка — только серверная функция.
create policy scale_read on public.scale_readings for select to authenticated using (org_id = public.my_org());
create policy scale_update on public.scale_readings for update to authenticated
  using (org_id = public.my_org()) with check (org_id = public.my_org());

-- ---------- Единый реестр: записи только принятых отчётов ----------

create view public.registry with (security_invoker = true) as
select
  e.id, e.entry_date, e.org_id, e.report_id, e.waste_type_id, e.disposal_id, e.quantity, e.reason,
  e.source, e.has_photo, e.created_at,
  o.name_ru as org_ru, o.name_kk as org_kk, o.type as org_type,
  w.name_ru as waste_ru, w.name_kk as waste_kk, w.unit, w.category, w.recyclable,
  round(e.quantity * w.kg_per_unit, 3) as mass_kg,
  round(e.quantity * w.kg_per_unit * w.co2_factor, 3) as co2_kg,
  round(e.quantity * w.cost_per_unit, 0) as cost_kzt,
  d.name_ru as disposal_ru, d.name_kk as disposal_kk, coalesce(d.diverts, false) as diverts,
  p.full_name as responsible
from public.entries e
join public.reports r on r.id = e.report_id and r.status = 'accepted'
join public.organizations o on o.id = e.org_id and not o.is_demo
join public.waste_types w on w.id = e.waste_type_id
left join public.disposal_methods d on d.id = e.disposal_id
left join public.profiles p on p.id = e.user_id;

grant select on public.registry to authenticated;

-- Приём показаний весов по токену организации (вызывается без входа — весами или симулятором).
create or replace function public.push_scale_reading(p_token text, p_weight numeric) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_id bigint;
begin
  select org_id into v_org from public.org_secrets where scale_token = p_token;
  if v_org is null then raise exception 'Неверный токен весов'; end if;
  if p_weight is null or p_weight <= 0 or p_weight > 500 then raise exception 'Недопустимый вес'; end if;
  insert into public.scale_readings (org_id, weight) values (v_org, p_weight) returning id into v_id;
  return v_id;
end $$;
grant execute on function public.push_scale_reading(text, numeric) to anon, authenticated;

-- Покупка «спасённой порции» с открытой страницы.
create or replace function public.claim_offer(p_offer uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare v_left integer;
begin
  update public.surplus_offers set sold = sold + 1
  where id = p_offer and is_active and sold < portions and available_until > now()
  returning portions - sold into v_left;
  if v_left is null then raise exception 'Порции закончились'; end if;
  return v_left;
end $$;
grant execute on function public.claim_offer(uuid) to anon, authenticated;

-- ---------- Живое обновление ----------
do $$ begin
  alter publication supabase_realtime add table public.entries, public.reports, public.scale_readings, public.surplus_offers;
exception when others then null; end $$;
