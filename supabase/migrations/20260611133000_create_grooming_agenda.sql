create extension if not exists pgcrypto;

create type appointment_shift as enum ('manha', 'tarde');
create type grooming_type as enum ('higienica', 'tesoura', 'maquina');
create type appointment_status as enum ('scheduled', 'completed', 'cancelled');

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists customers_name_phone_key
  on customers (full_name, phone);

create table if not exists pets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name text not null,
  breed text not null,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pets_customer_name_key unique (customer_id, name)
);

create index if not exists pets_customer_id_idx
  on pets (customer_id);

create table if not exists grooming_appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict,
  pet_id uuid not null references pets(id) on delete restrict,
  appointment_date date not null,
  arrival_time time not null,
  shift appointment_shift not null,
  bath boolean not null default false,
  grooming_type grooming_type,
  notes text not null default '',
  status appointment_status not null default 'scheduled',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint grooming_appointments_service_check check (
    bath or grooming_type is not null
  ),
  constraint grooming_appointments_shift_check check (
    (shift = 'manha' and arrival_time < time '12:00')
    or (shift = 'tarde' and arrival_time >= time '12:00')
  ),
  constraint grooming_appointments_pet_time_key unique (pet_id, appointment_date, arrival_time)
);

create index if not exists grooming_appointments_date_shift_idx
  on grooming_appointments (appointment_date, shift, arrival_time);

create index if not exists grooming_appointments_customer_idx
  on grooming_appointments (customer_id, appointment_date desc);

create index if not exists grooming_appointments_pet_idx
  on grooming_appointments (pet_id, appointment_date desc);

drop trigger if exists customers_set_updated_at on customers;
create trigger customers_set_updated_at
before update on customers
for each row
execute function set_updated_at();

drop trigger if exists pets_set_updated_at on pets;
create trigger pets_set_updated_at
before update on pets
for each row
execute function set_updated_at();

drop trigger if exists grooming_appointments_set_updated_at on grooming_appointments;
create trigger grooming_appointments_set_updated_at
before update on grooming_appointments
for each row
execute function set_updated_at();

create or replace view monthly_grooming_service_totals as
select
  date_trunc('month', appointment_date)::date as month_reference,
  grooming_type,
  count(*)::int as total
from grooming_appointments
where grooming_type is not null
  and status <> 'cancelled'
group by 1, 2;

create or replace view frequent_pets_rank as
select
  p.id as pet_id,
  p.name as pet_name,
  p.breed,
  c.full_name as customer_name,
  count(*) filter (where ga.status <> 'cancelled')::int as total_visits
from grooming_appointments ga
join pets p on p.id = ga.pet_id
join customers c on c.id = ga.customer_id
group by p.id, p.name, p.breed, c.full_name
order by total_visits desc, p.name asc;

comment on table grooming_appointments is 'Agenda de banho e tosa dividida entre os turnos manhã e tarde.';
comment on column grooming_appointments.arrival_time is 'Campo exibido como Chegada na agenda da parede.';
comment on column grooming_appointments.grooming_type is 'Opções de tosa: higiênica, tesoura ou máquina.';
