# VETCO — Sistema Veterinario Modular (100% Estático)

Sistema web **100% estático (HTML5, CSS3 moderno y JavaScript puro, sin frameworks ni build steps)** diseñado para operar cómodamente desde **celulares, tabletas y computadoras** en apertura directa (`index.html`), **XAMPP** o **GitHub Pages**.

## Módulos incluidos

### 1. Panel de Control (Dashboard)
- Indicadores clínicos y operativos con CSS `subgrid`: **Citas de Hoy**, **Recordatorios Pendientes**, **Historias Clínicas** (desglose por especie) y **Próximas Citas (7 días)**.
- Tarjetas interactivas de citas del día con cambio rápido de estado, WhatsApp 1-clic, recordatorios y botón **Atender / Historia**.
- Bandeja de alertas próximas/atrasadas y listado de **Últimos Pacientes Atendidos**.

### 2. Agenda y Citas con Recordatorios
- **4 vistas seleccionables** con botón **Fijar como preferida**:
  - **Hoy / Día** (con aviso automático si hay citas atrasadas).
  - **Próximas / Lista** (filtros rápidos: *Todas*, *Hoy*, *Próximas*, *Atrasadas*, *Sin notificar*).
  - **Calendario Semanal** (7 columnas con creación directa por día).
  - **Calendario Mensual** (grilla 7×6 con marcadores visuales `:has()` y panel del día seleccionado).
- **Buscador y filtros** por estado (`Programada`, `Confirmada`, `En consulta`, `Completada`, `No asistió`, `Cancelada`), tipo de cita y veterinario.
- **Modal Agendar / Editar Cita** con autocompletado de pacientes existentes desde Historias Clínicas o registro de paciente nuevo, más **alerta en vivo de empalme de horario**.
- **Recordatorios para el Propietario**: WhatsApp (`wa.me` configurado para **México +52**), Correo (`mailto:`), descarga **`.ics` (RFC 5545)**, **Google Calendar**, plantilla editable y marca persistente de **Recordatorio enviado con fecha y hora**.
- **Recordatorios para el Veterinario**: contador de citas hoy/atrasadas en navegación, bandeja de alertas, **Notification API** opt-in con permiso explícito y exportación `.ics`.
- **Integración clínica bidireccional**: botón **Atender / Historia** que cambia automáticamente la cita a *En consulta*, precarga los datos en el formulario clínico y ofrece marcarla como *Completada* al guardar; y botón **Cita** desde Historias Clínicas.

### 3. Historias Clínicas (Formato Oficial VETCO de 2 Páginas)
- Formulario completo de **8 secciones** fiel al formato físico VETCO (Encabezado, Propietario/Paciente con cálculo de edad, Anamnésicos, Motivo, Examen Clínico, 12 Órganos y Sistemas con `N / AN / NE` y alerta visual `:has()` para hallazgos `AN`, Lista de Problemas y Diferenciales, 15 Exámenes Complementarios, Diagnóstico Final, Tratamientos y Médico).
- Autoguardado de borrador, vista rápida, duplicar control y **hoja de impresión oficial VETCO de 2 páginas** protegida en `@layer print` (`color-scheme: light !important`) contra cualquier tema activo.

### 4. Apariencia, Persistencia y Accesibilidad
- **3 temas visuales**: **Oscuro** (por defecto), **Blanco / Claro** y **Morado (Fase Beta)** con contraste WCAG AA.
- **App Shell responsivo**: sidebar fija y colapsable en escritorio + barra de navegación inferior táctil (`>= 48px`) en móvil y tableta.
- **Respaldos JSON v2 retrocompatibles con v1** (`localStorage` preserva historias clínicas previas e incluye 3 historias + 5 citas demo realistas).

## Arquitectura de archivos

```text
vetco/
├── index.html
├── README.md
├── css/
│   ├── tokens.css        # @layer, tokens semánticos, 3 temas, clamp()
│   ├── layout.css        # App Shell (sidebar colapsable, topbar, bottom-nav)
│   ├── components.css    # Botones, KPIs (subgrid), tablas (@container), modales, toasts
│   ├── modules.css       # Dashboard, Agenda (4 vistas), formulario clínico (:has())
│   ├── print.css         # @media print sagrado (2 páginas oficiales VETCO)
│   └── styles.css        # Punto de entrada de compatibilidad
└── js/
    ├── demo-data.js      # Catálogos y datos demo (México +52)
    ├── storage.js        # Persistencia localStorage retrocompatible y backup JSON v1/v2
    ├── accessibility.js  # :user-invalid, light-dismiss dialog, toasts popover, temas
    ├── reminders.js      # WhatsApp, mailto, generador .ics, Google Calendar, Notification API
    ├── appointments.js   # Módulo completo de Agenda y Citas (4 vistas + modales)
    └── app.js            # Orquestador del App Shell, Dashboard, Historias e Impresión
```

## Cómo ejecutarlo localmente

1. Abre `index.html` directamente en tu navegador, o
2. Con **XAMPP**, accede a `http://localhost/vetco/`.
3. Para publicar en **GitHub Pages**, sube esta carpeta a tu repositorio y activa **Settings → Pages → Deploy from a branch (`main` / `root`)**.
