(function () {
  const SUPABASE_URL = 'https://urgcgdwwyhtyegfpuxyq.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1cmdjZ2R3d3lodHllZ2ZwdXh5cSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzgxMTg3MjE0LCJleHAiOjIwOTY3NjMyMTR9.XUz0C0ZNSlS_cvakYT2_q2pJPLKK8qBLZy5a6wQ5kd4';
  const GROOMING_TYPES = {
    higienica: 'Tosa Higiênica',
    tesoura: 'Tosa Tesoura',
    maquina: 'Tosa Máquina',
  };
  const SHIFT_LABELS = {
    manha: 'Manhã',
    tarde: 'Tarde',
  };
  const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const PET_EMOJIS = ['🐶', '🐱', '🐾', '🐶', '🐱'];

  const state = {
    appointments: [],
    initialized: false,
    loading: false,
    lastError: null,
  };

  function startOfDay(date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  function offsetDate(base, days) {
    const value = startOfDay(base);
    value.setDate(value.getDate() + days);
    return value;
  }

  function toDateKey(value) {
    if (typeof value === 'string') {
      return value.slice(0, 10);
    }

    const date = startOfDay(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function fromDateKey(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function formatLongDate(dateKey) {
    const date = fromDateKey(dateKey);
    return `${WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()} de ${MONTHS_LONG[date.getMonth()]}`;
  }

  function formatMonthYear(dateKey) {
    const date = fromDateKey(dateKey);
    return `${MONTHS_LONG[date.getMonth()]} de ${date.getFullYear()}`;
  }

  function formatMonthShort(dateKey) {
    return MONTHS_SHORT[fromDateKey(dateKey).getMonth()];
  }

  function formatWeekdayShort(dateKey) {
    return WEEKDAYS_SHORT[fromDateKey(dateKey).getDay()];
  }

  function monthKey(dateKey) {
    return dateKey.slice(0, 7);
  }

  function parseMinutes(time) {
    const [hours, minutes] = String(time || '00:00').split(':').map(Number);
    return hours * 60 + minutes;
  }

  function getShiftForTime(time) {
    return parseMinutes(time) < 12 * 60 ? 'manha' : 'tarde';
  }

  function getShiftLabel(shift) {
    return SHIFT_LABELS[shift] || 'Turno';
  }

  function getGroomingLabel(type) {
    return GROOMING_TYPES[type] || '';
  }

  function getServiceLabels(appointment) {
    const labels = [];

    if (appointment.bath) {
      labels.push('Banho');
    }

    if (appointment.groomingType) {
      labels.push(getGroomingLabel(appointment.groomingType));
    }

    return labels;
  }

  function compareAppointments(left, right) {
    return (
      left.date.localeCompare(right.date) ||
      parseMinutes(left.arrivalTime) - parseMinutes(right.arrivalTime) ||
      left.petName.localeCompare(right.petName)
    );
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function emitChange(detail) {
    window.dispatchEvent(new CustomEvent('colina:appointments-changed', { detail }));
  }

  function buildUrl(table, searchParams) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);

    Object.entries(searchParams || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });

    return url;
  }

  async function requestJson(url, options) {
    const response = await fetch(url, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...(options && options.headers ? options.headers : {}),
      },
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const error = new Error(payload && payload.message ? payload.message : 'Erro ao acessar o Supabase.');
      error.code = payload && payload.code ? payload.code : String(response.status);
      error.details = payload;
      throw error;
    }

    return payload;
  }

  function normalizeAppointment(row) {
    return {
      id: row.id,
      date: row.appointment_date,
      arrivalTime: String(row.arrival_time || '').slice(0, 5),
      shift: row.shift,
      phone: row.customer ? row.customer.phone : '',
      clientName: row.customer ? row.customer.full_name : '',
      petName: row.pet ? row.pet.name : '',
      breed: row.pet ? row.pet.breed : '',
      bath: Boolean(row.bath),
      groomingType: row.grooming_type || '',
      notes: row.notes || '',
      status: row.status || 'scheduled',
    };
  }

  async function fetchAppointments() {
    const url = buildUrl('grooming_appointments', {
      select:
        'id,appointment_date,arrival_time,shift,bath,grooming_type,notes,status,customer:customers!grooming_appointments_customer_id_fkey(full_name,phone),pet:pets!grooming_appointments_pet_id_fkey(name,breed)',
      order: 'appointment_date.asc,arrival_time.asc',
    });

    const data = await requestJson(url, { method: 'GET' });
    return (data || []).map(normalizeAppointment).sort(compareAppointments);
  }

  async function refreshAppointments() {
    state.loading = true;

    try {
      const appointments = await fetchAppointments();
      state.appointments = appointments;
      state.initialized = true;
      state.lastError = null;
      emitChange({ source: 'refresh', total: appointments.length });
      return clone(appointments);
    } catch (error) {
      state.lastError = error;
      throw error;
    } finally {
      state.loading = false;
    }
  }

  async function ready() {
    if (state.initialized) {
      return clone(state.appointments);
    }

    return refreshAppointments();
  }

  function getAppointments() {
    return clone(state.appointments);
  }

  function getAppointmentsByDate(dateKey) {
    return getAppointments().filter((appointment) => appointment.date === dateKey);
  }

  function getAppointmentsByDateAndShift(dateKey, shift) {
    return getAppointmentsByDate(dateKey).filter((appointment) => getShiftForTime(appointment.arrivalTime) === shift);
  }

  function getDaySummary(dateKey) {
    const appointments = getAppointmentsByDate(dateKey);
    const groomingCounts = { higienica: 0, tesoura: 0, maquina: 0 };
    let bathCount = 0;
    let morningCount = 0;
    let afternoonCount = 0;

    appointments.forEach((appointment) => {
      if (appointment.bath) {
        bathCount += 1;
      }

      if (appointment.groomingType) {
        groomingCounts[appointment.groomingType] += 1;
      }

      if (getShiftForTime(appointment.arrivalTime) === 'manha') {
        morningCount += 1;
      } else {
        afternoonCount += 1;
      }
    });

    return {
      total: appointments.length,
      bathCount,
      groomingTotal: groomingCounts.higienica + groomingCounts.tesoura + groomingCounts.maquina,
      morningCount,
      afternoonCount,
      groomingCounts,
    };
  }

  function getMonthlyGroomingCounts(currentMonthKey) {
    const counts = { higienica: 0, tesoura: 0, maquina: 0 };
    getAppointments().forEach((appointment) => {
      if (monthKey(appointment.date) === currentMonthKey && appointment.groomingType) {
        counts[appointment.groomingType] += 1;
      }
    });
    return counts;
  }

  function getFrequentPets(limit) {
    const map = new Map();

    getAppointments().forEach((appointment) => {
      const key = `${appointment.petName.toLowerCase()}::${appointment.clientName.toLowerCase()}`;
      const entry = map.get(key) || {
        petName: appointment.petName,
        clientName: appointment.clientName,
        breed: appointment.breed,
        visits: 0,
      };

      entry.visits += 1;
      map.set(key, entry);
    });

    return Array.from(map.values())
      .sort((left, right) => right.visits - left.visits || left.petName.localeCompare(right.petName))
      .slice(0, limit || 5)
      .map((item, index) => ({
        ...item,
        emoji: PET_EMOJIS[index % PET_EMOJIS.length],
      }));
  }

  function hasConflict(nextAppointment) {
    return state.appointments.some((appointment) => {
      return (
        appointment.date === nextAppointment.date &&
        appointment.arrivalTime === nextAppointment.arrivalTime &&
        appointment.petName.trim().toLowerCase() === nextAppointment.petName.trim().toLowerCase()
      );
    });
  }

  async function maybeSingle(table, params) {
    const url = buildUrl(table, { ...params, limit: '1' });
    const data = await requestJson(url, { method: 'GET' });
    return Array.isArray(data) && data.length ? data[0] : null;
  }

  async function insertRows(table, rows) {
    const url = buildUrl(table, { select: '*' });
    return requestJson(url, {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(rows),
    });
  }

  async function updateRows(table, filters, values) {
    const url = buildUrl(table, { ...filters, select: '*' });
    return requestJson(url, {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(values),
    });
  }

  async function findOrCreateCustomer(input) {
    const existing = await maybeSingle('customers', {
      select: 'id,full_name,phone',
      full_name: `eq.${input.clientName.trim()}`,
      phone: `eq.${input.phone.trim()}`,
    });

    if (existing) {
      return existing;
    }

    const created = await insertRows('customers', [
      {
        full_name: input.clientName.trim(),
        phone: input.phone.trim(),
      },
    ]);

    return created[0];
  }

  async function findOrCreatePet(customerId, input) {
    const existing = await maybeSingle('pets', {
      select: 'id,breed',
      customer_id: `eq.${customerId}`,
      name: `eq.${input.petName.trim()}`,
    });

    if (!existing) {
      const created = await insertRows('pets', [
        {
          customer_id: customerId,
          name: input.petName.trim(),
          breed: input.breed.trim(),
        },
      ]);

      return created[0];
    }

    if (existing.breed !== input.breed.trim()) {
      const updated = await updateRows(
        'pets',
        { id: `eq.${existing.id}` },
        { breed: input.breed.trim() }
      );
      return updated[0];
    }

    return existing;
  }

  async function addAppointment(input) {
    await ready();

    if (hasConflict(input)) {
      throw new Error('Já existe um agendamento para este pet no mesmo dia e horário.');
    }

    const customer = await findOrCreateCustomer(input);
    const pet = await findOrCreatePet(customer.id, input);

    const created = await insertRows('grooming_appointments', [
      {
        customer_id: customer.id,
        pet_id: pet.id,
        appointment_date: input.date,
        arrival_time: input.arrivalTime,
        shift: getShiftForTime(input.arrivalTime),
        bath: Boolean(input.bath),
        grooming_type: input.groomingType || null,
        notes: input.notes.trim(),
      },
    ]);

    await refreshAppointments();
    return state.appointments.find((appointment) => appointment.id === created[0].id);
  }

  function buildDayWindow(centerDateKey, radius) {
    const base = fromDateKey(centerDateKey);
    const days = [];
    const steps = typeof radius === 'number' ? radius : 2;

    for (let offset = -steps; offset <= steps; offset += 1) {
      const date = offsetDate(base, offset);
      const dateKey = toDateKey(date);
      days.push({
        dateKey,
        label: formatWeekdayShort(dateKey),
        dateNumber: String(date.getDate()).padStart(2, '0'),
        monthLabel: formatMonthShort(dateKey),
        isToday: dateKey === toDateKey(new Date()),
      });
    }

    return days;
  }

  window.ColinaAgenda = {
    ready,
    refreshAppointments,
    getAppointments,
    getAppointmentsByDate,
    getAppointmentsByDateAndShift,
    getDaySummary,
    getMonthlyGroomingCounts,
    getFrequentPets,
    hasConflict,
    addAppointment,
    buildDayWindow,
    toDateKey,
    fromDateKey,
    formatLongDate,
    formatMonthYear,
    formatMonthShort,
    formatWeekdayShort,
    monthKey,
    getShiftForTime,
    getShiftLabel,
    getGroomingLabel,
    getServiceLabels,
    isLoading: function () {
      return state.loading;
    },
    getLastError: function () {
      return state.lastError;
    },
  };
})();
