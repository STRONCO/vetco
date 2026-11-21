/* ==========================================================================
   VETCO — Módulo Completo de Agenda, Citas y Recordatorios (Bloque 3)
   - 4 vistas: Agenda del día, Lista filtrable, Calendario semanal, Calendario mensual
   - Vista preferida configurable con 1 clic
   - Modal Crear/Editar cita con autocompletado de pacientes y detección de solapamientos
   - Modal de Recordatorios al propietario (WhatsApp MX +52, Correo, .ics, Google Cal, Copiar)
   - Puente bidireccional con Historia Clínica
   ========================================================================== */

(function (global) {
  'use strict';

  const { APPOINTMENT_STATUSES, APPOINTMENT_TYPES, AGENDA_VIEWS } = global.VETCO_DATA;
  const Storage = global.VETCO_STORAGE;
  const A11y = global.VETCO_A11Y;
  const Reminders = global.VETCO_REMINDERS;

  const STATUS_LABELS = Object.fromEntries((APPOINTMENT_STATUSES || []).map((s) => [s.key, s.label]));
  const VIEW_LABELS = Object.fromEntries((AGENDA_VIEWS || []).map((v) => [v.key, v.label]));
  const CHANNEL_LABELS = {
    whatsapp: 'WhatsApp',
    email: 'Correo',
    manual: 'Manual',
    ics: 'Calendario .ics'
  };

  let hooks = {
    onDataChanged: () => {},
    onStartClinicalRecord: () => {},
    onConfirm: () => {}
  };

  let currentView = 'day';
  let selectedDate = '';
  let listQuickFilter = 'all';
  let editingAppointmentId = null;
  let reminderAppointmentId = null;

  // Referencias DOM (se inicializan en init())
  let els = {};

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getTodayISO() {
    const now = new Date();
    return toISO(now);
  }

  function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseISO(iso) {
    const dt = new Date(`${iso}T12:00:00`);
    return Number.isNaN(dt.getTime()) ? new Date() : dt;
  }

  function addDaysISO(iso, delta) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + delta);
    return toISO(d);
  }

  function addMonthsISO(iso, delta) {
    const d = parseISO(iso);
    d.setDate(1);
    d.setMonth(d.getMonth() + delta);
    return toISO(d);
  }

  function getMondayISO(iso) {
    const d = parseISO(iso);
    const day = d.getDay(); // 0 dom .. 6 sab
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return toISO(d);
  }

  function formatDisplayDate(iso) {
    if (!iso) return '—';
    const parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function formatMonthYear(iso) {
    try {
      return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(parseISO(iso));
    } catch {
      return iso.slice(0, 7);
    }
  }

  function formatShortWeekday(iso) {
    try {
      return new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(parseISO(iso)).replace('.', '');
    } catch {
      return '';
    }
  }

  function formatDayShort(iso) {
    try {
      return new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).format(parseISO(iso));
    } catch {
      return formatDisplayDate(iso);
    }
  }

  function timeToMinutes(hhmm) {
    const [h, m] = String(hhmm || '09:00').split(':').map((n) => parseInt(n, 10) || 0);
    return h * 60 + m;
  }

  // ------------------------------------------------------------------------
  // Tarjeta completa y reutilizable de Cita (usada en Agenda y Dashboard)
  // ------------------------------------------------------------------------
  function buildAppointmentCard(appt, options) {
    const opts = options || {};
    const settings = Storage.getSettings();
    const isOverdue = Reminders.isAppointmentOverdue(appt);

    const wrap = document.createElement('div');
    wrap.className = 'appt-card-wrap';

    const card = document.createElement('article');
    card.className = 'appt-card';

    // Columna de hora / fecha
    const timeCol = document.createElement('div');
    timeCol.className = 'appt-time-col';
    const timeStrong = document.createElement('strong');
    timeStrong.textContent = appt.hora || '09:00';
    const timeSub = document.createElement('span');
    timeSub.textContent = opts.showDate ? formatDisplayDate(appt.fecha) : `${appt.duracionMin || 30} min`;
    timeCol.append(timeStrong, timeSub);

    // Columna de información
    const info = document.createElement('div');
    info.className = 'appt-info';

    const titleRow = document.createElement('div');
    titleRow.className = 'appt-title-row';

    const pacName = document.createElement('strong');
    pacName.textContent = appt.paciente?.nombre || 'Paciente';
    titleRow.append(pacName);

    if (appt.paciente?.especie) {
      const sp = document.createElement('span');
      sp.className = 'species-tag';
      sp.textContent = appt.paciente.especie;
      titleRow.append(sp);
    }

    const statusPill = document.createElement('span');
    statusPill.className = 'status-pill';
    statusPill.dataset.status = appt.estado || 'programada';
    statusPill.textContent = STATUS_LABELS[appt.estado] || appt.estado;
    titleRow.append(statusPill);

    if (isOverdue) {
      const ovBadge = document.createElement('span');
      ovBadge.className = 'badge badge-warn';
      ovBadge.dataset.overdue = 'true';
      ovBadge.textContent = 'Atrasada';
      titleRow.append(ovBadge);
    }

    if (appt.prioridad === 'urgente') {
      const urg = document.createElement('span');
      urg.className = 'badge badge-danger';
      urg.dataset.priority = 'urgente';
      urg.textContent = 'Urgente';
      titleRow.append(urg);
    }

    const notifBadge = document.createElement('span');
    notifBadge.className = appt.reminder?.notified ? 'badge badge-ok' : 'badge badge-warn';
    notifBadge.dataset.notified = appt.reminder?.notified ? 'true' : 'false';
    if (appt.reminder?.notified) {
      const ch = CHANNEL_LABELS[appt.reminder.channel] || appt.reminder.channel || 'Enviado';
      const stamp = Reminders.formatNotifiedStamp(appt.reminder.notifiedAt);
      notifBadge.textContent = stamp ? `Recordatorio enviado · ${ch} · ${stamp}` : `Recordatorio enviado · ${ch}`;
    } else {
      notifBadge.textContent = 'Sin notificar';
    }
    titleRow.append(notifBadge);

    const meta = document.createElement('div');
    meta.className = 'appt-meta';
    meta.textContent = [
      appt.propietario?.nombres,
      appt.propietario?.telefono ? Reminders.formatPhonePretty(appt.propietario.telefono) : '',
      appt.medico?.nombre,
      opts.showDate ? `${appt.duracionMin || 30} min` : ''
    ]
      .filter(Boolean)
      .join(' · ');

    const reason = document.createElement('p');
    reason.className = 'appt-reason';
    reason.textContent = `${appt.tipo ? `${appt.tipo}: ` : ''}${appt.motivo || 'Consulta programada'}`;

    info.append(titleRow, meta, reason);

    if (appt.notas && !opts.compact) {
      const notesP = document.createElement('small');
      notesP.className = 'text-muted';
      notesP.textContent = `Nota: ${appt.notas}`;
      info.append(notesP);
    }

    // Columna de acciones
    const actions = document.createElement('div');
    actions.className = 'appt-actions';

    // Selector rápido de estado inline
    if (!opts.hideStatusSelect) {
      const statusSel = document.createElement('select');
      statusSel.className = 'status-inline-select';
      statusSel.setAttribute('aria-label', `Cambiar estado de la cita de ${appt.paciente?.nombre || 'paciente'}`);
      for (const st of APPOINTMENT_STATUSES) {
        const o = document.createElement('option');
        o.value = st.key;
        o.textContent = st.label;
        if (st.key === appt.estado) o.selected = true;
        statusSel.append(o);
      }
      statusSel.addEventListener('change', () => {
        Storage.updateAppointmentStatus(appt.id, statusSel.value);
        hooks.onDataChanged();
        A11y.showToast(
          `Estado de ${appt.paciente?.nombre || 'cita'} actualizado a "${STATUS_LABELS[statusSel.value] || statusSel.value}".`,
          'success'
        );
      });
      actions.append(statusSel);
    }

    // Botón WhatsApp 1-clic
    const btnWa = document.createElement('a');
    btnWa.className = 'btn btn-whatsapp btn-xs';
    btnWa.href = Reminders.buildWhatsAppUrl(appt, settings);
    btnWa.target = '_blank';
    btnWa.rel = 'noopener noreferrer';
    btnWa.textContent = 'WhatsApp';
    btnWa.title = `Enviar recordatorio por WhatsApp (+${settings.countryCode || '52'})`;
    btnWa.addEventListener('click', () => {
      Storage.markAppointmentNotified(appt.id, 'whatsapp');
      hooks.onDataChanged();
      A11y.showToast(`Recordatorio por WhatsApp registrado para ${appt.paciente?.nombre || 'paciente'}.`, 'success');
    });

    // Botón modal Recordar (editar mensaje, correo, .ics, Google Cal)
    const btnRemind = document.createElement('button');
    btnRemind.type = 'button';
    btnRemind.className = 'btn btn-outline btn-xs';
    btnRemind.textContent = 'Recordar';
    btnRemind.title = 'Editar mensaje, enviar por correo o descargar .ics';
    btnRemind.addEventListener('click', () => openReminderModal(appt.id));

    // Botón puente clínico: Atender / Crear Historia Clínica
    const btnAttend = document.createElement('button');
    btnAttend.type = 'button';
    btnAttend.className = 'btn btn-primary btn-xs';
    btnAttend.textContent = appt.linkedRecordId ? 'Abrir Historia' : 'Atender / Historia';
    btnAttend.title = appt.linkedRecordId
      ? 'Abrir la historia clínica vinculada a esta cita'
      : 'Iniciar historia clínica con los datos de este paciente y propietario';
    btnAttend.addEventListener('click', () => hooks.onStartClinicalRecord(appt.id));

    actions.append(btnWa, btnRemind, btnAttend);

    if (!opts.compact) {
      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'action-chip';
      btnEdit.textContent = 'Editar';
      btnEdit.addEventListener('click', () => openEditAppointmentModal(appt.id));

      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'action-chip action-chip-danger';
      btnDel.textContent = 'Eliminar';
      btnDel.addEventListener('click', () => requestDeleteAppointment(appt));

      actions.append(btnEdit, btnDel);
    }

    card.append(timeCol, info, actions);
    wrap.append(card);
    return wrap;
  }

  // ------------------------------------------------------------------------
  // Filtrado de citas
  // ------------------------------------------------------------------------
  function getFilteredAppointments(allAppts) {
    const q = (els.searchInput?.value || '').trim().toLowerCase();
    const st = els.statusFilter?.value || '';
    const tp = els.typeFilter?.value || '';
    const vet = els.vetFilter?.value || '';

    return (allAppts || []).filter((a) => {
      if (st && a.estado !== st) return false;
      if (tp && a.tipo !== tp) return false;
      if (vet && (a.medico?.nombre || '') !== vet) return false;
      if (!q) return true;
      const haystack = [
        a.paciente?.nombre,
        a.paciente?.especie,
        a.paciente?.raza,
        a.propietario?.nombres,
        a.propietario?.telefono,
        a.propietario?.email,
        a.tipo,
        a.motivo,
        a.notas,
        a.medico?.nombre,
        a.fecha,
        a.hora
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  function populateVetFilter() {
    if (!els.vetFilter) return;
    const prev = els.vetFilter.value;
    const vets = Storage.getKnownVets();
    els.vetFilter.innerHTML = '<option value="">Todos los veterinarios</option>';
    for (const v of vets) {
      const opt = document.createElement('option');
      opt.value = v.nombre;
      opt.textContent = v.nombre;
      els.vetFilter.append(opt);
    }
    if (prev && vets.some((v) => v.nombre === prev)) {
      els.vetFilter.value = prev;
    }
  }

  // ------------------------------------------------------------------------
  // Render principal del módulo Agenda
  // ------------------------------------------------------------------------
  function syncViewTabsUI() {
    const settings = Storage.getSettings();
    const preferred = settings.preferredAgendaView || 'day';

    document.querySelectorAll('[data-agenda-view]').forEach((btn) => {
      const v = btn.getAttribute('data-agenda-view');
      const active = v === currentView;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (els.btnPinPreferred) {
      const isPinned = currentView === preferred;
      els.btnPinPreferred.classList.toggle('is-active', isPinned);
      els.btnPinPreferred.textContent = isPinned
        ? `★ Preferida (${VIEW_LABELS[preferred] || preferred})`
        : '☆ Fijar como preferida';
    }

    if (els.dateNavWrap) {
      els.dateNavWrap.hidden = currentView === 'list';
    }

    if (els.quickChipsBar) {
      els.quickChipsBar.hidden = currentView !== 'list';
    }
  }

  function updateDateNavLabel() {
    if (!els.dateLabel) return;
    if (currentView === 'day') {
      const today = getTodayISO();
      const prefix = selectedDate === today ? 'Hoy · ' : '';
      els.dateLabel.textContent = `${prefix}${formatDayShort(selectedDate)}`;
    } else if (currentView === 'week') {
      const mon = getMondayISO(selectedDate);
      const sun = addDaysISO(mon, 6);
      els.dateLabel.textContent = `${formatDisplayDate(mon)} — ${formatDisplayDate(sun)}`;
    } else if (currentView === 'month') {
      els.dateLabel.textContent = formatMonthYear(selectedDate);
    }
  }

  function renderAgendaKPIs(allAppts) {
    const today = getTodayISO();
    const todayCount = allAppts.filter((a) => a.fecha === today && a.estado !== 'cancelada').length;
    const overdueCount = allAppts.filter((a) => Reminders.isAppointmentOverdue(a)).length;
    const upcomingCount = allAppts.filter(
      (a) => a.fecha > today && !['cancelada', 'no_asistio', 'completada'].includes(a.estado)
    ).length;
    const unnotifiedCount = allAppts.filter(
      (a) => !['cancelada', 'no_asistio', 'completada'].includes(a.estado) && !a.reminder?.notified
    ).length;

    if (els.kpiToday) els.kpiToday.textContent = String(todayCount);
    if (els.kpiOverdue) els.kpiOverdue.textContent = String(overdueCount);
    if (els.kpiUpcoming) els.kpiUpcoming.textContent = String(upcomingCount);
    if (els.kpiUnnotified) els.kpiUnnotified.textContent = String(unnotifiedCount);
  }

  function renderDayView(filtered) {
    const dayAppts = filtered
      .filter((a) => a.fecha === selectedDate)
      .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));

    const overdueOtherDays = filtered
      .filter((a) => a.fecha < selectedDate && Reminders.isAppointmentOverdue(a))
      .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));

    els.stage.innerHTML = '';

    // Aviso de citas atrasadas de días previos
    if (overdueOtherDays.length > 0 && selectedDate === getTodayISO()) {
      const alertBox = document.createElement('div');
      alertBox.className = 'draft-banner';
      alertBox.innerHTML = `
        <div class="draft-banner-text">
          <strong>Tienes ${overdueOtherDays.length} cita(s) atrasada(s) pendiente(s) de atención o reprogramación</strong>
          <span>Revisa las citas vencidas para atenderlas, reprogramarlas o marcar "No asistió".</span>
        </div>
      `;
      const btnShowOverdue = document.createElement('button');
      btnShowOverdue.type = 'button';
      btnShowOverdue.className = 'btn btn-outline btn-sm';
      btnShowOverdue.textContent = 'Ver atrasadas';
      btnShowOverdue.addEventListener('click', () => {
        currentView = 'list';
        listQuickFilter = 'overdue';
        render();
      });
      alertBox.append(btnShowOverdue);
      els.stage.append(alertBox);
    }

    const panel = document.createElement('div');
    panel.className = 'panel-card';

    const header = document.createElement('div');
    header.className = 'panel-header';
    const h2 = document.createElement('h2');
    h2.textContent = `${Reminders.formatDateLongEsMx(selectedDate)} (${dayAppts.length})`;
    const btnAddDay = document.createElement('button');
    btnAddDay.type = 'button';
    btnAddDay.className = 'btn btn-primary btn-xs';
    btnAddDay.textContent = '+ Agendar este día';
    btnAddDay.addEventListener('click', () => openNewAppointmentModal({ fecha: selectedDate }));
    header.append(h2, btnAddDay);

    const body = document.createElement('div');
    body.className = 'panel-body';

    if (dayAppts.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <div class="empty-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <p class="empty-title">No hay citas para esta fecha</p>
        <p class="empty-desc">Cambia de día, ajusta los filtros o agenda una nueva cita para ${formatDisplayDate(selectedDate)}.</p>
      `;
      const actions = document.createElement('div');
      actions.className = 'empty-actions';
      const btnEmptyAdd = document.createElement('button');
      btnEmptyAdd.type = 'button';
      btnEmptyAdd.className = 'btn btn-primary btn-sm';
      btnEmptyAdd.textContent = '+ Agendar cita';
      btnEmptyAdd.addEventListener('click', () => openNewAppointmentModal({ fecha: selectedDate }));
      actions.append(btnEmptyAdd);
      empty.append(actions);
      body.append(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'appt-list';
      for (const a of dayAppts) {
        list.append(buildAppointmentCard(a, { showDate: false }));
      }
      body.append(list);
    }

    panel.append(header, body);
    els.stage.append(panel);
  }

  function renderListView(filtered) {
    const today = getTodayISO();

    // Sincronizar pills rápidos
    document.querySelectorAll('[data-list-filter]').forEach((btn) => {
      const active = btn.getAttribute('data-list-filter') === listQuickFilter;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    let items = [...filtered];
    if (listQuickFilter === 'today') {
      items = items.filter((a) => a.fecha === today);
    } else if (listQuickFilter === 'upcoming') {
      items = items.filter((a) => a.fecha >= today && !['cancelada', 'no_asistio', 'completada'].includes(a.estado));
    } else if (listQuickFilter === 'overdue') {
      items = items.filter((a) => Reminders.isAppointmentOverdue(a));
    } else if (listQuickFilter === 'unnotified') {
      items = items.filter(
        (a) => !['cancelada', 'no_asistio', 'completada'].includes(a.estado) && !a.reminder?.notified
      );
    }

    items.sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));

    els.stage.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel-card';

    const header = document.createElement('div');
    header.className = 'panel-header';
    const h2 = document.createElement('h2');
    h2.textContent = `Listado de citas (${items.length})`;
    const btnExportFiltered = document.createElement('button');
    btnExportFiltered.type = 'button';
    btnExportFiltered.className = 'btn btn-outline btn-xs';
    btnExportFiltered.textContent = 'Exportar vista (.ics)';
    btnExportFiltered.addEventListener('click', () => {
      if (!Reminders.downloadAgendaICS(items, `vetco-citas-${listQuickFilter}-${today}.ics`, Storage.getSettings())) {
        A11y.showToast('No hay citas activas en esta vista para exportar.', 'error');
      } else {
        A11y.showToast(`Se descargó archivo .ics con ${items.length} cita(s).`, 'success');
      }
    });
    header.append(h2, btnExportFiltered);

    const body = document.createElement('div');
    body.className = 'panel-body';

    if (items.length === 0) {
      const hasActiveFilters = Boolean(
        (els.searchInput?.value || '').trim() ||
          els.statusFilter?.value ||
          els.typeFilter?.value ||
          els.vetFilter?.value ||
          listQuickFilter !== 'all'
      );
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <div class="empty-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <p class="empty-title">No se encontraron citas con estos filtros</p>
        <p class="empty-desc">Prueba limpiando los filtros activos o registra una nueva cita veterinaria.</p>
      `;
      const actions = document.createElement('div');
      actions.className = 'empty-actions';
      if (hasActiveFilters) {
        const btnReset = document.createElement('button');
        btnReset.type = 'button';
        btnReset.className = 'btn btn-outline btn-sm';
        btnReset.textContent = 'Limpiar filtros';
        btnReset.addEventListener('click', () => {
          if (els.searchInput) els.searchInput.value = '';
          if (els.statusFilter) els.statusFilter.value = '';
          if (els.typeFilter) els.typeFilter.value = '';
          if (els.vetFilter) els.vetFilter.value = '';
          listQuickFilter = 'all';
          render();
        });
        actions.append(btnReset);
      }
      const btnNew = document.createElement('button');
      btnNew.type = 'button';
      btnNew.className = 'btn btn-primary btn-sm';
      btnNew.textContent = '+ Nueva Cita';
      btnNew.addEventListener('click', () => openNewAppointmentModal());
      actions.append(btnNew);
      empty.append(actions);
      body.append(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'appt-list';
      for (const a of items) {
        list.append(buildAppointmentCard(a, { showDate: true }));
      }
      body.append(list);
    }

    panel.append(header, body);
    els.stage.append(panel);
  }

  function renderWeekView(filtered) {
    const monday = getMondayISO(selectedDate);
    const today = getTodayISO();

    els.stage.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel-card';
    const body = document.createElement('div');
    body.className = 'panel-body';

    const grid = document.createElement('div');
    grid.className = 'week-grid';

    for (let i = 0; i < 7; i++) {
      const dayIso = addDaysISO(monday, i);
      const dayAppts = filtered
        .filter((a) => a.fecha === dayIso)
        .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));

      const col = document.createElement('div');
      col.className = `week-col ${dayIso === today ? 'is-today' : ''}`.trim();

      const colHead = document.createElement('div');
      colHead.className = 'week-col-header';

      const title = document.createElement('div');
      title.className = 'week-col-title';
      const dow = document.createElement('span');
      dow.textContent = formatShortWeekday(dayIso);
      const num = document.createElement('strong');
      num.textContent = dayIso.slice(8, 10);
      title.append(dow, num);

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'icon-btn week-add-btn';
      addBtn.setAttribute('aria-label', `Agendar cita el ${formatDisplayDate(dayIso)}`);
      addBtn.title = `Agendar el ${formatDisplayDate(dayIso)}`;
      addBtn.textContent = '+';
      addBtn.addEventListener('click', () => openNewAppointmentModal({ fecha: dayIso }));

      colHead.append(title, addBtn);
      col.append(colHead);

      if (dayAppts.length === 0) {
        const empty = document.createElement('small');
        empty.className = 'text-muted';
        empty.textContent = 'Libre';
        col.append(empty);
      } else {
        for (const a of dayAppts) {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'cal-event-chip';
          chip.dataset.status = a.estado;
          if (a.prioridad === 'urgente') chip.dataset.priority = 'urgente';
          if (Reminders.isAppointmentOverdue(a)) chip.dataset.overdue = 'true';

          const line1 = document.createElement('strong');
          line1.textContent = `${a.hora} · ${a.paciente?.nombre || 'Paciente'}`;
          const line2 = document.createElement('small');
          line2.textContent = `${a.tipo || 'Consulta'} · ${a.propietario?.nombres || ''}`;

          chip.append(line1, line2);
          chip.addEventListener('click', () => openEditAppointmentModal(a.id));
          col.append(chip);
        }
      }

      grid.append(col);
    }

    body.append(grid);
    panel.append(body);
    els.stage.append(panel);
  }

  function renderMonthView(filtered) {
    const today = getTodayISO();
    const anchor = parseISO(selectedDate);
    const year = anchor.getFullYear();
    const month = anchor.getMonth();

    const firstOfMonth = new Date(year, month, 1, 12);
    const startDow = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1; // lunes = 0
    const gridStart = new Date(year, month, 1 - startDow, 12);

    // Agrupar citas por fecha
    const byDate = new Map();
    for (const a of filtered) {
      if (!byDate.has(a.fecha)) byDate.set(a.fecha, []);
      byDate.get(a.fecha).push(a);
    }

    els.stage.innerHTML = '';
    const layout = document.createElement('div');
    layout.className = 'month-layout';

    // Columna izquierda: Calendario 7x6
    const calPanel = document.createElement('div');
    calPanel.className = 'panel-card';
    const calBody = document.createElement('div');
    calBody.className = 'panel-body';

    const weekdays = document.createElement('div');
    weekdays.className = 'month-weekdays';
    ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach((wd) => {
      const s = document.createElement('span');
      s.textContent = wd;
      weekdays.append(s);
    });

    const grid = document.createElement('div');
    grid.className = 'month-grid';

    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + i);
      const iso = toISO(cellDate);
      const inMonth = cellDate.getMonth() === month;
      const dayAppts = byDate.get(iso) || [];

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = [
        'month-day-btn',
        !inMonth ? 'is-outside' : '',
        iso === today ? 'is-today' : '',
        iso === selectedDate ? 'is-selected' : ''
      ]
        .filter(Boolean)
        .join(' ');
      btn.setAttribute('aria-label', `${formatDisplayDate(iso)}, ${dayAppts.length} cita(s)`);

      const num = document.createElement('span');
      num.className = 'month-day-num';
      num.textContent = String(cellDate.getDate());
      btn.append(num);

      if (dayAppts.length > 0) {
        const dotsWrap = document.createElement('div');
        dotsWrap.className = 'month-day-dots';
        for (const a of dayAppts.slice(0, 4)) {
          const dot = document.createElement('span');
          let cls = 'cal-dot';
          if (a.prioridad === 'urgente') cls += ' cal-dot--urgent';
          else if (Reminders.isAppointmentOverdue(a)) cls += ' cal-dot--overdue';
          else if (a.estado === 'confirmada' || a.estado === 'completada') cls += ' cal-dot--ok';
          dot.className = cls;
          dotsWrap.append(dot);
        }
        const countLbl = document.createElement('span');
        countLbl.className = 'month-day-count';
        countLbl.textContent = `${dayAppts.length}`;
        dotsWrap.append(countLbl);
        btn.append(dotsWrap);
      }

      btn.addEventListener('click', () => {
        selectedDate = iso;
        render();
        if (window.innerWidth < 920) {
          const detailPanel = els.stage.querySelector('.month-day-detail');
          if (detailPanel) {
            detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      });

      grid.append(btn);
    }

    calBody.append(weekdays, grid);
    calPanel.append(calBody);

    // Columna derecha: Detalle del día seleccionado
    const sidePanel = document.createElement('div');
    sidePanel.className = 'panel-card month-day-detail';
    const sideHead = document.createElement('div');
    sideHead.className = 'panel-header';
    const sideTitle = document.createElement('h2');
    sideTitle.textContent = formatDayShort(selectedDate);
    const btnAddDay = document.createElement('button');
    btnAddDay.type = 'button';
    btnAddDay.className = 'btn btn-primary btn-xs';
    btnAddDay.textContent = '+ Agendar';
    btnAddDay.addEventListener('click', () => openNewAppointmentModal({ fecha: selectedDate }));
    sideHead.append(sideTitle, btnAddDay);

    const sideBody = document.createElement('div');
    sideBody.className = 'panel-body';

    const selectedAppts = (byDate.get(selectedDate) || []).sort((a, b) =>
      String(a.hora || '').localeCompare(String(b.hora || ''))
    );

    if (selectedAppts.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state empty-state--compact';
      empty.innerHTML = `
        <div class="empty-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <p class="empty-title">Día libre</p>
        <p class="empty-desc">Sin citas programadas para el ${formatDisplayDate(selectedDate)}.</p>
      `;
      const btnNewDay = document.createElement('button');
      btnNewDay.type = 'button';
      btnNewDay.className = 'btn btn-primary btn-xs';
      btnNewDay.textContent = '+ Agendar este día';
      btnNewDay.addEventListener('click', () => openNewAppointmentModal({ fecha: selectedDate }));
      empty.append(btnNewDay);
      sideBody.append(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'appt-list';
      for (const a of selectedAppts) {
        list.append(buildAppointmentCard(a, { showDate: false }));
      }
      sideBody.append(list);
    }

    sidePanel.append(sideHead, sideBody);
    layout.append(calPanel, sidePanel);
    els.stage.append(layout);
  }

  function render() {
    if (!els.stage) return;
    populateVetFilter();
    const allAppts = Storage.getAllAppointments();
    renderAgendaKPIs(allAppts);
    syncViewTabsUI();
    updateDateNavLabel();

    const filtered = getFilteredAppointments(allAppts);
    if (currentView === 'day') renderDayView(filtered);
    else if (currentView === 'list') renderListView(filtered);
    else if (currentView === 'week') renderWeekView(filtered);
    else if (currentView === 'month') renderMonthView(filtered);
  }

  // ------------------------------------------------------------------------
  // Modal Crear / Editar Cita con autocompletado y detección de solapamiento
  // ------------------------------------------------------------------------
  function populateModalDatalists() {
    const patients = Storage.getKnownPatients();
    const vets = Storage.getKnownVets();

    if (els.knownPatientSelect) {
      els.knownPatientSelect.innerHTML = '<option value="">— Paciente nuevo (capturar datos manualmente) —</option>';
      for (const p of patients) {
        const opt = document.createElement('option');
        opt.value = p.recordId;
        opt.textContent = `${p.paciente.nombre} (${p.paciente.especie || 'Mascota'}) — ${p.propietario.nombres}`;
        els.knownPatientSelect.append(opt);
      }
    }

    if (els.knownPatientsDatalist) {
      els.knownPatientsDatalist.innerHTML = '';
      for (const p of patients) {
        const opt = document.createElement('option');
        opt.value = p.paciente.nombre;
        opt.label = `${p.paciente.especie || ''} · ${p.propietario.nombres}`;
        els.knownPatientsDatalist.append(opt);
      }
    }

    if (els.knownVetsDatalist) {
      els.knownVetsDatalist.innerHTML = '';
      for (const v of vets) {
        const opt = document.createElement('option');
        opt.value = v.nombre;
        els.knownVetsDatalist.append(opt);
      }
    }
  }

  function applyKnownPatient(recordId) {
    if (!recordId) {
      els.sourceRecordId.value = '';
      return;
    }
    const rec = Storage.getRecordById(recordId);
    if (!rec) return;
    els.sourceRecordId.value = rec.id;
    els.pacNombre.value = rec.paciente?.nombre || '';
    els.pacEspecie.value = rec.paciente?.especie || '';
    els.pacRaza.value = rec.paciente?.raza || '';
    els.pacSexo.value = rec.paciente?.sexo || '';
    els.propNombres.value = rec.propietario?.nombres || '';
    els.propTelefono.value = rec.propietario?.telefono || '';
    els.propEmail.value = rec.propietario?.email || '';
    els.propDocumento.value = rec.propietario?.documento || '';
    if (!els.vetNombre.value && rec.medico?.nombre) {
      els.vetNombre.value = rec.medico.nombre;
      els.vetMatricula.value = rec.medico.matricula || '';
    }
    checkOverlapWarning();
  }

  function checkOverlapWarning() {
    if (!els.overlapWarning) return;
    const fecha = els.fecha.value;
    const hora = els.hora.value;
    const dur = Number(els.duracion.value) || 30;
    const vet = els.vetNombre.value.trim().toLowerCase();

    if (!fecha || !hora) {
      els.overlapWarning.hidden = true;
      return;
    }

    const startMin = timeToMinutes(hora);
    const endMin = startMin + dur;

    const conflicts = Storage.getAllAppointments().filter((a) => {
      if (editingAppointmentId && a.id === editingAppointmentId) return false;
      if (['cancelada', 'no_asistio'].includes(a.estado)) return false;
      if (a.fecha !== fecha) return false;
      if (vet && a.medico?.nombre && a.medico.nombre.trim().toLowerCase() !== vet) return false;

      const aStart = timeToMinutes(a.hora);
      const aEnd = aStart + (Number(a.duracionMin) || 30);
      return startMin < aEnd && endMin > aStart;
    });

    if (conflicts.length === 0) {
      els.overlapWarning.hidden = true;
      return;
    }

    const c = conflicts[0];
    els.overlapWarning.innerHTML = `<strong>Posible empalme de horario</strong>Ya existe una cita para <b>${escapeHtml(
      c.paciente?.nombre || 'otro paciente'
    )}</b> a las <b>${escapeHtml(c.hora)}</b> (${Number(c.duracionMin) || 30} min)${
      c.medico?.nombre ? ` con ${escapeHtml(c.medico.nombre)}` : ''
    }. Puedes ajustar la hora o guardar igualmente si es urgencia.`;
    els.overlapWarning.hidden = false;
  }

  function openNewAppointmentModal(prefill) {
    const p = prefill || {};
    editingAppointmentId = null;
    populateModalDatalists();
    els.form.reset();
    A11y.resetFormValidation(els.form);

    els.modalTitle.textContent = 'Agendar Nueva Cita';
    els.modalSub.textContent = 'Vincula un paciente existente o captura los datos de un paciente nuevo.';
    els.idInput.value = '';
    els.sourceRecordId.value = p.sourceRecordId || '';
    els.linkedRecordId.value = '';
    els.fecha.value = p.fecha || selectedDate || getTodayISO();
    els.hora.value = p.hora || '10:00';
    els.duracion.value = String(p.duracionMin || 30);
    els.tipo.value = p.tipo || 'Consulta general';
    els.prioridad.value = p.prioridad || 'normal';
    els.estado.value = p.estado || 'programada';
    els.motivo.value = p.motivo || '';
    els.notas.value = p.notas || '';

    if (p.sourceRecordId) {
      els.knownPatientSelect.value = p.sourceRecordId;
      applyKnownPatient(p.sourceRecordId);
    } else {
      els.knownPatientSelect.value = '';
      els.pacNombre.value = p.paciente?.nombre || '';
      els.pacEspecie.value = p.paciente?.especie || '';
      els.pacRaza.value = p.paciente?.raza || '';
      els.pacSexo.value = p.paciente?.sexo || '';
      els.propNombres.value = p.propietario?.nombres || '';
      els.propTelefono.value = p.propietario?.telefono || '';
      els.propEmail.value = p.propietario?.email || '';
      els.propDocumento.value = p.propietario?.documento || '';
      els.vetNombre.value = p.medico?.nombre || '';
      els.vetMatricula.value = p.medico?.matricula || '';
    }

    checkOverlapWarning();
    els.dialog.showModal();
  }

  function openEditAppointmentModal(id) {
    const appt = Storage.getAppointmentById(id);
    if (!appt) return;
    editingAppointmentId = appt.id;
    populateModalDatalists();
    els.form.reset();
    A11y.resetFormValidation(els.form);

    els.modalTitle.textContent = `Editar Cita — ${appt.paciente?.nombre || 'Paciente'}`;
    els.modalSub.textContent = `Programada para el ${formatDisplayDate(appt.fecha)} a las ${appt.hora}.`;
    els.idInput.value = appt.id;
    els.sourceRecordId.value = appt.sourceRecordId || '';
    els.linkedRecordId.value = appt.linkedRecordId || '';
    els.knownPatientSelect.value = appt.sourceRecordId || '';

    els.fecha.value = appt.fecha || getTodayISO();
    els.hora.value = appt.hora || '10:00';
    els.duracion.value = String(appt.duracionMin || 30);
    els.tipo.value = appt.tipo || 'Consulta general';
    els.prioridad.value = appt.prioridad || 'normal';
    els.estado.value = appt.estado || 'programada';

    els.pacNombre.value = appt.paciente?.nombre || '';
    els.pacEspecie.value = appt.paciente?.especie || '';
    els.pacRaza.value = appt.paciente?.raza || '';
    els.pacSexo.value = appt.paciente?.sexo || '';

    els.propNombres.value = appt.propietario?.nombres || '';
    els.propTelefono.value = appt.propietario?.telefono || '';
    els.propEmail.value = appt.propietario?.email || '';
    els.propDocumento.value = appt.propietario?.documento || '';

    els.vetNombre.value = appt.medico?.nombre || '';
    els.vetMatricula.value = appt.medico?.matricula || '';
    els.motivo.value = appt.motivo || '';
    els.notas.value = appt.notas || '';

    checkOverlapWarning();
    els.dialog.showModal();
  }

  function handleSaveAppointment(e) {
    if (e) e.preventDefault();
    const controls = Array.from(els.form.querySelectorAll('input, select, textarea'));
    let firstInvalid = null;
    for (const c of controls) {
      if (!c.validity.valid) {
        A11y.markFieldInvalidOnSubmit(c);
        if (!firstInvalid) firstInvalid = c;
      }
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const existing = editingAppointmentId ? Storage.getAppointmentById(editingAppointmentId) : null;
    const payload = {
      id: editingAppointmentId || null,
      fecha: els.fecha.value,
      hora: els.hora.value,
      duracionMin: Number(els.duracion.value) || 30,
      tipo: els.tipo.value,
      prioridad: els.prioridad.value,
      estado: els.estado.value,
      motivo: els.motivo.value.trim(),
      notas: els.notas.value.trim(),
      paciente: {
        nombre: els.pacNombre.value.trim(),
        especie: els.pacEspecie.value.trim(),
        raza: els.pacRaza.value.trim(),
        sexo: els.pacSexo.value
      },
      propietario: {
        nombres: els.propNombres.value.trim(),
        telefono: els.propTelefono.value.trim(),
        email: els.propEmail.value.trim(),
        documento: els.propDocumento.value.trim()
      },
      medico: {
        nombre: els.vetNombre.value.trim(),
        matricula: els.vetMatricula.value.trim()
      },
      sourceRecordId: els.sourceRecordId.value || null,
      linkedRecordId: els.linkedRecordId.value || existing?.linkedRecordId || null,
      reminder: existing?.reminder || { notified: false, channel: null, notifiedAt: null },
      createdAt: existing?.createdAt || null
    };

    const saved = Storage.saveAppointment(payload);
    if (!saved) {
      A11y.showToast('No fue posible guardar la cita en localStorage.', 'error');
      return;
    }

    selectedDate = saved.fecha;
    els.dialog.close('saved');
    hooks.onDataChanged();
    A11y.showToast(
      editingAppointmentId
        ? `Cita de ${saved.paciente.nombre} actualizada.`
        : `Cita agendada para ${saved.paciente.nombre} (${formatDisplayDate(saved.fecha)} ${saved.hora}).`,
      'success'
    );
  }

  function requestDeleteAppointment(appt) {
    hooks.onConfirm({
      title: `¿Eliminar cita de ${appt.paciente?.nombre || 'este paciente'}?`,
      message: `Se eliminará la cita del ${formatDisplayDate(appt.fecha)} a las ${appt.hora}. Esta acción no elimina historias clínicas ya guardadas.`,
      confirmLabel: 'Sí, eliminar cita',
      onConfirm: () => {
        Storage.deleteAppointment(appt.id);
        hooks.onDataChanged();
        A11y.showToast(`Cita de ${appt.paciente?.nombre || 'paciente'} eliminada.`, 'success');
      }
    });
  }

  // ------------------------------------------------------------------------
  // Modal de Recordatorios al Propietario (WhatsApp, Correo, .ics, Copiar)
  // ------------------------------------------------------------------------
  function syncReminderModalState(appt) {
    const cfg = Storage.getSettings();
    const customMsg = els.remMessage.value.trim();

    els.remPatientMeta.textContent = `${appt.paciente?.nombre || 'Paciente'} · ${formatDisplayDate(appt.fecha)} a las ${appt.hora}`;
    els.remOwnerMeta.textContent = `${appt.propietario?.nombres || 'Propietario'} · Tel: ${
      Reminders.formatPhonePretty(appt.propietario?.telefono) || 'Sin teléfono'
    }${appt.propietario?.email ? ` · ${appt.propietario.email}` : ''}`;

    if (appt.reminder?.notified) {
      const ch = CHANNEL_LABELS[appt.reminder.channel] || appt.reminder.channel || 'Manual';
      const stamp = Reminders.formatNotifiedStamp(appt.reminder.notifiedAt);
      els.remStatusBadge.className = 'badge badge-ok';
      els.remStatusBadge.textContent = stamp ? `Recordatorio enviado · ${ch} · ${stamp}` : `Recordatorio enviado · ${ch}`;
      els.remToggleManual.textContent = 'Marcar como pendiente';
    } else {
      els.remStatusBadge.className = 'badge badge-warn';
      els.remStatusBadge.textContent = 'Recordatorio pendiente';
      els.remToggleManual.textContent = 'Marcar enviado manualmente';
    }

    els.remBtnWa.href = Reminders.buildWhatsAppUrl(appt, cfg, customMsg);
    els.remBtnMail.href = Reminders.buildMailtoUrl(appt, cfg, customMsg);
    els.remBtnGcal.href = Reminders.buildGoogleCalendarUrl(appt, cfg);
  }

  function openReminderModal(id) {
    const appt = Storage.getAppointmentById(id);
    if (!appt) return;
    reminderAppointmentId = appt.id;
    const cfg = Storage.getSettings();
    els.remMessage.value = Reminders.renderTemplate(cfg.whatsappTemplate, appt, cfg);
    syncReminderModalState(appt);
    els.remDialog.showModal();
  }

  // ------------------------------------------------------------------------
  // Inicialización y enlaces de eventos
  // ------------------------------------------------------------------------
  function init(appHooks) {
    hooks = { ...hooks, ...(appHooks || {}) };
    selectedDate = getTodayISO();
    currentView = Storage.getSettings().preferredAgendaView || 'day';

    els = {
      stage: document.getElementById('agenda-stage'),
      dateNavWrap: document.getElementById('agenda-date-nav'),
      dateLabel: document.getElementById('agenda-date-label'),
      btnPinPreferred: document.getElementById('btn-pin-preferred-view'),
      quickChipsBar: document.getElementById('agenda-list-quick-chips'),
      searchInput: document.getElementById('agenda-search-query'),
      statusFilter: document.getElementById('agenda-filter-status'),
      typeFilter: document.getElementById('agenda-filter-type'),
      vetFilter: document.getElementById('agenda-filter-vet'),
      kpiToday: document.getElementById('ag-kpi-today'),
      kpiOverdue: document.getElementById('ag-kpi-overdue'),
      kpiUpcoming: document.getElementById('ag-kpi-upcoming'),
      kpiUnnotified: document.getElementById('ag-kpi-unnotified'),
      // Modal Cita
      dialog: document.getElementById('appointment-dialog'),
      form: document.getElementById('appointment-form'),
      modalTitle: document.getElementById('appointment-dialog-title'),
      modalSub: document.getElementById('appointment-dialog-sub'),
      idInput: document.getElementById('appt-id'),
      sourceRecordId: document.getElementById('appt-source-record-id'),
      linkedRecordId: document.getElementById('appt-linked-record-id'),
      knownPatientSelect: document.getElementById('appt-known-patient'),
      knownPatientsDatalist: document.getElementById('known-patients-datalist'),
      knownVetsDatalist: document.getElementById('known-vets-datalist'),
      fecha: document.getElementById('appt-fecha'),
      hora: document.getElementById('appt-hora'),
      duracion: document.getElementById('appt-duracion'),
      tipo: document.getElementById('appt-tipo'),
      prioridad: document.getElementById('appt-prioridad'),
      estado: document.getElementById('appt-estado'),
      pacNombre: document.getElementById('appt-pac-nombre'),
      pacEspecie: document.getElementById('appt-pac-especie'),
      pacRaza: document.getElementById('appt-pac-raza'),
      pacSexo: document.getElementById('appt-pac-sexo'),
      propNombres: document.getElementById('appt-prop-nombres'),
      propTelefono: document.getElementById('appt-prop-telefono'),
      propEmail: document.getElementById('appt-prop-email'),
      propDocumento: document.getElementById('appt-prop-documento'),
      vetNombre: document.getElementById('appt-vet-nombre'),
      vetMatricula: document.getElementById('appt-vet-matricula'),
      motivo: document.getElementById('appt-motivo'),
      notas: document.getElementById('appt-notas'),
      overlapWarning: document.getElementById('appt-overlap-warning'),
      // Modal Recordatorio
      remDialog: document.getElementById('reminder-dialog'),
      remPatientMeta: document.getElementById('rem-patient-meta'),
      remOwnerMeta: document.getElementById('rem-owner-meta'),
      remStatusBadge: document.getElementById('rem-status-badge'),
      remMessage: document.getElementById('rem-message-text'),
      remBtnWa: document.getElementById('rem-btn-wa'),
      remBtnMail: document.getElementById('rem-btn-mail'),
      remBtnIcs: document.getElementById('rem-btn-ics'),
      remBtnGcal: document.getElementById('rem-btn-gcal'),
      remBtnCopy: document.getElementById('rem-btn-copy'),
      remBtnResetTpl: document.getElementById('rem-btn-reset-tpl'),
      remToggleManual: document.getElementById('rem-toggle-manual')
    };

    // Poblar selects de tipos y estados
    if (els.typeFilter) {
      els.typeFilter.innerHTML = '<option value="">Todos los tipos</option>';
      for (const t of APPOINTMENT_TYPES) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        els.typeFilter.append(opt);
      }
    }
    if (els.tipo) {
      els.tipo.innerHTML = '';
      for (const t of APPOINTMENT_TYPES) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        els.tipo.append(opt);
      }
    }
    if (els.statusFilter) {
      els.statusFilter.innerHTML = '<option value="">Todos los estados</option>';
      for (const s of APPOINTMENT_STATUSES) {
        const opt = document.createElement('option');
        opt.value = s.key;
        opt.textContent = s.label;
        els.statusFilter.append(opt);
      }
    }
    if (els.estado) {
      els.estado.innerHTML = '';
      for (const s of APPOINTMENT_STATUSES) {
        const opt = document.createElement('option');
        opt.value = s.key;
        opt.textContent = s.label;
        els.estado.append(opt);
      }
    }

    A11y.initFormValidationA11y(els.form);

    // Cambio de vista (Día / Lista / Semanal / Mensual)
    document.querySelectorAll('[data-agenda-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentView = btn.getAttribute('data-agenda-view');
        render();
      });
    });

    // Fijar vista preferida
    els.btnPinPreferred?.addEventListener('click', () => {
      Storage.saveSettings({ preferredAgendaView: currentView });
      syncViewTabsUI();
      A11y.showToast(`"${VIEW_LABELS[currentView] || currentView}" guardada como vista preferida de Agenda.`, 'success');
    });

    // Navegación temporal (< Hoy >)
    document.getElementById('btn-agenda-prev')?.addEventListener('click', () => {
      if (currentView === 'day') selectedDate = addDaysISO(selectedDate, -1);
      else if (currentView === 'week') selectedDate = addDaysISO(selectedDate, -7);
      else if (currentView === 'month') selectedDate = addMonthsISO(selectedDate, -1);
      render();
    });
    document.getElementById('btn-agenda-today')?.addEventListener('click', () => {
      selectedDate = getTodayISO();
      render();
    });
    document.getElementById('btn-agenda-next')?.addEventListener('click', () => {
      if (currentView === 'day') selectedDate = addDaysISO(selectedDate, 1);
      else if (currentView === 'week') selectedDate = addDaysISO(selectedDate, 7);
      else if (currentView === 'month') selectedDate = addMonthsISO(selectedDate, 1);
      render();
    });

    // Filtros y búsqueda
    document.getElementById('agenda-search-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      render();
    });
    els.searchInput?.addEventListener('input', render);
    els.statusFilter?.addEventListener('change', render);
    els.typeFilter?.addEventListener('change', render);
    els.vetFilter?.addEventListener('change', render);

    document.querySelectorAll('[data-list-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        listQuickFilter = btn.getAttribute('data-list-filter');
        render();
      });
    });

    // Botones "+ Nueva Cita" dentro de Agenda
    document.getElementById('btn-agenda-new-appt')?.addEventListener('click', () => openNewAppointmentModal());

    // Clics en KPIs de Agenda para filtrar rápido
    document.getElementById('ag-kpi-card-today')?.addEventListener('click', () => {
      currentView = 'day';
      selectedDate = getTodayISO();
      render();
    });
    document.getElementById('ag-kpi-card-overdue')?.addEventListener('click', () => {
      currentView = 'list';
      listQuickFilter = 'overdue';
      render();
    });
    document.getElementById('ag-kpi-card-upcoming')?.addEventListener('click', () => {
      currentView = 'list';
      listQuickFilter = 'upcoming';
      render();
    });
    document.getElementById('ag-kpi-card-unnotified')?.addEventListener('click', () => {
      currentView = 'list';
      listQuickFilter = 'unnotified';
      render();
    });

    // Autocompletado de pacientes en modal de cita
    els.knownPatientSelect?.addEventListener('change', () => applyKnownPatient(els.knownPatientSelect.value));
    els.pacNombre?.addEventListener('change', () => {
      const typed = els.pacNombre.value.trim().toLowerCase();
      if (!typed) return;
      const match = Storage.getKnownPatients().find((p) => p.paciente.nombre.trim().toLowerCase() === typed);
      if (match && !els.propNombres.value.trim()) {
        els.knownPatientSelect.value = match.recordId;
        applyKnownPatient(match.recordId);
      }
    });

    // Autocompletar matrícula al elegir veterinario conocido
    els.vetNombre?.addEventListener('change', () => {
      const typed = els.vetNombre.value.trim().toLowerCase();
      const vet = Storage.getKnownVets().find((v) => v.nombre.toLowerCase() === typed);
      if (vet && vet.matricula && !els.vetMatricula.value.trim()) {
        els.vetMatricula.value = vet.matricula;
      }
      checkOverlapWarning();
    });

    // Checar solapamiento en vivo
    [els.fecha, els.hora, els.duracion, els.vetNombre].forEach((el) => {
      el?.addEventListener('change', checkOverlapWarning);
    });

    // Guardar cita
    els.form?.addEventListener('submit', handleSaveAppointment);
    document.getElementById('btn-appt-save-submit')?.addEventListener('click', () => els.form.requestSubmit());

    // Eventos del modal de Recordatorios
    els.remMessage?.addEventListener('input', () => {
      const appt = Storage.getAppointmentById(reminderAppointmentId);
      if (appt) syncReminderModalState(appt);
    });

    els.remBtnResetTpl?.addEventListener('click', () => {
      const appt = Storage.getAppointmentById(reminderAppointmentId);
      if (!appt) return;
      const cfg = Storage.getSettings();
      els.remMessage.value = Reminders.renderTemplate(cfg.whatsappTemplate, appt, cfg);
      syncReminderModalState(appt);
    });

    els.remBtnWa?.addEventListener('click', () => {
      if (!reminderAppointmentId) return;
      const updated = Storage.markAppointmentNotified(reminderAppointmentId, 'whatsapp');
      if (updated) syncReminderModalState(updated);
      hooks.onDataChanged();
      A11y.showToast('Recordatorio por WhatsApp registrado con fecha y hora.', 'success');
    });

    els.remBtnMail?.addEventListener('click', () => {
      if (!reminderAppointmentId) return;
      const updated = Storage.markAppointmentNotified(reminderAppointmentId, 'email');
      if (updated) syncReminderModalState(updated);
      hooks.onDataChanged();
      A11y.showToast('Recordatorio por correo registrado con fecha y hora.', 'success');
    });

    els.remBtnIcs?.addEventListener('click', () => {
      const appt = Storage.getAppointmentById(reminderAppointmentId);
      if (!appt) return;
      Reminders.downloadICS(appt, Storage.getSettings());
      A11y.showToast(`Archivo .ics descargado para ${appt.paciente?.nombre || 'cita'}.`, 'success');
    });

    els.remBtnCopy?.addEventListener('click', async () => {
      const text = els.remMessage.value.trim();
      if (!text) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          els.remMessage.select();
          document.execCommand('copy');
        }
        A11y.showToast('Mensaje de recordatorio copiado al portapapeles.', 'success');
      } catch {
        A11y.showToast('No se pudo copiar automáticamente; selecciona y copia el texto manualmente.', 'error');
      }
    });

    els.remToggleManual?.addEventListener('click', () => {
      const appt = Storage.getAppointmentById(reminderAppointmentId);
      if (!appt) return;
      const updated = appt.reminder?.notified
        ? Storage.clearAppointmentNotified(appt.id)
        : Storage.markAppointmentNotified(appt.id, 'manual');
      if (updated) syncReminderModalState(updated);
      hooks.onDataChanged();
      A11y.showToast(
        updated?.reminder?.notified ? 'Recordatorio marcado como enviado.' : 'Recordatorio marcado como pendiente.',
        'success'
      );
    });
  }

  function applyPreferredView() {
    currentView = Storage.getSettings().preferredAgendaView || 'day';
  }

  global.VETCO_APPOINTMENTS = {
    init,
    render,
    applyPreferredView,
    buildAppointmentCard,
    openNewAppointmentModal,
    openEditAppointmentModal,
    openReminderModal
  };
})(window);
