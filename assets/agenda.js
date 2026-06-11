(function () {
  const api = window.ColinaAgenda;
  const todayKey = api.toDateKey(new Date());
  const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  let selectedDateKey = todayKey;
  let selectedShift = currentMinutes < 12 * 60 ? 'manha' : 'tarde';

  const ranges = {
    manha: { startHour: 7, endHour: 12, label: '07h às 12h' },
    tarde: { startHour: 12, endHour: 18, label: '12h às 18h' },
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function updateClock() {
    const now = new Date();
    qs('clockTime').textContent = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    qs('clockDate').textContent = api.formatLongDate(api.toDateKey(now));
    qs('footerUpdated').textContent = `Atualizado às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function renderDayNav() {
    const container = qs('dayPills');
    container.innerHTML = '';

    api.buildDayWindow(selectedDateKey, 2).forEach((day) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `day-pill${day.dateKey === selectedDateKey ? ' is-active' : ''}${day.isToday ? ' is-today' : ''}`;
      button.innerHTML = `
        <div class="pill-label">${day.isToday ? 'hoje' : day.label}</div>
        <div class="pill-date">${day.dateNumber}</div>
        <div class="pill-month">${day.monthLabel}</div>
      `;
      button.addEventListener('click', function () {
        selectedDateKey = day.dateKey;
        render();
      });
      container.appendChild(button);
    });
  }

  function renderSummary() {
    const summary = api.getDaySummary(selectedDateKey);
    const activeSummary = qs('agendaSummary');

    qs('turnoManha').classList.toggle('is-active', selectedShift === 'manha');
    qs('turnoTarde').classList.toggle('is-active', selectedShift === 'tarde');
    qs('countManha').textContent = `${summary.morningCount} agendado${summary.morningCount === 1 ? '' : 's'}`;
    qs('countTarde').textContent = `${summary.afternoonCount} agendado${summary.afternoonCount === 1 ? '' : 's'}`;

    activeSummary.innerHTML = `
      <div class="summary-chip">
        <span class="summary-chip-value">${summary.total}</span>
        <span class="summary-chip-label">no dia</span>
      </div>
      <div class="summary-chip">
        <span class="summary-chip-value">${summary.bathCount}</span>
        <span class="summary-chip-label">com banho</span>
      </div>
      <div class="summary-chip">
        <span class="summary-chip-value">${summary.groomingCounts.higienica}</span>
        <span class="summary-chip-label">tosa higiênica</span>
      </div>
      <div class="summary-chip">
        <span class="summary-chip-value">${summary.groomingCounts.tesoura}</span>
        <span class="summary-chip-label">tosa tesoura</span>
      </div>
      <div class="summary-chip">
        <span class="summary-chip-value">${summary.groomingCounts.maquina}</span>
        <span class="summary-chip-label">tosa máquina</span>
      </div>
    `;
  }

  function buildRows() {
    const appointments = api.getAppointmentsByDateAndShift(selectedDateKey, selectedShift);
    const { startHour, endHour } = ranges[selectedShift];
    const rows = [];

    for (let hour = startHour; hour < endHour; hour += 1) {
      const hourAppointments = appointments.filter((appointment) => Number(appointment.arrivalTime.slice(0, 2)) === hour);

      if (!hourAppointments.length) {
        rows.push({
          type: 'empty',
          hourBreak: true,
          label: `${String(hour).padStart(2, '0')}:00`,
        });
        continue;
      }

      hourAppointments.forEach((appointment, index) => {
        rows.push({
          type: 'appointment',
          appointment,
          hourBreak: index === 0,
        });
      });
    }

    return rows;
  }

  function renderTable() {
    const rows = buildRows();
    const tbody = qs('agendaTableBody');

    tbody.innerHTML = rows
      .map((row) => {
        if (row.type === 'empty') {
          return `
            <tr class="row-empty${row.hourBreak ? ' row-hour-break' : ''}">
              <td class="cell-time">${row.label}</td>
              <td colspan="7" class="slot-message">Livre para encaixe neste horário.</td>
            </tr>
          `;
        }

        const { appointment } = row;
        const groomingLabel = api.getGroomingLabel(appointment.groomingType);
        return `
          <tr${row.hourBreak ? ' class="row-hour-break"' : ''}>
            <td class="cell-time">${appointment.arrivalTime}</td>
            <td>${appointment.phone}</td>
            <td class="cell-client">
              <strong>${appointment.clientName}</strong>
              <span>Contato principal</span>
            </td>
            <td class="cell-pet">
              <strong>${appointment.petName}</strong>
              <span>${appointment.breed}</span>
            </td>
            <td>${appointment.breed}</td>
            <td>
              <span class="bool-pill ${appointment.bath ? 'is-yes' : 'is-no'}">${appointment.bath ? 'Sim' : 'Não'}</span>
            </td>
            <td>
              <span class="service-pill ${groomingLabel ? '' : 'is-empty'}">${groomingLabel || 'Sem tosa'}</span>
            </td>
            <td class="cell-note">${appointment.notes || 'Sem observações.'}</td>
          </tr>
        `;
      })
      .join('');
  }

  function renderFooter() {
    const appointments = api.getAppointmentsByDateAndShift(selectedDateKey, selectedShift);
    const bathCount = appointments.filter((appointment) => appointment.bath).length;
    const groomingCount = appointments.filter((appointment) => appointment.groomingType).length;

    qs('agendaTitle').textContent = api.formatLongDate(selectedDateKey);
    qs('agendaShiftBadge').textContent = `${api.getShiftLabel(selectedShift)} · ${ranges[selectedShift].label}`;
    qs('agendaFooter').innerHTML = `
      <span><strong>${appointments.length}</strong> agendamento${appointments.length === 1 ? '' : 's'} neste turno</span>
      <span><strong>${bathCount}</strong> com banho</span>
      <span><strong>${groomingCount}</strong> com tosa</span>
      <span>Campos exibidos: Chegada, Tele, Cliente, Pet, Raça, Banho, Tosa e Observação</span>
    `;
  }

  function render() {
    renderDayNav();
    renderSummary();
    renderTable();
    renderFooter();
  }

  function bind() {
    qs('prevDay').addEventListener('click', function () {
      const date = api.fromDateKey(selectedDateKey);
      date.setDate(date.getDate() - 1);
      selectedDateKey = api.toDateKey(date);
      render();
    });

    qs('nextDay').addEventListener('click', function () {
      const date = api.fromDateKey(selectedDateKey);
      date.setDate(date.getDate() + 1);
      selectedDateKey = api.toDateKey(date);
      render();
    });

    qs('turnoManha').addEventListener('click', function () {
      selectedShift = 'manha';
      render();
    });

    qs('turnoTarde').addEventListener('click', function () {
      selectedShift = 'tarde';
      render();
    });

    window.addEventListener('colina:appointments-changed', render);
  }

  bind();
  updateClock();
  render();
  window.setInterval(updateClock, 30000);
})();
