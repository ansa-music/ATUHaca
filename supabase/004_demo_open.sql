-- Демо-точка жюри: текущий отчёт всегда открыт для ввода.
-- Если проверяющий уже отправил/принял отчёт демо-точки, при следующем входе гостя он снова становится черновиком
-- (записи сохраняются, в истории статусов остаётся отметка).
create or replace function public.get_or_create_report(p_month date)
 returns reports language plpgsql security definer set search_path to 'public'
as $function$
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
  elsif r.status in ('submitted', 'in_review', 'accepted')
        and exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    insert into public.status_history (report_id, from_status, to_status, user_id, comment)
    values (r.id, r.status, 'draft', auth.uid(), 'Демо-точка: отчёт снова открыт для ввода');
    update public.reports set status = 'draft', submitted_at = null, reviewer_id = null, decided_at = null, trust_score = null
    where id = r.id returning * into r;
  end if;
  return r;
end $function$;
