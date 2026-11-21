/* ==========================================================================
   VETCO — Motor de Recordatorios y Calendario (100% Estático)
   - WhatsApp (wa.me) con normalización LADA México (+52) y plantilla editable
   - Correo (mailto:) prellenado
   - Generador de eventos .ics (RFC 5545) individual y por lote
   - Enlace directo a Google Calendar
   - Bandeja de alertas próximas + Notification API opt-in con deduplicación
   ========================================================================== */

(function (global) {
  'use strict';

  const NOTIFIED_SESSION_KEY = 'vetco_browser_notified_ids_v1';
  let watcherIntervalId = null;

  function cleanDigits(value) {
    return String(value || '').replace(/\D+/g, '');
  }

  function normalizePhoneForWhatsApp(rawPhone, countryCode) {
    const cc = cleanDigits(countryCode || '52') || '52';
    let digits = cleanDigits(rawPhone);
    if (!digits) return '';
    // Quitar prefijo internacional 00 si existe
    if (digits.startsWith('00')) digits = digits.slice(2);
    // Número local mexicano de 10 dígitos -> anteponer LADA 52
    if (digits.length === 10) {
      return `${cc}${digits}`;
    }
    // Si ya trae 521 + 10 dígitos (formato antiguo móvil MX), normalizar a 52 + 10 dígitos
    if (cc === '52' && digits.length === 13 && digits.startsWith('521')) {
      return `52${digits.slice(3)}`;
    }
    return digits;
  }

  function formatPhonePretty(rawPhone) {
    const d = cleanDigits(rawPhone);
    if (d.length === 10) {
      return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
    }
    return rawPhone || '';
  }

  function parseAppointmentStart(appt) {
    if (!appt || !appt.fecha) return null;
    const time = appt.hora || '09:00';
    const dt = new Date(`${appt.fecha}T${time}:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function formatDateLongEsMx(isoDate) {
    if (!isoDate) return 'fecha por confirmar';
    const dt = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(dt.getTime())) return isoDate;
    try {
      return new Intl.DateTimeFormat('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(dt);
    } catch {
      return isoDate;
    }
  }

  function renderTemplate(template, appt, settings) {
    const cfg = settings || {};
    const tpl =
      template ||
      cfg.whatsappTemplate ||
      'Hola {propietario}, te recordamos la cita de {paciente} en {clinica} el {fecha} a las {hora}.';

    const replacements = {
      '{propietario}': appt?.propietario?.nombres || 'propietario',
      '{paciente}': appt?.paciente?.nombre || 'tu mascota',
      '{fecha}': formatDateLongEsMx(appt?.fecha),
      '{hora}': appt?.hora || 'por confirmar',
      '{motivo}': appt?.motivo || appt?.tipo || 'Consulta veterinaria',
      '{medico}': appt?.medico?.nombre || 'nuestro equipo médico',
      '{clinica}': cfg.clinicName || 'VETCO Clínica Veterinaria',
      '{direccionClinica}': cfg.clinicAddress || '',
      '{telefonoClinica}': formatPhonePretty(cfg.clinicPhone || '6183678303')
    };

    let output = String(tpl);
    for (const [token, val] of Object.entries(replacements)) {
      output = output.split(token).join(val);
    }
    return output.trim();
  }

  function buildWhatsAppUrl(appt, settings, customMessage) {
    const cfg = settings || {};
    const targetPhone = normalizePhoneForWhatsApp(
      appt?.propietario?.telefono || cfg.clinicPhone,
      cfg.countryCode || '52'
    );
    const text = customMessage || renderTemplate(cfg.whatsappTemplate, appt, cfg);
    const encoded = encodeURIComponent(text);
    return targetPhone ? `https://wa.me/${targetPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  }

  function buildMailtoUrl(appt, settings, customMessage) {
    const cfg = settings || {};
    const to = encodeURIComponent(appt?.propietario?.email || '');
    const subject = encodeURIComponent(
      `Recordatorio de cita — ${appt?.paciente?.nombre || 'Paciente'} (${cfg.clinicName || 'VETCO'})`
    );
    const body = encodeURIComponent(customMessage || renderTemplate(cfg.whatsappTemplate, appt, cfg));
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }

  function formatLocalICSDate(dateObj) {
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `${dateObj.getFullYear()}${pad(dateObj.getMonth() + 1)}${pad(dateObj.getDate())}` +
      `T${pad(dateObj.getHours())}${pad(dateObj.getMinutes())}${pad(dateObj.getSeconds())}`
    );
  }

  function formatUTCICSDate(dateObj) {
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `${dateObj.getUTCFullYear()}${pad(dateObj.getUTCMonth() + 1)}${pad(dateObj.getUTCDate())}` +
      `T${pad(dateObj.getUTCHours())}${pad(dateObj.getUTCMinutes())}${pad(dateObj.getUTCSeconds())}Z`
    );
  }

  function escapeICS(text) {
    return String(text || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  function buildGoogleCalendarUrl(appt, settings) {
    const cfg = settings || {};
    const start = parseAppointmentStart(appt);
    if (!start) return 'https://calendar.google.com/calendar/render?action=TEMPLATE';
    const end = new Date(start.getTime() + (Number(appt.duracionMin) || 30) * 60000);

    const title = `Cita VETCO: ${appt.paciente?.nombre || 'Paciente'} (${appt.tipo || 'Consulta'})`;
    const details = [
      `Paciente: ${appt.paciente?.nombre || '—'} (${appt.paciente?.especie || '—'})`,
      `Propietario: ${appt.propietario?.nombres || '—'} · Tel: ${appt.propietario?.telefono || '—'}`,
      `Médico: ${appt.medico?.nombre || 'Por asignar'}`,
      `Motivo: ${appt.motivo || '—'}`,
      appt.notas ? `Notas: ${appt.notas}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${formatLocalICSDate(start)}/${formatLocalICSDate(end)}`,
      details,
      location: `${cfg.clinicName || 'VETCO'}${cfg.clinicAddress ? ` — ${cfg.clinicAddress}` : ''}`
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function generateICS(appointments, settings) {
    const cfg = settings || {};
    const list = Array.isArray(appointments) ? appointments : [appointments];
    const stamp = formatUTCICSDate(new Date());
    const location = `${cfg.clinicName || 'VETCO Clínica Veterinaria'}${
      cfg.clinicAddress ? ` - ${cfg.clinicAddress}` : ''
    }`;

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VETCO//Sistema Veterinario Modular//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    for (const appt of list) {
      const start = parseAppointmentStart(appt);
      if (!start) continue;
      const end = new Date(start.getTime() + (Number(appt.duracionMin) || 30) * 60000);
      const uid = `${appt.id || Date.now()}@vetco.local`;
      const summary = `Cita Veterinaria: ${appt.paciente?.nombre || 'Paciente'} — ${appt.tipo || 'Consulta'}`;
      const description = [
        `Paciente: ${appt.paciente?.nombre || '—'} (${appt.paciente?.especie || '—'})`,
        `Propietario: ${appt.propietario?.nombres || '—'} | Tel: ${appt.propietario?.telefono || '—'}`,
        `Médico Veterinario: ${appt.medico?.nombre || 'Por asignar'}`,
        `Motivo: ${appt.motivo || 'Consulta veterinaria'}`,
        cfg.clinicPhone ? `Teléfono clínica: ${formatPhonePretty(cfg.clinicPhone)}` : ''
      ]
        .filter(Boolean)
        .join('\n');

      lines.push(
        'BEGIN:VEVENT',
        `UID:${escapeICS(uid)}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${formatLocalICSDate(start)}`,
        `DTEND:${formatLocalICSDate(end)}`,
        `SUMMARY:${escapeICS(summary)}`,
        `DESCRIPTION:${escapeICS(description)}`,
        `LOCATION:${escapeICS(location)}`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeICS(`Recordatorio: cita de ${appt.paciente?.nombre || 'paciente'} en 30 min`)}`,
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeICS(`Mañana tienes cita veterinaria para ${appt.paciente?.nombre || 'paciente'}`)}`,
        'END:VALARM',
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');
    return `${lines.join('\r\n')}\r\n`;
  }

  function triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadICS(appt, settings) {
    const ics = generateICS([appt], settings);
    const safeName = String(appt?.paciente?.nombre || 'cita')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    triggerDownload(ics, `vetco-cita-${safeName}-${appt?.fecha || 'evento'}.ics`, 'text/calendar;charset=utf-8');
  }

  function downloadAgendaICS(appointments, filename, settings) {
    const active = (appointments || []).filter((a) => a.estado !== 'cancelada');
    if (active.length === 0) return false;
    const ics = generateICS(active, settings);
    triggerDownload(ics, filename || 'vetco-agenda.ics', 'text/calendar;charset=utf-8');
    return true;
  }

  // ------------------------------------------------------------------------
  // Bandeja de alertas próximas y citas atrasadas para el veterinario
  // ------------------------------------------------------------------------
  function isAppointmentOverdue(appt, nowDate) {
    if (!appt || !['programada', 'confirmada'].includes(appt.estado)) return false;
    const start = parseAppointmentStart(appt);
    if (!start) return false;
    const now = nowDate || new Date();
    return start.getTime() < now.getTime();
  }

  function formatNotifiedStamp(isoStamp) {
    if (!isoStamp) return '';
    const dt = new Date(isoStamp);
    if (Number.isNaN(dt.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(dt);
    } catch {
      return isoStamp.slice(0, 16).replace('T', ' ');
    }
  }

  function getUpcomingAlerts(appointments, nowDate) {
    const now = nowDate || new Date();
    const nowMs = now.getTime();
    const alerts = [];

    for (const appt of appointments || []) {
      if (['completada', 'cancelada', 'no_asistio'].includes(appt.estado)) continue;
      const start = parseAppointmentStart(appt);
      if (!start) continue;
      const diffMin = Math.round((start.getTime() - nowMs) / 60000);

      if (diffMin < 0 && appt.estado !== 'en_consulta') {
        const absMin = Math.abs(diffMin);
        const tag =
          absMin >= 1440
            ? `Atrasada (${Math.floor(absMin / 1440)}d)`
            : absMin >= 60
              ? `Atrasada (${Math.floor(absMin / 60)}h)`
              : `Hace ${absMin} min`;
        alerts.push({
          appt,
          diffMin,
          level: 'urgent',
          tag,
          reason: 'Cita atrasada sin pasar a consulta'
        });
      } else if (diffMin >= 0 && diffMin <= 120) {
        alerts.push({
          appt,
          diffMin,
          level: diffMin <= 30 || appt.prioridad === 'urgente' ? 'urgent' : 'soon',
          tag: diffMin <= 1 ? 'Ahora' : `En ${diffMin} min`,
          reason: appt.prioridad === 'urgente' ? 'Cita urgente próxima' : 'Próxima cita en agenda'
        });
      } else if (diffMin > 120 && diffMin <= 1440 && !appt.reminder?.notified) {
        alerts.push({
          appt,
          diffMin,
          level: 'warn',
          tag: `${appt.hora}`,
          reason: 'Propietario pendiente por notificar'
        });
      }
    }

    alerts.sort((a, b) => a.diffMin - b.diffMin);
    return alerts;
  }

  // ------------------------------------------------------------------------
  // Notification API opt-in (mientras la app esté abierta)
  // ------------------------------------------------------------------------
  function getNotificationSupportState() {
    if (typeof global.Notification === 'undefined') return 'unsupported';
    return global.Notification.permission; // 'default' | 'granted' | 'denied'
  }

  async function requestNotificationPermission() {
    if (typeof global.Notification === 'undefined') return 'unsupported';
    if (global.Notification.permission === 'granted') return 'granted';
    try {
      return await global.Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  function getNotifiedIds() {
    try {
      const raw = global.sessionStorage.getItem(NOTIFIED_SESSION_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  function markSessionNotified(id) {
    try {
      const set = getNotifiedIds();
      set.add(id);
      global.sessionStorage.setItem(NOTIFIED_SESSION_KEY, JSON.stringify(Array.from(set)));
    } catch {
      // ignorar en modos restringidos
    }
  }

  function checkAndDispatchBrowserNotifications(getAppointmentsFn, getSettingsFn, onFallbackNotify) {
    const settings = typeof getSettingsFn === 'function' ? getSettingsFn() : {};
    if (!settings.browserNotificationsEnabled) return;

    const lead = Number(settings.reminderLeadMinutes) || 30;
    const appts = typeof getAppointmentsFn === 'function' ? getAppointmentsFn() : [];
    const nowMs = Date.now();
    const sent = getNotifiedIds();

    for (const appt of appts) {
      if (!['programada', 'confirmada'].includes(appt.estado)) continue;
      if (sent.has(appt.id)) continue;
      const start = parseAppointmentStart(appt);
      if (!start) continue;
      const diffMin = Math.round((start.getTime() - nowMs) / 60000);

      if (diffMin >= 0 && diffMin <= lead) {
        markSessionNotified(appt.id);
        const title = `VETCO — Cita en ${diffMin <= 1 ? 'breve' : `${diffMin} min`}`;
        const body = `${appt.paciente?.nombre || 'Paciente'} (${appt.propietario?.nombres || 'Propietario'}) · ${appt.hora} · ${appt.motivo || appt.tipo}`;

        if (getNotificationSupportState() === 'granted') {
          try {
            new global.Notification(title, { body, tag: appt.id });
          } catch {
            if (typeof onFallbackNotify === 'function') onFallbackNotify(`${title}: ${body}`);
          }
        } else if (typeof onFallbackNotify === 'function') {
          onFallbackNotify(`${title}: ${body}`);
        }
      }
    }
  }

  function startWatcher(getAppointmentsFn, getSettingsFn, onFallbackNotify) {
    stopWatcher();
    checkAndDispatchBrowserNotifications(getAppointmentsFn, getSettingsFn, onFallbackNotify);
    watcherIntervalId = global.setInterval(() => {
      checkAndDispatchBrowserNotifications(getAppointmentsFn, getSettingsFn, onFallbackNotify);
    }, 60000);
  }

  function stopWatcher() {
    if (watcherIntervalId) {
      global.clearInterval(watcherIntervalId);
      watcherIntervalId = null;
    }
  }

  global.VETCO_REMINDERS = {
    normalizePhoneForWhatsApp,
    formatPhonePretty,
    formatDateLongEsMx,
    parseAppointmentStart,
    renderTemplate,
    buildWhatsAppUrl,
    buildMailtoUrl,
    buildGoogleCalendarUrl,
    generateICS,
    downloadICS,
    downloadAgendaICS,
    isAppointmentOverdue,
    formatNotifiedStamp,
    getUpcomingAlerts,
    getNotificationSupportState,
    requestNotificationPermission,
    startWatcher,
    stopWatcher
  };
})(window);
