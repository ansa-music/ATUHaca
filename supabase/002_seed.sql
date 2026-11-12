-- Qadir — демо-данные: 5 организаций АТУ по образцам ТЗ, демо-логины по ролям,
-- взвешивания с 1 июля 2026 по вчерашний день. Запускать после 001_schema.sql.
-- Файл можно запускать повторно: он очищает данные Qadir и создаёт их заново.
--
-- Демо-логины (пароль у всех один, задан ниже в v_pw):
--   iskander@qadir.kz  — ответственное лицо, столовая «Искандер»
--   atuinn@qadir.kz    — ответственное лицо, ATU INN
--   canella@qadir.kz   — ответственное лицо, кофейня «Canella»
--   tpp@qadir.kz       — ответственное лицо, кафедра ТПП
--   thipp@qadir.kz     — ответственное лицо, кафедра ТХиПП
--   jury@qadir.kz      — гость жюри, «Демо-точка жюри»
--   reviewer@qadir.kz  — проверяющий
--   admin@qadir.kz     — администратор
--   rector@qadir.kz    — руководство

set search_path = public, extensions;

truncate public.scale_readings, public.org_secrets, public.surplus_offers, public.daily_portions, public.entry_photos,
  public.status_history, public.entries, public.reports, public.waste_types, public.disposal_methods,
  public.profiles, public.organizations cascade;
delete from auth.users where email like '%@qadir.kz';

do $$
declare
  v_pw text := 'Qadir-2026';   -- демо-пароль; только для демо-учётных записей
  -- организации
  o_tpp uuid; o_thipp uuid; o_inn uuid; o_cafe uuid; o_isk uuid; o_jury uuid;
  -- способы утилизации
  d_tbo uuid; d_bin uuid; d_recycle uuid; d_compost uuid; d_feed uuid; d_oil uuid;
  -- пользователи
  u_reviewer uuid; u_resp uuid;
  r record; w record; v_day date; v_rep uuid; v_qty numeric; v_factor numeric; v_month date;
  v_status public.report_status; v_created timestamptz; v_dow int;
