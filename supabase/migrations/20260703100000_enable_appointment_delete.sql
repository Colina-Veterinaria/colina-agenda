grant delete on table public.grooming_appointments to anon, authenticated;

drop policy if exists grooming_appointments_delete_public on public.grooming_appointments;
create policy grooming_appointments_delete_public
on public.grooming_appointments
for delete
to anon, authenticated
using (true);

comment on policy grooming_appointments_delete_public on public.grooming_appointments is 'Permite excluir agendamentos pela agenda da parede no MVP.';
