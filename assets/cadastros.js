(function () {
  const api = window.ColinaAgenda;
  const e = api.escapeHtml;

  let searchTerm = '';
  let selectedCustomerId = '';
  let submitting = false;
  let nextRowId = 1;
  let draft = { fullName: '', phone: '' };
  let petRows = [];

  function qs(id) {
    return document.getElementById(id);
  }

  function getSelectedCustomer() {
    return selectedCustomerId ? api.getCustomerById(selectedCustomerId) : null;
  }

  function newRow(values) {
    return {
      rowId: String(nextRowId++),
      id: values && values.id ? values.id : '',
      petName: values && values.petName ? values.petName : '',
      breed: values && values.breed ? values.breed : '',
    };
  }

  function updateClock() {
    const now = new Date();
    qs('clockTime').textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    qs('clockDate').textContent = api.formatLongDate(api.toDateKey(now));
    qs('footerUpdated').textContent = `Atualizado às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function renderSummary() {
    const summary = api.getRegistrySummary();
    qs('registrySummary').innerHTML = `
      <div class="metric-chip">
        <span class="metric-chip-value">${summary.totalCustomers}</span>
        <span class="metric-chip-label">clientes</span>
      </div>
      <div class="metric-chip">
        <span class="metric-chip-value">${summary.totalPets}</span>
        <span class="metric-chip-label">pets</span>
      </div>
      <div class="metric-chip">
        <span class="metric-chip-value">${summary.multiPetCustomers}</span>
        <span class="metric-chip-label">com 2+ pets</span>
      </div>
    `;
  }

  function getFilteredCustomers() {
    return searchTerm.trim() ? api.searchCustomers(searchTerm) : api.getCustomers();
  }

  function renderCustomerCard(customer) {
    const petsLine = customer.pets.length
      ? customer.pets.map((pet) => e(pet.name)).join(' · ')
      : 'Sem pets';

    return `
      <button type="button" class="registry-card${customer.id === selectedCustomerId ? ' is-active' : ''}" data-customer-id="${customer.id}">
        <div class="registry-card-header">
          <div>
            <div class="registry-card-title">${e(customer.fullName)}</div>
            <div class="registry-card-subtitle">${e(customer.phone)}</div>
          </div>
          <div class="registry-card-count">${customer.pets.length} pet${customer.pets.length === 1 ? '' : 's'}</div>
        </div>
        <div class="registry-card-pets">${petsLine}</div>
      </button>
    `;
  }

  function renderRegistryList() {
    const customers = getFilteredCustomers();
    qs('registryList').innerHTML = customers.length
      ? customers.map(renderCustomerCard).join('')
      : '<div class="empty-card">Nenhum cadastro encontrado.</div>';
  }

  function renderPetRowsHtml() {
    return petRows
      .map((row, index) => {
        const canRemove = !row.id && petRows.length > 1;
        return `
          <div class="pet-row" data-row-id="${row.rowId}">
            <div class="pet-row-grid">
              <div class="field">
                <label class="field-label">Pet ${index + 1}</label>
                <input type="text" data-key="petName" value="${e(row.petName)}" placeholder="Nome do pet">
              </div>
              <div class="field">
                <label class="field-label">Raça</label>
                <input type="text" data-key="breed" value="${e(row.breed)}" placeholder="Raça do pet">
              </div>
              <div class="pet-row-action">
                ${canRemove ? '<button type="button" class="pet-row-remove" data-action="remove-pet">Remover</button>' : ''}
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderDetail() {
    const isNew = !selectedCustomerId;
    const customer = isNew ? null : getSelectedCustomer();
    const title = isNew ? 'Novo cliente' : draft.fullName || (customer ? customer.fullName : 'Cliente');
    const petCount = customer ? customer.pets.length : 0;
    const submitLabel = isNew ? 'Criar cadastro' : 'Salvar';

    qs('detailPanel').innerHTML = `
      <div class="panel-heading panel-heading-compact panel-heading-inline">
        <h2 class="section-title">${e(title)}</h2>
        ${isNew ? '' : `<span class="registry-card-count">${petCount} pet${petCount === 1 ? '' : 's'}</span>`}
      </div>

      <form id="detailForm">
        <div class="form-grid">
          <div class="field">
            <label class="field-label" for="fullName">Cliente</label>
            <input type="text" id="fullName" value="${e(draft.fullName)}" placeholder="Nome do tutor" autocomplete="off" required>
          </div>
          <div class="field">
            <label class="field-label" for="phone">Telefone</label>
            <input type="tel" id="phone" value="${e(draft.phone)}" inputmode="numeric" maxlength="13" placeholder="47 91234-5678" autocomplete="off" required>
          </div>

          <div class="field is-wide">
            <div class="field-row">
              <label class="field-label">Pets</label>
              <button type="button" class="text-link button-link" data-action="add-pet">+ adicionar pet</button>
            </div>
            <div class="pet-rows" id="petRows">${renderPetRowsHtml()}</div>
          </div>
        </div>

        <div class="submit-row">
          <button type="submit" class="primary-button" id="detailSubmit">${submitLabel}</button>
        </div>

        <div class="feedback" id="detailFeedback" role="status" aria-live="polite"></div>
      </form>
    `;
  }

  function render() {
    renderSummary();
    renderRegistryList();
    renderDetail();
  }

  function readDom() {
    const nameEl = qs('fullName');
    const phoneEl = qs('phone');
    if (nameEl) draft.fullName = nameEl.value;
    if (phoneEl) draft.phone = phoneEl.value;

    const container = qs('petRows');
    if (!container) return;

    petRows = petRows.map((row) => {
      const el = container.querySelector(`[data-row-id="${row.rowId}"]`);
      if (!el) return row;
      const nameInput = el.querySelector('[data-key="petName"]');
      const breedInput = el.querySelector('[data-key="breed"]');
      return {
        ...row,
        petName: nameInput ? nameInput.value : row.petName,
        breed: breedInput ? breedInput.value : row.breed,
      };
    });
  }

  function selectCustomer(customerId) {
    const customer = api.getCustomerById(customerId);
    if (!customer) {
      startNewCustomer();
      return;
    }

    selectedCustomerId = customer.id;
    draft = { fullName: customer.fullName, phone: customer.phone };
    petRows = customer.pets.length
      ? customer.pets.map((pet) => newRow({ id: pet.id, petName: pet.name, breed: pet.breed }))
      : [newRow()];

    renderRegistryList();
    renderDetail();
  }

  function startNewCustomer() {
    selectedCustomerId = '';
    draft = { fullName: '', phone: '' };
    petRows = [newRow()];
    renderRegistryList();
    renderDetail();
    const nameEl = qs('fullName');
    if (nameEl) nameEl.focus();
  }

  function showFeedback(message, mode) {
    const feedback = qs('detailFeedback');
    if (!feedback) return;
    feedback.className = `feedback is-visible ${mode === 'error' ? 'is-error' : 'is-success'}`;
    feedback.textContent = message;
  }

  function clearFeedback() {
    const feedback = qs('detailFeedback');
    if (!feedback) return;
    feedback.className = 'feedback';
    feedback.textContent = '';
  }

  function setSubmitting(value) {
    submitting = value;
    const button = qs('detailSubmit');
    if (!button) return;
    button.disabled = value;
    if (value) {
      button.textContent = 'Salvando...';
    }
  }

  function buildSuccessMessage(result) {
    const name = result.customer.fullName;

    if (result.customerAction === 'created') {
      return `Cadastro criado para ${name}.`;
    }

    const parts = [];
    if (result.petsCreated) {
      parts.push(`${result.petsCreated} pet${result.petsCreated === 1 ? '' : 's'} adicionado${result.petsCreated === 1 ? '' : 's'}`);
    }
    if (result.petsUpdated) {
      parts.push(`${result.petsUpdated} pet${result.petsUpdated === 1 ? '' : 's'} atualizado${result.petsUpdated === 1 ? '' : 's'}`);
    }

    if (parts.length) {
      return `${name}: ${parts.join(' e ')}.`;
    }

    return `Cadastro de ${name} salvo.`;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    clearFeedback();
    readDom();

    const payload = {
      customerId: selectedCustomerId,
      fullName: draft.fullName,
      phone: draft.phone,
      pets: petRows.map((row) => ({ id: row.id, petName: row.petName, breed: row.breed })),
    };

    setSubmitting(true);

    try {
      const result = await api.saveCustomerWithPets(payload);
      selectCustomer(result.customer.id);
      showFeedback(buildSuccessMessage(result), 'success');
    } catch (error) {
      setSubmitting(false);
      showFeedback(error && error.message ? error.message : 'Não foi possível salvar o cadastro.', 'error');
    }
  }

  function renderError(error) {
    qs('registryList').innerHTML = '<div class="empty-card">Não foi possível carregar os cadastros do Supabase.</div>';
    showFeedback(error && error.message ? error.message : 'Falha ao carregar dados do Supabase.', 'error');
  }

  async function syncData() {
    try {
      await api.refreshCustomers();
    } catch (error) {
      renderError(error);
    }
  }

  function bind() {
    qs('newCustomerBtn').addEventListener('click', startNewCustomer);

    qs('registrySearch').addEventListener('input', function () {
      searchTerm = qs('registrySearch').value;
      renderRegistryList();
    });

    qs('registryList').addEventListener('click', function (event) {
      const button = event.target.closest('[data-customer-id]');
      if (!button) return;
      selectCustomer(button.getAttribute('data-customer-id'));
    });

    const panel = qs('detailPanel');

    panel.addEventListener('submit', function (event) {
      if (event.target && event.target.id === 'detailForm') {
        handleSubmit(event);
      }
    });

    panel.addEventListener('input', function (event) {
      const target = event.target;

      if (target.id === 'phone') {
        target.value = api.formatPhone(target.value);
      }

      if (target.id === 'fullName' || target.id === 'phone' || target.hasAttribute('data-key')) {
        clearFeedback();
      }
    });

    panel.addEventListener('click', function (event) {
      const addBtn = event.target.closest('[data-action="add-pet"]');
      if (addBtn) {
        readDom();
        petRows.push(newRow());
        renderDetail();
        return;
      }

      const removeBtn = event.target.closest('[data-action="remove-pet"]');
      if (removeBtn) {
        const row = event.target.closest('[data-row-id]');
        if (!row) return;
        readDom();
        petRows = petRows.filter((item) => item.rowId !== row.getAttribute('data-row-id'));
        if (!petRows.length) {
          petRows = [newRow()];
        }
        renderDetail();
      }
    });

    window.addEventListener('colina:registry-changed', function () {
      if (selectedCustomerId && !api.getCustomerById(selectedCustomerId)) {
        startNewCustomer();
      }
      renderSummary();
      renderRegistryList();
    });
  }

  async function init() {
    updateClock();
    bind();
    startNewCustomer();

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
