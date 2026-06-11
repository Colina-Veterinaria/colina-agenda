grant usage on schema public to anon, authenticated;

grant select, insert, update on table public.customers to anon, authenticated;
grant select, insert, update on table public.pets to anon, authenticated;
grant select, insert, update on table public.grooming_appointments to anon, authenticated;

alter table public.customers enable row level security;
alter table public.pets enable row level security;
alter table public.grooming_appointments enable row level security;

drop policy if exists customers_select_public on public.customers;
create policy customers_select_public
on public.customers
for select
to anon, authenticated
using (true);

drop policy if exists customers_insert_public on public.customers;
create policy customers_insert_public
on public.customers
for insert
to anon, authenticated
with check (true);

drop policy if exists customers_update_public on public.customers;
create policy customers_update_public
on public.customers
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists pets_select_public on public.pets;
create policy pets_select_public
on public.pets
for select
to anon, authenticated
using (true);

drop policy if exists pets_insert_public on public.pets;
create policy pets_insert_public
on public.pets
for insert
to anon, authenticated
with check (true);

drop policy if exists pets_update_public on public.pets;
create policy pets_update_public
on public.pets
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists grooming_appointments_select_public on public.grooming_appointments;
create policy grooming_appointments_select_public
on public.grooming_appointments
for select
to anon, authenticated
using (true);

drop policy if exists grooming_appointments_insert_public on public.grooming_appointments;
create policy grooming_appointments_insert_public
on public.grooming_appointments
for insert
to anon, authenticated
with check (true);

drop policy if exists grooming_appointments_update_public on public.grooming_appointments;
create policy grooming_appointments_update_public
on public.grooming_appointments
for update
to anon, authenticated
using (true)
with check (true);

comment on policy customers_select_public on public.customers is 'Permite leitura do MVP da agenda via chave anon.';
comment on policy customers_insert_public on public.customers is 'Permite cadastro de clientes pela tela da recepcao.';
comment on policy customers_update_public on public.customers is 'Permite ajustes simples do cadastro de clientes pela tela da recepcao.';
comment on policy pets_select_public on public.pets is 'Permite leitura dos pets vinculados a agenda.';
comment on policy pets_insert_public on public.pets is 'Permite cadastro de pets pela tela da recepcao.';
comment on policy pets_update_public on public.pets is 'Permite atualizar dados basicos do pet, como raca.';
comment on policy grooming_appointments_select_public on public.grooming_appointments is 'Permite leitura da agenda pela recepcao e pelo painel da parede.';
comment on policy grooming_appointments_insert_public on public.grooming_appointments is 'Permite criar novos agendamentos no MVP sem autenticação.';
comment on policy grooming_appointments_update_public on public.grooming_appointments is 'Mantem margem para atualizar agendamentos quando o fluxo evoluir.';
