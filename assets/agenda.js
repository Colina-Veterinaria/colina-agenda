(function () {
  const api = window.ColinaAgenda;
  const e = api.escapeHtml;
  const todayKey = api.toDateKey(new Date());
  const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  let selectedDateKey = todayKey;
  let selectedShift = currentMinutes < 12 * 60 ? 'manha' : 'tarde';
  let editingAppointmentId = '';
  let editingCustomerId = '';
  let editingPetId = '';
  let editPetPickerOpen = false;
  let editSubmitting = false;
  let actionsAppointmentId = '';

  const ranges = {
    manha: { startHour: 7, endHour: 12, label: '07h às 12h' },
    tarde: { startHour: 12, endHour: 18, label: '12h às 18h' },
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function isEditModalOpen() {
    return qs('appointmentEditOverlay').classList.contains('is-open');
  }

  function getEditingCustomer() {
    return editingCustomerId ? api.getCustomerById(editingCustomerId) : null;
  }

  function getEditingPet() {
    const customer = getEditingCustomer();
    if (!customer || !editingPetId) {
      return null;
    }

    return customer.pets.find((pet) => pet.id === editingPetId) || null;
  }

  function buildLookupLabel(customer) {
    return customer ? `${customer.fullName} · ${customer.phone}` : '';
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

  function setTableMessage(message) {
    qs('agendaTableBody').innerHTML = `
      <tr class="row-empty row-hour-break">
        <td class="cell-time">--:--</td>
        <td colspan="9" class="slot-message">${message}</td>
      </tr>
    `;
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
    qs('turnoManha').classList.toggle('is-active', selectedShift === 'manha');
    qs('turnoTarde').classList.toggle('is-active', selectedShift === 'tarde');
    qs('countManha').textContent = `${summary.morningCount} agendado${summary.morningCount === 1 ? '' : 's'}`;
    qs('countTarde').textContent = `${summary.afternoonCount} agendado${summary.afternoonCount === 1 ? '' : 's'}`;
    qs('agendaSummary').innerHTML = `
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

    if (!rows.length) {
      setTableMessage('Nenhum agendamento encontrado para este turno.');
      return;
    }

    tbody.innerHTML = rows
      .map((row) => {
        if (row.type === 'empty') {
          return `
            <tr class="row-empty${row.hourBreak ? ' row-hour-break' : ''}">
              <td class="cell-time">${row.label}</td>
              <td colspan="9" class="slot-message">livre</td>
            </tr>
          `;
        }

        const { appointment } = row;
        const groomingLabel = api.getGroomingLabel(appointment.groomingType);
        const chargedAmountLabel = api.formatCurrency(appointment.chargedAmount);
        return `
          <tr class="agenda-row${row.hourBreak ? ' row-hour-break' : ''}${actionsAppointmentId === appointment.id ? ' is-actions-open' : ''}" data-appointment-row data-appointment-id="${e(appointment.id)}">
            <td class="cell-time"><span class="row-visual">${appointment.arrivalTime}</span></td>
            <td><span class="row-visual">${e(appointment.phone)}</span></td>
            <td class="cell-client">
              <div class="row-visual">
                <strong>${e(appointment.clientName)}</strong>
              </div>
            </td>
            <td class="cell-pet">
              <div class="row-visual">
                <strong>${e(appointment.petName)}</strong>
              </div>
            </td>
            <td><span class="row-visual">${e(appointment.breed)}</span></td>
            <td><span class="row-visual bool-pill ${appointment.bath ? 'is-yes' : 'is-no'}">${appointment.bath ? 'Sim' : 'Não'}</span></td>
            <td><span class="row-visual bool-pill ${appointment.tele ? 'is-yes' : 'is-no'}">${appointment.tele ? 'Sim' : 'Não'}</span></td>
            <td><span class="row-visual service-pill ${groomingLabel ? '' : 'is-empty'}">${groomingLabel || 'Sem tosa'}</span></td>
            <td><span class="row-visual money-pill ${chargedAmountLabel ? '' : 'is-empty'}">${chargedAmountLabel || 'Não informado'}</span></td>
            <td class="cell-note">
              <div class="cell-note-layout">
                <span class="row-visual cell-note-copy">${e(appointment.notes) || 'Sem observações.'}</span>
                <div class="row-inline-actions" aria-label="Ações do agendamento">
                  <button
                    type="button"
                    class="table-inline-action is-edit"
                    data-action="edit-appointment"
                    data-appointment-id="${e(appointment.id)}"
                    aria-label="Editar agendamento de ${e(appointment.petName)}"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    class="table-inline-action is-danger"
                    data-action="delete-appointment"
                    data-appointment-id="${e(appointment.id)}"
                    aria-label="Excluir agendamento de ${e(appointment.petName)}"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </td>
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
    `;
  }

  function render() {
    renderDayNav();
    renderSummary();
    renderTable();
    renderFooter();
  }

  function renderError(error) {
    renderDayNav();
    qs('agendaTitle').textContent = 'Agenda indisponível';
    qs('agendaShiftBadge').textContent = 'Sem conexão';
    qs('agendaSummary').innerHTML = `
      <div class="summary-chip">
        <span class="summary-chip-value">!</span>
        <span class="summary-chip-label">falha ao carregar</span>
      </div>
    `;
    setTableMessage(error && error.message ? error.message : 'Não foi possível carregar os dados do Supabase.');
    qs('agendaFooter').innerHTML = '<span>Confira as policies do Supabase e a conectividade da página.</span>';
  }

  async function syncData() {
    try {
      await Promise.all([api.refreshAppointments(), api.refreshCustomers()]);
    } catch (error) {
      renderError(error);
    }
  }

  function showEditFeedback(message, mode) {
    const feedback = qs('appointmentEditFeedback');
    feedback.className = `feedback is-visible ${mode === 'error' ? 'is-error' : 'is-success'}`;
    feedback.textContent = message;
  }

  function clearEditFeedback() {
    const feedback = qs('appointmentEditFeedback');
    feedback.className = 'feedback';
    feedback.textContent = '';
  }

  function setEditSubmitting(nextValue) {
    editSubmitting = nextValue;
    const button = qs('appointmentEditSubmit');
    if (!button) {
      return;
    }

    button.disabled = nextValue;
    button.textContent = nextValue ? 'Salvando...' : 'Salvar alterações';
  }

  function clearEditSelection() {
    editingCustomerId = '';
    editingPetId = '';
    editPetPickerOpen = false;
  }

  function selectEditCustomer(customerId) {
    const customer = api.getCustomerById(customerId);

    if (!customer) {
      clearEditSelection();
      renderEditSelectionLine();
      renderEditLookupResults();
      return;
    }

    editingCustomerId = customer.id;
    editingPetId = customer.pets.length === 1 ? customer.pets[0].id : '';
    editPetPickerOpen = customer.pets.length > 1 && !editingPetId;
    qs('editCustomerLookup').value = buildLookupLabel(customer);
    renderEditSelectionLine();
    renderEditLookupResults();
  }

  function renderEditLookupResults() {
    const query = qs('editCustomerLookup').value.trim();
    const customer = getEditingCustomer();
    const shouldHideResults = customer && query === buildLookupLabel(customer);
    const results = query && !shouldHideResults ? api.searchCustomers(query, 5) : [];
    const shouldShowEmpty = Boolean(query) && !shouldHideResults;

    qs('editLookupResults').innerHTML = results.length
      ? results
          .map((item) => {
            const petsLabel = item.pets.length ? item.pets.map((pet) => e(pet.name)).join(' · ') : 'Sem pets cadastrados';
            return `
              <button type="button" class="search-result-option${item.id === editingCustomerId ? ' is-active' : ''}" data-customer-id="${item.id}">
                <strong>${e(item.fullName)}</strong>
                <span>${e(item.phone)}</span>
                <small>${petsLabel}</small>
              </button>
            `;
          })
          .join('')
      : shouldShowEmpty
        ? '<div class="search-result-empty">Nenhum cadastro encontrado.</div>'
        : '';
  }

  function renderEditPetPicker() {
    const customer = getEditingCustomer();
    const pet = getEditingPet();
    const petPickerField = qs('editPetPickerField');

    if (!customer || customer.pets.length <= 1) {
      petPickerField.hidden = true;
      qs('editPetPicker').innerHTML = '';
      return;
    }

    petPickerField.hidden = false;
    qs('editPetPicker').className = `pet-picker${editPetPickerOpen ? ' is-open' : ''}`;
    qs('editPetPicker').innerHTML = `
      <div class="pet-picker-header">
        <span>Pets relacionados a ${e(customer.fullName)}</span>
        <button type="button" class="text-link button-link" data-action="toggle-pets">${editPetPickerOpen ? 'Fechar' : 'Escolher pet'}</button>
      </div>
      ${editPetPickerOpen
        ? `
          <div class="pet-picker-options">
            ${customer.pets
              .map(
                (item) => `
                  <button type="button" class="pet-picker-option${pet && pet.id === item.id ? ' is-active' : ''}" data-pet-id="${item.id}">
                    <strong>${e(item.name)}</strong>
                    <span>${e(item.breed)}</span>
                  </button>
                `
              )
              .join('')}
          </div>
        `
        : ''}
    `;
  }

  function renderEditSelectionLine() {
    const customer = getEditingCustomer();
    const pet = getEditingPet();

    if (!customer) {
      qs('editSelectedProfileLine').innerHTML = '<div class="selection-pill is-placeholder">Pesquise por cliente, pet ou telefone para selecionar um cadastro.</div>';
      renderEditPetPicker();
      return;
    }

    const petMarkup = customer.pets.length > 1 && !pet
      ? `
        <button type="button" class="selection-pill selection-pill-button" data-action="toggle-pets">
          <span>Pet</span>
          <strong>Escolher pet</strong>
        </button>
      `
      : `
        <div class="selection-pill">
          <span>Pet</span>
          <strong>${pet ? e(pet.name) : 'Sem pet cadastrado'}</strong>
        </div>
      `;

    const breedMarkup = `
      <div class="selection-pill">
        <span>Raça</span>
        <strong>${pet ? e(pet.breed) : customer.pets.length ? 'Aguardando pet' : 'Sem raça'}</strong>
      </div>
    `;

    qs('editSelectedProfileLine').innerHTML = `
      <div class="selection-pill">
        <span>Cliente</span>
        <strong>${e(customer.fullName)}</strong>
      </div>
      <div class="selection-pill">
        <span>Telefone</span>
        <strong>${e(customer.phone)}</strong>
      </div>
      ${petMarkup}
      ${breedMarkup}
    `;

    renderEditPetPicker();
  }

  function openEditModal(appointmentId) {
    const appointment = api.getAppointmentById(appointmentId);
    if (!appointment) {
      return;
    }

    actionsAppointmentId = '';
    editingAppointmentId = appointment.id;
    editingCustomerId = appointment.customerId;
    editingPetId = appointment.petId;
    editPetPickerOpen = false;
    clearEditFeedback();
    setEditSubmitting(false);

    qs('editAppointmentDate').value = appointment.date;
    qs('editArrivalTime').value = appointment.arrivalTime;
    qs('editBath').checked = appointment.bath;
    qs('editTele').checked = appointment.tele;
    qs('editGroomingType').value = appointment.groomingType;
    qs('editChargedAmount').value = appointment.chargedAmount === null ? '' : String(appointment.chargedAmount);
    qs('editNotes').value = appointment.notes || '';

    const customer = getEditingCustomer();
    qs('editCustomerLookup').value = customer ? buildLookupLabel(customer) : '';
    renderEditSelectionLine();
    renderEditLookupResults();

    qs('appointmentEditOverlay').classList.add('is-open');
    qs('appointmentEditOverlay').setAttribute('aria-hidden', 'false');
  }

  function closeEditModal() {
    qs('appointmentEditOverlay').classList.remove('is-open');
    qs('appointmentEditOverlay').setAttribute('aria-hidden', 'true');
    qs('appointmentEditForm').reset();
    clearEditSelection();
    editingAppointmentId = '';
    clearEditFeedback();
    setEditSubmitting(false);
    qs('editCustomerLookup').value = '';
    qs('editLookupResults').innerHTML = '';
    qs('editSelectedProfileLine').innerHTML = '';
    qs('editPetPicker').innerHTML = '';
    qs('editPetPickerField').hidden = true;
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    if (editSubmitting) {
      return;
    }

    clearEditFeedback();

    const customer = getEditingCustomer();
    const pet = getEditingPet();
    const payload = {
      id: editingAppointmentId,
      date: qs('editAppointmentDate').value,
      arrivalTime: qs('editArrivalTime').value,
      customerId: customer ? customer.id : '',
      petId: pet ? pet.id : '',
      bath: qs('editBath').checked,
      tele: qs('editTele').checked,
      groomingType: qs('editGroomingType').value,
      chargedAmount: qs('editChargedAmount').value,
      notes: qs('editNotes').value,
    };

    if (!payload.id || !payload.date || !payload.arrivalTime || !payload.customerId || !payload.petId) {
      showEditFeedback('Selecione data, horário, cliente e pet antes de salvar.', 'error');
      return;
    }

    if (!payload.bath && !payload.groomingType) {
      showEditFeedback('Selecione pelo menos um serviço: banho, uma opção de tosa ou ambos.', 'error');
      return;
    }

    if (api.hasConflict(payload)) {
      showEditFeedback('Já existe um agendamento para este pet no mesmo dia e horário. Ajuste o horário antes de salvar.', 'error');
      return;
    }

    setEditSubmitting(true);

    try {
      const saved = await api.updateAppointment(payload);
      if (!saved) {
        throw new Error('Não foi possível salvar as alterações.');
      }

      selectedDateKey = saved.date;
      selectedShift = api.getShiftForTime(saved.arrivalTime);
      closeEditModal();
      render();
    } catch (error) {
      showEditFeedback(error && error.message ? error.message : 'Não foi possível atualizar o agendamento.', 'error');
    } finally {
      if (editingAppointmentId) {
        setEditSubmitting(false);
      }
    }
  }

  async function handleDeleteAppointment(appointmentId) {
    const appointment = api.getAppointmentById(appointmentId);
    if (!appointment) {
      return;
    }

    const confirmed = window.confirm(`Excluir o agendamento de ${appointment.petName} às ${appointment.arrivalTime}?`);
    if (!confirmed) {
      return;
    }

    try {
      await api.deleteAppointment(appointmentId);
      if (editingAppointmentId === appointmentId) {
        closeEditModal();
      }
      render();
    } catch (error) {
      window.alert(error && error.message ? error.message : 'Não foi possível excluir o agendamento.');
    }
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

    qs('agendaTableBody').addEventListener('click', function (event) {
      const trigger = event.target.closest('[data-action]');
      const row = event.target.closest('[data-appointment-row]');

      if (trigger) {
        const appointmentId = trigger.getAttribute('data-appointment-id');
        const action = trigger.getAttribute('data-action');

        if (action === 'edit-appointment') {
          actionsAppointmentId = '';
          openEditModal(appointmentId);
          return;
        }

        if (action === 'delete-appointment') {
          actionsAppointmentId = '';
          handleDeleteAppointment(appointmentId);
          return;
        }
      }

      if (!row) {
        return;
      }

      const appointmentId = row.getAttribute('data-appointment-id');
      actionsAppointmentId = actionsAppointmentId === appointmentId ? '' : appointmentId;
      renderTable();
    });

    qs('appointmentEditClose').addEventListener('click', closeEditModal);
    qs('appointmentEditCancel').addEventListener('click', closeEditModal);
    qs('appointmentEditOverlay').addEventListener('click', function (event) {
      if (event.target === this) {
        closeEditModal();
      }
    });

    qs('editCustomerLookup').addEventListener('input', function () {
      clearEditFeedback();
      clearEditSelection();
      renderEditSelectionLine();
      renderEditLookupResults();
    });

    qs('editLookupResults').addEventListener('click', function (event) {
      const button = event.target.closest('[data-customer-id]');
      if (!button) {
        return;
      }

      clearEditFeedback();
      selectEditCustomer(button.getAttribute('data-customer-id'));
    });

    qs('editSelectedProfileLine').addEventListener('click', function (event) {
      const trigger = event.target.closest('[data-action="toggle-pets"]');
      if (!trigger) {
        return;
      }

      editPetPickerOpen = !editPetPickerOpen;
      renderEditSelectionLine();
    });

    qs('editPetPicker').addEventListener('click', function (event) {
      const toggle = event.target.closest('[data-action="toggle-pets"]');
      if (toggle) {
        editPetPickerOpen = !editPetPickerOpen;
        renderEditSelectionLine();
        return;
      }

      const button = event.target.closest('[data-pet-id]');
      if (!button) {
        return;
      }

      editingPetId = button.getAttribute('data-pet-id');
      editPetPickerOpen = false;
      clearEditFeedback();
      renderEditSelectionLine();
    });

    qs('appointmentEditForm').addEventListener('submit', handleEditSubmit);

    ['editAppointmentDate', 'editArrivalTime', 'editNotes', 'editChargedAmount'].forEach((id) => {
      qs(id).addEventListener('input', clearEditFeedback);
    });

    ['editBath', 'editTele', 'editGroomingType'].forEach((id) => {
      qs(id).addEventListener('change', clearEditFeedback);
    });

    window.addEventListener('colina:appointments-changed', function () {
      render();
      if (editingAppointmentId && !api.getAppointmentById(editingAppointmentId)) {
        closeEditModal();
      }
    });

    window.addEventListener('colina:registry-changed', function () {
      if (!isEditModalOpen()) {
        return;
      }

      if (editingCustomerId && !api.getCustomerById(editingCustomerId)) {
        clearEditSelection();
        qs('editCustomerLookup').value = '';
      }

      renderEditSelectionLine();
      renderEditLookupResults();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isEditModalOpen()) {
        closeEditModal();
        return;
      }

      if (event.key === 'Escape' && actionsAppointmentId) {
        actionsAppointmentId = '';
        renderTable();
      }
    });

    document.addEventListener('click', function (event) {
      if (event.target.closest('#agendaTableBody') || event.target.closest('#appointmentEditOverlay')) {
        return;
      }

      if (actionsAppointmentId) {
        actionsAppointmentId = '';
        renderTable();
      }
    });
  }

  async function init() {
    bind();
    updateClock();
    setTableMessage('Carregando agenda...');

    try {
      await api.ready();
      render();
    } catch (error) {
      renderError(error);
    }

    window.setInterval(updateClock, 30000);
    window.setInterval(syncData, 30000);
  }

  init();
})();
