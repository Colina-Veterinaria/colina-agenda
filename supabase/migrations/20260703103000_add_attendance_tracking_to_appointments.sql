alter table public.grooming_appointments
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_out_at timestamptz;

alter table public.grooming_appointments
  drop constraint if exists grooming_appointments_attendance_check;

alter table public.grooming_appointments
  add constraint grooming_appointments_attendance_check
  check (
    checked_out_at is null
    or (
      checked_in_at is not null
      and checked_out_at >= checked_in_at
    )
  );

comment on column public.grooming_appointments.checked_in_at is 'Horário em que o cliente/pet chegou para o atendimento.';
comment on column public.grooming_appointments.checked_out_at is 'Horário em que o atendimento foi encerrado e o pet saiu.';
