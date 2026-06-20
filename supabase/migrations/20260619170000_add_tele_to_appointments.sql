-- "Tele" indica se o pet será buscado em casa (tele-busca). Campo binário (sim/não).
alter table grooming_appointments
  add column if not exists tele boolean not null default false;

comment on column grooming_appointments.tele is 'Tele-busca: indica se o pet será buscado em casa (sim/não).';
