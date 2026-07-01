(function () {
  const api = window.ColinaAgenda;
  const e = api.escapeHtml;

  let searchTerm = '';
  let sortField = 'appointments';
  let sortDirection = 'desc';

  const SORT_FIELD_LABELS = {
    appointments: 'agendamentos',
    last: 'último agendamento',
    bath: 'banho',
    higienica: 'tosa higiênica',
    tesoura: 'tosa tesoura',
    maquina: 'tosa máquina',
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
    return sortRows(api.getCustomerFrequencyRows().filter(matchesSearch));
  }

  function renderSummary() {
    const summary = api.getCustomerFrequencySummary();
    qs('activitySummary').innerHTML = `
      <div class="metric-chip metric-chip--neutral">
        <span class="metric-chip-value">${summary.totalCustomers}</span>
        <span class="metric-chip-label">clientes com histórico</span>
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

  function renderTable(rows) {
    if (!rows.length) {
      qs('activityList').innerHTML = `<div class="empty-card">${searchTerm.trim() ? 'Nenhum cliente encontrado para esta busca.' : 'Nenhum agendamento encontrado ainda.'}</div>`;
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
                      <div class="frequency-client">
                        <strong>${e(row.fullName)}</strong>
                        <span>${e(row.phone)}${row.petNames ? ` · ${e(row.petNames)}` : ''}</span>
                      </div>
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

  function render() {
    const rows = getRows();
    renderSummary();
    renderSortDirectionButton();
    renderToolbarMeta(rows.length);
    renderTable(rows);
  }

  function renderError(error) {
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
