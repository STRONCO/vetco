/* ==========================================================================
   VETCO — Catálogos clínicos oficiales, catálogos de Agenda y datos demo
   Configurado por defecto para México (+52) y tema oscuro clínico
   ========================================================================== */

(function (global) {
  'use strict';

  const ORGAN_SYSTEMS = [
    { key: 'estadoGeneral', number: 1, label: 'Estado general y Condición Corporal' },
    { key: 'hidratacion', number: 2, label: 'Estado de Hidratación' },
    { key: 'tegumentario', number: 3, label: 'Sistema Tegumentario' },
    { key: 'ojos', number: 4, label: 'Ojos' },
    { key: 'oidos', number: 5, label: 'Oídos' },
    { key: 'nariz', number: 6, label: 'Nariz' },
    { key: 'digestivo', number: 7, label: 'Sistema Digestivo' },
    { key: 'respiratorio', number: 8, label: 'S. Respiratorio' },
    { key: 'nervioso', number: 9, label: 'S. Nervioso' },
    { key: 'musculoesqueletico', number: 10, label: 'S. Musculoesquelético' },
    { key: 'cardiovascular', number: 11, label: 'S. Cardiovascular' },
    { key: 'genitourinario', number: 12, label: 'S. Genitourinario' }
  ];

  // Orden exacto por filas de 3 columnas del formato VETCO (Página 2)
  const COMPLEMENTARY_EXAMS = [
    { key: 'quimicaSanguinea', label: 'Química Sanguínea' },
    { key: 'coprologico', label: 'Coprológico' },
    { key: 'coproscopico', label: 'Coproscópico' },
    { key: 'rayosX', label: 'Rayos X' },
    { key: 'endoscopia', label: 'Endoscopia' },
    { key: 'cultivos', label: 'Cultivos' },
    { key: 'ecografia', label: 'Ecografía' },
    { key: 'ecg', label: 'ECG' },
    { key: 'antibiograma', label: 'Antibiograma' },
    { key: 'cuadroHematico', label: 'Cuadro Hemático' },
    { key: 'eeg', label: 'EEG' },
    { key: 'biopsia', label: 'Biopsia' },
    { key: 'frotisPiel', label: 'Frotis (raspado piel)' },
    { key: 'parcialOrina', label: 'Parcial de Orina' },
    { key: 'otros', label: 'Otros' }
  ];

  const APPOINTMENT_STATUSES = [
    { key: 'programada', label: 'Programada' },
    { key: 'confirmada', label: 'Confirmada' },
    { key: 'en_consulta', label: 'En consulta' },
    { key: 'completada', label: 'Completada' },
    { key: 'no_asistio', label: 'No asistió' },
    { key: 'cancelada', label: 'Cancelada' }
  ];

  const APPOINTMENT_TYPES = [
    'Consulta general',
    'Control post-tratamiento',
    'Vacunación',
    'Desparasitación',
    'Cirugía / Procedimiento',
    'Urgencia',
    'Profilaxis / Estética médica'
  ];

  const AGENDA_VIEWS = [
    { key: 'day', label: 'Agenda del día' },
    { key: 'list', label: 'Lista filtrable' },
    { key: 'week', label: 'Calendario semanal' },
    { key: 'month', label: 'Calendario mensual' }
  ];

  const DEFAULT_SETTINGS = {
    theme: 'dark', // 'dark' | 'light' | 'purple'
    sidebarCollapsed: false,
    clinicName: 'VETCO Clínica Veterinaria',
    clinicPhone: '6183678303',
    clinicAddress: 'Av. 20 de Noviembre #410, Zona Centro, Durango, Dgo.',
    countryCode: '52',
    preferredAgendaView: 'day',
    autoTransitionInProgress: true,
    promptCompleteOnSave: true,
    browserNotificationsEnabled: false,
    reminderLeadMinutes: 30,
    whatsappTemplate:
      'Hola {propietario}, te recordamos la cita veterinaria de {paciente} en {clinica} el {fecha} a las {hora} ({motivo}) con {medico}. Por favor confírmanos tu asistencia. Tel: {telefonoClinica}.'
  };

  function getOffsetDateISO(dayOffset) {
    const d = new Date();
    d.setDate(d.getDate() + (dayOffset || 0));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getRelativeTimeHHMM(offsetMinutes, fallbackHHMM) {
    const now = new Date();
    const target = new Date(now.getTime() + offsetMinutes * 60000);
    // Si cambia de día, usar horario clínico diurno de respaldo
    if (target.getDate() !== now.getDate()) return fallbackHHMM;
    const hh = String(target.getHours()).padStart(2, '0');
    const mm = String(Math.floor(target.getMinutes() / 5) * 5).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const DEMO_RECORDS = [
    {
      id: 'demo-hc-001',
      fecha: '2026-11-18',
      numeroHistoria: 'HC-2026-0001',
      propietario: {
        nombres: 'Carolina Méndez Rojas',
        documento: 'MERJ890514',
        direccion: 'Calle Negrete #318, Col. Centro, Durango',
        telefono: '618 367 8303',
        email: 'carolina.mendez@ejemplo.mx'
      },
      paciente: {
        nombre: 'Max',
        sexo: 'Macho',
        raza: 'Golden Retriever',
        especie: 'Canino',
        fechaNacimiento: '2022-05-14',
        color: 'Dorado',
        peso: '29.4'
      },
      anamnesicos: {
        desparasitacion: '2026-09-10 / Drontal Plus',
        vacunas: '2026-06-02 / Nobivac DHPPi+RL / Lote B8421',
        enfermedadesAnteriores: 'Otitis externa leve en 2024, resuelta sin secuelas.',
        tratamientosPrevios: 'Propietaria administró agua de manzanilla en casa ayer.',
        evolucion: 'Inicio hace 24 horas con 3 episodios de emesis y heces blandas.',
        alimentacion: 'Concentrado premium adulto 2 veces al día; comió restos de comida casera el domingo.',
        historiaReproductiva: 'Esterilizado',
        ultimoCelo: 'No aplica',
        ultimoParto: 'No aplica'
      },
      motivoConsulta:
        'Vómitos esporádicos desde ayer en la noche, disminución del apetito y decaimiento leve tras ingerir alimento grasoso.',
      examenClinico: {
        fr: '26',
        fc: '104',
        temperatura: '38.7',
        pulso: 'Fuerte y concordante',
        tlc: '2 seg',
        nodulosLinfaticos: 'Normales a la palpación',
        mucosas: 'Rosadas, levemente secas',
        actitud: 'Alerta',
        actitudOtro: 'Dócil, colaborador durante la evaluación',
        organos: {
          estadoGeneral: 'N',
          hidratacion: 'AN',
          tegumentario: 'N',
          ojos: 'N',
          oidos: 'N',
          nariz: 'N',
          digestivo: 'AN',
          respiratorio: 'N',
          nervioso: 'N',
          musculoesqueletico: 'N',
          cardiovascular: 'N',
          genitourinario: 'N'
        },
        hallazgos:
          'Deshidratación estimada del 5%. Leve molestia a la palpación abdominal craneal y borborigmos aumentados. Sin masas ni cuerpos extraños palpables.'
      },
      listaProblemas: [
        'Emesis aguda',
        'Heces pastosas / diarrea leve',
        'Deshidratación leve (5%)',
        'Hiporexia',
        'Dolor abdominal craneal leve',
        '',
        ''
      ],
      diagnosticosDiferenciales: [
        'Gastroenteritis aguda por indiscreción alimentaria',
        'Parasitismo gastrointestinal',
        'Pancreatitis aguda leve',
        'Cuerpo extraño gastrointestinal',
        '',
        '',
        ''
      ],
      examenesComplementarios: {
        cuadroHematico: { checked: true, note: 'Hemoconcentración leve' },
        quimicaSanguinea: { checked: true, note: 'Perfil hepático y renal normal' },
        coproscopico: { checked: true, note: 'Negativo a huevos de parásitos' }
      },
      hallazgosPruebas:
        'Cuadro hemático con hematocrito en 54% (compatible con deshidratación leve), leucocitos dentro de rango normal. Coproscópico negativo.',
      diagnosticoFinal: 'Gastroenteritis aguda secundaria a indiscreción alimentaria.',
      tratamientos: [
        {
          productoBase: 'Maropitant (Cerenia)',
          dosisBasica: '1 mg/kg',
          presentacion: 'Solución inyectable 10 mg/mL',
          via: 'Subcutánea (SC)',
          frecuenciaDuracion: 'Dosis única en clínica'
        },
        {
          productoBase: 'Omeprazol',
          dosisBasica: '1 mg/kg',
          presentacion: 'Cápsulas 20 mg',
          via: 'Oral (PO)',
          frecuenciaDuracion: 'Cada 24 h por 5 días en ayunas'
        },
        {
          productoBase: 'Probiótico veterinario (Entero-Chronic)',
          dosisBasica: '1 sobre',
          presentacion: 'Sobres x 4 g',
          via: 'Oral (PO)',
          frecuenciaDuracion: 'Cada 24 h por 7 días con dieta blanda'
        }
      ],
      medico: {
        nombre: 'Dra. Laura Sofía Gómez',
        matricula: 'CED-8424819'
      },
      updatedAt: '2026-11-18T16:20:00.000Z'
    },
    {
      id: 'demo-hc-002',
      fecha: '2026-11-19',
      numeroHistoria: 'HC-2026-0002',
      propietario: {
        nombres: 'Andrés Felipe Torres',
        documento: 'TOFA910322',
        direccion: 'Blvd. Felipe Pescador #1204, Durango',
        telefono: '618 412 5590',
        email: 'andres.torres@ejemplo.mx'
      },
      paciente: {
        nombre: 'Luna',
        sexo: 'Hembra',
        raza: 'Doméstico Pelo Corto',
        especie: 'Felino',
        fechaNacimiento: '2023-08-22',
        color: 'Atigrado gris',
        peso: '4.1'
      },
      anamnesicos: {
        desparasitacion: '2026-07-01 / Revolution Plus',
        vacunas: '2026-04-12 / Felocell Triple + Rabia / Lote F1120',
        enfermedadesAnteriores: 'Ninguna reportada.',
        tratamientosPrevios: 'Ninguno.',
        evolucion: 'Prurito progresivo en zona dorsal y base de la cola desde hace 2 semanas.',
        alimentacion: 'Concentrado para gato esterilizado indoor ad libitum.',
        historiaReproductiva: 'Esterilizado',
        ultimoCelo: 'Esterilizada a los 7 meses',
        ultimoParto: 'No aplica'
      },
      motivoConsulta:
        'Rascado frecuente en cuello y lomo, pérdida localizada de pelo y pequeñas costras en la piel.',
      examenClinico: {
        fr: '30',
        fc: '168',
        temperatura: '38.4',
        pulso: 'Fuerte y simétrico',
        tlc: '< 2 seg',
        nodulosLinfaticos: 'Submandibulares sin alteraciones',
        mucosas: 'Rosadas húmedas',
        actitud: 'Alerta',
        actitudOtro: 'Nerviosa al inicio, manejable',
        organos: {
          estadoGeneral: 'N',
          hidratacion: 'N',
          tegumentario: 'AN',
          ojos: 'N',
          oidos: 'N',
          nariz: 'N',
          digestivo: 'N',
          respiratorio: 'N',
          nervioso: 'N',
          musculoesqueletico: 'N',
          cardiovascular: 'N',
          genitourinario: 'N'
        },
        hallazgos:
          'Dermatitis miliar en región lumbosacra con áreas de alopecia autoinducida y presencia de excretas de pulga en el pelaje.'
      },
      listaProblemas: [
        'Prurito dorsal intenso',
        'Dermatitis miliar lumbosacra',
        'Alopecia autoinducida',
        'Evidencia de ectoparásitos (pulgas)',
        '',
        '',
        ''
      ],
      diagnosticosDiferenciales: [
        'Dermatitis alérgica por picadura de pulga (DAPP)',
        'Dermatofitosis',
        'Alergia alimentaria',
        'Atopia felina',
        '',
        '',
        ''
      ],
      examenesComplementarios: {
        frotisPiel: { checked: true, note: 'Raspado superficial y tricograma' }
      },
      hallazgosPruebas:
        'Raspado cutáneo negativo para ácaros. Tricograma muestra puntas fracturadas por lamido excesivo; prueba de papel húmedo positiva para heces de pulga.',
      diagnosticoFinal: 'Dermatitis Alérgica por Picadura de Pulga (DAPP).',
      tratamientos: [
        {
          productoBase: 'Sarolaner + Selamectina',
          dosisBasica: '1 pipeta (2.5 - 5 kg)',
          presentacion: 'Pipeta spot-on',
          via: 'Tópica',
          frecuenciaDuracion: 'Mensual por 3 meses consecutivos'
        },
        {
          productoBase: 'Prednisolona',
          dosisBasica: '1 mg/kg',
          presentacion: 'Tabletas 5 mg',
          via: 'Oral (PO)',
          frecuenciaDuracion: 'Cada 24 h por 4 días, luego reducir a días alternos x 4 tomas'
        }
      ],
      medico: {
        nombre: 'Dr. Julián Camilo Herrera',
        matricula: 'CED-9131094'
      },
      updatedAt: '2026-11-19T11:45:00.000Z'
    },
    {
      id: 'demo-hc-003',
      fecha: '2026-11-20',
      numeroHistoria: 'HC-2026-0003',
      propietario: {
        nombres: 'Mariana Salgado Prieto',
        documento: 'SAPM950819',
        direccion: 'Fracc. Lomas del Parque #214, Durango',
        telefono: '618 290 7741',
        email: 'mariana.salgado@ejemplo.mx'
      },
      paciente: {
        nombre: 'Rocky',
        sexo: 'Macho',
        raza: 'Bulldog Francés',
        especie: 'Canino',
        fechaNacimiento: '2024-02-10',
        color: 'Atigrado oscuro',
        peso: '11.8'
      },
      anamnesicos: {
        desparasitacion: '2026-10-05 / NexGard Spectra',
        vacunas: '2026-02-18 / Vanguard Plus 5 + KC / Lote V991',
        enfermedadesAnteriores: 'Ninguna.',
        tratamientosPrevios: 'Ninguno.',
        evolucion: 'Tos seca tipo graznido desde hace 3 días tras regreso de guardería canina.',
        alimentacion: 'Concentrado hipoalergénico cordero y arroz.',
        historiaReproductiva: 'Entero',
        ultimoCelo: 'No aplica',
        ultimoParto: 'No aplica'
      },
      motivoConsulta:
        'Tos seca repetitiva que empeora al emocionarse o jalar la correa; come y juega con normalidad.',
      examenClinico: {
        fr: '32',
        fc: '118',
        temperatura: '38.6',
        pulso: 'Fuerte, regular',
        tlc: '< 2 seg',
        nodulosLinfaticos: 'Retrofaríngeos levemente reactivos',
        mucosas: 'Rosadas húmedas',
        actitud: 'Alerta',
        actitudOtro: 'Muy activo',
        organos: {
          estadoGeneral: 'N',
          hidratacion: 'N',
          tegumentario: 'N',
          ojos: 'N',
          oidos: 'N',
          nariz: 'N',
          digestivo: 'N',
          respiratorio: 'AN',
          nervioso: 'N',
          musculoesqueletico: 'N',
          cardiovascular: 'N',
          genitourinario: 'N'
        },
        hallazgos:
          'Reflejo tusígeno positivo inmediatamente a la palpación traqueal suave. Campos pulmonares limpios a la auscultación, sin estertores ni sibilancias.'
      },
      listaProblemas: [
        'Tos seca paroxística',
        'Reflejo tusígeno positivo',
        'Linfadenomegalia retrofaríngea leve',
        '',
        '',
        '',
        ''
      ],
      diagnosticosDiferenciales: [
        'Complejo respiratorio infeccioso canino (Traqueobronquitis)',
        'Colapso traqueal',
        'Síndrome braquicefálico exacerbado',
        '',
        '',
        '',
        ''
      ],
      examenesComplementarios: {
        rayosX: { checked: true, note: 'Tórax LL y VD — patrón bronquial leve' }
      },
      hallazgosPruebas:
        'Radiografía de tórax sin evidencia de consolidación pulmonar ni cardiomegalia; leve engrosamiento de paredes bronquiales.',
      diagnosticoFinal: 'Traqueobronquitis infecciosa canina no complicada.',
      tratamientos: [
        {
          productoBase: 'Doxiciclina',
          dosisBasica: '10 mg/kg',
          presentacion: 'Tabletas 100 mg',
          via: 'Oral (PO)',
          frecuenciaDuracion: 'Cada 24 h por 10 días con alimento'
        },
        {
          productoBase: 'Meloxicam',
          dosisBasica: '0.1 mg/kg',
          presentacion: 'Suspensión oral 1.5 mg/mL',
          via: 'Oral (PO)',
          frecuenciaDuracion: 'Cada 24 h por 3 días después de comer'
        }
      ],
      medico: {
        nombre: 'Dra. Laura Sofía Gómez',
        matricula: 'CED-8424819'
      },
      updatedAt: '2026-11-20T09:15:00.000Z'
    }
  ];

  // Citas demo con fechas dinámicas relativas al día actual (incluye 1 atrasada, hoy, mañana y próxima)
  function getDemoAppointments() {
    const yesterday = getOffsetDateISO(-1);
    const today = getOffsetDateISO(0);
    const tomorrow = getOffsetDateISO(1);
    const inTwoDays = getOffsetDateISO(2);

    return [
      {
        id: 'demo-appt-overdue',
        fecha: yesterday,
        hora: '17:30',
        duracionMin: 30,
        tipo: 'Desparasitación',
        prioridad: 'normal',
        estado: 'programada',
        motivo: 'Desparasitación interna y revisión de peso (cita pendiente de reprogramar o cerrar)',
        notas: 'Propietario llamó para avisar posible retraso; confirmar si acude hoy.',
        paciente: {
          nombre: 'Luna',
          especie: 'Felino',
          raza: 'Doméstico Pelo Corto',
          sexo: 'Hembra'
        },
        propietario: {
          nombres: 'Andrés Felipe Torres',
          telefono: '618 412 5590',
          email: 'andres.torres@ejemplo.mx',
          documento: 'TOFA910322'
        },
        medico: {
          nombre: 'Dr. Julián Camilo Herrera',
          matricula: 'CED-9131094'
        },
        sourceRecordId: 'demo-hc-002',
        linkedRecordId: null,
        reminder: {
          notified: false,
          channel: null,
          notifiedAt: null
        },
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'demo-appt-001',
        fecha: today,
        hora: getRelativeTimeHHMM(25, '10:30'),
        duracionMin: 30,
        tipo: 'Control post-tratamiento',
        prioridad: 'normal',
        estado: 'confirmada',
        motivo: 'Control de gastroenteritis e hidratación (revisión a 48 h)',
        notas: 'Verificar tolerancia a dieta blanda y peso actual.',
        paciente: {
          nombre: 'Max',
          especie: 'Canino',
          raza: 'Golden Retriever',
          sexo: 'Macho'
        },
        propietario: {
          nombres: 'Carolina Méndez Rojas',
          telefono: '618 367 8303',
          email: 'carolina.mendez@ejemplo.mx',
          documento: 'MERJ890514'
        },
        medico: {
          nombre: 'Dra. Laura Sofía Gómez',
          matricula: 'CED-8424819'
        },
        sourceRecordId: 'demo-hc-001',
        linkedRecordId: null,
        reminder: {
          notified: true,
          channel: 'whatsapp',
          notifiedAt: new Date(Date.now() - 3600000).toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'demo-appt-002',
        fecha: today,
        hora: getRelativeTimeHHMM(75, '12:00'),
        duracionMin: 45,
        tipo: 'Urgencia',
        prioridad: 'urgente',
        estado: 'programada',
        motivo: 'Episodio de tos persistente y dificultad leve al respirar tras paseo',
        notas: 'Preparar nebulizador y saturómetro antes del ingreso.',
        paciente: {
          nombre: 'Rocky',
          especie: 'Canino',
          raza: 'Bulldog Francés',
          sexo: 'Macho'
        },
        propietario: {
          nombres: 'Mariana Salgado Prieto',
          telefono: '618 290 7741',
          email: 'mariana.salgado@ejemplo.mx',
          documento: 'SAPM950819'
        },
        medico: {
          nombre: 'Dra. Laura Sofía Gómez',
          matricula: 'CED-8424819'
        },
        sourceRecordId: 'demo-hc-003',
        linkedRecordId: null,
        reminder: {
          notified: false,
          channel: null,
          notifiedAt: null
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'demo-appt-004',
        fecha: tomorrow,
        hora: '11:00',
        duracionMin: 30,
        tipo: 'Vacunación',
        prioridad: 'normal',
        estado: 'programada',
        motivo: 'Refuerzo anual séxtuple + antirrábica',
        notas: 'Paciente nuevo referido; recordar traer cartilla física.',
        paciente: {
          nombre: 'Kira',
          especie: 'Canino',
          raza: 'Border Collie',
          sexo: 'Hembra'
        },
        propietario: {
          nombres: 'Diego Armando Reyes',
          telefono: '618 367 8303',
          email: 'diego.reyes@ejemplo.mx',
          documento: 'REDA930210'
        },
        medico: {
          nombre: 'Dr. Julián Camilo Herrera',
          matricula: 'CED-9131094'
        },
        sourceRecordId: null,
        linkedRecordId: null,
        reminder: {
          notified: false,
          channel: null,
          notifiedAt: null
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'demo-appt-005',
        fecha: inTwoDays,
        hora: '16:30',
        duracionMin: 60,
        tipo: 'Cirugía / Procedimiento',
        prioridad: 'normal',
        estado: 'confirmada',
        motivo: 'Valoración preanestésica y profilaxis dental programada',
        notas: 'Indicar ayuno de sólidos de 8 horas y líquidos de 2 horas.',
        paciente: {
          nombre: 'Max',
          especie: 'Canino',
          raza: 'Golden Retriever',
          sexo: 'Macho'
        },
        propietario: {
          nombres: 'Carolina Méndez Rojas',
          telefono: '618 367 8303',
          email: 'carolina.mendez@ejemplo.mx',
          documento: 'MERJ890514'
        },
        medico: {
          nombre: 'Dra. Laura Sofía Gómez',
          matricula: 'CED-8424819'
        },
        sourceRecordId: 'demo-hc-001',
        linkedRecordId: null,
        reminder: {
          notified: true,
          channel: 'email',
          notifiedAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  global.VETCO_DATA = {
    ORGAN_SYSTEMS,
    COMPLEMENTARY_EXAMS,
    APPOINTMENT_STATUSES,
    APPOINTMENT_TYPES,
    AGENDA_VIEWS,
    DEFAULT_SETTINGS,
    DEMO_RECORDS,
    getDemoAppointments
  };
})(window);
