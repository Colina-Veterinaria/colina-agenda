(function () {
  const SUPABASE_URL = 'https://urgcgdwwyhtyegfpuxyq.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZ2NnZHd3eWh0eWVnZnB1eHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODcyMTQsImV4cCI6MjA5Njc2MzIxNH0.XUz0C0ZNSlS_cvakYT2_q2pJPLKK8qBLZy5a6wQ5kd4';
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
  const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const APPOINTMENT_SELECT =
    'id,customer_id,pet_id,appointment_date,arrival_time,shift,bath,tele,grooming_type,charged_amount,notes,status,checked_in_at,checked_out_at,customer:customers!grooming_appointments_customer_id_fkey(id,full_name,phone),pet:pets!grooming_appointments_pet_id_fkey(id,name,breed)';

  const state = {
    appointments: [],
    customers: [],
    appointmentsInitialized: false,
    registryInitialized: false,
    loadingAppointments: false,
    loadingRegistry: false,
    lastError: null,
  };

  const CACHE_KEY = 'colina:scoped:v1';
  const TTL = 60000;
  const pending = new Map();
  const dayPending = new Map();
  let revision = 0;
  let activeDate = '';
  let cache = {};
  try {
    cache = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}') || {};
    // Libera o espaço ocupado pelos antigos snapshots de tabelas inteiras.
    ['colina:v4:appointments', 'colina:v1:customers'].forEach((key) => sessionStorage.removeItem(key));
  } catch (_) {}

  function persistCache() {
    const entries = Object.entries(cache).sort((a, b) => b[1].at - a[1].at).slice(0, 60);
    cache = Object.fromEntries(entries);
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {}
  }

  function fresh(key, ttl = TTL) {
    return cache[key] && Date.now() - cache[key].at < ttl;
  }

  function putCache(key, value) {
    cache[key] = { at: Date.now(), value };
    persistCache();
    return value;
  }

  async function cached(key, loader, ttl = TTL) {
    if (fresh(key, ttl)) return clone(cache[key].value);
    if (!pending.has(key)) {
      const task = (async () => {
        // A resposta iniciada antes de uma gravação não pode repor dados antigos.
        let version, value;
        do { version = revision; value = await loader(); } while (version !== revision);
        return putCache(key, value);
      })();
      pending.set(key, task);
      task.finally(() => pending.delete(key)).catch(() => {});
    }
    return clone(await pending.get(key));
  }

  function invalidateReports() {
    revision += 1;
    Object.keys(cache).forEach((key) => {
      if (!key.startsWith('day:') && !key.startsWith('customer:')) delete cache[key];
    });
    persistCache();
  }

  function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function startVisibleSync(callback) {
    const run = () => { if (!document.hidden) callback(); };
    const timer = window.setInterval(run, TTL);
    document.addEventListener('visibilitychange', run);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
    };
  }

  async function rpc(name, params) {
    try {
      return await requestJson(buildUrl('rpc/' + name), {
        method: 'POST', body: JSON.stringify(params || {}),
      });
    } catch (error) {
      if (error.code === 'PGRST202' || error.code === '42883') {
        throw new Error('Atualização do banco pendente. Aplique o SQL reduce_egress_scoped_queries no Supabase.');
      }
      throw error;
    }
  }

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
    const parts = dateKey.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
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

  function formatShortDate(dateKey) {
    const date = fromDateKey(dateKey);
    return `${String(date.getDate()).padStart(2, '0')} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
  }

  function formatWeekdayShort(dateKey) {
    return WEEKDAYS_SHORT[fromDateKey(dateKey).getDay()];
  }

  function monthKey(dateKey) {
    return dateKey.slice(0, 7);
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function phoneDigits(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 11);
  }

  function formatPhone(value) {
    const digits = phoneDigits(value);

    if (!digits) {
      return '';
    }

    if (digits.length <= 2) {
      return digits;
    }

    if (digits.length <= 7) {
      return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    }

    return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }

  function isValidPhone(value) {
    const digits = phoneDigits(value);
    return digits.length === 11 && digits.charAt(2) === '9';
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

  function normalizeChargedAmount(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const raw = String(value).trim();
    if (!raw) {
      return null;
    }

    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
    const amount = Number(normalized);

    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Informe um valor cobrado v\u00e1lido.');
    }

    return Math.round(amount * 100) / 100;
  }

  function formatCurrency(value) {
    const amount = normalizeChargedAmount(value);
    return amount === null ? '' : CURRENCY_FORMATTER.format(amount);
  }

  function normalizeTimestamp(value) {
    if (!value) {
      return '';
    }

    const timestamp = new Date(value);
    return Number.isNaN(timestamp.getTime()) ? '' : timestamp.toISOString();
  }

  function formatTimeLabel(value) {
    if (!value) {
      return '';
    }

    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) {
      return '';
    }

    return timestamp.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getAttendanceState(appointment) {
    if (appointment && appointment.checkedOutAt) {
      return 'completed';
    }

    if (appointment && appointment.checkedInAt) {
      return 'present';
    }

    return 'scheduled';
  }

  function getAttendanceLabel(state) {
    if (state === 'present') {
      return 'Presente';
    }

    if (state === 'completed') {
      return 'Finalizado';
    }

    return 'Agendado';
  }

  function getAttendanceSummaryLabel(appointment) {
    const state = getAttendanceState(appointment);

    if (state === 'present') {
      const timeLabel = formatTimeLabel(appointment.checkedInAt);
      return timeLabel ? `Chegou às ${timeLabel}` : 'Chegou';
    }

    if (state === 'completed') {
      const timeLabel = formatTimeLabel(appointment.checkedOutAt);
      return timeLabel ? `Saiu às ${timeLabel}` : 'Finalizado';
    }

    return 'Aguardando chegada';
  }

  function compareAppointments(left, right) {
    return (
      left.date.localeCompare(right.date) ||
      parseMinutes(left.arrivalTime) - parseMinutes(right.arrivalTime) ||
      left.petName.localeCompare(right.petName)
    );
  }

  function comparePets(left, right) {
    return left.name.localeCompare(right.name);
  }

  function compareCustomers(left, right) {
    return left.fullName.localeCompare(right.fullName) || phoneDigits(left.phone).localeCompare(phoneDigits(right.phone));
  }

  function compareAppointmentMoments(leftDate, leftTime, rightDate, rightTime) {
    return leftDate.localeCompare(rightDate) || parseMinutes(leftTime) - parseMinutes(rightTime);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function emitAppointmentsChange(detail) {
    window.dispatchEvent(new CustomEvent('colina:appointments-changed', { detail }));
  }

  function emitRegistryChange(detail) {
    window.dispatchEvent(new CustomEvent('colina:registry-changed', { detail }));
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

  // O PostgREST trunca respostas sem paginação no limite configurado no servidor
  // (max_rows, 1000 por padrão). Para não perder agendamentos/clientes acima disso,
  // paginamos explicitamente via header Range até a página vir incompleta.
  async function fetchAllRows(table, searchParams) {
    const pageSize = 1000;
    let from = 0;
    let allRows = [];

    while (true) {
      const url = buildUrl(table, searchParams);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Range: `${from}-${from + pageSize - 1}`,
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

      const rows = payload || [];
      allRows = allRows.concat(rows);

      if (rows.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    return allRows;
  }

  function normalizePet(row) {
    return {
      id: row.id,
      name: row.name || '',
      breed: row.breed || '',
      notes: row.notes || '',
    };
  }

  function normalizeCustomer(row) {
    return {
      id: row.id,
      fullName: row.full_name || '',
      phone: formatPhone(row.phone || ''),
      notes: row.notes || '',
      pets: (row.pets || []).map(normalizePet).sort(comparePets),
    };
  }

  function normalizeAppointment(row) {
    const appointment = {
      id: row.id,
      date: row.appointment_date,
      arrivalTime: String(row.arrival_time || '').slice(0, 5),
      shift: row.shift,
      customerId: row.customer ? row.customer.id : row.customer_id || '',
      petId: row.pet ? row.pet.id : row.pet_id || '',
      phone: row.customer ? formatPhone(row.customer.phone) : '',
      clientName: row.customer ? row.customer.full_name : '',
      petName: row.pet ? row.pet.name : '',
      breed: row.pet ? row.pet.breed : '',
      bath: Boolean(row.bath),
      tele: Boolean(row.tele),
      groomingType: row.grooming_type || '',
      chargedAmount: normalizeChargedAmount(row.charged_amount),
      notes: row.notes || '',
      checkedInAt: normalizeTimestamp(row.checked_in_at),
      checkedOutAt: normalizeTimestamp(row.checked_out_at),
      status: row.status || 'scheduled',
    };

    appointment.attendanceState = getAttendanceState(appointment);
    appointment.attendanceLabel = getAttendanceLabel(appointment.attendanceState);
    appointment.attendanceSummary = getAttendanceSummaryLabel(appointment);
    return appointment;
  }

  function rebuildAppointments() {
    state.appointments = Object.entries(cache)
      .filter(([key]) => key.startsWith('day:'))
      .flatMap(([, entry]) => entry.value).sort(compareAppointments);
  }

  async function loadAppointmentWindow(centerDateKey = toDateKey(new Date())) {
    activeDate = centerDateKey;
    const days = buildDayWindow(centerDateKey, 2).map((day) => day.dateKey);
    const missing = days.filter((day) => !fresh('day:' + day) && !dayPending.has(day));
    if (missing.length) {
      const task = (async () => {
        let version, rows;
        do {
          version = revision;
          rows = await fetchAllRows('grooming_appointments', {
            select: APPOINTMENT_SELECT,
            appointment_date: `in.(${missing.join(',')})`,
            order: 'appointment_date.asc,arrival_time.asc,id.asc',
          });
        } while (version !== revision);
        const appointments = rows.map(normalizeAppointment);
        missing.forEach((day) => putCache('day:' + day, appointments.filter((item) => item.date === day)));
      })();
      missing.forEach((day) => dayPending.set(day, task));
      task.finally(() => missing.forEach((day) => dayPending.delete(day))).catch(() => {});
    }
    await Promise.all(days.map((day) => dayPending.get(day)));
    rebuildAppointments();
    state.appointmentsInitialized = true;
    return getAppointmentsByDate(centerDateKey);
  }

  async function refreshAppointments() {
    return loadAppointmentWindow(activeDate || toDateKey(new Date()));
  }

  // Cada tela escolhe suas consultas; inicializar não baixa tabelas completas.
  async function ready() { return { appointments: getAppointments(), customers: getCustomers() }; }

  function rememberCustomer(customer) {
    state.customers = state.customers.filter((item) => item.id !== customer.id).concat(customer);
    return clone(customer);
  }

  async function loadCustomer(id, force = false) {
    const key = 'customer:' + id;
    if (force) delete cache[key];
    const customer = await cached(key, async () => {
      const row = await maybeSingle('customers', {
        id: `eq.${id}`, select: 'id,full_name,phone,notes,pets(id,name,breed,notes)',
      });
      if (!row) throw new Error('Cliente não encontrado. Atualize a busca.');
      return normalizeCustomer(row);
    });
    return rememberCustomer(customer);
  }

  async function searchCustomerPage(query = '', page = 0, pageSize = 25) {
    const result = await cached('search:' + JSON.stringify([query.trim(), page, pageSize]), () =>
      rpc('colina_search_customers', { p_query: query.trim(), p_offset: page * pageSize, p_limit: pageSize }));
    return { ...result, rows: result.rows.map((row) => ({
      id: row.id, fullName: row.full_name, phone: formatPhone(row.phone),
      petNames: row.pet_names, petCount: row.pet_count,
    })) };
  }

  async function loadRegistrySummary() {
    state.registrySummary = await cached('registry-summary', () => rpc('colina_registry_summary'));
    return clone(state.registrySummary);
  }

  async function loadReceptionInsights(month) {
    const result = await cached('reception:' + month, () => rpc('colina_reception_insights', { p_month: month + '-01' }));
    return result;
  }

  async function loadFrequency(options) {
    const range = normalizeFrequencyRange(options);
    const key = 'frequency:' + JSON.stringify(range);
    const rows = await cached(key, () => rpc('colina_customer_frequency', {
      p_start: range.startDate || null, p_end: range.endDate || null,
    }));
    return rows;
  }

  async function loadCustomerHistory(customerId, options, page = 0) {
    const range = normalizeFrequencyRange(options);
    const key = 'history:' + JSON.stringify([customerId, range, page]);
    return cached(key, async () => {
      const params = { select: APPOINTMENT_SELECT, customer_id: `eq.${customerId}`,
        order: 'appointment_date.desc,arrival_time.desc,id.desc', offset: page * 50, limit: 51 };
      const bounds = [];
      if (range.startDate) bounds.push(`appointment_date.gte.${range.startDate}`);
      if (range.endDate) bounds.push(`appointment_date.lte.${range.endDate}`);
      if (bounds.length) params.and = `(${bounds.join(',')})`;
      const rows = await requestJson(buildUrl('grooming_appointments', params), { method: 'GET' });
      return { rows: rows.slice(0, 50).map(normalizeAppointment), hasMore: rows.length > 50 };
    });
  }

  function forgetAppointment(id) {
    Object.entries(cache).forEach(([key, entry]) => {
      if (key.startsWith('day:')) entry.value = entry.value.filter((item) => item.id !== id);
    });
    rebuildAppointments();
    persistCache();
  }

  async function reloadAppointment(id) {
    invalidateReports();
    const row = await maybeSingle('grooming_appointments', { select: APPOINTMENT_SELECT, id: `eq.${id}` });
    forgetAppointment(id);
    if (!row) throw new Error('Agendamento não encontrado. Atualize a agenda.');
    const appointment = normalizeAppointment(row);
    const entry = cache['day:' + appointment.date];
    if (entry) entry.value.push(appointment);
    rebuildAppointments();
    persistCache();
    emitAppointmentsChange({ source: 'mutation', id });
    return appointment;
  }

  async function reloadCustomer(id) {
    invalidateReports();
    const customer = await loadCustomer(id, true);
    // Atualiza os nomes já presentes na janela sem baixar novamente seus agendamentos.
    Object.entries(cache).forEach(([key, entry]) => {
      if (!key.startsWith('day:')) return;
      entry.value.forEach((item) => {
        if (item.customerId !== id) return;
        item.clientName = customer.fullName;
        item.phone = customer.phone;
        const pet = customer.pets.find((pet) => pet.id === item.petId);
        if (pet) { item.petName = pet.name; item.breed = pet.breed; }
      });
    });
    rebuildAppointments();
    persistCache();
    emitRegistryChange({ source: 'mutation', id });
    return customer;
  }

  function getAppointments() {
    return clone(state.appointments);
  }

  function getAppointmentById(appointmentId) {
    const appointment = state.appointments.find((item) => item.id === appointmentId);
    return appointment ? clone(appointment) : null;
  }

  function getCustomers() {
    return clone(state.customers);
  }

  function getCustomerRecordById(customerId) {
    return state.customers.find((customer) => customer.id === customerId) || null;
  }

  function getPetRecordById(customerId, petId) {
    const customer = getCustomerRecordById(customerId);
    if (!customer) {
      return null;
    }

    return customer.pets.find((pet) => pet.id === petId) || null;
  }

  function getCustomerById(customerId) {
    const customer = getCustomerRecordById(customerId);
    return customer ? clone(customer) : null;
  }

  function getPetsByCustomerId(customerId) {
    const customer = getCustomerRecordById(customerId);
    return customer ? clone(customer.pets) : [];
  }

  function getRegistrySummary() {
    return state.registrySummary || { totalCustomers: 0, totalPets: 0, multiPetCustomers: 0 };
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
    let presentCount = 0;
    let completedCount = 0;

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

      if (getAttendanceState(appointment) === 'present') {
        presentCount += 1;
      } else if (getAttendanceState(appointment) === 'completed') {
        completedCount += 1;
      }
    });

    return {
      total: appointments.length,
      bathCount,
      groomingTotal: groomingCounts.higienica + groomingCounts.tesoura + groomingCounts.maquina,
      morningCount,
      afternoonCount,
      presentCount,
      completedCount,
      groomingCounts,
    };
  }

  function getMonthlyGroomingCounts(month) {
    const entry = cache['reception:' + month];
    return entry ? entry.value.monthly : { higienica: 0, tesoura: 0, maquina: 0 };
  }

  function getFrequentPets(limit) {
    const entry = cache['reception:' + monthKey(activeDate || toDateKey(new Date()))];
    return (entry ? entry.value.frequent : []).slice(0, limit || 5)
      .map((item, index) => ({ ...item, emoji: PET_EMOJIS[index % PET_EMOJIS.length] }));
  }

  function normalizeFrequencyRange(options) {
    const source = options && options.range ? options.range : options || {};
    return {
      startDate: source.startDate || source.start || '',
      endDate: source.endDate || source.end || '',
    };
  }

  function hasConflict(nextAppointment) {
    const currentAppointmentId = normalizeText(nextAppointment.id);
    const nextPetId = normalizeText(nextAppointment.petId);
    const nextPetName = nextPetId
      ? ''
      : normalizeText(nextAppointment.petName || (getPetRecordById(nextAppointment.customerId, nextAppointment.petId) || {}).name);

    return state.appointments.some((appointment) => {
      if (currentAppointmentId && appointment.id === currentAppointmentId) {
        return false;
      }

      if (appointment.date !== nextAppointment.date || appointment.arrivalTime !== nextAppointment.arrivalTime) {
        return false;
      }

      if (nextPetId) {
        return appointment.petId === nextPetId;
      }

      return appointment.petName.trim().toLowerCase() === nextPetName.toLowerCase();
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

  async function deleteRows(table, filters) {
    const url = buildUrl(table, { ...filters, select: '*' });
    return requestJson(url, {
      method: 'DELETE',
      headers: {
        Prefer: 'return=representation',
      },
    });
  }

  async function findOrCreateCustomer(input) {
    const clientName = normalizeText(input.clientName || input.fullName);
    const phone = formatPhone(input.phone);

    if (!clientName) {
      throw new Error('Informe o nome do cliente antes de salvar.');
    }

    if (!isValidPhone(phone)) {
      throw new Error('Use o telefone no formato XX 9XXXX-XXXX.');
    }

    const existing = await maybeSingle('customers', {
      select: 'id,full_name,phone,notes',
      full_name: `eq.${clientName}`,
      phone: `eq.${phone}`,
    });

    if (existing) {
      return { customer: existing, action: 'existing' };
    }

    const created = await insertRows('customers', [
      {
        full_name: clientName,
        phone,
      },
    ]);

    return { customer: created[0], action: 'created' };
  }

  async function findOrCreatePet(customerId, input) {
    const petName = normalizeText(input.petName);
    const breed = normalizeText(input.breed);

    if (!petName || !breed) {
      throw new Error('Informe pet e raça para continuar.');
    }

    const existing = await maybeSingle('pets', {
      select: 'id,name,breed,notes',
      customer_id: `eq.${customerId}`,
      name: `eq.${petName}`,
    });

    if (!existing) {
      const created = await insertRows('pets', [
        {
          customer_id: customerId,
          name: petName,
          breed,
        },
      ]);

      return { pet: created[0], action: 'created' };
    }

    if (existing.breed !== breed && breed) {
      const updated = await updateRows(
        'pets',
        { id: `eq.${existing.id}` },
        { breed }
      );

      return { pet: updated[0], action: 'updated' };
    }

    return { pet: existing, action: 'existing' };
  }

  async function ensureCustomerSelection(customerId) {
    const customer = await loadCustomer(customerId);

    if (!customer) {
      throw new Error('Selecione um cliente cadastrado antes de continuar.');
    }

    return customer;
  }

  async function ensurePetSelection(customerId, petId) {
    const pet = getPetRecordById(customerId, petId);

    if (!pet) {
      throw new Error('Selecione um pet cadastrado antes de continuar.');
    }

    return pet;
  }

  function normalizePetPayloadList(input) {
    const rawPets = Array.isArray(input.pets) ? input.pets : [{ petName: input.petName, breed: input.breed }];
    const pets = [];
    const seenNames = new Set();

    rawPets.forEach((row) => {
      const petName = normalizeText(row && (row.petName || row.name));
      const breed = normalizeText(row && row.breed);

      if (!petName && !breed) {
        return;
      }

      if (!petName || !breed) {
        throw new Error('Preencha pet e raça em todas as linhas adicionadas.');
      }

      const key = petName.toLowerCase();
      if (seenNames.has(key)) {
        throw new Error('Não repita o mesmo pet nas linhas adicionadas.');
      }

      seenNames.add(key);
      pets.push({ petName, breed });
    });

    return pets;
  }

  async function savePetEntries(customerId, petEntries) {
    const results = [];

    for (const entry of petEntries) {
      results.push(await findOrCreatePet(customerId, entry));
    }

    return results;
  }

  async function saveCustomerRegistration(input) {
    const customerId = normalizeText(input.customerId);
    const fullName = normalizeText(input.fullName || input.clientName);
    const phone = formatPhone(input.phone);
    const petMode = normalizeText(input.petMode) || (customerId ? 'client' : 'new');
    const petEntries = normalizePetPayloadList(input);

    if (!fullName) {
      throw new Error('Preencha o nome do cliente antes de salvar.');
    }

    if (!isValidPhone(phone)) {
      throw new Error('Use o telefone no formato XX 9XXXX-XXXX.');
    }

    let customerAction = 'existing';
    let customer;
    let petResults = [];

    if (!customerId) {
      if (!petEntries.length) {
        throw new Error('No novo cadastro, informe pelo menos um pet com raça.');
      }

      const customerResult = await findOrCreateCustomer({ fullName, phone });
      const savedPetResults = await savePetEntries(customerResult.customer.id, petEntries);

      customer = customerResult.customer;
      petResults = savedPetResults;
      customerAction = customerResult.action;
    } else {
      const currentCustomer = await ensureCustomerSelection(customerId);
      customer = currentCustomer;

      if (currentCustomer.fullName !== fullName || currentCustomer.phone !== phone) {
        const updatedCustomer = await updateRows(
          'customers',
          { id: `eq.${customerId}` },
          {
            full_name: fullName,
            phone,
          }
        );
        customer = updatedCustomer[0];
        customerAction = 'updated';
      }

      if (petMode === 'new') {
        if (!petEntries.length) {
          throw new Error('Informe pelo menos um novo pet com raça.');
        }

        petResults = await savePetEntries(customerId, petEntries);
      } else if (petMode !== 'client') {
        const currentPet = await ensurePetSelection(customerId, petMode);
        const petEntry = petEntries[0];

        if (!petEntry) {
          throw new Error('Informe o nome e a raça do pet selecionado.');
        }

        if (petEntries.length > 1) {
          throw new Error('Ao editar um pet existente, use apenas uma linha de pet e raça.');
        }

        if (currentPet.name !== petEntry.petName || currentPet.breed !== petEntry.breed) {
          const updatedPet = await updateRows(
            'pets',
            { id: `eq.${currentPet.id}` },
            {
              name: petEntry.petName,
              breed: petEntry.breed,
            }
          );

          petResults = [{ pet: updatedPet[0], action: 'updated' }];
        } else {
          petResults = [{ pet: currentPet, action: 'existing' }];
        }
      }
    }

    await reloadCustomer(customer.id);

    const affectedPets = petResults
      .map((result) => clone(getPetRecordById(customer.id, result.pet.id)))
      .filter(Boolean);

    return {
      customer: clone(getCustomerRecordById(customer.id)),
      pet: affectedPets[0] || null,
      pets: affectedPets,
      customerAction,
      petAction: petResults.length <= 1 ? (petResults[0] ? petResults[0].action : 'none') : 'multiple',
      petActions: petResults.map((result) => result.action),
      petMode,
    };
  }

  async function addCustomerRegistration(input) {
    return saveCustomerRegistration(input);
  }

  function normalizePetListWithIds(rawPets) {
    const pets = [];
    const seenNames = new Set();

    (Array.isArray(rawPets) ? rawPets : []).forEach((row) => {
      const id = normalizeText(row && row.id);
      const petName = normalizeText(row && (row.petName || row.name));
      const breed = normalizeText(row && row.breed);

      if (!petName && !breed) {
        return;
      }

      if (!petName || !breed) {
        throw new Error('Preencha nome e raça em todos os pets.');
      }

      const key = petName.toLowerCase();
      if (seenNames.has(key)) {
        throw new Error('Há dois pets com o mesmo nome neste cliente.');
      }

      seenNames.add(key);
      pets.push({ id, petName, breed });
    });

    return pets;
  }

  // Salva um cliente e a sua lista completa de pets numa única operação:
  // atualiza os pets existentes que mudaram e cria os novos. Base do
  // cadastro em ficha única (master-detail), sem modos separados.
  async function saveCustomerWithPets(input) {
    const customerId = normalizeText(input.customerId);
    const fullName = normalizeText(input.fullName);
    const phone = formatPhone(input.phone);

    if (!fullName) {
      throw new Error('Preencha o nome do cliente antes de salvar.');
    }

    if (!isValidPhone(phone)) {
      throw new Error('Use o telefone no formato XX 9XXXX-XXXX.');
    }

    const pets = normalizePetListWithIds(input.pets);

    let customer;
    let customerAction = 'existing';

    if (!customerId) {
      if (!pets.length) {
        throw new Error('Adicione pelo menos um pet com raça para criar o cadastro.');
      }

      const result = await findOrCreateCustomer({ fullName, phone });
      customer = result.customer;
      customerAction = result.action;
    } else {
      const current = await ensureCustomerSelection(customerId);
      customer = current;

      if (current.fullName !== fullName || current.phone !== phone) {
        const updated = await updateRows('customers', { id: `eq.${customerId}` }, { full_name: fullName, phone });
        customer = updated[0];
        customerAction = 'updated';
      }
    }

    let created = 0;
    let updated = 0;

    for (const pet of pets) {
      if (pet.id) {
        const currentPet = getPetRecordById(customer.id, pet.id);
        if (!currentPet || currentPet.name !== pet.petName || currentPet.breed !== pet.breed) {
          await updateRows('pets', { id: `eq.${pet.id}` }, { name: pet.petName, breed: pet.breed });
          updated += 1;
        }
      } else {
        const result = await findOrCreatePet(customer.id, pet);
        if (result.action === 'created') {
          created += 1;
        } else if (result.action === 'updated') {
          updated += 1;
        }
      }
    }

    await reloadCustomer(customer.id);

    return {
      customer: clone(getCustomerRecordById(customer.id)),
      customerAction,
      petsCreated: created,
      petsUpdated: updated,
    };
  }

  async function deleteCustomer(customerId) {
    if (!customerId) {
      throw new Error('Cliente não encontrado.');
    }

    const existing = await maybeSingle('customers', { select: 'id', id: `eq.${customerId}` });
    if (!existing) {
      throw new Error('Não foi possível encontrar o cliente para excluir.');
    }

    await deleteRows('pets', { customer_id: `eq.${customerId}` });
    await deleteRows('customers', { id: `eq.${customerId}` });

    const remaining = await maybeSingle('customers', { select: 'id', id: `eq.${customerId}` });
    if (remaining) {
      throw new Error('A exclusão foi bloqueada pelo Supabase. Verifique as permissões de DELETE na tabela customers e tente novamente.');
    }

    invalidateReports();
    delete cache['customer:' + customerId];
    state.customers = state.customers.filter((item) => item.id !== customerId);
    persistCache();
    emitRegistryChange({ source: 'mutation', id: customerId });
  }

  async function addAppointment(input) {

    if (hasConflict(input)) {
      throw new Error('Já existe um agendamento para este pet no mesmo dia e horário.');
    }

    let customer;
    let pet;

    if (input.customerId && input.petId) {
      customer = await ensureCustomerSelection(input.customerId);
      pet = await ensurePetSelection(input.customerId, input.petId);
    } else {
      const customerResult = await findOrCreateCustomer(input);
      const petResult = await findOrCreatePet(customerResult.customer.id, input);
      customer = normalizeCustomer({
        ...customerResult.customer,
        pets: [petResult.pet],
      });
      pet = normalizePet(petResult.pet);
    }

    const created = await insertRows('grooming_appointments', [
      {
        customer_id: customer.id,
        pet_id: pet.id,
        appointment_date: input.date,
        arrival_time: input.arrivalTime,
        shift: getShiftForTime(input.arrivalTime),
        bath: Boolean(input.bath),
        tele: Boolean(input.tele),
        grooming_type: input.groomingType || null,
        charged_amount: normalizeChargedAmount(input.chargedAmount),
        notes: normalizeText(input.notes),
      },
    ]);

    return reloadAppointment(created[0].id);
  }

  async function updateAppointment(input) {

    const appointmentId = normalizeText(input.id);
    if (!appointmentId) {
      throw new Error('Selecione um agendamento para editar.');
    }

    if (hasConflict(input)) {
      throw new Error('J\u00e1 existe um agendamento para este pet no mesmo dia e hor\u00e1rio.');
    }

    const customer = await ensureCustomerSelection(input.customerId);
    const pet = await ensurePetSelection(customer.id, input.petId);

    const updated = await updateRows(
      'grooming_appointments',
      { id: `eq.${appointmentId}` },
      {
        customer_id: customer.id,
        pet_id: pet.id,
        appointment_date: input.date,
        arrival_time: input.arrivalTime,
        shift: getShiftForTime(input.arrivalTime),
        bath: Boolean(input.bath),
        tele: Boolean(input.tele),
        grooming_type: input.groomingType || null,
        charged_amount: normalizeChargedAmount(input.chargedAmount),
        notes: normalizeText(input.notes),
      }
    );

    if (!updated.length) {
      throw new Error('N\u00e3o foi poss\u00edvel encontrar o agendamento para atualizar.');
    }

    return reloadAppointment(updated[0].id);
  }

  async function deleteAppointment(appointmentId) {

    const id = normalizeText(appointmentId);
    if (!id) {
      throw new Error('Selecione um agendamento para excluir.');
    }

    const existing = await maybeSingle('grooming_appointments', {
      select: APPOINTMENT_SELECT,
      id: `eq.${id}`,
    });

    if (!existing) {
      throw new Error('Não foi possível encontrar o agendamento para excluir.');
    }

    await deleteRows('grooming_appointments', { id: `eq.${id}` });
    const remaining = await maybeSingle('grooming_appointments', {
      select: 'id',
      id: `eq.${id}`,
    });

    if (remaining) {
      throw new Error('A exclusão foi bloqueada no Supabase. Aplique a migration de DELETE da agenda e tente novamente.');
    }

    invalidateReports();
    forgetAppointment(id);
    emitAppointmentsChange({ source: 'mutation', id });
    return normalizeAppointment(existing);
  }

  async function updateAppointmentAttendance(appointmentId, values) {

    const id = normalizeText(appointmentId);
    if (!id) {
      throw new Error('Selecione um agendamento para atualizar a presença.');
    }

    const appointment = state.appointments.find((item) => item.id === id);
    if (!appointment) {
      throw new Error('Não foi possível encontrar o agendamento.');
    }

    if (appointment.status === 'cancelled') {
      throw new Error('Este agendamento está cancelado e não pode receber chegada ou saída.');
    }

    const updated = await updateRows('grooming_appointments', { id: `eq.${id}` }, values);

    if (!updated.length) {
      throw new Error('Não foi possível atualizar o status de chegada/saída.');
    }

    return reloadAppointment(id);
  }

  async function markAppointmentArrival(appointmentId) {
    const appointment = getAppointmentById(appointmentId);

    if (!appointment) {
      throw new Error('Não foi possível encontrar o agendamento.');
    }

    if (appointment.checkedOutAt) {
      throw new Error('Este atendimento já foi finalizado. Desfaça a saída antes de marcar nova chegada.');
    }

    if (appointment.checkedInAt) {
      return appointment;
    }

    return updateAppointmentAttendance(appointmentId, {
      checked_in_at: new Date().toISOString(),
      checked_out_at: null,
      status: 'scheduled',
    });
  }

  async function markAppointmentDeparture(appointmentId) {
    const appointment = getAppointmentById(appointmentId);

    if (!appointment) {
      throw new Error('Não foi possível encontrar o agendamento.');
    }

    if (!appointment.checkedInAt) {
      throw new Error('Marque a chegada antes de registrar a saída.');
    }

    if (appointment.checkedOutAt) {
      return appointment;
    }

    return updateAppointmentAttendance(appointmentId, {
      checked_out_at: new Date().toISOString(),
      status: 'completed',
    });
  }

  async function undoAppointmentArrival(appointmentId) {
    const appointment = getAppointmentById(appointmentId);

    if (!appointment) {
      throw new Error('Não foi possível encontrar o agendamento.');
    }

    if (appointment.checkedOutAt) {
      throw new Error('Desfaça a saída antes de limpar a chegada.');
    }

    if (!appointment.checkedInAt) {
      return appointment;
    }

    return updateAppointmentAttendance(appointmentId, {
      checked_in_at: null,
      status: 'scheduled',
    });
  }

  async function undoAppointmentDeparture(appointmentId) {
    const appointment = getAppointmentById(appointmentId);

    if (!appointment) {
      throw new Error('Não foi possível encontrar o agendamento.');
    }

    if (!appointment.checkedOutAt) {
      return appointment;
    }

    return updateAppointmentAttendance(appointmentId, {
      checked_out_at: null,
      status: 'scheduled',
    });
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

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.ColinaAgenda = {
    ready,
    refreshAppointments,
    loadAppointmentWindow,
    loadCustomer,
    searchCustomerPage,
    loadRegistrySummary,
    loadReceptionInsights,
    loadFrequency,
    loadCustomerHistory,
    debounce,
    startVisibleSync,
    getAppointments,
    getAppointmentById,
    getCustomers,
    getCustomerById,
    getPetsByCustomerId,
    getRegistrySummary,
    getAppointmentsByDate,
    getAppointmentsByDateAndShift,
    getDaySummary,
    getMonthlyGroomingCounts,
    getFrequentPets,
    getAttendanceState,
    getAttendanceLabel,
    getAttendanceSummaryLabel,
    formatTimeLabel,
    hasConflict,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    markAppointmentArrival,
    markAppointmentDeparture,
    undoAppointmentArrival,
    undoAppointmentDeparture,
    addCustomerRegistration,
    saveCustomerRegistration,
    saveCustomerWithPets,
    deleteCustomer,
    buildDayWindow,
    toDateKey,
    fromDateKey,
    formatLongDate,
    formatShortDate,
    formatMonthYear,
    formatMonthShort,
    formatWeekdayShort,
    monthKey,
    getShiftForTime,
    getShiftLabel,
    getGroomingLabel,
    getServiceLabels,
    formatCurrency,
    formatPhone,
    isValidPhone,
    phoneDigits,
    escapeHtml,
    isLoading: function () {
      return pending.size > 0 || dayPending.size > 0;
    },
    getLastError: function () {
      return state.lastError;
    },
  };
})();
