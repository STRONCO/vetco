/* ==========================================================================
   VETCO — Controlador principal del Sistema Modular (Bloque 1 + Bloque 2)
   - App Shell (Sidebar colapsable, Bottom Nav móvil, 3 Temas: Oscuro/Claro/Morado Beta)
   - Panel de Control mejorado (KPIs, Citas hoy, Alertas, Últimos pacientes)
   - Módulo completo de Historias Clínicas + Formulario 8 secciones + Impresión oficial 2 págs
   - Integración con Motor de Recordatorios (WhatsApp MX +52, mailto, .ics, Google Calendar, Notification API)
   ========================================================================== */

(function (global) {
  'use strict';

  const { ORGAN_SYSTEMS, COMPLEMENTARY_EXAMS } = global.VETCO_DATA;
  const Storage = global.VETCO_STORAGE;
  const A11y = global.VETCO_A11Y;
  const Reminders = global.VETCO_REMINDERS;
  const Appointments = global.VETCO_APPOINTMENTS;

  // App Shell y vistas
  const appShell = document.getElementById('app-shell');
  const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
  const topbarKicker = document.getElementById('topbar-kicker');
  const topbarTitle = document.getElementById('topbar-title');
  const topbarAlertBadge = document.getElementById('topbar-alert-badge');
  const sidebarApptsBadge = document.getElementById('sidebar-appts-badge');
  const sidebarRecordsBadge = document.getElementById('sidebar-records-badge');
  const mobileApptsBadge = document.getElementById('mobile-appts-badge');
  const sidebarClinicName = document.getElementById('sidebar-clinic-name');
  const sidebarClinicPhone = document.getElementById('sidebar-clinic-phone');

  const views = {
    overview: document.getElementById('view-overview'),
    appointments: document.getElementById('view-appointments'),
    records: document.getElementById('view-records'),
    form: document.getElementById('view-form')
  };

  // Dashboard (Panel de Control)
  const overviewDateSubtitle = document.getElementById('overview-date-subtitle');
  const overviewDraftBanner = document.getElementById('overview-draft-banner');
  const overviewDraftDetail = document.getElementById('overview-draft-detail');
  const ovKpiTodayAppts = document.getElementById('ov-kpi-today-appts');
  const ovKpiTodayMeta = document.getElementById('ov-kpi-today-meta');
  const ovKpiPendingReminders = document.getElementById('ov-kpi-pending-reminders');
  const ovKpiTotalRecords = document.getElementById('ov-kpi-total-records');
  const ovKpiSpeciesMeta = document.getElementById('ov-kpi-species-meta');
  const ovKpiWeekAppts = document.getElementById('ov-kpi-week-appts');
  const overviewTodayList = document.getElementById('overview-today-list');
  const overviewTodayEmpty = document.getElementById('overview-today-empty');
  const overviewAlertsList = document.getElementById('overview-alerts-list');
  const overviewRecentPatients = document.getElementById('overview-recent-patients');
  const btnOverviewEnableNotif = document.getElementById('btn-overview-enable-notif');

  // Historias Clínicas
  const kpiTotal = document.getElementById('kpi-total');
  const kpiCaninos = document.getElementById('kpi-caninos');
  const kpiFelinos = document.getElementById('kpi-felinos');
  const kpiOtras = document.getElementById('kpi-otras');
  const searchForm = document.getElementById('search-form');
  const searchQuery = document.getElementById('search-query');
  const filterEspecie = document.getElementById('filter-especie');
  const sortRecords = document.getElementById('sort-records');
  const recordsTbody = document.getElementById('records-tbody');
  const recordsEmpty = document.getElementById('records-empty');
  const draftBanner = document.getElementById('draft-banner');
  const draftBannerDetail = document.getElementById('draft-banner-detail');

  // Formulario Clínico
  const form = document.getElementById('clinical-form');
  const formHeading = document.getElementById('form-main-heading');
  const formLiveSubtitle = document.getElementById('form-live-subtitle');
  const formApptLinkPill = document.getElementById('form-appt-link-pill');
  const linkedAppointmentInput = document.getElementById('linked-appointment-id');
  const autosaveStatus = document.getElementById('autosave-status');
  const errorSummary = document.getElementById('form-error-summary');
  const errorList = document.getElementById('form-error-list');
  const organsGrid = document.getElementById('organs-grid');
  const problemsContainer = document.getElementById('problems-list-container');
  const examsGrid = document.getElementById('exams-grid');
  const treatmentsTbody = document.getElementById('treatments-tbody');
  const pacNacimiento = document.getElementById('pac-nacimiento');
  const pacEdadBadge = document.getElementById('pac-edad-badge');

  // Modales y hoja de impresión
  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmTitle = document.getElementById('confirm-dialog-title');
  const confirmMessage = document.getElementById('confirm-dialog-message');
  const confirmOkBtn = document.getElementById('confirm-dialog-ok');
  const previewDialog = document.getElementById('preview-dialog');
  const previewTitle = document.getElementById('preview-dialog-title');
  const previewSub = document.getElementById('preview-dialog-sub');
  const previewBody = document.getElementById('preview-dialog-body');
  const previewBtnPrint = document.getElementById('preview-btn-print');
  const previewBtnEdit = document.getElementById('preview-btn-edit');
  const previewBtnAppt = document.getElementById('preview-btn-appt');
  const alertsDialog = document.getElementById('alerts-dialog');
  const alertsDialogList = document.getElementById('alerts-dialog-list');
  const notifPermissionStatus = document.getElementById('notif-permission-status');
  const btnToggleBrowserNotif = document.getElementById('btn-toggle-browser-notif');
  const settingsDialog = document.getElementById('settings-dialog');
  const quickNewDialog = document.getElementById('quick-new-dialog');
  const printSheet = document.getElementById('print-sheet');

  let activeView = 'overview';
  let lastNonFormView = 'records';
  let currentEditingId = null;
  let pendingConfirmAction = null;
  let previewingRecordId = null;
  let draftDebounceTimer = null;

  // ------------------------------------------------------------------------
  // Utilidades generales
  // ------------------------------------------------------------------------
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
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatDisplayDate(iso) {
    if (!iso) return '—';
    const parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function computeAgeLabel(dobIso) {
    if (!dobIso) return '';
    const dob = new Date(`${dobIso}T00:00:00`);
    if (Number.isNaN(dob.getTime())) return '';
    const today = new Date();
    if (dob > today) return '';

    let years = today.getFullYear() - dob.getFullYear();
    let months = today.getMonth() - dob.getMonth();
    if (today.getDate() < dob.getDate()) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years <= 0 && months <= 0) return 'Menos de 1 mes';
    if (years <= 0) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
    if (months === 0) return `${years} ${years === 1 ? 'año' : 'años'}`;
    return `${years} ${years === 1 ? 'año' : 'años'}, ${months} m`;
  }

  function updateAgeBadge() {
    pacEdadBadge.textContent = computeAgeLabel(pacNacimiento.value);
  }

  function updateLiveSubtitle() {
    const hc = document.getElementById('numeroHistoria').value.trim();
    const pac = document.getElementById('pac-nombre').value.trim();
    const prop = document.getElementById('prop-nombres').value.trim();

    const parts = [];
    if (hc) parts.push(hc);
    if (pac) parts.push(`Paciente: ${pac}`);
    if (prop) parts.push(`Propietario: ${prop}`);

    formLiveSubtitle.textContent = parts.length ? parts.join(' · ') : 'Borrador sin paciente asignado';
  }

  // ------------------------------------------------------------------------
  // Temas (Oscuro, Claro, Morado Beta) y Sidebar colapsable
  // ------------------------------------------------------------------------
  function syncThemeUI(themeName) {
    const active = A11y.applyTheme(themeName);
    const shortNames = { dark: 'Oscuro', light: 'Claro', purple: 'Morado' };
    const topbarThemeLabel = document.getElementById('topbar-theme-label');
    if (topbarThemeLabel) {
      topbarThemeLabel.textContent = shortNames[active] || 'Oscuro';
    }
    document.querySelectorAll('[data-theme-set]').forEach((btn) => {
      const isMatch = btn.getAttribute('data-theme-set') === active;
      btn.classList.toggle('is-active', isMatch);
      btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    });
  }

  function setTheme(themeName, announce) {
    const applied = A11y.applyTheme(themeName);
    Storage.saveSettings({ theme: applied });
    syncThemeUI(applied);
    if (announce) {
      const names = { dark: 'Oscuro', light: 'Blanco / Claro', purple: 'Morado (Beta)' };
      A11y.showToast(`Tema visual cambiado a ${names[applied] || applied}.`, 'success');
    }
  }

  function cycleTheme() {
    const order = ['dark', 'light', 'purple'];
    const current = Storage.getSettings().theme || 'dark';
    const next = order[(order.indexOf(current) + 1) % order.length];
    setTheme(next, true);
  }

  function syncSidebarState(collapsed) {
    const isCollapsed = Boolean(collapsed);
    appShell.setAttribute('data-sidebar', isCollapsed ? 'collapsed' : 'expanded');
    btnSidebarToggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    btnSidebarToggle.setAttribute('aria-label', isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral');
  }

  function syncClinicMetaUI() {
    const cfg = Storage.getSettings();
    sidebarClinicName.textContent = cfg.clinicName || 'VETCO Clínica Veterinaria';
    const prettyPhone = Reminders.formatPhonePretty(cfg.clinicPhone || '6183678303');
    sidebarClinicPhone.textContent = `MX +${cfg.countryCode || '52'} · ${prettyPhone}`;
  }

  // ------------------------------------------------------------------------
  // Navegación del App Shell (Vistas)
  // ------------------------------------------------------------------------
  const VIEW_META = {
    overview: { kicker: 'VETCO · Resumen Diario', title: 'Panel de Control' },
    appointments: { kicker: 'VETCO · Módulo de Citas', title: 'Agenda y Citas' },
    records: { kicker: 'VETCO · Expediente Clínico', title: 'Historias Clínicas' },
    form: { kicker: 'VETCO · Formato Oficial 2 Páginas', title: 'Editor de Historia Clínica' }
  };

  function switchView(viewName) {
    if (!views[viewName]) return;
    if (viewName !== 'form') {
      lastNonFormView = viewName;
    }
    activeView = viewName;

    for (const [key, section] of Object.entries(views)) {
      section.hidden = key !== viewName;
    }

    const navTarget = viewName === 'form' ? 'records' : viewName;
    document.querySelectorAll('[data-nav]').forEach((btn) => {
      const active = btn.getAttribute('data-nav') === navTarget;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });

    const meta = VIEW_META[viewName] || VIEW_META.overview;
    topbarKicker.textContent = meta.kicker;
    topbarTitle.textContent = meta.title;

    if (viewName === 'overview') renderOverview();
    if (viewName === 'appointments') Appointments.render();
    if (viewName === 'records') renderRecordsView();
    if (viewName === 'form') setActiveStepChip('#sec-identificacion');

    updateGlobalBadges();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function updateGlobalBadges() {
    const records = Storage.getAllRecords();
    const appts = Storage.getAllAppointments();
    const today = getTodayISO();
    const todayActive = appts.filter((a) => a.fecha === today && !['cancelada', 'no_asistio'].includes(a.estado)).length;
    const overdueCount = appts.filter((a) => a.fecha < today && Reminders.isAppointmentOverdue(a)).length;
    const menuCount = todayActive + overdueCount;
    const alerts = Reminders.getUpcomingAlerts(appts);

    sidebarRecordsBadge.textContent = String(records.length);
    sidebarApptsBadge.textContent = String(menuCount);
    sidebarApptsBadge.title = overdueCount
      ? `${todayActive} hoy + ${overdueCount} atrasada(s)`
      : `${todayActive} cita(s) hoy`;
    mobileApptsBadge.textContent = String(menuCount);
    mobileApptsBadge.hidden = menuCount === 0;

    topbarAlertBadge.textContent = String(alerts.length);
    topbarAlertBadge.hidden = alerts.length === 0;
  }

  // Puente directo: Iniciar o Abrir Historia Clínica desde una cita
  function startClinicalRecordFromAppointment(appointmentId) {
    const appt = Storage.getAppointmentById(appointmentId);
    if (!appt) return;

    if (appt.linkedRecordId) {
      const existing = Storage.getRecordById(appt.linkedRecordId);
      if (existing) {
        openEditRecordForm(existing.id, appt.id);
        return;
      }
    }

    const settings = Storage.getSettings();
    if (
      settings.autoTransitionInProgress &&
      (appt.estado === 'programada' || appt.estado === 'confirmada')
    ) {
      Storage.updateAppointmentStatus(appt.id, 'en_consulta');
    }

    // Buscar antecedentes si el paciente ya tiene historia clínica previa
    const prior =
      (appt.sourceRecordId && Storage.getRecordById(appt.sourceRecordId)) ||
      Storage.getAllRecords().find(
        (r) =>
          (r.paciente?.nombre || '').toLowerCase() === (appt.paciente?.nombre || '').toLowerCase() &&
          (r.propietario?.nombres || '').toLowerCase() === (appt.propietario?.nombres || '').toLowerCase()
      );

    const prefill = {
      id: null,
      fecha: appt.fecha || getTodayISO(),
      numeroHistoria: Storage.generateNextHCNumber(),
      propietario: {
        nombres: appt.propietario?.nombres || prior?.propietario?.nombres || '',
        documento: appt.propietario?.documento || prior?.propietario?.documento || '',
        direccion: prior?.propietario?.direccion || '',
        telefono: appt.propietario?.telefono || prior?.propietario?.telefono || '',
        email: appt.propietario?.email || prior?.propietario?.email || ''
      },
      paciente: {
        nombre: appt.paciente?.nombre || prior?.paciente?.nombre || '',
        sexo: appt.paciente?.sexo || prior?.paciente?.sexo || '',
        raza: appt.paciente?.raza || prior?.paciente?.raza || '',
        especie: appt.paciente?.especie || prior?.paciente?.especie || '',
        fechaNacimiento: prior?.paciente?.fechaNacimiento || '',
        color: prior?.paciente?.color || '',
        peso: prior?.paciente?.peso || ''
      },
      anamnesicos: prior?.anamnesicos ? { ...prior.anamnesicos } : {},
      motivoConsulta: appt.motivo || '',
      medico: {
        nombre: appt.medico?.nombre || prior?.medico?.nombre || '',
        matricula: appt.medico?.matricula || prior?.medico?.matricula || ''
      }
    };

    populateForm(prefill, `Consulta — ${appt.paciente?.nombre || 'Paciente'}`, appt);
    switchView('form');
    A11y.showToast(
      settings.autoTransitionInProgress
        ? `Historia iniciada para ${appt.paciente?.nombre || 'paciente'}. Cita marcada "En consulta".`
        : `Datos de la cita precargados para ${appt.paciente?.nombre || 'paciente'}.`,
      'success'
    );
  }

  // ------------------------------------------------------------------------
  // VISTA 1: PANEL DE CONTROL (DASHBOARD MEJORADO)
  // ------------------------------------------------------------------------
  function renderOverview() {
    const records = Storage.getAllRecords();
    const appts = Storage.getAllAppointments();
    const today = getTodayISO();

    overviewDateSubtitle.textContent = `Hoy es ${Reminders.formatDateLongEsMx(today)} · Actividad clínica y recordatorios activos.`;

    // KPIs de citas
    const todayAppts = appts
      .filter((a) => a.fecha === today)
      .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));

    const todayActive = todayAppts.filter((a) => a.estado !== 'cancelada');
    const confirmedCount = todayActive.filter((a) => a.estado === 'confirmada').length;
    const inProgressCount = todayActive.filter((a) => a.estado === 'en_consulta').length;

    ovKpiTodayAppts.textContent = String(todayActive.length);
    ovKpiTodayMeta.textContent = `${confirmedCount} confirmadas · ${inProgressCount} en consulta`;

    const pendingReminders = appts.filter(
      (a) => !['completada', 'cancelada', 'no_asistio'].includes(a.estado) && !a.reminder?.notified
    ).length;
    ovKpiPendingReminders.textContent = String(pendingReminders);

    // KPIs de historias
    let caninos = 0;
    let felinos = 0;
    let otras = 0;
    for (const r of records) {
      const esp = String(r.paciente?.especie || '').toLowerCase();
      if (esp.includes('canin') || esp.includes('perr')) caninos += 1;
      else if (esp.includes('felin') || esp.includes('gat')) felinos += 1;
      else otras += 1;
    }
    ovKpiTotalRecords.textContent = String(records.length);
    ovKpiSpeciesMeta.textContent = `${caninos} caninos · ${felinos} felinos · ${otras} otras`;

    // Citas próximos 7 días
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const maxIso = `${in7Days.getFullYear()}-${String(in7Days.getMonth() + 1).padStart(2, '0')}-${String(
      in7Days.getDate()
    ).padStart(2, '0')}`;
    const weekActive = appts.filter(
      (a) => a.fecha >= today && a.fecha <= maxIso && !['cancelada', 'no_asistio'].includes(a.estado)
    ).length;
    ovKpiWeekAppts.textContent = String(weekActive);

    checkDraftBanners();

    // Citas de hoy
    overviewTodayList.innerHTML = '';
    if (todayAppts.length === 0) {
      overviewTodayEmpty.hidden = false;
    } else {
      overviewTodayEmpty.hidden = true;
      for (const appt of todayAppts) {
        overviewTodayList.append(Appointments.buildAppointmentCard(appt, { showDate: false, compact: true }));
      }
    }

    // Alertas próximas
    renderAlertsList(overviewAlertsList, 4);
    syncNotifButtonsUI();

    // Últimos pacientes atendidos
    overviewRecentPatients.innerHTML = '';
    const recent = [...records]
      .sort((a, b) => String(b.updatedAt || b.fecha || '').localeCompare(String(a.updatedAt || a.fecha || '')))
      .slice(0, 4);

    if (recent.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state empty-state--compact';
      empty.innerHTML = `
        <div class="empty-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <p class="empty-title">Sin pacientes registrados aún</p>
        <p class="empty-desc">Crea la primera historia clínica para ver aquí los accesos rápidos.</p>
      `;
      const btnAdd = document.createElement('button');
      btnAdd.type = 'button';
      btnAdd.className = 'btn btn-primary btn-xs';
      btnAdd.textContent = '+ Nueva Historia';
      btnAdd.addEventListener('click', openNewRecordForm);
      empty.append(btnAdd);
      overviewRecentPatients.append(empty);
    } else {
      for (const rec of recent) {
        const item = document.createElement('div');
        item.className = 'compact-item';

        const main = document.createElement('div');
        main.className = 'compact-item-main';
        const title = document.createElement('strong');
        title.textContent = `${rec.paciente?.nombre || 'Paciente'} (${rec.paciente?.especie || '—'})`;
        const sub = document.createElement('small');
        sub.textContent = `${rec.propietario?.nombres || '—'} · ${formatDisplayDate(rec.fecha)}`;
        main.append(title, sub);

        const btnGroup = document.createElement('div');
        btnGroup.className = 'row-actions';
        const btnVer = document.createElement('button');
        btnVer.type = 'button';
        btnVer.className = 'action-chip';
        btnVer.textContent = 'Ver';
        btnVer.addEventListener('click', () => openPreviewModal(rec.id));

        const btnCtrl = document.createElement('button');
        btnCtrl.type = 'button';
        btnCtrl.className = 'action-chip';
        btnCtrl.textContent = 'Control';
        btnCtrl.addEventListener('click', () => openDuplicateForFollowUp(rec.id));

        btnGroup.append(btnVer, btnCtrl);
        item.append(main, btnGroup);
        overviewRecentPatients.append(item);
      }
    }
  }

  function renderAlertsList(containerEl, limit) {
    if (!containerEl) return;
    const alerts = Reminders.getUpcomingAlerts(Storage.getAllAppointments());
    const items = limit ? alerts.slice(0, limit) : alerts;
    containerEl.innerHTML = '';

    if (items.length === 0) {
      containerEl.innerHTML = `
        <div class="empty-state empty-state--compact">
          <div class="empty-icon empty-icon--ok" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <p class="empty-title">Todo al día</p>
          <p class="empty-desc">Sin alertas urgentes ni recordatorios pendientes en las próximas 24 horas.</p>
        </div>
      `;
      return;
    }

    const settings = Storage.getSettings();
    for (const al of items) {
      const row = document.createElement('div');
      row.className = `compact-item alert-item ${al.level === 'urgent' ? 'is-urgent' : ''}`.trim();

      const main = document.createElement('div');
      main.className = 'compact-item-main';
      const strong = document.createElement('strong');
      strong.textContent = `${al.appt.paciente?.nombre || 'Paciente'} · ${al.tag}`;
      const small = document.createElement('small');
      small.textContent = `${al.reason} (${al.appt.propietario?.nombres || '—'})`;
      main.append(strong, small);

      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'row-actions';

      const waLink = document.createElement('a');
      waLink.className = 'btn btn-whatsapp btn-xs';
      waLink.href = Reminders.buildWhatsAppUrl(al.appt, settings);
      waLink.target = '_blank';
      waLink.rel = 'noopener noreferrer';
      waLink.textContent = 'Avisar';
      waLink.addEventListener('click', () => {
        Storage.markAppointmentNotified(al.appt.id, 'whatsapp');
        refreshAllDataViews();
      });

      const attendBtn = document.createElement('button');
      attendBtn.type = 'button';
      attendBtn.className = 'btn btn-primary btn-xs';
      attendBtn.textContent = 'Atender';
      attendBtn.addEventListener('click', () => {
        if (alertsDialog.open) alertsDialog.close();
        startClinicalRecordFromAppointment(al.appt.id);
      });

      actionsWrap.append(waLink, attendBtn);
      row.append(main, actionsWrap);
      containerEl.append(row);
    }
  }

  // ------------------------------------------------------------------------
  // Construcción dinámica de controles del formulario clínico (8 secciones)
  // ------------------------------------------------------------------------
  function buildOrganSystemsUI() {
    organsGrid.innerHTML = '';
    for (const organ of ORGAN_SYSTEMS) {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'organ-item';

      const legend = document.createElement('legend');
      legend.textContent = `${organ.number}. ${organ.label}`;

      const radiosWrap = document.createElement('div');
      radiosWrap.className = 'organ-radios';

      const options = [
        { val: 'N', title: 'Normal', cls: 'pill-n' },
        { val: 'AN', title: 'Anormal', cls: 'pill-an' },
        { val: 'NE', title: 'No Examinado', cls: 'pill-ne' }
      ];

      for (const opt of options) {
        const lbl = document.createElement('label');
        lbl.className = `organ-pill ${opt.cls}`;
        lbl.title = opt.title;

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `organ_${organ.key}`;
        radio.value = opt.val;

        const span = document.createElement('span');
        span.textContent = opt.val;

        lbl.append(radio, span);
        radiosWrap.append(lbl);
      }

      fieldset.append(legend, radiosWrap);
      organsGrid.append(fieldset);
    }
  }

  function buildComplementaryExamsUI() {
    examsGrid.innerHTML = '';
    for (const exam of COMPLEMENTARY_EXAMS) {
      const item = document.createElement('div');
      item.className = 'exam-item';

      const lbl = document.createElement('label');
      lbl.className = 'exam-check-label';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'exam-check';
      chk.id = `exam_chk_${exam.key}`;
      chk.name = `exam_chk_${exam.key}`;

      const nameSpan = document.createElement('span');
      nameSpan.textContent = exam.label;
      lbl.append(chk, nameSpan);

      const noteInput = document.createElement('input');
      noteInput.type = 'text';
      noteInput.className = 'exam-note';
      noteInput.id = `exam_note_${exam.key}`;
      noteInput.name = `exam_note_${exam.key}`;
      noteInput.placeholder = 'Detalle / resultado breve...';
      noteInput.setAttribute('aria-label', `Detalle para ${exam.label}`);

      noteInput.addEventListener('input', () => {
        if (noteInput.value.trim() && !chk.checked) {
          chk.checked = true;
        }
      });

      item.append(lbl, noteInput);
      examsGrid.append(item);
    }
  }

  function createProblemRow(index, problemVal, diffVal) {
    const row = document.createElement('div');
    row.className = 'dual-row';

    const leftWrap = document.createElement('div');
    leftWrap.className = 'numbered-field';
    const numLeft = document.createElement('span');
    numLeft.className = 'row-num';
    numLeft.textContent = `${index}.`;
    const inputProblem = document.createElement('input');
    inputProblem.type = 'text';
    inputProblem.className = 'problem-input';
    inputProblem.value = problemVal || '';
    inputProblem.placeholder = `Problema ${index}`;
    inputProblem.setAttribute('aria-label', `Lista de problemas, ítem ${index}`);
    leftWrap.append(numLeft, inputProblem);

    const rightWrap = document.createElement('div');
    rightWrap.className = 'numbered-field';
    const numRight = document.createElement('span');
    numRight.className = 'row-num';
    numRight.textContent = `${index}.`;
    const inputDiff = document.createElement('input');
    inputDiff.type = 'text';
    inputDiff.className = 'diff-input';
    inputDiff.value = diffVal || '';
    inputDiff.placeholder = `Diagnóstico diferencial ${index}`;
    inputDiff.setAttribute('aria-label', `Diagnóstico diferencial, ítem ${index}`);
    rightWrap.append(numRight, inputDiff);

    row.append(leftWrap, rightWrap);
    return row;
  }

  function renderProblemRows(problems, diffs) {
    problemsContainer.innerHTML = '';
    const count = Math.max(7, (problems || []).length, (diffs || []).length);
    for (let i = 0; i < count; i++) {
      problemsContainer.append(
        createProblemRow(i + 1, (problems && problems[i]) || '', (diffs && diffs[i]) || '')
      );
    }
  }

  function createTreatmentRow(t) {
    const tr = document.createElement('tr');
    const data = t || {};

    const fields = [
      { cls: 't-producto', label: 'Producto Base', value: data.productoBase || '', placeholder: 'Ej. Omeprazol' },
      { cls: 't-dosis', label: 'Dosis Básica', value: data.dosisBasica || '', placeholder: 'Ej. 1 mg/kg' },
      { cls: 't-presentacion', label: 'Presentación', value: data.presentacion || '', placeholder: 'Ej. Cápsulas 20 mg' },
      { cls: 't-via', label: 'Vía', value: data.via || '', placeholder: 'Oral, SC, IM...', list: 'vias-list' },
      { cls: 't-frecuencia', label: 'Frecuencia y Duración', value: data.frecuenciaDuracion || '', placeholder: 'Ej. Cada 12 h x 5 días' }
    ];

    for (const f of fields) {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = f.cls;
      input.value = f.value;
      input.placeholder = f.placeholder;
      input.setAttribute('aria-label', f.label);
      if (f.list) input.setAttribute('list', f.list);
      td.append(input);
      tr.append(td);
    }

    const tdAction = document.createElement('td');
    tdAction.className = 'col-action';
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-btn';
    delBtn.setAttribute('aria-label', 'Eliminar fila de tratamiento');
    delBtn.title = 'Eliminar fila';
    delBtn.innerHTML =
      '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
    delBtn.addEventListener('click', () => {
      if (treatmentsTbody.children.length <= 1) {
        tr.querySelectorAll('input').forEach((inp) => {
          inp.value = '';
        });
      } else {
        tr.remove();
      }
      scheduleDraftSave();
    });
    tdAction.append(delBtn);
    tr.append(tdAction);

    return tr;
  }

  function renderTreatmentRows(treatments) {
    treatmentsTbody.innerHTML = '';
    const rows = Array.isArray(treatments) && treatments.length ? treatments : [];
    const total = Math.max(5, rows.length);
    for (let i = 0; i < total; i++) {
      treatmentsTbody.append(createTreatmentRow(rows[i] || {}));
    }
  }

  // ------------------------------------------------------------------------
  // Serialización y carga del formulario clínico
  // ------------------------------------------------------------------------
  function getRadioValue(name) {
    const checked = form.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : '';
  }

  function setRadioValue(name, value) {
    const radios = form.querySelectorAll(`input[name="${name}"]`);
    radios.forEach((r) => {
      r.checked = r.value === (value || '');
    });
  }

  function collectFormData() {
    const organos = {};
    for (const o of ORGAN_SYSTEMS) {
      organos[o.key] = getRadioValue(`organ_${o.key}`);
    }

    const listaProblemas = Array.from(problemsContainer.querySelectorAll('.problem-input')).map((i) =>
      i.value.trim()
    );
    const diagnosticosDiferenciales = Array.from(problemsContainer.querySelectorAll('.diff-input')).map((i) =>
      i.value.trim()
    );

    const examenesComplementarios = {};
    for (const exam of COMPLEMENTARY_EXAMS) {
      const chk = document.getElementById(`exam_chk_${exam.key}`);
      const note = document.getElementById(`exam_note_${exam.key}`);
      if (chk && (chk.checked || (note && note.value.trim()))) {
        examenesComplementarios[exam.key] = {
          checked: Boolean(chk.checked),
          note: note ? note.value.trim() : ''
        };
      }
    }

    const tratamientos = Array.from(treatmentsTbody.querySelectorAll('tr'))
      .map((tr) => ({
        productoBase: tr.querySelector('.t-producto').value.trim(),
        dosisBasica: tr.querySelector('.t-dosis').value.trim(),
        presentacion: tr.querySelector('.t-presentacion').value.trim(),
        via: tr.querySelector('.t-via').value.trim(),
        frecuenciaDuracion: tr.querySelector('.t-frecuencia').value.trim()
      }))
      .filter(
        (t) => t.productoBase || t.dosisBasica || t.presentacion || t.via || t.frecuenciaDuracion
      );

    return {
      id: document.getElementById('record-id').value || null,
      appointmentId: linkedAppointmentInput.value || null,
      fecha: document.getElementById('fecha').value,
      numeroHistoria: document.getElementById('numeroHistoria').value.trim(),
      propietario: {
        nombres: document.getElementById('prop-nombres').value.trim(),
        documento: document.getElementById('prop-documento').value.trim(),
        direccion: document.getElementById('prop-direccion').value.trim(),
        telefono: document.getElementById('prop-telefono').value.trim(),
        email: document.getElementById('prop-email').value.trim()
      },
      paciente: {
        nombre: document.getElementById('pac-nombre').value.trim(),
        sexo: getRadioValue('pacSexo'),
        raza: document.getElementById('pac-raza').value.trim(),
        especie: document.getElementById('pac-especie').value.trim(),
        fechaNacimiento: document.getElementById('pac-nacimiento').value,
        color: document.getElementById('pac-color').value.trim(),
        peso: document.getElementById('pac-peso').value.trim()
      },
      anamnesicos: {
        desparasitacion: document.getElementById('anam-desparasitacion').value.trim(),
        vacunas: document.getElementById('anam-vacunas').value.trim(),
        enfermedadesAnteriores: document.getElementById('anam-enfermedades').value.trim(),
        tratamientosPrevios: document.getElementById('anam-tratamientos').value.trim(),
        evolucion: document.getElementById('anam-evolucion').value.trim(),
        alimentacion: document.getElementById('anam-alimentacion').value.trim(),
        historiaReproductiva: getRadioValue('anamReproductiva'),
        ultimoCelo: document.getElementById('anam-ultimo-celo').value.trim(),
        ultimoParto: document.getElementById('anam-ultimo-parto').value.trim()
      },
      motivoConsulta: document.getElementById('motivo-consulta').value.trim(),
      examenClinico: {
        fr: document.getElementById('ex-fr').value.trim(),
        fc: document.getElementById('ex-fc').value.trim(),
        temperatura: document.getElementById('ex-temp').value.trim(),
        pulso: document.getElementById('ex-pulso').value.trim(),
        tlc: document.getElementById('ex-tlc').value.trim(),
        nodulosLinfaticos: document.getElementById('ex-nodulos').value.trim(),
        mucosas: document.getElementById('ex-mucosas').value.trim(),
        actitud: getRadioValue('exActitud'),
        actitudOtro: document.getElementById('ex-actitud-otro').value.trim(),
        organos,
        hallazgos: document.getElementById('ex-hallazgos').value.trim()
      },
      listaProblemas,
      diagnosticosDiferenciales,
      examenesComplementarios,
      hallazgosPruebas: document.getElementById('desc-pruebas').value.trim(),
      diagnosticoFinal: document.getElementById('diagnostico-final').value.trim(),
      tratamientos,
      medico: {
        nombre: document.getElementById('vet-nombre').value.trim(),
        matricula: document.getElementById('vet-matricula').value.trim()
      }
    };
  }

  function populateForm(record, headingText, linkedAppt) {
    form.reset();
    A11y.resetFormValidation(form);
    errorSummary.hidden = true;
    errorList.innerHTML = '';

    const r = record || {};
    const prop = r.propietario || {};
    const pac = r.paciente || {};
    const anam = r.anamnesicos || {};
    const ex = r.examenClinico || {};
    const med = r.medico || {};

    currentEditingId = r.id || null;
    document.getElementById('record-id').value = r.id || '';

    const apptId = linkedAppt?.id || r.appointmentId || '';
    linkedAppointmentInput.value = apptId;
    if (apptId) {
      const apptObj = linkedAppt || Storage.getAppointmentById(apptId);
      formApptLinkPill.textContent = apptObj
        ? `Cita ${apptObj.hora} · ${apptObj.paciente?.nombre || 'Paciente'}`
        : 'Vinculada a cita';
      formApptLinkPill.hidden = false;
    } else {
      formApptLinkPill.hidden = true;
    }

    document.getElementById('fecha').value = r.fecha || getTodayISO();
    document.getElementById('numeroHistoria').value = r.numeroHistoria || Storage.generateNextHCNumber();

    document.getElementById('prop-nombres').value = prop.nombres || '';
    document.getElementById('prop-documento').value = prop.documento || '';
    document.getElementById('prop-direccion').value = prop.direccion || '';
    document.getElementById('prop-telefono').value = prop.telefono || '';
    document.getElementById('prop-email').value = prop.email || '';

    document.getElementById('pac-nombre').value = pac.nombre || '';
    setRadioValue('pacSexo', pac.sexo || '');
    document.getElementById('pac-raza').value = pac.raza || '';
    document.getElementById('pac-especie').value = pac.especie || '';
    document.getElementById('pac-nacimiento').value = pac.fechaNacimiento || '';
    document.getElementById('pac-color').value = pac.color || '';
    document.getElementById('pac-peso').value = pac.peso || '';

    document.getElementById('anam-desparasitacion').value = anam.desparasitacion || '';
    document.getElementById('anam-vacunas').value = anam.vacunas || '';
    document.getElementById('anam-enfermedades').value = anam.enfermedadesAnteriores || '';
    document.getElementById('anam-tratamientos').value = anam.tratamientosPrevios || '';
    document.getElementById('anam-evolucion').value = anam.evolucion || '';
    document.getElementById('anam-alimentacion').value = anam.alimentacion || '';
    setRadioValue('anamReproductiva', anam.historiaReproductiva || '');
    document.getElementById('anam-ultimo-celo').value = anam.ultimoCelo || '';
    document.getElementById('anam-ultimo-parto').value = anam.ultimoParto || '';

    document.getElementById('motivo-consulta').value = r.motivoConsulta || '';

    document.getElementById('ex-fr').value = ex.fr || '';
    document.getElementById('ex-fc').value = ex.fc || '';
    document.getElementById('ex-temp').value = ex.temperatura || '';
    document.getElementById('ex-pulso').value = ex.pulso || '';
    document.getElementById('ex-tlc').value = ex.tlc || '';
    document.getElementById('ex-nodulos').value = ex.nodulosLinfaticos || '';
    document.getElementById('ex-mucosas').value = ex.mucosas || '';
    setRadioValue('exActitud', ex.actitud || '');
    document.getElementById('ex-actitud-otro').value = ex.actitudOtro || '';

    const organos = ex.organos || {};
    for (const o of ORGAN_SYSTEMS) {
      setRadioValue(`organ_${o.key}`, organos[o.key] || '');
    }
    document.getElementById('ex-hallazgos').value = ex.hallazgos || '';

    renderProblemRows(r.listaProblemas || [], r.diagnosticosDiferenciales || []);

    const exams = r.examenesComplementarios || {};
    for (const exam of COMPLEMENTARY_EXAMS) {
      const chk = document.getElementById(`exam_chk_${exam.key}`);
      const note = document.getElementById(`exam_note_${exam.key}`);
      const entry = exams[exam.key];
      if (chk) chk.checked = Boolean(entry && entry.checked);
      if (note) note.value = entry && entry.note ? entry.note : '';
    }

    document.getElementById('desc-pruebas').value = r.hallazgosPruebas || '';
    document.getElementById('diagnostico-final').value = r.diagnosticoFinal || '';

    renderTreatmentRows(r.tratamientos || []);

    document.getElementById('vet-nombre').value = med.nombre || '';
    document.getElementById('vet-matricula').value = med.matricula || '';

    formHeading.textContent = headingText || (r.id ? 'Editar Historia Clínica' : 'Nueva Historia Clínica');
    autosaveStatus.textContent = r.id ? 'Editando registro guardado' : 'Nuevo borrador';
    autosaveStatus.dataset.state = r.id ? 'saved' : 'idle';
    updateAgeBadge();
    updateLiveSubtitle();
  }

  function openNewRecordForm() {
    populateForm(null, 'Nueva Historia Clínica', null);
    switchView('form');
    document.getElementById('prop-nombres').focus();
  }

  function openEditRecordForm(id, appointmentId) {
    const rec = Storage.getRecordById(id);
    if (!rec) {
      A11y.showToast('No se encontró la historia clínica solicitada.', 'error');
      return;
    }
    const appt = appointmentId ? Storage.getAppointmentById(appointmentId) : null;
    populateForm(rec, `Editar ${rec.numeroHistoria}`, appt);
    switchView('form');
  }

  function openDuplicateForFollowUp(id) {
    const rec = Storage.getRecordById(id);
    if (!rec) return;
    const copy = {
      id: null,
      fecha: getTodayISO(),
      numeroHistoria: Storage.generateNextHCNumber(),
      propietario: { ...rec.propietario },
      paciente: { ...rec.paciente },
      anamnesicos: { ...rec.anamnesicos },
      medico: { ...rec.medico }
    };
    populateForm(copy, `Nueva consulta — ${rec.paciente.nombre}`, null);
    switchView('form');
    A11y.showToast(`Datos de ${rec.paciente.nombre} cargados para nueva consulta.`, 'success');
  }

  // ------------------------------------------------------------------------
  // VISTA 3: HISTORIAS CLÍNICAS (KPIs, búsqueda y tabla)
  // ------------------------------------------------------------------------
  function checkDraftBanners() {
    const draft = Storage.getDraft();
    if (!draft) {
      draftBanner.hidden = true;
      overviewDraftBanner.hidden = true;
      return;
    }
    const pac = draft.data?.paciente?.nombre || 'sin nombre';
    const hc = draft.data?.numeroHistoria || '';
    const msg = `Borrador ${hc ? `(${hc}) ` : ''}para paciente "${pac}" guardado automáticamente.`;
    draftBannerDetail.textContent = msg;
    overviewDraftDetail.textContent = msg;
    draftBanner.hidden = false;
    overviewDraftBanner.hidden = false;
  }

  function renderRecordsView() {
    const all = Storage.getAllRecords();
    kpiTotal.textContent = String(all.length);

    let caninos = 0;
    let felinos = 0;
    let otras = 0;
    for (const r of all) {
      const esp = String(r.paciente?.especie || '').toLowerCase();
      if (esp.includes('canin') || esp.includes('perr')) caninos += 1;
      else if (esp.includes('felin') || esp.includes('gat')) felinos += 1;
      else otras += 1;
    }
    kpiCaninos.textContent = String(caninos);
    kpiFelinos.textContent = String(felinos);
    kpiOtras.textContent = String(otras);

    checkDraftBanners();

    const q = searchQuery.value.trim().toLowerCase();
    const especieFilter = filterEspecie.value;
    const sortBy = sortRecords.value;

    const filtered = all.filter((r) => {
      if (especieFilter) {
        const esp = String(r.paciente?.especie || '').toLowerCase();
        if (especieFilter === 'Canino' && !(esp.includes('canin') || esp.includes('perr'))) return false;
        if (especieFilter === 'Felino' && !(esp.includes('felin') || esp.includes('gat'))) return false;
        if (
          especieFilter === 'Otro' &&
          (esp.includes('canin') || esp.includes('perr') || esp.includes('felin') || esp.includes('gat'))
        ) {
          return false;
        }
      }
      if (!q) return true;
      const haystack = [
        r.numeroHistoria,
        r.fecha,
        r.paciente?.nombre,
        r.paciente?.raza,
        r.paciente?.especie,
        r.propietario?.nombres,
        r.propietario?.documento,
        r.propietario?.telefono,
        r.motivoConsulta,
        r.diagnosticoFinal,
        r.medico?.nombre
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    filtered.sort((a, b) => {
      if (sortBy === 'oldest') return String(a.fecha || '').localeCompare(String(b.fecha || ''));
      if (sortBy === 'patient') {
        return String(a.paciente?.nombre || '').localeCompare(String(b.paciente?.nombre || ''), 'es-MX');
      }
      if (sortBy === 'hc') return String(a.numeroHistoria || '').localeCompare(String(b.numeroHistoria || ''));
      const dateCmp = String(b.fecha || '').localeCompare(String(a.fecha || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });

    recordsTbody.innerHTML = '';
    if (filtered.length === 0) {
      const clearBtn = document.getElementById('btn-records-clear-filters');
      if (clearBtn) clearBtn.hidden = !(q || especieFilter);
      recordsEmpty.hidden = false;
      return;
    }
    recordsEmpty.hidden = true;

    for (const r of filtered) {
      const tr = document.createElement('tr');

      const thHc = document.createElement('th');
      thHc.scope = 'row';
      thHc.textContent = r.numeroHistoria || 'Sin número';

      const tdFecha = document.createElement('td');
      tdFecha.className = 'tabular';
      tdFecha.textContent = formatDisplayDate(r.fecha);

      const tdPac = document.createElement('td');
      const pacDiv = document.createElement('div');
      pacDiv.className = 'patient-cell';
      const pacName = document.createElement('strong');
      pacName.textContent = r.paciente?.nombre || '—';
      if (r.paciente?.especie) {
        const tag = document.createElement('span');
        tag.className = 'species-tag';
        tag.textContent = r.paciente.especie;
        pacName.append(tag);
      }
      const pacMeta = document.createElement('small');
      pacMeta.textContent = [r.paciente?.raza, r.paciente?.sexo, r.paciente?.peso ? `${r.paciente.peso} kg` : '']
        .filter(Boolean)
        .join(' · ');
      pacDiv.append(pacName, pacMeta);
      tdPac.append(pacDiv);

      const tdProp = document.createElement('td');
      const propDiv = document.createElement('div');
      propDiv.className = 'owner-cell';
      const propName = document.createElement('strong');
      propName.textContent = r.propietario?.nombres || '—';
      const propMeta = document.createElement('small');
      propMeta.textContent = [
        r.propietario?.documento ? `ID: ${r.propietario.documento}` : '',
        r.propietario?.telefono ? Reminders.formatPhonePretty(r.propietario.telefono) : ''
      ]
        .filter(Boolean)
        .join(' · ');
      propDiv.append(propName, propMeta);
      tdProp.append(propDiv);

      const tdDx = document.createElement('td');
      const dxDiv = document.createElement('div');
      dxDiv.className = 'dx-preview';
      dxDiv.textContent = r.diagnosticoFinal || r.motivoConsulta || 'Sin descripción';
      tdDx.append(dxDiv);

      const tdMed = document.createElement('td');
      tdMed.textContent = r.medico?.nombre || '—';

      const tdActions = document.createElement('td');
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'row-actions';

      const btnView = document.createElement('button');
      btnView.type = 'button';
      btnView.className = 'action-chip';
      btnView.textContent = 'Ver';
      btnView.addEventListener('click', () => openPreviewModal(r.id));

      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'action-chip';
      btnEdit.textContent = 'Editar';
      btnEdit.addEventListener('click', () => openEditRecordForm(r.id));

      const btnFollow = document.createElement('button');
      btnFollow.type = 'button';
      btnFollow.className = 'action-chip';
      btnFollow.textContent = 'Control';
      btnFollow.title = 'Crear una nueva consulta con los datos de este paciente';
      btnFollow.addEventListener('click', () => openDuplicateForFollowUp(r.id));

      const btnSchedule = document.createElement('button');
      btnSchedule.type = 'button';
      btnSchedule.className = 'action-chip';
      btnSchedule.textContent = 'Cita';
      btnSchedule.title = 'Agendar una cita para este paciente';
      btnSchedule.addEventListener('click', () => Appointments.openNewAppointmentModal({ sourceRecordId: r.id }));

      const btnPrint = document.createElement('button');
      btnPrint.type = 'button';
      btnPrint.className = 'action-chip';
      btnPrint.textContent = 'Imprimir';
      btnPrint.addEventListener('click', () => printRecord(r));

      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'action-chip action-chip-danger';
      btnDel.textContent = 'Eliminar';
      btnDel.addEventListener('click', () => requestDeleteRecord(r));

      actionsWrap.append(btnView, btnEdit, btnFollow, btnSchedule, btnPrint, btnDel);
      tdActions.append(actionsWrap);

      tr.append(thHc, tdFecha, tdPac, tdProp, tdDx, tdMed, tdActions);
      recordsTbody.append(tr);
    }
  }

  function refreshAllDataViews() {
    updateGlobalBadges();
    syncClinicMetaUI();
    if (activeView === 'overview') renderOverview();
    if (activeView === 'appointments') Appointments.render();
    if (activeView === 'records') renderRecordsView();
    if (alertsDialog.open) renderAlertsList(alertsDialogList);
  }

  // ------------------------------------------------------------------------
  // Modales nativos (<dialog>)
  // ------------------------------------------------------------------------
  function openConfirmDialog({ title, message, confirmLabel, confirmVariant, onConfirm }) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmOkBtn.textContent = confirmLabel || 'Confirmar';
    confirmOkBtn.className = confirmVariant === 'primary' ? 'btn btn-primary' : 'btn btn-danger';
    pendingConfirmAction = onConfirm;
    confirmDialog.showModal();
  }

  confirmDialog.addEventListener('close', () => {
    const val = confirmDialog.returnValue;
    confirmDialog.returnValue = '';
    const action = pendingConfirmAction;
    pendingConfirmAction = null;
    if (val === 'confirm' && typeof action === 'function') {
      action();
    }
  });

  function requestDeleteRecord(record) {
    openConfirmDialog({
      title: `¿Eliminar historia ${record.numeroHistoria}?`,
      message: `Se eliminará la historia clínica de "${record.paciente?.nombre || 'este paciente'}" de este navegador. Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      onConfirm: () => {
        Storage.deleteRecord(record.id);
        refreshAllDataViews();
        A11y.showToast(`Historia ${record.numeroHistoria} eliminada.`, 'success');
      }
    });
  }

  function openPreviewModal(id) {
    const r = Storage.getRecordById(id);
    if (!r) return;
    previewingRecordId = r.id;
    previewTitle.textContent = `${r.numeroHistoria} — ${r.paciente?.nombre || 'Paciente'}`;
    previewSub.textContent = `Consulta del ${formatDisplayDate(r.fecha)} · ${r.medico?.nombre || 'Médico no especificado'}`;

    const organAbnormal = ORGAN_SYSTEMS.filter((o) => r.examenClinico?.organos?.[o.key] === 'AN').map(
      (o) => o.label
    );

    const examsSelected = COMPLEMENTARY_EXAMS.filter((ex) => {
      const entry = r.examenesComplementarios?.[ex.key];
      return entry && (entry.checked || entry.note);
    }).map((ex) => {
      const entry = r.examenesComplementarios[ex.key];
      return entry.note ? `${ex.label}: ${entry.note}` : ex.label;
    });

    const medsHtml =
      r.tratamientos && r.tratamientos.length
        ? `<ul>${r.tratamientos
            .map(
              (t) =>
                `<li><strong>${escapeHtml(t.productoBase)}</strong> — ${escapeHtml(t.dosisBasica)} (${escapeHtml(
                  t.presentacion
                )}, ${escapeHtml(t.via)}). ${escapeHtml(t.frecuenciaDuracion)}</li>`
            )
            .join('')}</ul>`
        : '<p>Sin tratamientos registrados.</p>';

    previewBody.innerHTML = `
      <section class="preview-section">
        <h3>Propietario y Paciente</h3>
        <dl class="preview-dl">
          <div><dt>Propietario</dt><dd>${escapeHtml(r.propietario?.nombres || '—')}</dd></div>
          <div><dt>Documento</dt><dd>${escapeHtml(r.propietario?.documento || '—')}</dd></div>
          <div><dt>Teléfono</dt><dd>${escapeHtml(Reminders.formatPhonePretty(r.propietario?.telefono) || '—')}</dd></div>
          <div><dt>Paciente</dt><dd>${escapeHtml(r.paciente?.nombre || '—')} (${escapeHtml(r.paciente?.especie || '—')})</dd></div>
          <div><dt>Raza / Sexo</dt><dd>${escapeHtml([r.paciente?.raza, r.paciente?.sexo].filter(Boolean).join(' · ') || '—')}</dd></div>
          <div><dt>Peso</dt><dd>${r.paciente?.peso ? `${escapeHtml(r.paciente.peso)} kg` : '—'}</dd></div>
        </dl>
      </section>

      <section class="preview-section">
        <h3>Motivo de Consulta y Constantes</h3>
        <p><strong>Motivo:</strong> ${escapeHtml(r.motivoConsulta || '—')}</p>
        <dl class="preview-dl">
          <div><dt>F. Respiratoria</dt><dd>${r.examenClinico?.fr ? `${escapeHtml(r.examenClinico.fr)} /rpm` : '—'}</dd></div>
          <div><dt>F. Cardiaca</dt><dd>${r.examenClinico?.fc ? `${escapeHtml(r.examenClinico.fc)} /lpm` : '—'}</dd></div>
          <div><dt>Temperatura</dt><dd>${r.examenClinico?.temperatura ? `${escapeHtml(r.examenClinico.temperatura)} °C` : '—'}</dd></div>
          <div><dt>Actitud</dt><dd>${escapeHtml([r.examenClinico?.actitud, r.examenClinico?.actitudOtro].filter(Boolean).join(' — ') || '—')}</dd></div>
          <div><dt>Sistemas Anormales</dt><dd>${escapeHtml(organAbnormal.length ? organAbnormal.join(', ') : 'Ninguno reportado')}</dd></div>
        </dl>
        ${r.examenClinico?.hallazgos ? `<p><strong>Hallazgos:</strong> ${escapeHtml(r.examenClinico.hallazgos)}</p>` : ''}
      </section>

      <section class="preview-section">
        <h3>Diagnóstico y Plan Terapéutico</h3>
        <p><strong>Exámenes complementarios:</strong> ${escapeHtml(examsSelected.length ? examsSelected.join(' · ') : 'Ninguno')}</p>
        <p><strong>Diagnóstico final:</strong> ${escapeHtml(r.diagnosticoFinal || 'Pendiente')}</p>
        <div><strong>Tratamientos:</strong>${medsHtml}</div>
      </section>
    `;

    previewDialog.showModal();
  }

  previewDialog.addEventListener('close', () => {
    previewDialog.returnValue = '';
  });

  previewBtnEdit.addEventListener('click', () => {
    const id = previewingRecordId;
    previewDialog.close('edit');
    if (id) openEditRecordForm(id);
  });

  previewBtnPrint.addEventListener('click', () => {
    const rec = Storage.getRecordById(previewingRecordId);
    previewDialog.close('print');
    if (rec) printRecord(rec);
  });

  previewBtnAppt.addEventListener('click', () => {
    const id = previewingRecordId;
    previewDialog.close('appt');
    if (id) Appointments.openNewAppointmentModal({ sourceRecordId: id });
  });

  // Alertas y Notification API
  function syncNotifButtonsUI() {
    const cfg = Storage.getSettings();
    const state = Reminders.getNotificationSupportState();
    const active = cfg.browserNotificationsEnabled && state === 'granted';

    if (notifPermissionStatus) {
      if (state === 'unsupported') {
        notifPermissionStatus.textContent = 'Este navegador no soporta Notification API (se usarán avisos en pantalla).';
      } else if (state === 'denied') {
        notifPermissionStatus.textContent = 'Permiso bloqueado en el navegador; se usarán avisos dentro de VETCO.';
      } else if (active) {
        notifPermissionStatus.textContent = `Activas: avisarán ${cfg.reminderLeadMinutes || 30} min antes mientras la app esté abierta.`;
      } else {
        notifPermissionStatus.textContent = 'Desactivadas. Actívalas para recibir avisos antes de cada cita.';
      }
    }

    if (btnToggleBrowserNotif) {
      btnToggleBrowserNotif.textContent = active ? 'Desactivar alertas' : 'Activar alertas';
    }
    if (btnOverviewEnableNotif) {
      btnOverviewEnableNotif.textContent = active ? 'Alertas activas ✓' : 'Activar alertas';
    }
  }

  async function toggleBrowserNotifications(ev) {
    const triggerBtn = ev && ev.currentTarget && ev.currentTarget.classList ? ev.currentTarget : null;
    const cfg = Storage.getSettings();
    if (cfg.browserNotificationsEnabled) {
      Storage.saveSettings({ browserNotificationsEnabled: false });
      Reminders.stopWatcher();
      syncNotifButtonsUI();
      A11y.showToast('Notificaciones del navegador desactivadas.', 'success');
      return;
    }

    if (triggerBtn) {
      triggerBtn.classList.add('is-loading');
      triggerBtn.setAttribute('aria-busy', 'true');
    }

    try {
      const perm = await Reminders.requestNotificationPermission();
      if (perm === 'granted') {
        Storage.saveSettings({ browserNotificationsEnabled: true });
        startReminderWatcher();
        syncNotifButtonsUI();
        A11y.showToast('Notificaciones del navegador activadas mientras VETCO esté abierto.', 'success');
      } else if (perm === 'unsupported') {
        Storage.saveSettings({ browserNotificationsEnabled: true });
        startReminderWatcher();
        syncNotifButtonsUI();
        A11y.showToast('Usando avisos internos en pantalla (Notification API no disponible).', 'success');
      } else {
        A11y.showToast('Permiso de notificaciones denegado en el navegador.', 'error');
        syncNotifButtonsUI();
      }
    } finally {
      if (triggerBtn) {
        triggerBtn.classList.remove('is-loading');
        triggerBtn.removeAttribute('aria-busy');
      }
    }
  }

  function startReminderWatcher() {
    Reminders.startWatcher(
      () => Storage.getAllAppointments(),
      () => Storage.getSettings(),
      (msg) => A11y.showToast(msg, 'success')
    );
  }

  function openAlertsModal() {
    renderAlertsList(alertsDialogList);
    syncNotifButtonsUI();
    alertsDialog.showModal();
  }

  // Configuración y respaldos
  function openSettingsModal() {
    const cfg = Storage.getSettings();
    document.getElementById('cfg-clinic-name').value = cfg.clinicName || '';
    document.getElementById('cfg-clinic-phone').value = cfg.clinicPhone || '6183678303';
    document.getElementById('cfg-country-code').value = cfg.countryCode || '52';
    document.getElementById('cfg-preferred-view').value = cfg.preferredAgendaView || 'day';
    document.getElementById('cfg-clinic-address').value = cfg.clinicAddress || '';
    document.getElementById('cfg-whatsapp-template').value = cfg.whatsappTemplate || '';
    document.getElementById('cfg-auto-in-progress').checked = Boolean(cfg.autoTransitionInProgress);
    document.getElementById('cfg-prompt-complete').checked = Boolean(cfg.promptCompleteOnSave);
    syncThemeUI(cfg.theme || 'dark');
    settingsDialog.showModal();
  }

  function saveSettingsFromModal() {
    Storage.saveSettings({
      clinicName: document.getElementById('cfg-clinic-name').value.trim() || 'VETCO Clínica Veterinaria',
      clinicPhone: document.getElementById('cfg-clinic-phone').value.trim() || '6183678303',
      countryCode: document.getElementById('cfg-country-code').value.replace(/\D+/g, '') || '52',
      preferredAgendaView: document.getElementById('cfg-preferred-view').value || 'day',
      clinicAddress: document.getElementById('cfg-clinic-address').value.trim(),
      whatsappTemplate: document.getElementById('cfg-whatsapp-template').value.trim(),
      autoTransitionInProgress: document.getElementById('cfg-auto-in-progress').checked,
      promptCompleteOnSave: document.getElementById('cfg-prompt-complete').checked
    });
    settingsDialog.close('saved');
    Appointments.applyPreferredView();
    refreshAllDataViews();
    A11y.showToast('Configuración guardada correctamente.', 'success');
  }

  // ------------------------------------------------------------------------
  // Validación, envío y autoguardado de borrador clínico
  // ------------------------------------------------------------------------
  function scheduleDraftSave() {
    clearTimeout(draftDebounceTimer);
    autosaveStatus.dataset.state = 'saving';
    autosaveStatus.textContent = 'Guardando borrador...';
    draftDebounceTimer = setTimeout(() => {
      const data = collectFormData();
      Storage.saveDraft(data);
      const time = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      autosaveStatus.dataset.state = 'saved';
      autosaveStatus.textContent = `Borrador guardado ${time}`;
    }, 500);
  }

  function validateAndSubmit(e) {
    if (e) e.preventDefault();

    errorList.innerHTML = '';
    const invalidFields = [];

    const controls = Array.from(form.querySelectorAll('input, select, textarea'));
    const checkedRadioGroups = new Set();

    for (const el of controls) {
      if (el.type === 'radio') {
        if (checkedRadioGroups.has(el.name)) continue;
        checkedRadioGroups.add(el.name);
        if (!el.validity.valid) {
          invalidFields.push({
            el,
            label: 'Sexo del paciente (selecciona Macho o Hembra)'
          });
        }
        continue;
      }

      if (!el.validity.valid) {
        A11y.markFieldInvalidOnSubmit(el);
        const labelText = el.labels && el.labels[0] ? el.labels[0].textContent.replace('*', '').trim() : el.name;
        invalidFields.push({ el, label: labelText });
      }
    }

    if (invalidFields.length > 0) {
      for (const item of invalidFields) {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#${item.el.id || ''}`;
        link.textContent = item.label;
        link.addEventListener('click', (ev) => {
          ev.preventDefault();
          item.el.focus();
          item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        li.append(link);
        errorList.append(li);
      }
      errorSummary.hidden = false;
      invalidFields[0].el.focus();
      invalidFields[0].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    errorSummary.hidden = true;
    const data = collectFormData();
    const saved = Storage.saveRecord(data);

    if (!saved) {
      A11y.showToast('No fue posible guardar en este navegador (espacio lleno o modo privado).', 'error');
      return;
    }

    Storage.clearDraft();
    currentEditingId = saved.id;
    document.getElementById('record-id').value = saved.id;

    // Vincular con la cita si proviene de una y ofrecer marcar como Completada
    const linkedApptId = data.appointmentId;
    if (linkedApptId) {
      Storage.linkAppointmentToRecord(linkedApptId, saved.id);
      const appt = Storage.getAppointmentById(linkedApptId);
      const cfg = Storage.getSettings();
      switchView(lastNonFormView || 'overview');
      A11y.showToast(`Historia clínica ${saved.numeroHistoria} (${saved.paciente.nombre}) guardada.`, 'success');

      if (cfg.promptCompleteOnSave && appt && appt.estado !== 'completada') {
        openConfirmDialog({
          title: '¿Marcar cita como Completada?',
          message: `La historia clínica ${saved.numeroHistoria} fue vinculada a la cita de ${appt.paciente?.nombre || 'este paciente'} (${appt.hora}). ¿Deseas cambiar el estado de la cita a "Completada"?`,
          confirmLabel: 'Sí, marcar Completada',
          confirmVariant: 'primary',
          onConfirm: () => {
            Storage.updateAppointmentStatus(appt.id, 'completada');
            refreshAllDataViews();
            A11y.showToast(`Cita de ${appt.paciente?.nombre || 'paciente'} marcada como Completada.`, 'success');
          }
        });
      }
      return;
    }

    switchView('records');
    A11y.showToast(`Historia clínica ${saved.numeroHistoria} (${saved.paciente.nombre}) guardada correctamente.`, 'success');
  }

  // ------------------------------------------------------------------------
  // Impresión del formato oficial VETCO (2 páginas exactas — INVARIANTE)
  // ------------------------------------------------------------------------
  function renderVetcoHeader(pageNum) {
    return `
      <table class="vetco-doc-table vetco-header-table">
        <tr>
          <td style="width:16%; text-align:center; vertical-align:middle;">
            <strong style="color:#1b3b6f; font-size:11pt;">VETCO</strong>
          </td>
          <td class="vetco-header-title" style="width:58%;">
            Historia Clínica<br>VETCO
          </td>
          <td style="width:13%; font-weight:700; text-align:center; vertical-align:middle;">Página</td>
          <td style="width:13%; text-align:center; vertical-align:middle;">${pageNum} de 2</td>
        </tr>
      </table>
    `;
  }

  function printRecord(record) {
    const r = record;
    const prop = r.propietario || {};
    const pac = r.paciente || {};
    const anam = r.anamnesicos || {};
    const ex = r.examenClinico || {};
    const organos = ex.organos || {};
    const exams = r.examenesComplementarios || {};
    const med = r.medico || {};

    const chk = (cond) => (cond ? 'X' : '&nbsp;');

    let organsRowsHtml = '';
    for (let i = 0; i < 6; i++) {
      const left = ORGAN_SYSTEMS[i];
      const right = ORGAN_SYSTEMS[i + 6];
      organsRowsHtml += `
        <tr>
          <td>${left.number}. ${escapeHtml(left.label)}</td>
          <td class="vetco-center"><strong>${escapeHtml(organos[left.key] || '')}</strong></td>
          <td>${right.number}. ${escapeHtml(right.label)}</td>
          <td class="vetco-center"><strong>${escapeHtml(organos[right.key] || '')}</strong></td>
        </tr>
      `;
    }

    const probCount = Math.max(7, (r.listaProblemas || []).length, (r.diagnosticosDiferenciales || []).length);
    let probRowsHtml = '';
    for (let i = 0; i < probCount; i++) {
      probRowsHtml += `
        <tr>
          <td><strong>${i + 1}.</strong> ${escapeHtml((r.listaProblemas && r.listaProblemas[i]) || '')}</td>
          <td><strong>${i + 1}.</strong> ${escapeHtml((r.diagnosticosDiferenciales && r.diagnosticosDiferenciales[i]) || '')}</td>
        </tr>
      `;
    }

    let examsRowsHtml = '';
    for (let row = 0; row < 5; row++) {
      examsRowsHtml += '<tr>';
      for (let col = 0; col < 3; col++) {
        const item = COMPLEMENTARY_EXAMS[row * 3 + col];
        const entry = exams[item.key];
        const mark = entry && entry.checked ? '[X]' : '[ ]';
        const note = entry && entry.note ? ` ${escapeHtml(entry.note)}` : '';
        examsRowsHtml += `<td><span class="vetco-label">${escapeHtml(item.label)}:</span> ${mark}${note}</td>`;
      }
      examsRowsHtml += '</tr>';
    }

    const trList = Array.isArray(r.tratamientos) ? r.tratamientos : [];
    const trCount = Math.max(5, trList.length);
    let treatRowsHtml = '';
    for (let i = 0; i < trCount; i++) {
      const t = trList[i] || {};
      treatRowsHtml += `
        <tr>
          <td>${escapeHtml(t.productoBase || '')}&nbsp;</td>
          <td>${escapeHtml(t.dosisBasica || '')}</td>
          <td>${escapeHtml(t.presentacion || '')}</td>
          <td>${escapeHtml(t.via || '')}</td>
          <td>${escapeHtml(t.frecuenciaDuracion || '')}</td>
        </tr>
      `;
    }

    printSheet.innerHTML = `
      <section class="print-page">
        ${renderVetcoHeader(1)}

        <table class="vetco-doc-table">
          <tr>
            <td style="width:45%;"><span class="vetco-label">Fecha:</span> ${escapeHtml(formatDisplayDate(r.fecha))}</td>
            <td style="width:55%;"><span class="vetco-label">Número Historia Clínica:</span> ${escapeHtml(r.numeroHistoria)}</td>
          </tr>
        </table>

        <table class="vetco-doc-table">
          <tr>
            <th colspan="2" class="vetco-section-bar" style="width:44%;">DATOS DEL PROPIETARIO</th>
            <th colspan="2" class="vetco-section-bar" style="width:56%;">DATOS DEL PACIENTE</th>
          </tr>
          <tr>
            <td colspan="2"><span class="vetco-label">Nombres:</span> ${escapeHtml(prop.nombres)}</td>
            <td style="width:33%;"><span class="vetco-label">Nombre:</span> ${escapeHtml(pac.nombre)}</td>
            <td style="width:23%;"><span class="vetco-label">Sexo:</span> ${escapeHtml(pac.sexo)}</td>
          </tr>
          <tr>
            <td colspan="2"><span class="vetco-label">Documento Identidad:</span> ${escapeHtml(prop.documento)}</td>
            <td><span class="vetco-label">Raza:</span> ${escapeHtml(pac.raza)}</td>
            <td><span class="vetco-label">Especie:</span> ${escapeHtml(pac.especie)}</td>
          </tr>
          <tr>
            <td colspan="2"><span class="vetco-label">Dirección:</span> ${escapeHtml(prop.direccion)}</td>
            <td><span class="vetco-label">Fecha de Nacimiento:</span> ${escapeHtml(formatDisplayDate(pac.fechaNacimiento))}</td>
            <td><span class="vetco-label">Color:</span> ${escapeHtml(pac.color)}</td>
          </tr>
          <tr>
            <td colspan="2"><span class="vetco-label">Teléfono:</span> ${escapeHtml(prop.telefono)}</td>
            <td><span class="vetco-label">Correo Electrónico:</span> ${escapeHtml(prop.email)}</td>
            <td><span class="vetco-label">Peso:</span> ${pac.peso ? `${escapeHtml(pac.peso)} kg` : ''}</td>
          </tr>
        </table>

        <table class="vetco-doc-table">
          <tr><th colspan="2" class="vetco-section-bar">ANAMNÉSICOS</th></tr>
          <tr><td colspan="2"><span class="vetco-label">Última Desparasitación (Fecha, Producto):</span> ${escapeHtml(anam.desparasitacion)}</td></tr>
          <tr><td colspan="2"><span class="vetco-label">Vacunas (Fecha/Marca/Lote):</span> ${escapeHtml(anam.vacunas)}</td></tr>
          <tr><td colspan="2"><span class="vetco-label">Enfermedades Anteriores:</span> ${escapeHtml(anam.enfermedadesAnteriores)}</td></tr>
          <tr><td colspan="2"><span class="vetco-label">Tratamientos:</span> ${escapeHtml(anam.tratamientosPrevios)}</td></tr>
          <tr><td colspan="2"><span class="vetco-label">Evolución:</span> ${escapeHtml(anam.evolucion)}</td></tr>
          <tr><td colspan="2"><span class="vetco-label">Alimentación:</span> ${escapeHtml(anam.alimentacion)}</td></tr>
          <tr>
            <td colspan="2">
              <span class="vetco-label">Historia Reproductiva:</span>
              Entero (${chk(anam.historiaReproductiva === 'Entero')}) &nbsp;&nbsp;
              Esterilizado (${chk(anam.historiaReproductiva === 'Esterilizado')})
            </td>
          </tr>
          <tr>
            <td style="width:50%;"><span class="vetco-label">Último Celo:</span> ${escapeHtml(anam.ultimoCelo)}</td>
            <td style="width:50%;"><span class="vetco-label">Fecha último Parto:</span> ${escapeHtml(anam.ultimoParto)}</td>
          </tr>
        </table>

        <table class="vetco-doc-table">
          <tr><th class="vetco-section-bar">MOTIVO DE CONSULTA</th></tr>
          <tr><td class="vetco-multiline">${escapeHtml(r.motivoConsulta)}</td></tr>
        </table>

        <table class="vetco-doc-table">
          <tr><th colspan="4" class="vetco-section-bar">EXAMEN CLÍNICO</th></tr>
          <tr>
            <td style="width:27%;"><span class="vetco-label">F. Respiratoria:</span> ${escapeHtml(ex.fr)} /rpm</td>
            <td style="width:27%;"><span class="vetco-label">F. Cardiaca:</span> ${escapeHtml(ex.fc)} /lpm</td>
            <td style="width:23%;"><span class="vetco-label">Temperatura:</span> ${escapeHtml(ex.temperatura)} °C</td>
            <td style="width:23%;"><span class="vetco-label">Pulso:</span> ${escapeHtml(ex.pulso)}</td>
          </tr>
          <tr>
            <td colspan="2"><span class="vetco-label">Tiempo Llenado Capilar:</span> ${escapeHtml(ex.tlc)}</td>
            <td colspan="2"><span class="vetco-label">Nódulos Linfáticos:</span> ${escapeHtml(ex.nodulosLinfaticos)}</td>
          </tr>
          <tr>
            <td><span class="vetco-label">Mucosas:</span> ${escapeHtml(ex.mucosas)}</td>
            <td colspan="3">
              <span class="vetco-label">Actitud y Temperamento:</span>
              Letárgico (${chk(ex.actitud === 'Letárgico')});
              Estuporoso (${chk(ex.actitud === 'Estuporoso')});
              Comatoso (${chk(ex.actitud === 'Comatoso')});
              Alerta (${chk(ex.actitud === 'Alerta')});
              Otro (${chk(ex.actitud === 'Otro')}): ${escapeHtml(ex.actitudOtro)}
            </td>
          </tr>
        </table>

        <table class="vetco-doc-table">
          <tr>
            <th class="vetco-subhead" style="width:40%;">ÓRGANOS Y SISTEMAS</th>
            <th class="vetco-subhead" style="width:10%;">N/AN/NE</th>
            <th class="vetco-subhead" style="width:40%;">ÓRGANOS Y SISTEMAS</th>
            <th class="vetco-subhead" style="width:10%;">N/AN/NE</th>
          </tr>
          ${organsRowsHtml}
          <tr>
            <td colspan="4" class="vetco-center"><strong>N:</strong> Normal &nbsp;&nbsp; <strong>AN:</strong> Anormal &nbsp;&nbsp; <strong>NE:</strong> No Examinado</td>
          </tr>
          <tr>
            <td colspan="4" class="vetco-multiline-lg"><span class="vetco-label">Descripción de los Hallazgos:</span>\n${escapeHtml(ex.hallazgos)}</td>
          </tr>
        </table>
      </section>

      <section class="print-page">
        ${renderVetcoHeader(2)}

        <table class="vetco-doc-table">
          <tr>
            <th class="vetco-section-bar" style="width:50%;">LISTA DE PROBLEMAS</th>
            <th class="vetco-section-bar" style="width:50%;">DIAGNÓSTICOS DIFERENCIALES</th>
          </tr>
          ${probRowsHtml}
        </table>

        <table class="vetco-doc-table">
          <tr><th colspan="3" class="vetco-section-bar">EXÁMENES COMPLEMENTARIOS</th></tr>
          ${examsRowsHtml}
          <tr><th colspan="3" class="vetco-section-bar">Descripción Hallazgos Pruebas Diagnósticas</th></tr>
          <tr><td colspan="3" class="vetco-multiline-lg">${escapeHtml(r.hallazgosPruebas)}</td></tr>
        </table>

        <table class="vetco-doc-table">
          <tr><th class="vetco-section-bar">DIAGNÓSTICO FINAL O CONFIRMATIVO</th></tr>
          <tr><td class="vetco-multiline">${escapeHtml(r.diagnosticoFinal)}</td></tr>
        </table>

        <table class="vetco-doc-table">
          <tr><th colspan="5" class="vetco-section-bar">TRATAMIENTOS</th></tr>
          <tr>
            <th class="vetco-subhead" style="width:22%;">Producto Base</th>
            <th class="vetco-subhead" style="width:14%;">Dosis Básica</th>
            <th class="vetco-subhead" style="width:24%;">Presentación</th>
            <th class="vetco-subhead" style="width:12%;">Vía</th>
            <th class="vetco-subhead" style="width:28%;">Frecuencia y Duración</th>
          </tr>
          ${treatRowsHtml}
        </table>

        <table class="vetco-doc-table">
          <tr><th class="vetco-section-bar">MÉDICO VETERINARIO</th></tr>
          <tr><td><span class="vetco-label">Médico Veterinario:</span> ${escapeHtml(med.nombre)}</td></tr>
          <tr><td><span class="vetco-label">Matrícula Profesional:</span> ${escapeHtml(med.matricula)}</td></tr>
        </table>
      </section>
    `;

    window.print();
  }

  // ------------------------------------------------------------------------
  // Exportar / Importar respaldo JSON unificado (v2 retrocompatible con v1)
  // ------------------------------------------------------------------------
  function exportBackupJson() {
    const payload = Storage.exportBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vetco-respaldo-${getTodayISO()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    A11y.showToast(
      `Respaldo exportado: ${payload.records.length} historia(s) y ${payload.appointments.length} cita(s).`,
      'success'
    );
  }

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const res = Storage.importBackupPayload(parsed);
        const cfg = Storage.getSettings();
        syncThemeUI(cfg.theme || 'dark');
        refreshAllDataViews();
        A11y.showToast(
          `Importado correctamente: ${res.recordsCount} historia(s) y ${res.appointmentsCount} cita(s).`,
          'success'
        );
      } catch (err) {
        A11y.showToast(err.message || 'El archivo seleccionado no es un respaldo JSON válido.', 'error');
      }
    };
    reader.readAsText(file);
  }

  function requestResetDemo() {
    openConfirmDialog({
      title: '¿Restaurar datos de demostración?',
      message:
        'Se restaurarán los 3 casos clínicos de ejemplo y las citas demo actuales en este navegador. Tu tema visual y configuración se conservarán.',
      confirmLabel: 'Restaurar demo',
      onConfirm: () => {
        Storage.resetToDemo();
        refreshAllDataViews();
        A11y.showToast('Datos de demostración restaurados.', 'success');
      }
    });
  }

  // ------------------------------------------------------------------------
  // Stepper de secciones del formulario clínico
  // ------------------------------------------------------------------------
  const stepChips = Array.from(document.querySelectorAll('.step-chip'));
  function setActiveStepChip(hash) {
    for (const chip of stepChips) {
      chip.classList.toggle('is-current', chip.getAttribute('href') === hash);
    }
  }

  function initSectionObserver() {
    if (!('IntersectionObserver' in window)) return;
    const sections = stepChips
      .map((chip) => document.querySelector(chip.getAttribute('href')))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        if (views.form.hidden) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveStepChip(`#${entry.target.id}`);
          }
        }
      },
      { rootMargin: '-25% 0px -65% 0px', threshold: 0 }
    );

    sections.forEach((sec) => observer.observe(sec));
  }

  function resumeDraftAction() {
    const draft = Storage.getDraft();
    if (!draft) return;
    populateForm(
      draft.data,
      draft.data.id ? `Editar ${draft.data.numeroHistoria} (Borrador)` : 'Continuar Borrador',
      draft.data.appointmentId ? Storage.getAppointmentById(draft.data.appointmentId) : null
    );
    switchView('form');
    A11y.showToast('Borrador restaurado.', 'success');
  }

  function discardDraftAction() {
    Storage.clearDraft();
    checkDraftBanners();
    A11y.showToast('Borrador descartado.', 'success');
  }

  // ------------------------------------------------------------------------
  // Enlace de eventos
  // ------------------------------------------------------------------------
  function bindEvents() {
    // Navegación principal (sidebar + bottom nav + links internos)
    document.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.getAttribute('data-nav')));
    });
    document.querySelectorAll('[data-nav-go]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.getAttribute('data-nav-go')));
    });

    document.getElementById('btn-brand-home').addEventListener('click', () => switchView('overview'));
    document.getElementById('btn-mobile-brand').addEventListener('click', () => switchView('overview'));

    // Sidebar colapsable
    btnSidebarToggle.addEventListener('click', () => {
      const nextCollapsed = appShell.getAttribute('data-sidebar') !== 'collapsed';
      syncSidebarState(nextCollapsed);
      Storage.saveSettings({ sidebarCollapsed: nextCollapsed });
    });

    // Temas (Oscuro / Claro / Morado Beta)
    document.querySelectorAll('[data-theme-set]').forEach((btn) => {
      btn.addEventListener('click', () => setTheme(btn.getAttribute('data-theme-set'), true));
    });
    document.getElementById('btn-topbar-theme-cycle').addEventListener('click', cycleTheme);

    // Nueva Historia y Nueva Cita desde distintos puntos
    document.getElementById('sidebar-new-appt').addEventListener('click', () => Appointments.openNewAppointmentModal());
    document.getElementById('topbar-new-appt').addEventListener('click', () => Appointments.openNewAppointmentModal());
    document.getElementById('btn-overview-new-appt').addEventListener('click', () => Appointments.openNewAppointmentModal());
    document.querySelectorAll('[data-action="new-appt"]').forEach((b) =>
      b.addEventListener('click', () => Appointments.openNewAppointmentModal())
    );

    document.getElementById('sidebar-new-record').addEventListener('click', openNewRecordForm);
    document.getElementById('topbar-new-record').addEventListener('click', openNewRecordForm);
    document.getElementById('btn-overview-new-record').addEventListener('click', openNewRecordForm);
    document.getElementById('btn-empty-new').addEventListener('click', openNewRecordForm);

    // Botón "+ Nuevo" móvil
    document.getElementById('btn-mobile-quick-new').addEventListener('click', () => quickNewDialog.showModal());
    document.getElementById('btn-quick-new-appt').addEventListener('click', () => {
      quickNewDialog.close();
      Appointments.openNewAppointmentModal();
    });
    document.getElementById('btn-quick-new-record').addEventListener('click', () => {
      quickNewDialog.close();
      openNewRecordForm();
    });

    // Volver / Cancelar formulario
    document.getElementById('btn-back-dashboard').addEventListener('click', () => switchView(lastNonFormView || 'records'));
    document.getElementById('btn-cancel-form').addEventListener('click', () => switchView(lastNonFormView || 'records'));

    // Alertas y Configuración
    document.getElementById('btn-open-alerts').addEventListener('click', openAlertsModal);
    document.getElementById('btn-toggle-browser-notif').addEventListener('click', toggleBrowserNotifications);
    btnOverviewEnableNotif.addEventListener('click', toggleBrowserNotifications);
    document.getElementById('btn-topbar-settings').addEventListener('click', openSettingsModal);
    document.getElementById('sidebar-open-settings').addEventListener('click', openSettingsModal);
    document.getElementById('btn-agenda-settings').addEventListener('click', openSettingsModal);
    document.getElementById('btn-save-settings').addEventListener('click', saveSettingsFromModal);

    // Exportar .ics de hoy / agenda completa
    const exportTodayICS = () => {
      const today = getTodayISO();
      const todayAppts = Storage.getAllAppointments().filter((a) => a.fecha === today && a.estado !== 'cancelada');
      if (!Reminders.downloadAgendaICS(todayAppts, `vetco-agenda-${today}.ics`, Storage.getSettings())) {
        A11y.showToast('No hay citas activas hoy para exportar a .ics.', 'error');
      } else {
        A11y.showToast(`Agenda de hoy (${todayAppts.length} citas) descargada en formato .ics.`, 'success');
      }
    };
    document.getElementById('btn-overview-export-ics').addEventListener('click', exportTodayICS);
    document.getElementById('btn-alerts-export-today-ics').addEventListener('click', exportTodayICS);
    document.getElementById('btn-agenda-export-ics').addEventListener('click', () => {
      const all = Storage.getAllAppointments().filter((a) => a.estado !== 'cancelada');
      if (!Reminders.downloadAgendaICS(all, `vetco-agenda-completa-${getTodayISO()}.ics`, Storage.getSettings())) {
        A11y.showToast('No hay citas activas para exportar.', 'error');
      } else {
        A11y.showToast(`Se exportaron ${all.length} cita(s) en formato .ics.`, 'success');
      }
    });

    // Búsqueda y filtros de historias
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      renderRecordsView();
    });
    searchQuery.addEventListener('input', renderRecordsView);
    filterEspecie.addEventListener('change', renderRecordsView);
    sortRecords.addEventListener('change', renderRecordsView);
    document.getElementById('btn-records-clear-filters')?.addEventListener('click', () => {
      searchQuery.value = '';
      filterEspecie.value = '';
      renderRecordsView();
      searchQuery.focus();
    });

    // Borradores (Dashboard + Historias)
    document.getElementById('btn-resume-draft').addEventListener('click', resumeDraftAction);
    document.getElementById('btn-discard-draft').addEventListener('click', discardDraftAction);
    document.querySelectorAll('[data-action="resume-draft"]').forEach((b) => b.addEventListener('click', resumeDraftAction));
    document.querySelectorAll('[data-action="discard-draft"]').forEach((b) => b.addEventListener('click', discardDraftAction));

    // Exportar / Importar / Reset demo (tanto en Historias como en Configuración)
    const importInput = document.getElementById('input-import-file');
    document.getElementById('btn-export-json').addEventListener('click', exportBackupJson);
    document.getElementById('btn-cfg-export').addEventListener('click', exportBackupJson);
    document.getElementById('btn-import-json').addEventListener('click', () => importInput.click());
    document.getElementById('btn-cfg-import').addEventListener('click', () => {
      settingsDialog.close();
      importInput.click();
    });
    importInput.addEventListener('change', () => {
      if (importInput.files && importInput.files[0]) {
        handleImportFile(importInput.files[0]);
        importInput.value = '';
      }
    });
    document.getElementById('btn-reset-demo').addEventListener('click', requestResetDemo);
    document.getElementById('btn-cfg-reset').addEventListener('click', () => {
      settingsDialog.close();
      requestResetDemo();
    });

    // Formulario clínico
    form.addEventListener('submit', validateAndSubmit);
    document.getElementById('btn-save-top').addEventListener('click', () => form.requestSubmit());

    const handlePrintCurrent = () => printRecord(collectFormData());
    document.getElementById('btn-print-current').addEventListener('click', handlePrintCurrent);
    document.getElementById('btn-print-bottom').addEventListener('click', handlePrintCurrent);

    document.getElementById('btn-all-normal').addEventListener('click', () => {
      for (const o of ORGAN_SYSTEMS) {
        setRadioValue(`organ_${o.key}`, 'N');
      }
      scheduleDraftSave();
      A11y.showToast('Los 12 sistemas fueron marcados como Normal (N).', 'success');
    });

    document.getElementById('btn-clear-organs').addEventListener('click', () => {
      for (const o of ORGAN_SYSTEMS) {
        setRadioValue(`organ_${o.key}`, '');
      }
      scheduleDraftSave();
    });

    document.getElementById('btn-add-problem-row').addEventListener('click', () => {
      const nextIndex = problemsContainer.children.length + 1;
      const row = createProblemRow(nextIndex, '', '');
      problemsContainer.append(row);
      row.querySelector('.problem-input').focus();
    });

    document.getElementById('btn-add-treatment').addEventListener('click', () => {
      const row = createTreatmentRow({});
      treatmentsTbody.append(row);
      row.querySelector('.t-producto').focus();
    });

    pacNacimiento.addEventListener('change', updateAgeBadge);
    document.getElementById('numeroHistoria').addEventListener('input', updateLiveSubtitle);
    document.getElementById('pac-nombre').addEventListener('input', updateLiveSubtitle);
    document.getElementById('prop-nombres').addEventListener('input', updateLiveSubtitle);

    form.addEventListener('input', scheduleDraftSave);
    form.addEventListener('change', scheduleDraftSave);

    stepChips.forEach((chip) => {
      chip.addEventListener('click', () => setActiveStepChip(chip.getAttribute('href')));
    });
  }

  function init() {
    const cfg = Storage.getSettings();
    syncThemeUI(cfg.theme || 'dark');
    syncSidebarState(Boolean(cfg.sidebarCollapsed));
    syncClinicMetaUI();

    buildOrganSystemsUI();
    buildComplementaryExamsUI();
    renderProblemRows([], []);
    renderTreatmentRows([]);
    A11y.initFormValidationA11y(form);
    A11y.initDialogLightDismissFallback();
    Appointments.init({
      onDataChanged: refreshAllDataViews,
      onStartClinicalRecord: startClinicalRecordFromAppointment,
      onConfirm: openConfirmDialog
    });
    bindEvents();
    initSectionObserver();

    if (cfg.browserNotificationsEnabled) {
      startReminderWatcher();
    }

    switchView('overview');
  }

  init();
})(window);
