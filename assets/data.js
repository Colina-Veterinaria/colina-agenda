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
  // Limiares de reaquecimento (em dias desde a última visita).
  const ACTIVITY_THRESHOLDS = {
    active: 30,
    cooling: 60,
  };
  const SEGMENT_LABELS = {
    agendado: 'Agendado',
    ativo: 'Ativo',
    esfriando: 'Esfriando',
    inativo: 'Inativo',
    novo: 'Sem visita',
  };
  const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const PET_EMOJIS = ['🐶', '🐱', '🐾', '🐶', '🐱'];

  const state = {
    appointments: [],
    customers: [],
    appointmentsInitialized: false,
    registryInitialized: false,
    loadingAppointments: false,
    loadingRegistry: false,
    lastError: null,
  };

  // Cache em sessionStorage para troca de tela instantânea (stale-while-revalidate):
  // a página hidrata o estado na hora e revalida no Supabase em segundo plano.
  // A versão protege contra formatos antigos quando o normalize mudar.
  const CACHE_KEYS = {
    appointments: 'colina:v1:appointments',
    customers: 'colina:v1:customers',
  };

  function readCache(key) {
    try {
      const raw = sessionStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writeCache(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // sessionStorage indisponível ou cheio: seguimos só com o estado em memória.
    }
  }

  // Hidrata o estado a partir do cache já no carregamento, antes de qualquer
  // render, para que getAppointments/getCustomers tenham dados de imediato.
  (function hydrateFromCache() {
    const cachedAppointments = readCache(CACHE_KEYS.appointments);
    if (cachedAppointments) {
      state.appointments = cachedAppointments;
      state.appointmentsInitialized = true;
    }

    const cachedCustomers = readCache(CACHE_KEYS.customers);
    if (cachedCustomers) {
      state.customers = cachedCustomers;
      state.registryInitialized = true;
    }
  })();

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
    return {
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
      groomingType: row.grooming_type || '',
      notes: row.notes || '',
      status: row.status || 'scheduled',
    };
  }

  async function fetchAppointments() {
    const url = buildUrl('grooming_appointments', {
      select:
        'id,customer_id,pet_id,appointment_date,arrival_time,shift,bath,grooming_type,notes,status,customer:customers!grooming_appointments_customer_id_fkey(id,full_name,phone),pet:pets!grooming_appointments_pet_id_fkey(id,name,breed)',
      order: 'appointment_date.asc,arrival_time.asc',
    });

    const data = await requestJson(url, { method: 'GET' });
    return (data || []).map(normalizeAppointment).sort(compareAppointments);
  }

  async function fetchCustomers() {
    const url = buildUrl('customers', {
      select: 'id,full_name,phone,notes,pets(id,name,breed,notes)',
      order: 'full_name.asc',
    });

    url.searchParams.set('pets.order', 'name.asc');

    const data = await requestJson(url, { method: 'GET' });
    return (data || []).map(normalizeCustomer).sort(compareCustomers);
  }

  async function refreshAppointments() {
    state.loadingAppointments = true;

    try {
      const appointments = await fetchAppointments();
      const changed = !state.appointmentsInitialized || JSON.stringify(appointments) !== JSON.stringify(state.appointments);
      state.appointments = appointments;
      state.appointmentsInitialized = true;
      state.lastError = null;
      writeCache(CACHE_KEYS.appointments, appointments);
      if (changed) {
        emitAppointmentsChange({ source: 'refresh', total: appointments.length });
      }
      return clone(appointments);
    } catch (error) {
      state.lastError = error;
      throw error;
    } finally {
      state.loadingAppointments = false;
    }
  }

  async function refreshCustomers() {
    state.loadingRegistry = true;

    try {
      const customers = await fetchCustomers();
      const changed = !state.registryInitialized || JSON.stringify(customers) !== JSON.stringify(state.customers);
      state.customers = customers;
      state.registryInitialized = true;
      state.lastError = null;
      writeCache(CACHE_KEYS.customers, customers);
      if (changed) {
        emitRegistryChange({ source: 'refresh', total: customers.length });
      }
      return clone(customers);
    } catch (error) {
      state.lastError = error;
      throw error;
    } finally {
      state.loadingRegistry = false;
    }
  }

  async function ready() {
    // Espera de rede só quando não há dado nenhum (primeiro acesso da sessão).
    // Com cache hidratado, revalidamos em segundo plano: a tela já renderizou
    // e os eventos de mudança atualizam o conteúdo quando o fresco chega.
    const tasks = [];
    const background = [];

    if (!state.appointmentsInitialized) {
      tasks.push(refreshAppointments());
    } else {
      background.push(refreshAppointments);
    }

    if (!state.registryInitialized) {
      tasks.push(refreshCustomers());
    } else {
      background.push(refreshCustomers);
    }

    if (tasks.length) {
      await Promise.all(tasks);
    }

    if (background.length) {
      Promise.all(background.map((refresh) => refresh())).catch(() => {
        // Mantemos os dados em cache; a revalidação tenta de novo na próxima troca.
      });
    }

    return {
      appointments: clone(state.appointments),
      customers: clone(state.customers),
    };
  }

  function getAppointments() {
    return clone(state.appointments);
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
    const customers = state.customers;
    const totalPets = customers.reduce((total, customer) => total + customer.pets.length, 0);
    const multiPetCustomers = customers.filter((customer) => customer.pets.length > 1).length;

    return {
      totalCustomers: customers.length,
      totalPets,
      multiPetCustomers,
    };
  }

  function searchCustomers(query, limit) {
    const normalizedQuery = normalizeText(query).toLowerCase();
    const numericQuery = phoneDigits(query);

    let results = state.customers.filter((customer) => {
      if (!normalizedQuery && !numericQuery) {
        return true;
      }

      const textStack = [
        customer.fullName,
        customer.phone,
        customer.notes,
        customer.pets.map((pet) => `${pet.name} ${pet.breed} ${pet.notes}`).join(' '),
      ]
        .join(' ')
        .toLowerCase();

      const phoneStack = phoneDigits(customer.phone);

      return textStack.includes(normalizedQuery) || (numericQuery ? phoneStack.includes(numericQuery) : false);
    });

    if (typeof limit === 'number') {
      results = results.slice(0, limit);
    }

    return clone(results);
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

  function daysBetween(fromKey, toKey) {
    const from = fromDateKey(fromKey);
    const to = fromDateKey(toKey);
    return Math.round((to - from) / 86400000);
  }

  function getSegmentLabel(segment) {
    return SEGMENT_LABELS[segment] || 'Cliente';
  }

  function segmentFor(info, daysSince) {
    if (info.nextVisit) {
      return 'agendado';
    }

    if (info.lastVisit === null) {
      return 'novo';
    }

    if (daysSince <= ACTIVITY_THRESHOLDS.active) {
      return 'ativo';
    }

    if (daysSince <= ACTIVITY_THRESHOLDS.cooling) {
      return 'esfriando';
    }

    return 'inativo';
  }

  // Enriquece cada cliente com última visita, próximo agendamento, dias sem
  // vir e segmento de reaquecimento. Base da tela de Frequência.
  function getCustomerActivity() {
    const todayKey = toDateKey(new Date());
    const byCustomer = new Map();

    state.appointments.forEach((appointment) => {
      if (!appointment.customerId) {
        return;
      }

      const entry = byCustomer.get(appointment.customerId) || {
        lastVisit: null,
        nextVisit: null,
        visitCount: 0,
      };

      if (appointment.date <= todayKey) {
        entry.visitCount += 1;
        if (!entry.lastVisit || appointment.date > entry.lastVisit) {
          entry.lastVisit = appointment.date;
        }
      } else if (!entry.nextVisit || appointment.date < entry.nextVisit) {
        entry.nextVisit = appointment.date;
      }

      byCustomer.set(appointment.customerId, entry);
    });

    return state.customers.map((customer) => {
      const info = byCustomer.get(customer.id) || { lastVisit: null, nextVisit: null, visitCount: 0 };
      const daysSince = info.lastVisit ? daysBetween(info.lastVisit, todayKey) : null;
      const daysUntilNext = info.nextVisit ? daysBetween(todayKey, info.nextVisit) : null;

      return {
        ...clone(customer),
        lastVisit: info.lastVisit,
        nextVisit: info.nextVisit,
        daysSince,
        daysUntilNext,
        visitCount: info.visitCount,
        segment: segmentFor(info, daysSince),
      };
    });
  }

  function getActivitySummary() {
    const counts = { ativo: 0, esfriando: 0, inativo: 0, novo: 0, agendado: 0 };
    const list = getCustomerActivity();

    list.forEach((customer) => {
      counts[customer.segment] += 1;
    });

    return { total: list.length, ...counts };
  }

  function hasConflict(nextAppointment) {
    const nextPetId = normalizeText(nextAppointment.petId);
    const nextPetName = nextPetId
      ? ''
      : normalizeText(nextAppointment.petName || (getPetRecordById(nextAppointment.customerId, nextAppointment.petId) || {}).name);

    return state.appointments.some((appointment) => {
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
    await ready();
    const customer = getCustomerRecordById(customerId);

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

    await refreshCustomers();

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

    await refreshCustomers();

    return {
      customer: clone(getCustomerRecordById(customer.id)),
      customerAction,
      petsCreated: created,
      petsUpdated: updated,
    };
  }

  async function addAppointment(input) {
    await ready();

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
        grooming_type: input.groomingType || null,
        notes: normalizeText(input.notes),
      },
    ]);

    await Promise.all([refreshAppointments(), refreshCustomers()]);
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

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.ColinaAgenda = {
    ready,
    refreshAppointments,
    refreshCustomers,
    getAppointments,
    getCustomers,
    getCustomerById,
    getPetsByCustomerId,
    getRegistrySummary,
    searchCustomers,
    getAppointmentsByDate,
    getAppointmentsByDateAndShift,
    getDaySummary,
    getMonthlyGroomingCounts,
    getFrequentPets,
    getCustomerActivity,
    getActivitySummary,
    getSegmentLabel,
    hasConflict,
    addAppointment,
    addCustomerRegistration,
    saveCustomerRegistration,
    saveCustomerWithPets,
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
    formatPhone,
    isValidPhone,
    phoneDigits,
    escapeHtml,
    isLoading: function () {
      return state.loadingAppointments || state.loadingRegistry;
    },
    getLastError: function () {
      return state.lastError;
    },
  };
})();
