create or replace view public.customer_frequency_rollup
with (security_invoker = true) as
with pet_names as (
  select
    p.customer_id,
    string_agg(p.name, ' · ' order by p.name) as pet_names
  from public.pets p
  group by p.customer_id
),
appointment_counts as (
  select
    ga.customer_id,
    count(*)::int as total_appointments,
    count(*) filter (where ga.bath)::int as bath_appointments,
    count(*) filter (where ga.grooming_type = 'higienica')::int as higienica_appointments,
    count(*) filter (where ga.grooming_type = 'tesoura')::int as tesoura_appointments,
    count(*) filter (where ga.grooming_type = 'maquina')::int as maquina_appointments,
    min(ga.appointment_date) as first_appointment_date,
    max(ga.appointment_date) as last_appointment_date
  from public.grooming_appointments ga
  group by ga.customer_id
),
latest_appointment as (
  select distinct on (ga.customer_id)
    ga.customer_id,
    ga.appointment_date as last_appointment_date,
    ga.arrival_time as last_arrival_time,
    p.name as last_pet_name
  from public.grooming_appointments ga
  join public.pets p on p.id = ga.pet_id
  order by ga.customer_id, ga.appointment_date desc, ga.arrival_time desc, ga.created_at desc
)
select
  c.id as customer_id,
  c.full_name,
  c.phone,
  coalesce(pn.pet_names, '') as pet_names,
  ac.total_appointments,
  ac.bath_appointments,
  ac.higienica_appointments,
  ac.tesoura_appointments,
  ac.maquina_appointments,
  ac.first_appointment_date,
  ac.last_appointment_date,
  la.last_arrival_time,
  coalesce(la.last_pet_name, '') as last_pet_name
from appointment_counts ac
join public.customers c on c.id = ac.customer_id
left join pet_names pn on pn.customer_id = c.id
left join latest_appointment la on la.customer_id = c.id
order by ac.total_appointments desc, ac.last_appointment_date desc, la.last_arrival_time desc, c.full_name asc;

grant select on table public.customer_frequency_rollup to anon, authenticated;

comment on view public.customer_frequency_rollup is 'Resumo por cliente da frequência de agendamentos, banhos, tipos de tosa e último atendimento/agendamento.';
