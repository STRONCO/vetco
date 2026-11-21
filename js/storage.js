/* ==========================================================================
   VETCO — Capa de persistencia local retrocompatible (localStorage)
   - Mantiene intactas las claves v1 de Historias Clínicas y borrador
   - Agrega almacén de Citas, Configuración/Temas y Respaldos JSON v1/v2
   ========================================================================== */

(function (global) {
  'use strict';

  // Claves v1 preservadas para no romper datos previos
  const STORAGE_KEY = 'vetco_clinical_records_v1';
  const DRAFT_KEY = 'vetco_clinical_draft_v1';
  const INIT_KEY = 'vetco_initialized_v1';

  // Claves nuevas para módulos de Agenda y Preferencias
  const APPOINTMENTS_KEY = 'vetco_appointments_v1';
  const APPOINTMENTS_INIT_KEY = 'vetco_appointments_init_v1';
  const SETTINGS_KEY = 'vetco_settings_v1';

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function safeRead(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.warn('Error leyendo localStorage:', err);
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('Error guardando en localStorage:', err);
      return false;
    }
  }

  function generateId(prefix) {
    const p = prefix || 'hc';
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return `${p}-${global.crypto.randomUUID()}`;
    }
    return `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ------------------------------------------------------------------------
  // 1. HISTORIAS CLÍNICAS (Retrocompatible v1)
  // ------------------------------------------------------------------------
  function ensureInitialized() {
    const initialized = global.localStorage.getItem(INIT_KEY);
    const existing = safeRead(STORAGE_KEY, null);
    if (!initialized || !Array.isArray(existing)) {
      safeWrite(STORAGE_KEY, clone(global.VETCO_DATA.DEMO_RECORDS));
      global.localStorage.setItem(INIT_KEY, '1');
    }
  }

  function getAllRecords() {
    ensureInitialized();
    const list = safeRead(STORAGE_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function getRecordById(id) {
    return getAllRecords().find((r) => r.id === id) || null;
  }

  function generateNextHCNumber() {
    const records = getAllRecords();
    const year = new Date().getFullYear();
    const prefix = `HC-${year}-`;
    let maxSeq = 0;

    for (const r of records) {
      const match = String(r.numeroHistoria || '').match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  function saveRecord(record) {
    const records = getAllRecords();
    const now = new Date().toISOString();
    const toSave = clone(record);

    if (!toSave.id) {
      toSave.id = generateId('hc');
      toSave.createdAt = now;
    }
    toSave.updatedAt = now;

    const idx = records.findIndex((r) => r.id === toSave.id);
    if (idx >= 0) {
      records[idx] = toSave;
    } else {
      records.unshift(toSave);
    }

    const ok = safeWrite(STORAGE_KEY, records);
    return ok ? toSave : null;
  }

  function deleteRecord(id) {
    const records = getAllRecords();
    const filtered = records.filter((r) => r.id !== id);
    return safeWrite(STORAGE_KEY, filtered);
  }

  function saveDraft(draftObj) {
    return safeWrite(DRAFT_KEY, {
      savedAt: new Date().toISOString(),
      data: draftObj
    });
  }

  function getDraft() {
    const draft = safeRead(DRAFT_KEY, null);
    return draft && draft.data ? draft : null;
  }

  function clearDraft() {
    try {
      global.localStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      console.warn('No se pudo limpiar el borrador:', err);
    }
  }

  // ------------------------------------------------------------------------
  // 2. AGENDA Y CITAS (Nuevo almacén independiente)
  // ------------------------------------------------------------------------
  function ensureAppointmentsInitialized() {
    const init = global.localStorage.getItem(APPOINTMENTS_INIT_KEY);
    const existing = safeRead(APPOINTMENTS_KEY, null);
    if (!init || !Array.isArray(existing)) {
      const seed =
        typeof global.VETCO_DATA.getDemoAppointments === 'function'
          ? global.VETCO_DATA.getDemoAppointments()
          : [];
      safeWrite(APPOINTMENTS_KEY, clone(seed));
      global.localStorage.setItem(APPOINTMENTS_INIT_KEY, '1');
    }
  }

  function normalizeAppointment(appt) {
    const a = clone(appt || {});
    return {
      id: a.id || null,
      fecha: a.fecha || '',
      hora: a.hora || '09:00',
      duracionMin: Number(a.duracionMin) || 30,
      tipo: a.tipo || 'Consulta general',
      prioridad: a.prioridad === 'urgente' ? 'urgente' : 'normal',
      estado: a.estado || 'programada',
      motivo: a.motivo || '',
      notas: a.notas || '',
      paciente: {
        nombre: a.paciente?.nombre || '',
        especie: a.paciente?.especie || '',
        raza: a.paciente?.raza || '',
        sexo: a.paciente?.sexo || ''
      },
      propietario: {
        nombres: a.propietario?.nombres || '',
        telefono: a.propietario?.telefono || '',
        email: a.propietario?.email || '',
        documento: a.propietario?.documento || ''
      },
      medico: {
        nombre: a.medico?.nombre || '',
        matricula: a.medico?.matricula || ''
      },
      sourceRecordId: a.sourceRecordId || null,
      linkedRecordId: a.linkedRecordId || null,
      reminder: {
        notified: Boolean(a.reminder?.notified),
        channel: a.reminder?.channel || null,
        notifiedAt: a.reminder?.notifiedAt || null
      },
      createdAt: a.createdAt || null,
      updatedAt: a.updatedAt || null
    };
  }

  function getAllAppointments() {
    ensureAppointmentsInitialized();
    const list = safeRead(APPOINTMENTS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function getAppointmentById(id) {
    return getAllAppointments().find((a) => a.id === id) || null;
  }

  function saveAppointment(appt) {
    const list = getAllAppointments();
    const now = new Date().toISOString();
    const toSave = normalizeAppointment(appt);

    if (!toSave.id) {
      toSave.id = generateId('cita');
      toSave.createdAt = now;
    }
    toSave.updatedAt = now;

    const idx = list.findIndex((a) => a.id === toSave.id);
    if (idx >= 0) {
      list[idx] = toSave;
    } else {
      list.push(toSave);
    }

    const ok = safeWrite(APPOINTMENTS_KEY, list);
    return ok ? toSave : null;
  }

  function deleteAppointment(id) {
    const list = getAllAppointments();
    const filtered = list.filter((a) => a.id !== id);
    return safeWrite(APPOINTMENTS_KEY, filtered);
  }

  function updateAppointmentStatus(id, newStatus) {
    const appt = getAppointmentById(id);
    if (!appt) return null;
    appt.estado = newStatus;
    return saveAppointment(appt);
  }

  function markAppointmentNotified(id, channel) {
    const appt = getAppointmentById(id);
    if (!appt) return null;
    appt.reminder = {
      notified: true,
      channel: channel || 'manual',
      notifiedAt: new Date().toISOString()
    };
    return saveAppointment(appt);
  }

  function clearAppointmentNotified(id) {
    const appt = getAppointmentById(id);
    if (!appt) return null;
    appt.reminder = {
      notified: false,
      channel: null,
      notifiedAt: null
    };
    return saveAppointment(appt);
  }

  function getKnownVets() {
    const map = new Map();
    for (const r of getAllRecords()) {
      if (r.medico?.nombre) {
        map.set(r.medico.nombre.trim().toLowerCase(), {
          nombre: r.medico.nombre.trim(),
          matricula: r.medico.matricula || ''
        });
      }
    }
    for (const a of getAllAppointments()) {
      if (a.medico?.nombre && !map.has(a.medico.nombre.trim().toLowerCase())) {
        map.set(a.medico.nombre.trim().toLowerCase(), {
          nombre: a.medico.nombre.trim(),
          matricula: a.medico.matricula || ''
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-MX'));
  }

  function linkAppointmentToRecord(appointmentId, recordId) {
    const appt = getAppointmentById(appointmentId);
    if (!appt) return null;
    appt.linkedRecordId = recordId;
    return saveAppointment(appt);
  }

  // Directorio derivado de pacientes conocidos (desde historias clínicas y citas)
  function getKnownPatients() {
    const records = getAllRecords();
    const map = new Map();
    for (const r of records) {
      const key = `${(r.paciente?.nombre || '').trim().toLowerCase()}|${(r.propietario?.nombres || '')
        .trim()
        .toLowerCase()}`;
      if (!r.paciente?.nombre) continue;
      if (!map.has(key)) {
        map.set(key, {
          recordId: r.id,
          paciente: clone(r.paciente),
          propietario: clone(r.propietario),
          medico: clone(r.medico || {}),
          lastDate: r.fecha || ''
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.paciente.nombre || '').localeCompare(String(b.paciente.nombre || ''), 'es-MX')
    );
  }

  // ------------------------------------------------------------------------
  // 3. CONFIGURACIÓN Y PREFERENCIAS (Temas, Clínica, LADA, Plantillas)
  // ------------------------------------------------------------------------
  function getSettings() {
    const defaults = clone(global.VETCO_DATA.DEFAULT_SETTINGS || {});
    const saved = safeRead(SETTINGS_KEY, null);
    if (!saved || typeof saved !== 'object') return defaults;
    return { ...defaults, ...saved };
  }

  function saveSettings(partial) {
    const merged = { ...getSettings(), ...(partial || {}) };
    safeWrite(SETTINGS_KEY, merged);
    return merged;
  }

  // ------------------------------------------------------------------------
  // 4. RESPALDOS JSON UNIFICADOS (v2 retrocompatible con v1) Y RESET DEMO
  // ------------------------------------------------------------------------
  function resetToDemo() {
    clearDraft();
    safeWrite(STORAGE_KEY, clone(global.VETCO_DATA.DEMO_RECORDS));
    global.localStorage.setItem(INIT_KEY, '1');

    const seedAppts =
      typeof global.VETCO_DATA.getDemoAppointments === 'function'
        ? global.VETCO_DATA.getDemoAppointments()
        : [];
    safeWrite(APPOINTMENTS_KEY, clone(seedAppts));
    global.localStorage.setItem(APPOINTMENTS_INIT_KEY, '1');

    return {
      records: getAllRecords(),
      appointments: getAllAppointments()
    };
  }

  function importRecords(importedList) {
    if (!Array.isArray(importedList)) {
      throw new Error('El archivo JSON debe contener un arreglo de historias clínicas.');
    }
    const sanitized = importedList
      .filter((item) => item && typeof item === 'object' && item.paciente && item.propietario)
      .map((item) => ({
        ...item,
        id: item.id || generateId('hc'),
        updatedAt: item.updatedAt || new Date().toISOString()
      }));

    if (sanitized.length === 0) {
      throw new Error('No se encontraron historias clínicas válidas en el archivo.');
    }

    const current = getAllRecords();
    const byId = new Map(current.map((r) => [r.id, r]));
    for (const rec of sanitized) {
      byId.set(rec.id, rec);
    }

    const merged = Array.from(byId.values());
    safeWrite(STORAGE_KEY, merged);
    return sanitized.length;
  }

  function importAppointments(importedList) {
    if (!Array.isArray(importedList)) return 0;
    const sanitized = importedList
      .filter((item) => item && typeof item === 'object' && item.fecha && item.paciente)
      .map((item) => {
        const norm = normalizeAppointment(item);
        norm.id = norm.id || generateId('cita');
        norm.updatedAt = norm.updatedAt || new Date().toISOString();
        return norm;
      });

    if (sanitized.length === 0) return 0;

    const current = getAllAppointments();
    const byId = new Map(current.map((a) => [a.id, a]));
    for (const appt of sanitized) {
      byId.set(appt.id, appt);
    }

    safeWrite(APPOINTMENTS_KEY, Array.from(byId.values()));
    return sanitized.length;
  }

  function exportBackupPayload() {
    return {
      schema: 'vetco-backup',
      version: 2,
      exportedAt: new Date().toISOString(),
      records: getAllRecords(),
      appointments: getAllAppointments(),
      settings: getSettings()
    };
  }

  function importBackupPayload(parsed) {
    // Retrocompatibilidad v1: archivo JSON era un arreglo plano de historias
    if (Array.isArray(parsed)) {
      const recordsCount = importRecords(parsed);
      return { recordsCount, appointmentsCount: 0, settingsUpdated: false };
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('El archivo JSON no tiene un formato de respaldo VETCO válido.');
    }

    let recordsCount = 0;
    let appointmentsCount = 0;
    let settingsUpdated = false;

    if (Array.isArray(parsed.records) && parsed.records.length > 0) {
      recordsCount = importRecords(parsed.records);
    }
    if (Array.isArray(parsed.appointments) && parsed.appointments.length > 0) {
      appointmentsCount = importAppointments(parsed.appointments);
    }
    if (parsed.settings && typeof parsed.settings === 'object') {
      saveSettings(parsed.settings);
      settingsUpdated = true;
    }

    if (recordsCount === 0 && appointmentsCount === 0 && !settingsUpdated) {
      throw new Error('El archivo no contiene historias clínicas ni citas válidas para importar.');
    }

    return { recordsCount, appointmentsCount, settingsUpdated };
  }

  global.VETCO_STORAGE = {
    // Historias v1
    getAllRecords,
    getRecordById,
    generateNextHCNumber,
    saveRecord,
    deleteRecord,
    importRecords,
    saveDraft,
    getDraft,
    clearDraft,
    // Citas
    getAllAppointments,
    getAppointmentById,
    saveAppointment,
    deleteAppointment,
    updateAppointmentStatus,
    markAppointmentNotified,
    clearAppointmentNotified,
    linkAppointmentToRecord,
    getKnownPatients,
    getKnownVets,
    // Preferencias
    getSettings,
    saveSettings,
    // Respaldos y Demo
    exportBackupPayload,
    importBackupPayload,
    resetToDemo
  };
})(window);
