(function () {
  const api = window.ColinaAgenda;
  let selectedDateKey = api.toDateKey(new Date());

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
        qs('appointmentDate').value = selectedDateKey;
        render();
      });
      container.appendChild(button);
    });
  }

  function renderSummary() {
    const summary = api.getDaySummary(selectedDateKey);
    qs('receptionSummary').innerHTML = `
      <div class="metric-chip">
        <span class="metric-chip-value">${summary.total}</span>
        <span class="metric-chip-label">agendados no dia</span>
      </div>
      <div class="metric-chip">
        <span class="metric-chip-value">${summary.morningCount}</span>
        <span class="metric-chip-label">na manhã</span>
      </div>
      <div class="metric-chip">
        <span class="metric-chip-value">${summary.afternoonCount}</span>
        <span class="metric-chip-label">na tarde</span>
      </div>
      <div class="metric-chip">
        <span class="metric-chip-value">${summary.bathCount}</span>
        <span class="metric-chip-label">com banho</span>
      </div>
      <div class="metric-chip">
        <span class="metric-chip-value">${summary.groomingTotal}</span>
        <span class="metric-chip-label">com tosa</span>
      </div>
    `;
  }

  function renderTodayGroups() {
    const appointments = api.getAppointmentsByDate(selectedDateKey);
    const morning = appointments.filter((appointment) => api.getShiftForTime(appointment.arrivalTime) === 'manha');
    const afternoon = appointments.filter((appointment) => api.getShiftForTime(appointment.arrivalTime) === 'tarde');

    qs('appointmentsTitle').textContent = `Agendamentos de ${api.formatLongDate(selectedDateKey)}`;
    qs('todayGroups').innerHTML = [renderGroup('Manhã', morning), renderGroup('Tarde', afternoon)].join('');
  }

  function renderGroup(label, appointments) {
    return `
      <section class="day-group">
        <div class="day-group-header">
          <div class="day-group-title">${label}</div>
          <div class="day-group-count">${appointments.length} agendado${appointments.length === 1 ? '' : 's'}</div>
        </div>
        <div class="day-group-list">
          ${appointments.length ? appointments.map(renderMiniAppointment).join('') : '<div class="empty-card">Nenhum agendamento neste turno.</div>'}
        </div>
      </section>
    `;
  }

  function renderMiniAppointment(appointment) {
    const services = api.getServiceLabels(appointment).join(' · ') || 'Sem serviço';
    return `
      <article class="mini-appointment">
        <div class="mini-appointment-top">
          <div class="mini-appointment-time">${appointment.arrivalTime}</div>
          <div class="mini-appointment-service">${services}</div>
        </div>
        <div class="mini-appointment-name">${appointment.petName}</div>
        <div class="mini-appointment-owner">${appointment.clientName} · ${appointment.phone}</div>
        ${appointment.notes ? `<div class="mini-appointment-note">${appointment.notes}</div>` : ''}
      </article>
    `;
  }

  function renderMonthlyInsights() {
    const monthCounts = api.getMonthlyGroomingCounts(api.monthKey(selectedDateKey));
    const serviceList = [
      { key: 'higienica', label: api.getGroomingLabel('higienica'), count: monthCounts.higienica },
      { key: 'tesoura', label: api.getGroomingLabel('tesoura'), count: monthCounts.tesoura },
      { key: 'maquina', label: api.getGroomingLabel('maquina'), count: monthCounts.maquina },
    ].sort((left, right) => right.count - left.count);

    const max = Math.max(1, ...serviceList.map((item) => item.count));
    qs('servicesMonthNote').textContent = `Resumo de ${api.formatMonthYear(selectedDateKey)} com foco nas três opções de tosa.`;
    qs('serviceRankList').innerHTML = serviceList
      .map((service, index) => {
        const width = Math.max(10, Math.round((service.count / max) * 100));
        return `
          <div class="service-rank">
            <div class="service-rank-index">${index + 1}</div>
            <div class="service-rank-copy">
              <strong>${service.label}</strong>
              <div class="service-rank-bar">
                <div class="service-rank-fill" style="width: ${width}%"></div>
              </div>
            </div>
            <div class="service-rank-count">${service.count}</div>
          </div>
        `;
      })
      .join('');
  }

  function renderFrequentPets() {
    const items = api.getFrequentPets(5);
    qs('frequentList').innerHTML = items
      .map((item) => {
        return `
          <div class="frequent-item">
            <div class="frequent-avatar">${item.emoji}</div>
            <div class="frequent-copy">
              <strong>${item.petName}</strong>
              <span>${item.clientName}</span>
            </div>
            <div class="frequent-count">
              <strong>${item.visits}</strong>
              visitas
            </div>
          </div>
        `;
      })
      .join('');
  }

  function updateHelperHints() {
    const time = qs('arrivalTime').value || '08:00';
    const shift = api.getShiftLabel(api.getShiftForTime(time));
    const bath = qs('bath').checked;
    const groomingType = qs('groomingType').value;
    const services = [];

    if (bath) {
      services.push('Banho');
    }

    if (groomingType) {
      services.push(api.getGroomingLabel(groomingType));
    }

    qs('shiftHint').innerHTML = `<strong>Turno:</strong> ${shift}`;
    qs('serviceHint').innerHTML = `<strong>Serviço:</strong> ${services.length ? services.join(' + ') : 'selecionar atendimento'}`;
  }

  function showFeedback(message, mode) {
    const feedback = qs('formFeedback');
    feedback.className = `feedback is-visible ${mode === 'error' ? 'is-error' : 'is-success'}`;
    feedback.textContent = message;
  }

  function clearFeedback() {
    const feedback = qs('formFeedback');
    feedback.className = 'feedback';
    feedback.textContent = '';
  }

  function handleSubmit(event) {
    event.preventDefault();
    clearFeedback();

    const payload = {
      date: qs('appointmentDate').value,
      arrivalTime: qs('arrivalTime').value,
      phone: qs('phone').value,
      clientName: qs('clientName').value,
      petName: qs('petName').value,
      breed: qs('breed').value,
      bath: qs('bath').checked,
      groomingType: qs('groomingType').value,
      notes: qs('notes').value,
    };

    if (!payload.date || !payload.arrivalTime || !payload.phone || !payload.clientName || !payload.petName || !payload.breed) {
      showFeedback('Preencha data, horário, telefone, cliente, pet e raça antes de salvar.', 'error');
      return;
    }

    if (!payload.bath && !payload.groomingType) {
      showFeedback('Selecione pelo menos um serviço: banho, uma opção de tosa ou ambos.', 'error');
      return;
    }

    if (api.hasConflict(payload)) {
      showFeedback('Já existe um agendamento para este pet no mesmo dia e horário. Ajuste o horário antes de salvar.', 'error');
      return;
    }

    const saved = api.addAppointment(payload);
    selectedDateKey = saved.date;
    qs('appointmentForm').reset();
    qs('appointmentDate').value = selectedDateKey;
    qs('arrivalTime').value = '08:00';
    qs('bath').checked = true;
    updateHelperHints();
    render();
    showFeedback(`Agendamento salvo para ${saved.petName} às ${saved.arrivalTime}.`, 'success');
  }

  function bind() {
    qs('prevDay').addEventListener('click', function () {
      const date = api.fromDateKey(selectedDateKey);
      date.setDate(date.getDate() - 1);
      selectedDateKey = api.toDateKey(date);
      qs('appointmentDate').value = selectedDateKey;
      render();
    });

    qs('nextDay').addEventListener('click', function () {
      const date = api.fromDateKey(selectedDateKey);
      date.setDate(date.getDate() + 1);
      selectedDateKey = api.toDateKey(date);
      qs('appointmentDate').value = selectedDateKey;
      render();
    });

    qs('appointmentForm').addEventListener('submit', handleSubmit);
    ['appointmentDate', 'arrivalTime', 'bath', 'groomingType'].forEach((id) => {
      qs(id).addEventListener('input', function () {
        if (id === 'appointmentDate' && qs('appointmentDate').value) {
          selectedDateKey = qs('appointmentDate').value;
          renderDayNav();
          renderSummary();
          renderTodayGroups();
          renderMonthlyInsights();
        }
        updateHelperHints();
      });
    });

    ['phone', 'clientName', 'petName', 'breed', 'notes'].forEach((id) => {
      qs(id).addEventListener('input', clearFeedback);
    });
  }

  function render() {
    renderDayNav();
    renderSummary();
    renderTodayGroups();
    renderMonthlyInsights();
    renderFrequentPets();
  }

  function init() {
    qs('appointmentDate').value = selectedDateKey;
    qs('arrivalTime').value = '08:00';
    qs('bath').checked = true;
    updateHelperHints();
    updateClock();
    bind();
    render();
    window.setInterval(updateClock, 30000);
  }

  init();
})();