begin
  -- ---------- Организации ----------
  insert into organizations (name_ru, name_kk, type, building) values
    ('Кафедра ТПП', 'ТПП кафедрасы', 'lab', 'Учебная лаборатория') returning id into o_tpp;
  insert into organizations (name_ru, name_kk, type, building) values
    ('Кафедра ТХиПП', 'ТХиПП кафедрасы', 'lab', 'Учебная лаборатория') returning id into o_thipp;
  insert into organizations (name_ru, name_kk, type, building) values
    ('Учебно-гостиничный комплекс ATU INN', 'ATU INN оқу-қонақ үй кешені', 'hotel', 'ATU INN') returning id into o_inn;
  insert into organizations (name_ru, name_kk, type, building) values
    ('Кофейня АТУ (ИП «Canella»)', 'АТУ кофеханасы (ЖК «Canella»)', 'cafe', 'Главный корпус') returning id into o_cafe;
  insert into organizations (name_ru, name_kk, type, building) values
    ('Столовый комплекс корп. 1, 2 (ИП «Искандер»)', '1, 2-корпустардың асхана кешені (ЖК «Искандер»)', 'canteen', 'Корпуса 1 и 2') returning id into o_isk;
  insert into organizations (name_ru, name_kk, type, building, is_demo) values
    ('Демо-точка жюри', 'Қазылар алқасының демо-нүктесі', 'other', 'Защита проекта', true) returning id into o_jury;
  insert into org_secrets (org_id) select id from organizations;

  -- ---------- Способы утилизации ----------
  insert into disposal_methods (name_ru, name_kk) values ('Вывоз ТБО', 'ҚТҚ шығару') returning id into d_tbo;
  insert into disposal_methods (name_ru, name_kk) values ('Вывоз ТБО (мусорный бак)', 'ҚТҚ шығару (қоқыс жәшігі)') returning id into d_bin;
  insert into disposal_methods (name_ru, name_kk, diverts) values ('Переработка (вторсырьё)', 'Қайта өңдеу (қайталама шикізат)', true) returning id into d_recycle;
  insert into disposal_methods (name_ru, name_kk, diverts) values ('Компост', 'Компост', true) returning id into d_compost;
  insert into disposal_methods (name_ru, name_kk, diverts) values ('Корм животным', 'Мал азығы', true) returning id into d_feed;
  insert into disposal_methods (name_ru, name_kk, diverts) values ('Сдача масла переработчику', 'Майды қайта өңдеушіге тапсыру', true) returning id into d_oil;

  -- ---------- Виды отходов по образцам таблиц АТУ ----------
  -- base — средний объём за рабочий день, нужен только генератору демо-данных.
  -- co2_factor 2,5 кг CO2-экв./кг — среднее по пищевым отходам (FAO, Food Wastage Footprint, 2013);
  -- упаковка в CO2 не учитывается. cost_per_unit — оценочные допущения команды, тенге.
  create temp table _wt (id uuid, org_id uuid, base numeric, avoidable boolean) on commit drop;

  with ins as (
    insert into waste_types (org_id, name_ru, name_kk, unit, kg_per_unit, default_disposal_id, recyclable, category, co2_factor, cost_per_unit)
    values
      -- Кафедра ТПП
      (o_tpp, 'Упаковочные отходы', 'Орама қалдықтары', 'kg', 1, d_tbo, true, 'packaging', 0, 0),
      (o_tpp, 'Мясные кости', 'Ет сүйектері', 'kg', 1, d_tbo, false, 'unavoidable', 2.5, 0),
      (o_tpp, 'Рыбные кости', 'Балық сүйектері', 'kg', 1, d_tbo, false, 'unavoidable', 2.5, 0),
      -- Кафедра ТХиПП
      (o_thipp, 'Яичная скорлупа', 'Жұмыртқа қабығы', 'kg', 1, d_tbo, true, 'unavoidable', 2.5, 0),
      (o_thipp, 'Сахароза', 'Сахароза', 'kg', 1, d_tbo, false, 'avoidable', 2.5, 450),
      (o_thipp, 'ПЭТ-бутылка 1,0 л (растительное масло)', 'ПЭТ-бөтелке 1,0 л (өсімдік майы)', 'kg', 1, d_tbo, true, 'packaging', 0, 0),
      (o_thipp, 'Стеклобутылка', 'Шыны бөтелке', 'kg', 1, d_tbo, true, 'packaging', 0, 0),
      (o_thipp, 'Отходы образцов хлебобулочных изделий', 'Нан-тоқаш өнімдері үлгілерінің қалдықтары', 'kg', 1, d_tbo, false, 'avoidable', 2.5, 600),
      (o_thipp, 'Отходы образцов кондитерских изделий', 'Кондитерлік өнімдер үлгілерінің қалдықтары', 'kg', 1, d_tbo, false, 'avoidable', 2.5, 1500),
      (o_thipp, 'Отходы фруктов и овощей', 'Жеміс-көкөніс қалдықтары', 'kg', 1, d_tbo, true, 'unavoidable', 2.5, 0),
      (o_thipp, 'Алюминиевые банки', 'Алюминий банкалар', 'kg', 1, d_tbo, true, 'packaging', 0, 0),
      -- ATU INN
      (o_inn, 'Очистки овощей', 'Көкөніс қабықтары', 'kg', 1, d_bin, true, 'unavoidable', 2.5, 0),
      (o_inn, 'Обрезки мясопродуктов', 'Ет өнімдерінің кесінділері', 'kg', 1, d_bin, false, 'unavoidable', 2.5, 0),
      (o_inn, 'Пищевые отходы из зала', 'Залдан шыққан тағам қалдықтары', 'kg', 1, d_bin, false, 'avoidable', 2.5, 1200),
      (o_inn, 'Остатки нереализованной продукции', 'Сатылмаған өнім қалдықтары', 'kg', 1, d_bin, false, 'avoidable', 2.5, 1500),
      (o_inn, 'Отработанное масло', 'Пайдаланылған май', 'l', 0.92, d_tbo, true, 'unavoidable', 2.5, 0),
      (o_inn, 'Картонная тара', 'Картон ыдыс', 'kg', 1, d_tbo, true, 'packaging', 0, 0),
      -- Кофейня
      (o_cafe, 'Кофейный жмых', 'Кофе сығындысы', 'kg', 1, d_bin, true, 'unavoidable', 2.5, 0),
      (o_cafe, 'Картонная тара', 'Картон ыдыс', 'kg', 1, d_tbo, true, 'packaging', 0, 0),
      (o_cafe, 'Остатки еды', 'Тамақ қалдықтары', 'kg', 1, d_bin, false, 'avoidable', 2.5, 1300),
      -- Столовая «Искандер»
      (o_isk, 'Очистки овощей', 'Көкөніс қабықтары', 'kg', 1, d_bin, true, 'unavoidable', 2.5, 0),
      (o_isk, 'Обрезки мясопродуктов', 'Ет өнімдерінің кесінділері', 'kg', 1, d_bin, false, 'unavoidable', 2.5, 0),
      (o_isk, 'Пищевые отходы из зала', 'Залдан шыққан тағам қалдықтары', 'kg', 1, d_bin, false, 'avoidable', 2.5, 1200),
      (o_isk, 'Остатки нереализованной продукции', 'Сатылмаған өнім қалдықтары', 'kg', 1, d_bin, false, 'avoidable', 2.5, 1500),
      (o_isk, 'Отработанное масло', 'Пайдаланылған май', 'l', 0.92, d_tbo, true, 'unavoidable', 2.5, 0),
      (o_isk, 'Картонная тара', 'Картон ыдыс', 'kg', 1, d_tbo, true, 'packaging', 0, 0),
      -- Демо-точка жюри
      (o_jury, 'Хлебобулочные изделия', 'Нан-тоқаш өнімдері', 'kg', 1, d_bin, false, 'avoidable', 2.5, 600),
      (o_jury, 'Остатки еды', 'Тамақ қалдықтары', 'kg', 1, d_bin, false, 'avoidable', 2.5, 1300),
      (o_jury, 'Картонная тара', 'Картон ыдыс', 'kg', 1, d_recycle, true, 'packaging', 0, 0),
      (o_jury, 'Кофейный жмых', 'Кофе сығындысы', 'kg', 1, d_compost, true, 'unavoidable', 2.5, 0)
    returning id, org_id, name_ru, category
  )
  insert into _wt
  select id, org_id,
    case
      when org_id = o_tpp and name_ru = 'Упаковочные отходы' then 0.6
      when org_id = o_tpp and name_ru = 'Мясные кости' then 1.8
      when org_id = o_tpp then 0.9
      when org_id = o_thipp and name_ru like 'Отходы образцов хлеб%' then 1.2
      when org_id = o_thipp and name_ru like 'Отходы фруктов%' then 1.5
      when org_id = o_thipp and name_ru = 'Стеклобутылка' then 0.8
      when org_id = o_thipp and name_ru like 'Отходы образцов конд%' then 0.8
      when org_id = o_thipp then 0.3
      when org_id = o_inn and name_ru = 'Очистки овощей' then 6
      when org_id = o_inn and name_ru = 'Обрезки мясопродуктов' then 2.5
      when org_id = o_inn and name_ru = 'Пищевые отходы из зала' then 5
      when org_id = o_inn and name_ru like 'Остатки нереализ%' then 3
      when org_id = o_inn and name_ru = 'Отработанное масло' then 1.5
      when org_id = o_inn then 2
      when org_id = o_cafe and name_ru = 'Кофейный жмых' then 4
      when org_id = o_cafe and name_ru = 'Картонная тара' then 1.2
      when org_id = o_cafe then 1.5
      when org_id = o_isk and name_ru = 'Очистки овощей' then 14
      when org_id = o_isk and name_ru = 'Обрезки мясопродуктов' then 6
      when org_id = o_isk and name_ru = 'Пищевые отходы из зала' then 18
      when org_id = o_isk and name_ru like 'Остатки нереализ%' then 9
      when org_id = o_isk and name_ru = 'Отработанное масло' then 4
      when org_id = o_isk then 5
      else 0
    end,
    category = 'avoidable'
  from ins;

  -- ---------- Пользователи ----------
  create temp table _users (email text, full_name text, role public.user_role, org_id uuid) on commit drop;
  insert into _users values
    ('iskander@qadir.kz', 'Ахметова Айгуль Сериковна', 'responsible', o_isk),
    ('atuinn@qadir.kz', 'Жумабаев Данияр Ерланович', 'responsible', o_inn),
    ('canella@qadir.kz', 'Ким Алина Сергеевна', 'responsible', o_cafe),
    ('tpp@qadir.kz', 'Сапарова Гульнар Маратовна', 'responsible', o_tpp),
    ('thipp@qadir.kz', 'Оспанов Нурлан Бекович', 'responsible', o_thipp),
    ('jury@qadir.kz', 'Гость жюри', 'responsible', o_jury),
    ('reviewer@qadir.kz', 'Байжанова Сауле Кайратовна', 'reviewer', null),
    ('admin@qadir.kz', 'Администратор системы', 'admin', null),
    ('rector@qadir.kz', 'Проректор (руководство)', 'management', null);

  for r in select * from _users loop
    u_resp := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', u_resp, 'authenticated', 'authenticated', r.email,
      -- у гостя жюри отдельный публичный пароль: он зашит в кнопку «Войти как гость жюри»
      crypt(case when r.email = 'jury@qadir.kz' then 'qadir-guest' else v_pw end, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', r.full_name), now(), now(),
      '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u_resp, u_resp::text,
      jsonb_build_object('sub', u_resp::text, 'email', r.email, 'email_verified', true), 'email', now(), now(), now());
    insert into profiles (id, full_name, email, role, org_id) values (u_resp, r.full_name, r.email, r.role, r.org_id)
    on conflict (id) do update set full_name = excluded.full_name, email = excluded.email, role = excluded.role, org_id = excluded.org_id;
  end loop;
  select id into u_reviewer from profiles where role = 'reviewer' limit 1;

  -- ---------- Отчёты по месяцам ----------
  -- Июль–октябрь приняты; октябрь кофейни возвращён на доработку;
  -- ноябрь: ATU INN отправлен (и выглядит подозрительно), остальные — черновики.
  for r in select o.id as org_id, p.id as user_id from organizations o join profiles p on p.org_id = o.id where not o.is_demo loop
    for v_month in select generate_series(date '2026-07-01', date_trunc('month', current_date)::date, interval '1 month')::date loop
      v_status := case
        when v_month = date_trunc('month', current_date)::date and r.org_id = o_inn then 'submitted'
        when v_month = date_trunc('month', current_date)::date then 'draft'
        when v_month = (date_trunc('month', current_date) - interval '1 month')::date and r.org_id = o_cafe then 'returned'
        else 'accepted' end;
      insert into reports (org_id, period_start, period_end, status, submitted_at, reviewer_id, decided_at, created_at)
      values (r.org_id, v_month, (v_month + interval '1 month - 1 day')::date, v_status,
        case when v_status <> 'draft' then least(now(), (v_month + interval '1 month 1 day 10 hours')) end,
        case when v_status in ('accepted', 'returned') then u_reviewer end,
        case when v_status in ('accepted', 'returned') then (v_month + interval '1 month 2 days 15 hours') end,
        v_month + interval '9 hours')
      returning id into v_rep;

      insert into status_history (report_id, from_status, to_status, user_id, comment, created_at)
      values (v_rep, null, 'draft', r.user_id, 'Отчёт создан', v_month + interval '9 hours');
      if v_status <> 'draft' then
        insert into status_history (report_id, from_status, to_status, user_id, created_at)
        values (v_rep, 'draft', 'submitted', r.user_id, least(now(), v_month + interval '1 month 1 day 10 hours'));
      end if;
      if v_status in ('accepted', 'returned') then
        insert into status_history (report_id, from_status, to_status, user_id, created_at)
        values (v_rep, 'submitted', 'in_review', u_reviewer, v_month + interval '1 month 2 days 11 hours');
        insert into status_history (report_id, from_status, to_status, user_id, comment, created_at)
        values (v_rep, 'in_review', v_status, u_reviewer,
          case when v_status = 'returned' then 'Нет записей за 19–23 октября и не указан вес кофейного жмыха за последнюю неделю. Дополните и отправьте повторно.' end,
          v_month + interval '1 month 2 days 15 hours');
      end if;
    end loop;
  end loop;

  -- ---------- Взвешивания ----------
  for r in select o.id as org_id, o.type, p.id as user_id from organizations o join profiles p on p.org_id = o.id where not o.is_demo loop
    for v_day in select generate_series(date '2026-07-01', current_date - 1, interval '1 day')::date loop
      v_dow := extract(isodow from v_day);
      continue when v_dow = 7;
      continue when v_dow = 6 and r.type not in ('hotel', 'cafe');
      continue when r.org_id = o_tpp and v_dow not in (2, 4);          -- лабораторные занятия
      continue when r.org_id = o_thipp and v_dow not in (1, 3, 5);
      -- пропуск в подозрительном ноябрьском отчёте ATU INN и в возвращённом октябрьском отчёте кофейни
      continue when r.org_id = o_inn and v_day between date '2026-11-04' and date '2026-11-06';
      continue when r.org_id = o_cafe and v_day between date '2026-10-19' and date '2026-10-23';

      select id into v_rep from reports where org_id = r.org_id and period_start = date_trunc('month', v_day)::date;

      for w in select * from _wt where org_id = r.org_id loop
        continue when r.type = 'lab' and random() < 0.3;
        v_factor := 0.75 + random() * 0.5;
        if w.avoidable and r.type in ('canteen', 'hotel') then
          v_factor := v_factor * case v_dow when 1 then 1.4 when 5 then 1.2 else 1 end;   -- понедельник и пятница
        end if;
        if r.org_id = o_isk and w.avoidable and v_day >= date '2026-10-01' then
          v_factor := v_factor * 1.3;                                                   -- рост в октябре — отклонение
        end if;
        v_qty := greatest(0.1, round(w.base * v_factor, 1));
        v_created := (v_day + interval '14 hours' + random() * interval '4 hours') at time zone 'Asia/Almaty';

        if r.org_id = o_inn and v_day >= date '2026-11-01' then
          v_qty := greatest(1, round(w.base));                                           -- круглые повторяющиеся значения
          v_created := (timestamp '2026-11-11 17:40:00' + random() * interval '10 minutes') at time zone 'Asia/Almaty';
        end if;

        insert into entries (report_id, org_id, entry_date, waste_type_id, quantity, disposal_id, reason, user_id, has_photo, source, created_at)
        select v_rep, r.org_id, v_day, t.id, v_qty, t.default_disposal_id,
          case when t.category = 'avoidable' and t.name_ru like 'Остатки нереализ%' then 'overproduction'
               when t.category = 'avoidable' and t.name_ru like '%из зала%' then 'plate'
               when t.category = 'avoidable' then (array['overproduction', 'expired', 'plate'])[1 + floor(random() * 3)::int]
               when t.category = 'unavoidable' then 'trimmings' end,
          r.user_id, false, 'manual', v_created
        from waste_types t where t.id = w.id;
      end loop;

      if r.type in ('canteen', 'hotel', 'cafe') then
        insert into daily_portions (org_id, day, portions)
        values (r.org_id, v_day, round(case r.type when 'canteen' then 650 when 'hotel' then 180 else 220 end * (0.85 + random() * 0.3))::int);
      end if;
    end loop;
  end loop;

  -- ---------- Пример «Спасённых порций» ----------
  insert into surplus_offers (org_id, title, portions, price, old_price, available_until, created_by)
  select o_isk, 'Плов с говядиной, порция', 6, 900, 1800, (current_date + interval '18 hours') at time zone 'Asia/Almaty', p.id
  from profiles p where p.org_id = o_isk;
end $$;

select o.name_ru as "Организация", count(e.id) as "Записей", min(e.entry_date) as "С", max(e.entry_date) as "По"
from public.organizations o left join public.entries e on e.org_id = o.id
group by o.name_ru order by 2 desc;
