(function () {
  const STORAGE_KEY = 'colina-vet-agenda-v2';
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

  function safeStorage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function seedState() {
    const today = startOfDay(new Date());
    const at = (days) => toDateKey(offsetDate(today, days));

    return {
      appointments: [
        { id: 'seed-1', date: at(-3), arrivalTime: '08:00', phone: '(47) 99112-1300', clientName: 'Carlos Mendes', petName: 'Thor', breed: 'Labrador', bath: true, groomingType: 'tesoura', notes: 'Pele sensível. Usar perfume suave.' },
        { id: 'seed-2', date: at(-3), arrivalTime: '09:10', phone: '(47) 99641-3201', clientName: 'Ana Paula Souza', petName: 'Mel', breed: 'Persa', bath: true, groomingType: 'higienica', notes: 'Cortar somente a região das patas.' },
        { id: 'seed-3', date: at(-3), arrivalTime: '10:40', phone: '(47) 99988-9014', clientName: 'Roberto Alves', petName: 'Pipoca', breed: 'Shih-tzu', bath: true, groomingType: '', notes: 'Banho avulso com hidratação.' },
        { id: 'seed-4', date: at(-3), arrivalTime: '13:30', phone: '(47) 99273-6142', clientName: 'Juliana Torres', petName: 'Nuvem', breed: 'Lhasa Apso', bath: true, groomingType: 'maquina', notes: 'Evitar máquina muito curta no dorso.' },

        { id: 'seed-5', date: at(-2), arrivalTime: '08:20', phone: '(47) 99112-1300', clientName: 'Carlos Mendes', petName: 'Thor', breed: 'Labrador', bath: true, groomingType: 'higienica', notes: 'Chega de coleira vermelha.' },
        { id: 'seed-6', date: at(-2), arrivalTime: '09:15', phone: '(47) 99755-4832', clientName: 'Fernanda Lima', petName: 'Bolinha', breed: 'Poodle', bath: true, groomingType: 'tesoura', notes: 'Manter topete arredondado.' },
        { id: 'seed-7', date: at(-2), arrivalTime: '14:00', phone: '(47) 99641-3201', clientName: 'Ana Paula Souza', petName: 'Mel', breed: 'Persa', bath: true, groomingType: 'maquina', notes: 'Secagem mais delicada no peito.' },
        { id: 'seed-8', date: at(-2), arrivalTime: '15:10', phone: '(47) 99445-8103', clientName: 'Sandra Reis', petName: 'Max', breed: 'Golden Retriever', bath: true, groomingType: 'tesoura', notes: '' },

        { id: 'seed-9', date: at(-1), arrivalTime: '08:00', phone: '(47) 99641-3201', clientName: 'Ana Paula Souza', petName: 'Mel', breed: 'Persa', bath: true, groomingType: 'higienica', notes: '' },
        { id: 'seed-10', date: at(-1), arrivalTime: '09:40', phone: '(47) 99112-1300', clientName: 'Carlos Mendes', petName: 'Thor', breed: 'Labrador', bath: true, groomingType: 'tesoura', notes: 'Cliente pediu foto antes da saída.' },
        { id: 'seed-11', date: at(-1), arrivalTime: '10:20', phone: '(47) 99988-9014', clientName: 'Roberto Alves', petName: 'Pipoca', breed: 'Shih-tzu', bath: true, groomingType: 'maquina', notes: '' },
        { id: 'seed-12', date: at(-1), arrivalTime: '13:00', phone: '(47) 99755-4832', clientName: 'Fernanda Lima', petName: 'Bolinha', breed: 'Poodle', bath: true, groomingType: '', notes: 'Somente banho e escovação.' },
        { id: 'seed-13', date: at(-1), arrivalTime: '15:30', phone: '(47) 99273-6142', clientName: 'Juliana Torres', petName: 'Nuvem', breed: 'Lhasa Apso', bath: true, groomingType: 'tesoura', notes: '' },

        { id: 'seed-14', date: at(0), arrivalTime: '08:00', phone: '(47) 99112-1300', clientName: 'Carlos Mendes', petName: 'Thor', breed: 'Labrador', bath: true, groomingType: 'tesoura', notes: 'Retirar às 11h30.' },
        { id: 'seed-15', date: at(0), arrivalTime: '08:45', phone: '(47) 99641-3201', clientName: 'Ana Paula Souza', petName: 'Mel', breed: 'Persa', bath: true, groomingType: 'higienica', notes: 'Usar laço rosa.' },
        { id: 'seed-16', date: at(0), arrivalTime: '09:30', phone: '(47) 99988-9014', clientName: 'Roberto Alves', petName: 'Pipoca', breed: 'Shih-tzu', bath: true, groomingType: 'maquina', notes: '' },
        { id: 'seed-17', date: at(0), arrivalTime: '10:30', phone: '(47) 99755-4832', clientName: 'Fernanda Lima', petName: 'Bolinha', breed: 'Poodle', bath: true, groomingType: '', notes: 'Cliente chega um pouco mais cedo.' },
        { id: 'seed-18', date: at(0), arrivalTime: '13:00', phone: '(47) 99273-6142', clientName: 'Juliana Torres', petName: 'Nuvem', breed: 'Lhasa Apso', bath: true, groomingType: 'tesoura', notes: '' },
        { id: 'seed-19', date: at(0), arrivalTime: '14:15', phone: '(47) 99445-8103', clientName: 'Sandra Reis', petName: 'Max', breed: 'Golden Retriever', bath: true, groomingType: 'higienica', notes: 'Escovação caprichada na cauda.' },
        { id: 'seed-20', date: at(0), arrivalTime: '15:00', phone: '(47) 99380-6110', clientName: 'Paula Azevedo', petName: 'Lola', breed: 'Spitz Alemão', bath: true, groomingType: 'maquina', notes: 'Cliente pediu aviso por WhatsApp.' },
        { id: 'seed-21', date: at(0), arrivalTime: '16:30', phone: '(47) 99210-3402', clientName: 'Marcelo Prado', petName: 'Chico', breed: 'Bulldog Francês', bath: true, groomingType: '', notes: '' },

        { id: 'seed-22', date: at(1), arrivalTime: '08:30', phone: '(47) 99112-1300', clientName: 'Carlos Mendes', petName: 'Thor', breed: 'Labrador', bath: true, groomingType: 'tesoura', notes: '' },
        { id: 'seed-23', date: at(1), arrivalTime: '09:30', phone: '(47) 99641-3201', clientName: 'Ana Paula Souza', petName: 'Mel', breed: 'Persa', bath: true, groomingType: 'higienica', notes: '' },
        { id: 'seed-24', date: at(1), arrivalTime: '14:00', phone: '(47) 99830-2211', clientName: 'Marcos Costa', petName: 'Luna', breed: 'Maltês', bath: true, groomingType: 'maquina', notes: 'Primeira visita.' },

        { id: 'seed-25', date: at(2), arrivalTime: '09:00', phone: '(47) 99755-4832', clientName: 'Fernanda Lima', petName: 'Bolinha', breed: 'Poodle', bath: true, groomingType: '', notes: '' },
        { id: 'seed-26', date: at(2), arrivalTime: '10:00', phone: '(47) 99273-6142', clientName: 'Juliana Torres', petName: 'Nuvem', breed: 'Lhasa Apso', bath: true, groomingType: 'tesoura', notes: '' },
        { id: 'seed-27', date: at(2), arrivalTime: '15:30', phone: '(47) 99988-9014', clientName: 'Roberto Alves', petName: 'Pipoca', breed: 'Shih-tzu', bath: true, groomingType: 'higienica', notes: '' },
      ],
    };
  }

  function ensureState() {
    const storage = safeStorage();
    if (!storage) {
      return seedState();
    }

    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.appointments)) {
          return parsed;
        }
      }
    } catch (error) {
      storage.removeItem(STORAGE_KEY);
    }

    const seeded = seedState();
    storage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  function saveState(state) {
    const storage = safeStorage();
    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    return state;
  }

  function getAppointments() {
    return clone(ensureState().appointments).sort(compareAppointments);
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

    const groomingTotal = groomingCounts.higienica + groomingCounts.tesoura + groomingCounts.maquina;

    return {
      total: appointments.length,
      bathCount,
      groomingTotal,
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
    return getAppointments().some((appointment) => {
      return (
        appointment.date === nextAppointment.date &&
        appointment.arrivalTime === nextAppointment.arrivalTime &&
        appointment.petName.trim().toLowerCase() === nextAppointment.petName.trim().toLowerCase()
      );
    });
  }

  function addAppointment(input) {
    const appointment = {
      id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `manual-${Date.now()}`,
      date: input.date,
      arrivalTime: input.arrivalTime,
      phone: input.phone.trim(),
      clientName: input.clientName.trim(),
      petName: input.petName.trim(),
      breed: input.breed.trim(),
      bath: Boolean(input.bath),
      groomingType: input.groomingType || '',
      notes: input.notes.trim(),
      createdAt: new Date().toISOString(),
    };

    const nextState = ensureState();
    nextState.appointments.push(appointment);
    nextState.appointments.sort(compareAppointments);
    saveState(nextState);
    window.dispatchEvent(new CustomEvent('colina:appointments-changed', { detail: appointment }));
    return appointment;
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
    getAppointments,
    getAppointmentsByDate,
    getAppointmentsByDateAndShift,
    getDaySummary,
    getMonthlyGroomingCounts,
    getFrequentPets,
    hasConflict,
    addAppointment,
    buildDayWindow,
  };
})();
