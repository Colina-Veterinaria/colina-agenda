(function () {
  const api = window.ColinaAgenda;
  const e = api.escapeHtml;

  let activeFilter = 'reativar';
  let searchTerm = '';

  const FILTERS = [
    { key: 'reativar', label: 'Reativar', segments: ['esfriando', 'inativo'] },
    { key: 'ativos', label: 'Ativos', segments: ['ativo', 'agendado'] },
    { key: 'novos', label: 'Sem visita', segments: ['novo'] },
    { key: 'todos', label: 'Todos', segments: null },
  ];

  function qs(id) {
    return document.getElementById(id);
  }

  function updateClock() {
    const now = new Date();
    qs('clockTime').textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    qs('clockDate').textContent = api.formatLongDate(api.toDateKey(now));
    qs('footerUpdated').textContent = `Atualizado às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function matchesSearch(customer) {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return true;
    }

    const digits = api.phoneDigits(searchTerm);
    const stack = [
      customer.fullName,
      customer.phone,
      customer.pets.map((pet) => `${pet.name} ${pet.breed}`).join(' '),
    ]
      .join(' ')
      .toLowerCase();

    return stack.includes(term) || (digits ? api.phoneDigits(customer.phone).includes(digits) : false);
  }

  function sortRows(rows) {
    if (activeFilter === 'novos') {
      return rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    if (activeFilter === 'reativar') {
      return rows.sort((a, b) => (b.daysSince || -1) - (a.daysSince || -1) || a.fullName.localeCompare(b.fullName));
    }

    if (activeFilter === 'ativos') {
      return rows.sort((a, b) => {
        if (a.segment !== b.segment) {
          return a.segment === 'agendado' ? -1 : 1;
        }
        return b.visitCount - a.visitCount || a.fullName.localeCompare(b.fullName);
      });
    }

    return rows.sort((a, b) => b.visitCount - a.visitCount || a.fullName.localeCompare(b.fullName));
  }

  function getRows() {
    const filter = FILTERS.find((item) => item.key === activeFilter) || FILTERS[0];
    let rows = api.getCustomerActivity().filter(matchesSearch);

    if (filter.segments) {
      rows = rows.filter((customer) => filter.segments.includes(customer.segment));
    }

    return sortRows(rows);
  }

  function renderSummary() {
    const summary = api.getActivitySummary();
    qs('activitySummary').innerHTML = `
      <div class="metric-chip metric-chip--ativo">
        <span class="metric-chip-value">${summary.ativo + summary.agendado}</span>
        <span class="metric-chip-label">ativos</span>
      </div>
      <div class="metric-chip metric-chip--esfriando">
        <span class="metric-chip-value">${summary.esfriando}</span>
        <span class="metric-chip-label">esfriando</span>
      </div>
      <div class="metric-chip metric-chip--inativo">
        <span class="metric-chip-value">${summary.inativo}</span>
        <span class="metric-chip-label">inativos</span>
      </div>
      <div class="metric-chip metric-chip--novo">
        <span class="metric-chip-value">${summary.novo}</span>
        <span class="metric-chip-label">sem visita</span>
      </div>
    `;
  }

  function renderTabs() {
    const list = api.getCustomerActivity();
    const counts = {};
    list.forEach((customer) => {
      counts[customer.segment] = (counts[customer.segment] || 0) + 1;
    });

    qs('segmentTabs').innerHTML = FILTERS.map((filter) => {
      const count = filter.segments
        ? filter.segments.reduce((total, seg) => total + (counts[seg] || 0), 0)
        : list.length;
      return `
        <button type="button" class="segment-tab${filter.key === activeFilter ? ' is-active' : ''}" data-filter="${filter.key}">
          ${filter.label}
          <span class="segment-tab-count">${count}</span>
        </button>
      `;
    }).join('');
  }

  function visitCountText(customer) {
    if (customer.visitCount === 0) return 'Nunca veio';
    return `${customer.visitCount} ${customer.visitCount === 1 ? 'visita' : 'visitas'}`;
  }

  function visitSubText(customer) {
    if (customer.segment === 'agendado' && customer.daysUntilNext != null) {
      return customer.daysUntilNext <= 0
        ? 'próxima: hoje'
        : `próxima em ${customer.daysUntilNext} dia${customer.daysUntilNext === 1 ? '' : 's'}`;
    }
    if (!customer.lastVisit) return '';
    if (customer.daysSince === 0) return 'última: hoje';
    if (customer.daysSince === 1) return 'última: ontem';
    return `última há ${customer.daysSince} dias`;
  }

  function buildWhatsappLink(customer) {
    const digits = api.phoneDigits(customer.phone);
    if (digits.length < 10) {
      return '';
    }

    const firstName = customer.fullName.split(' ')[0];
    const petNames = customer.pets.map((pet) => pet.name).join(', ');
    const message =
      `Olá, ${firstName}! Aqui é da Colina Clínica Veterinária 🐾 ` +
      (petNames ? `Faz um tempinho que não vemos o(a) ${petNames}. ` : 'Faz um tempinho que não passa por aqui. ') +
      'Que tal agendar um banho e tosa? Temos horários abertos esta semana.';

    return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;
  }

  function renderRow(customer) {
    const petsLine = customer.pets.length ? customer.pets.map((pet) => e(pet.name)).join(' · ') : 'Sem pets';
    const waLink = buildWhatsappLink(customer);
    const action = waLink
      ? `<a class="wa-button" href="${waLink}" target="_blank" rel="noopener">WhatsApp</a>`
      : '<span class="wa-button is-disabled">Telefone inválido</span>';
    const subText = visitSubText(customer);

    return `
      <div class="activity-row activity-row--${customer.segment}">
        <div class="activity-main">
          <div class="activity-name">${e(customer.fullName)}</div>
          <div class="activity-sub">${e(customer.phone)} · ${petsLine}</div>
        </div>
        <div class="activity-visit">
          <div class="activity-visit-value">${visitCountText(customer)}</div>
          ${subText ? `<div class="activity-visit-label">${subText}</div>` : ''}
        </div>
        <div class="activity-seg">
          <span class="seg-badge seg-badge--${customer.segment}">${api.getSegmentLabel(customer.segment)}</span>
        </div>
        <div class="activity-actions">${action}</div>
      </div>
    `;
  }

  function emptyMessage() {
    if (searchTerm.trim()) {
      return 'Nenhum cliente encontrado para esta busca.';
    }

    if (activeFilter === 'reativar') {
      return 'Ninguém para reativar agora — base em dia. 🎉';
    }

    if (activeFilter === 'novos') {
      return 'Todos os clientes já têm pelo menos uma visita.';
    }

    return 'Nenhum cliente neste filtro.';
  }

  function renderList() {
    const rows = getRows();
    qs('activityList').innerHTML = rows.length
      ? rows.map(renderRow).join('')
      : `<div class="empty-card">${emptyMessage()}</div>`;
  }

  function render() {
    renderSummary();
    renderTabs();
    renderList();
  }

  function renderError(error) {
    qs('activityList').innerHTML = `<div class="empty-card">${e(error && error.message ? error.message : 'Não foi possível carregar os dados do Supabase.')}</div>`;
  }

  async function syncData() {
    try {
      await Promise.all([api.refreshAppointments(), api.refreshCustomers()]);
    } catch (error) {
      renderError(error);
    }
  }

  function bind() {
    qs('segmentTabs').addEventListener('click', function (event) {
      const button = event.target.closest('[data-filter]');
      if (!button) {
        return;
      }
      activeFilter = button.getAttribute('data-filter');
      renderTabs();
      renderList();
    });

    qs('activitySearch').addEventListener('input', function () {
      searchTerm = qs('activitySearch').value;
      renderList();
    });

    window.addEventListener('colina:appointments-changed', render);
    window.addEventListener('colina:registry-changed', render);
  }

  async function init() {
    updateClock();
    bind();

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
