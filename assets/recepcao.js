(function () {
  const api = window.ColinaAgenda;
  const e = api.escapeHtml;
  let selectedDateKey = api.toDateKey(new Date());
  let submitting = false;
  let selectedCustomerId = '';
  let selectedPetId = '';
  let petPickerOpen = false;

  function qs(id) {
    return document.getElementById(id);
  }

  function submitButton() {
    return document.querySelector('.primary-button');
  }

  function getSelectedCustomer() {
    return selectedCustomerId ? api.getCustomerById(selectedCustomerId) : null;
  }

  function getSelectedPet() {
    const customer = getSelectedCustomer();
    if (!customer || !selectedPetId) {
      return null;
    }

    return customer.pets.find((pet) => pet.id === selectedPetId) || null;
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

  function renderMonthlyInsights() {
    const monthCounts = api.getMonthlyGroomingCounts(api.monthKey(selectedDateKey));
    const serviceList = [
      { key: 'higienica', label: api.getGroomingLabel('higienica'), count: monthCounts.higienica },
      { key: 'tesoura', label: api.getGroomingLabel('tesoura'), count: monthCounts.tesoura },
      { key: 'maquina', label: api.getGroomingLabel('maquina'), count: monthCounts.maquina },
    ].sort((left, right) => right.count - left.count);

    const max = Math.max(1, ...serviceList.map((item) => item.count));
    qs('serviceRankList').innerHTML = serviceList
      .map((service, index) => {
        const width = service.count ? Math.round((service.count / max) * 100) : 10;
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
    qs('frequentList').innerHTML = items.length
      ? items
          .map((item) => {
            return `
              <div class="frequent-item">
                <div class="frequent-avatar">${item.emoji}</div>
                <div class="frequent-copy">
                  <strong>${e(item.petName)}</strong>
                  <span>${e(item.clientName)}</span>
                </div>
                <div class="frequent-count">
                  <strong>${item.visits}</strong>
                  visitas
                </div>
              </div>
            `;
          })
          .join('')
      : '<div class="empty-card">Os pets frequentes aparecerão conforme novos atendimentos forem salvos.</div>';
  }

  function clearSelection() {
    selectedCustomerId = '';
    selectedPetId = '';
    petPickerOpen = false;
  }

  function selectCustomer(customerId) {
    const customer = api.getCustomerById(customerId);

    if (!customer) {
      clearSelection();
      renderSelectionLine();
      renderLookupResults();
      return;
    }

    selectedCustomerId = customer.id;
    selectedPetId = customer.pets.length === 1 ? customer.pets[0].id : '';
    petPickerOpen = customer.pets.length > 1 && !selectedPetId;
    qs('customerLookup').value = buildLookupLabel(customer);
    renderSelectionLine();
    renderLookupResults();
  }

  function getLookupResults() {
    return api.searchCustomers(qs('customerLookup').value, 5);
  }

  function renderLookupResults() {
    const query = qs('customerLookup').value.trim();
    const customer = getSelectedCustomer();
    const shouldHideResults = customer && query === buildLookupLabel(customer);
    const results = query && !shouldHideResults ? getLookupResults() : [];
    const shouldShowEmpty = Boolean(query) && !shouldHideResults;

    qs('lookupResults').innerHTML = results.length
      ? results
          .map((customer) => {
            const petsLabel = customer.pets.length
              ? customer.pets.map((pet) => e(pet.name)).join(' · ')
              : 'Sem pets cadastrados';

            return `
              <button type="button" class="search-result-option${customer.id === selectedCustomerId ? ' is-active' : ''}" data-customer-id="${customer.id}">
                <strong>${e(customer.fullName)}</strong>
                <span>${e(customer.phone)}</span>
                <small>${petsLabel}</small>
              </button>
            `;
          })
          .join('')
      : shouldShowEmpty
        ? '<div class="search-result-empty">Nenhum cadastro encontrado.</div>'
        : '';
  }

  function renderPetPicker() {
    const customer = getSelectedCustomer();
    const pet = getSelectedPet();
    const petPickerField = qs('petPickerField');

    if (!customer || customer.pets.length <= 1) {
      petPickerField.hidden = true;
      qs('petPicker').innerHTML = '';
      return;
    }

    petPickerField.hidden = false;
    qs('petPicker').className = `pet-picker${petPickerOpen ? ' is-open' : ''}`;
    qs('petPicker').innerHTML = `
      <div class="pet-picker-header">
        <span>Pets relacionados a ${e(customer.fullName)}</span>
        <button type="button" class="text-link button-link" data-action="toggle-pets">${petPickerOpen ? 'Fechar' : 'Escolher pet'}</button>
      </div>
      ${petPickerOpen
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

  function renderSelectionLine() {
    const customer = getSelectedCustomer();
    const pet = getSelectedPet();

    if (!customer) {
      qs('selectedProfileLine').innerHTML = '<div class="selection-pill is-placeholder">Pesquise por cliente, pet ou telefone para selecionar um cadastro.</div>';
      renderPetPicker();
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

    qs('selectedProfileLine').innerHTML = `
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

    renderPetPicker();
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

  function setSubmitting(nextValue) {
    submitting = nextValue;
    const button = submitButton();
    if (!button) {
      return;
    }

    button.disabled = nextValue;
    button.textContent = nextValue ? 'Salvando...' : 'Salvar agendamento';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    clearFeedback();

    const customer = getSelectedCustomer();
    const pet = getSelectedPet();
    const payload = {
      date: qs('appointmentDate').value,
      arrivalTime: qs('arrivalTime').value,
      customerId: customer ? customer.id : '',
      petId: pet ? pet.id : '',
      bath: qs('bath').checked,
      tele: qs('tele').checked,
      groomingType: qs('groomingType').value,
      chargedAmount: qs('chargedAmount').value,
      notes: qs('notes').value,
    };

    if (!payload.date || !payload.arrivalTime || !payload.customerId || !payload.petId) {
      showFeedback('Selecione data, horário, cliente e pet antes de salvar.', 'error');
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

    setSubmitting(true);

    try {
      const saved = await api.addAppointment(payload);
      selectedDateKey = saved.date;
      qs('appointmentForm').reset();
      qs('appointmentDate').value = selectedDateKey;
      qs('arrivalTime').value = '08:00';
      qs('bath').checked = true;
      qs('customerLookup').value = buildLookupLabel(getSelectedCustomer());
      render();
      renderLookupResults();
      showFeedback(`Agendamento salvo para ${saved.petName} às ${saved.arrivalTime}.`, 'success');
    } catch (error) {
      showFeedback(error && error.message ? error.message : 'Não foi possível salvar o agendamento.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function render() {
    renderDayNav();
    renderSummary();
    renderMonthlyInsights();
    renderFrequentPets();
    renderSelectionLine();
    renderLookupResults();
  }

  function renderError(error) {
    renderDayNav();
    qs('serviceRankList').innerHTML = '';
    qs('frequentList').innerHTML = '<div class="empty-card">As métricas voltarão assim que a conexão for restabelecida.</div>';
    showFeedback(error && error.message ? error.message : 'Falha ao carregar dados do Supabase.', 'error');
  }

  async function syncData() {
    try {
      await Promise.all([api.refreshAppointments(), api.refreshCustomers()]);
    } catch (error) {
      renderError(error);
    }
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

    qs('customerLookup').addEventListener('input', function () {
      clearFeedback();
      clearSelection();
      renderSelectionLine();
      renderLookupResults();
    });

    qs('lookupResults').addEventListener('click', function (event) {
      const button = event.target.closest('[data-customer-id]');
      if (!button) {
        return;
      }

      clearFeedback();
      selectCustomer(button.getAttribute('data-customer-id'));
    });

    qs('selectedProfileLine').addEventListener('click', function (event) {
      const trigger = event.target.closest('[data-action="toggle-pets"]');
      if (!trigger) {
        return;
      }

      petPickerOpen = !petPickerOpen;
      renderSelectionLine();
    });

    qs('petPicker').addEventListener('click', function (event) {
      const toggle = event.target.closest('[data-action="toggle-pets"]');
      if (toggle) {
        petPickerOpen = !petPickerOpen;
        renderSelectionLine();
        return;
      }

      const button = event.target.closest('[data-pet-id]');
      if (!button) {
        return;
      }

      selectedPetId = button.getAttribute('data-pet-id');
      petPickerOpen = false;
      clearFeedback();
      renderSelectionLine();
    });

    qs('appointmentForm').addEventListener('submit', handleSubmit);

    qs('appointmentDate').addEventListener('input', function () {
      if (qs('appointmentDate').value) {
        selectedDateKey = qs('appointmentDate').value;
        render();
      }
    });

    qs('notes').addEventListener('input', clearFeedback);

    window.addEventListener('colina:appointments-changed', render);
    window.addEventListener('colina:registry-changed', function () {
      if (selectedCustomerId && !api.getCustomerById(selectedCustomerId)) {
        clearSelection();
        qs('customerLookup').value = '';
      }

      if (selectedCustomerId) {
        const customer = api.getCustomerById(selectedCustomerId);
        const hasSelectedPet = customer && customer.pets.some((pet) => pet.id === selectedPetId);

        if (!hasSelectedPet) {
          selectedPetId = customer && customer.pets.length === 1 ? customer.pets[0].id : '';
        }

        qs('customerLookup').value = buildLookupLabel(customer);
      }

      render();
      renderLookupResults();
    });
  }

  async function init() {
    qs('appointmentDate').value = selectedDateKey;
    qs('arrivalTime').value = '08:00';
    qs('bath').checked = true;
    updateClock();
    bind();

    try {
      await api.ready();
      render();
      renderLookupResults();
    } catch (error) {
      renderError(error);
    }

    window.setInterval(updateClock, 30000);
    window.setInterval(syncData, 30000);
  }

  init();
})();
