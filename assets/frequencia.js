(function () {
  const api = window.ColinaAgenda;
  const e = api.escapeHtml;

  let searchTerm = '';
  let sortField = 'appointments';
  let sortDirection = 'desc';
  let periodMode = 'all';
  let customStartDate = '';
  let customEndDate = '';
  let activeCustomerId = '';

  const SORT_FIELD_LABELS = {
    appointments: 'agendamentos',
    last: 'último agendamento',
    bath: 'banho',
    higienica: 'tosa higiênica',
    tesoura: 'tosa tesoura',
    maquina: 'tosa máquina',
  };

  const GROOMING_TYPE_LABELS = {
    higienica: 'Tosa Higiênica',
    tesoura: 'Tosa Tesoura',
    maquina: 'Tosa Máquina',
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function updateClock() {
    const now = new Date();
    qs('clockTime').textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    qs('clockDate').textContent = api.formatLongDate(api.toDateKey(now));
    qs('footerUpdated').textContent = `Atualizado às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function addDays(base, days) {
    const value = new Date(base);
    value.setHours(0, 0, 0, 0);
    value.setDate(value.getDate() + days);
    return value;
  }

  function getPresetRange(days) {
    const end = new Date();
    return {
      startDate: api.toDateKey(addDays(end, -(days - 1))),
      endDate: api.toDateKey(end),
    };
  }

  function ensureCustomRange() {
    if (!customStartDate || !customEndDate) {
      const range = getPresetRange(30);
      customStartDate = customStartDate || range.startDate;
      customEndDate = customEndDate || range.endDate;
    }
  }

  function normalizeRangeOrder(range) {
    if (range.startDate && range.endDate && range.startDate > range.endDate) {
      return {
        startDate: range.endDate,
        endDate: range.startDate,
      };
    }

    return range;
  }

  function getPeriodRange() {
    if (periodMode === 'all') {
      return {};
    }

    if (periodMode === '7') {
      return getPresetRange(7);
    }

    if (periodMode === 'custom') {
      ensureCustomRange();
      return normalizeRangeOrder({
        startDate: customStartDate,
        endDate: customEndDate,
      });
    }

    return getPresetRange(30);
  }

  function getFullHistoryRange() {
    return {
      endDate: api.toDateKey(new Date()),
    };
  }

  function formatPeriodRange(range) {
    if (!range.startDate && !range.endDate) {
      return 'todo o histórico';
    }

    if (range.startDate === range.endDate) {
      return api.formatShortDate(range.startDate);
    }

    return `${api.formatShortDate(range.startDate)} a ${api.formatShortDate(range.endDate)}`;
  }

  function getPeriodLabel() {
    const quickLabel =
      periodMode === 'all' ? 'Todos' : periodMode === '7' ? 'Últimos 7 dias' : periodMode === 'custom' ? 'Personalizado' : 'Últimos 30 dias';
    return `${quickLabel} · ${formatPeriodRange(getPeriodRange())}`;
  }

  function isFullHistoryMode() {
    return periodMode === 'all';
  }

  function updatePeriodControls() {
    ensureCustomRange();

    document.querySelectorAll('[data-period]').forEach((button) => {
      const isActive = button.dataset.period === periodMode;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });

    qs('customPeriodFields').hidden = periodMode !== 'custom';
    qs('periodStart').value = customStartDate;
    qs('periodEnd').value = customEndDate;
    qs('periodMeta').textContent = getPeriodLabel();
  }

  function compareMoments(left, right) {
    return left.lastAppointmentDate.localeCompare(right.lastAppointmentDate) || left.lastAppointmentTime.localeCompare(right.lastAppointmentTime);
  }

  function compareNames(left, right) {
    return left.fullName.localeCompare(right.fullName);
  }

  function matchesSearch(row) {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return true;
    }

    const digits = api.phoneDigits(searchTerm);
    const stack = [row.fullName, row.phone, row.petNames].join(' ').toLowerCase();
    return stack.includes(term) || (digits ? api.phoneDigits(row.phone).includes(digits) : false);
  }

  function sortRows(rows) {
    return rows.sort((left, right) => {
      let comparison = 0;

      if (sortField === 'last') {
        comparison = compareMoments(left, right);
      } else if (sortField === 'bath') {
        comparison = left.bathCount - right.bathCount;
      } else if (sortField === 'higienica') {
        comparison = left.higienicaCount - right.higienicaCount;
      } else if (sortField === 'tesoura') {
        comparison = left.tesouraCount - right.tesouraCount;
      } else if (sortField === 'maquina') {
        comparison = left.maquinaCount - right.maquinaCount;
      } else {
        comparison = left.totalAppointments - right.totalAppointments;
      }

      if (sortDirection === 'desc') {
        comparison *= -1;
      }

      if (comparison !== 0) {
        return comparison;
      }

      if (sortField !== 'appointments') {
        const appointmentComparison = right.totalAppointments - left.totalAppointments;
        if (appointmentComparison !== 0) {
          return appointmentComparison;
        }
      }

      const recencyComparison = compareMoments(right, left);
      if (recencyComparison !== 0) {
        return recencyComparison;
      }

      return compareNames(left, right);
    });
  }

  function getRows() {
    return sortRows(api.getCustomerFrequencyRows(getPeriodRange()).filter(matchesSearch));
  }

  function getAllRowsForPeriod() {
    return api.getCustomerFrequencyRows(getPeriodRange());
  }

  function renderSummary() {
    const summary = api.getCustomerFrequencySummary(getPeriodRange());
    qs('activitySummary').innerHTML = `
      <div class="metric-chip metric-chip--neutral">
        <span class="metric-chip-value">${summary.totalCustomers}</span>
        <span class="metric-chip-label">${isFullHistoryMode() ? 'clientes com histórico' : 'clientes no período'}</span>
      </div>
      <div class="metric-chip metric-chip--gold">
        <span class="metric-chip-value">${summary.totalAppointments}</span>
        <span class="metric-chip-label">agendamentos</span>
      </div>
      <div class="metric-chip metric-chip--ativo">
        <span class="metric-chip-value">${summary.bathCount}</span>
        <span class="metric-chip-label">com banho</span>
      </div>
      <div class="metric-chip metric-chip--warn">
        <span class="metric-chip-value">${summary.higienicaCount}</span>
        <span class="metric-chip-label">tosa higiênica</span>
      </div>
      <div class="metric-chip metric-chip--brown">
        <span class="metric-chip-value">${summary.tesouraCount}</span>
        <span class="metric-chip-label">tosa tesoura</span>
      </div>
      <div class="metric-chip metric-chip--plum">
        <span class="metric-chip-value">${summary.maquinaCount}</span>
        <span class="metric-chip-label">tosa máquina</span>
      </div>
    `;
  }

  function renderToolbarMeta(totalRows) {
    const fieldLabel = SORT_FIELD_LABELS[sortField] || SORT_FIELD_LABELS.appointments;
    const directionLabel = sortDirection === 'desc' ? 'maior para menor' : 'menor para maior';
    qs('activityMeta').textContent = `${totalRows} cliente${totalRows === 1 ? '' : 's'} exibido${totalRows === 1 ? '' : 's'} · ${fieldLabel} · ${directionLabel}`;
  }

  function renderSortDirectionButton() {
    const button = qs('activitySortDirection');
    const isDesc = sortDirection === 'desc';
    button.textContent = isDesc ? '↑' : '↓';
    button.setAttribute('aria-label', isDesc ? 'Mostrar menor primeiro' : 'Mostrar maior primeiro');
    button.setAttribute('title', isDesc ? 'Maior para menor' : 'Menor para maior');
  }

  function formatLastAppointment(row) {
    if (!row.lastAppointmentDate) {
      return 'Sem histórico';
    }

    const petLine = row.lastPetName ? ` · ${e(row.lastPetName)}` : '';
    return `
      <div class="frequency-last">
        <strong>${e(api.formatShortDate(row.lastAppointmentDate))}</strong>
        <span>${e(row.lastAppointmentTime)}${petLine}</span>
      </div>
    `;
  }

  function formatServices(appointment) {
    const labels = [];

    if (appointment.bath) {
      labels.push('Banho');
    }

    if (appointment.groomingType) {
      labels.push(GROOMING_TYPE_LABELS[appointment.groomingType] || appointment.groomingType);
    }

    if (appointment.tele) {
      labels.push('Tele');
    }

    return labels.length ? labels.join(' · ') : 'Sem serviço informado';
  }

  function renderTable(rows) {
    if (!rows.length) {
      qs('activityList').innerHTML = `<div class="empty-card">${
        searchTerm.trim()
          ? `Nenhum cliente encontrado para esta busca${isFullHistoryMode() ? '.' : ' neste período.'}`
          : isFullHistoryMode()
          ? 'Nenhum agendamento encontrado ainda.'
          : 'Nenhum agendamento encontrado neste período.'
      }</div>`;
      return;
    }

    qs('activityList').innerHTML = `
      <div class="frequency-table-wrap">
        <table class="frequency-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Cliente</th>
              <th>Agendamentos</th>
              <th>Banhos</th>
              <th>Tosa Higiênica</th>
              <th>Tosa Tesoura</th>
              <th>Tosa Máquina</th>
              <th>Último Agendamento</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row, index) => {
                return `
                  <tr>
                    <td><span class="frequency-rank">${index + 1}</span></td>
                    <td>
                      <button type="button" class="frequency-client-button" data-customer-id="${e(row.customerId)}" aria-label="Abrir histórico de ${e(row.fullName)}">
                        <strong>${e(row.fullName)}</strong>
                        <span>${e(row.phone)}${row.petNames ? ` · ${e(row.petNames)}` : ''}</span>
                      </button>
                    </td>
                    <td><span class="frequency-number frequency-number--primary">${row.totalAppointments}</span></td>
                    <td><span class="frequency-number">${row.bathCount}</span></td>
                    <td><span class="frequency-number">${row.higienicaCount}</span></td>
                    <td><span class="frequency-number">${row.tesouraCount}</span></td>
                    <td><span class="frequency-number">${row.maquinaCount}</span></td>
                    <td>${formatLastAppointment(row)}</td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderCustomerDetail() {
    const customer = api.getCustomerById(activeCustomerId);
    const row = getAllRowsForPeriod().find((item) => item.customerId === activeCustomerId);
    const history = api.getCustomerFrequencyHistory(activeCustomerId, getFullHistoryRange());
    const customerName = row ? row.fullName : customer ? customer.fullName : 'Cliente';
    const customerPhone = row ? row.phone : customer ? customer.phone : '';
    const petNames = row ? row.petNames : customer && customer.pets.length ? customer.pets.map((pet) => pet.name).join(' · ') : '';

    qs('customerDetailContent').innerHTML = `
      <div class="frequency-detail-header">
        <button type="button" class="icon-button frequency-drawer-close" id="closeCustomerDrawer" aria-label="Fechar histórico" title="Fechar">×</button>
        <div class="frequency-detail-title">
          <span>Histórico do cliente</span>
          <h2>${e(customerName)}</h2>
          <p>${e(customerPhone)}${petNames ? ` · ${e(petNames)}` : ''}</p>
        </div>
      </div>

      <div class="frequency-detail-summary">
        <div class="metric-chip metric-chip--gold">
          <span class="metric-chip-value">${row ? row.totalAppointments : 0}</span>
          <span class="metric-chip-label">${isFullHistoryMode() ? 'agendamentos no total' : 'agendamentos no período'}</span>
        </div>
        <div class="metric-chip metric-chip--ativo">
          <span class="metric-chip-value">${row ? row.bathCount : 0}</span>
          <span class="metric-chip-label">banhos</span>
        </div>
        <div class="metric-chip metric-chip--warn">
          <span class="metric-chip-value">${row ? row.higienicaCount : 0}</span>
          <span class="metric-chip-label">tosa higiênica</span>
        </div>
        <div class="metric-chip metric-chip--brown">
          <span class="metric-chip-value">${row ? row.tesouraCount : 0}</span>
          <span class="metric-chip-label">tosa tesoura</span>
        </div>
        <div class="metric-chip metric-chip--plum">
          <span class="metric-chip-value">${row ? row.maquinaCount : 0}</span>
          <span class="metric-chip-label">tosa máquina</span>
        </div>
      </div>

      <div class="frequency-detail-subhead">
        <strong>Todos os agendamentos anteriores</strong>
        <span>Histórico completo até ${e(api.formatShortDate(api.toDateKey(new Date())))}</span>
      </div>

      ${renderCustomerHistory(history)}
    `;
  }

  function renderCustomerHistory(history) {
    if (!history.length) {
      return '<div class="empty-card">Nenhum agendamento anterior encontrado para este cliente.</div>';
    }

    return `
      <div class="frequency-history-list">
        ${history
          .map((appointment) => {
            return `
              <article class="frequency-history-item">
                <div class="frequency-history-date">
                  <strong>${e(api.formatShortDate(appointment.date))}</strong>
                  <span>${e(appointment.arrivalTime)}</span>
                </div>
                <div class="frequency-history-body">
                  <div class="frequency-history-main">
                    <strong>${e(appointment.petName || 'Pet')}</strong>
                    <span>${e(formatServices(appointment))}</span>
                  </div>
                  <div class="frequency-history-meta">
                    <span class="frequency-status">${e(appointment.attendanceLabel || 'Agendado')}</span>
                    ${appointment.breed ? `<span>${e(appointment.breed)}</span>` : ''}
                  </div>
                  <p>${appointment.notes ? e(appointment.notes) : '<span class="frequency-muted">Sem observações</span>'}</p>
                </div>
              </article>
            `;
          })
          .join('')}
      </div>
    `;
  }

  function render() {
    const rows = getRows();
    updatePeriodControls();
    renderSummary();
    renderSortDirectionButton();
    renderToolbarMeta(rows.length);
    renderTable(rows);

    qs('customerDetailPanel').hidden = !activeCustomerId;
    qs('customerDetailPanel').classList.toggle('is-open', Boolean(activeCustomerId));

    if (activeCustomerId) {
      renderCustomerDetail();
    }
  }

  function renderError(error) {
    renderSortDirectionButton();
    qs('activityMeta').textContent = 'Falha ao carregar frequência.';
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
    qs('activitySortField').addEventListener('change', function () {
      sortField = qs('activitySortField').value;
      render();
    });

    qs('activitySortDirection').addEventListener('click', function () {
      sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
      render();
    });

    qs('activitySearch').addEventListener('input', function () {
      searchTerm = qs('activitySearch').value;
      render();
    });

    document.querySelectorAll('[data-period]').forEach((button) => {
      button.addEventListener('click', function () {
        periodMode = button.dataset.period;
        render();
      });
    });

    qs('periodStart').addEventListener('change', function () {
      customStartDate = qs('periodStart').value;
      periodMode = 'custom';
      render();
    });

    qs('periodEnd').addEventListener('change', function () {
      customEndDate = qs('periodEnd').value;
      periodMode = 'custom';
      render();
    });

    qs('activityList').addEventListener('click', function (event) {
      const button = event.target.closest('[data-customer-id]');
      if (!button) {
        return;
      }

      activeCustomerId = button.dataset.customerId;
      render();
    });

    qs('customerDetailPanel').addEventListener('click', function (event) {
      if (event.target.closest('#closeCustomerDrawer') || event.target === qs('customerDetailPanel')) {
        activeCustomerId = '';
        render();
      }
    });

    window.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && activeCustomerId) {
        activeCustomerId = '';
        render();
      }
    });

    window.addEventListener('colina:appointments-changed', render);
    window.addEventListener('colina:registry-changed', render);
  }

  async function init() {
    const defaultRange = getPresetRange(30);
    customStartDate = defaultRange.startDate;
    customEndDate = defaultRange.endDate;

    updateClock();
    bind();
    updatePeriodControls();
    renderSortDirectionButton();
    renderToolbarMeta(0);

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
