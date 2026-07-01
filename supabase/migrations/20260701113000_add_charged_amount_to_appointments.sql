alter table grooming_appointments
  add column if not exists charged_amount numeric(10, 2);

comment on column grooming_appointments.charged_amount is 'Valor cobrado no atendimento. Campo opcional.';
