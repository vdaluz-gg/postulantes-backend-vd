import { JobOfferSeed } from './seed.types';

/** Ofertas de ejemplo: las mismas del mock del front, con la ficha interna separada de lo publicable. */
export const OFFERS_SEED: readonly JobOfferSeed[] = [
  {
    code: 'CSYP1233113446',
    title: 'Operario/a Pan 29',
    description: 'Importante empresa dedicada a la digitalización de archivos, ubicada en la zona de Garín, se encuentra en la búsqueda de sumar operarios as de carga y descarga Tareas a realizar: Tareas de recepción, preparación de pedidos, movimiento de mercadería y tareas generales de depósito logística. Jornada de trabajo: Martes 24 06 a las 12hs hasta las 18hs. Lugar de trabajo: Gral. Pacheco. Se liquida finalizado el mes. ¡Aguardamos tu postulación en caso de interesarte',
    zoneName: 'Gral. Pacheco',
    area: 'Logística',
    schedule: 'Martes 24/06 · 12 a 18 h',
    publishedAt: '2026-11-04',
    requirements: [
      'Disponibilidad para la jornada del martes 24/06',
      'Sin experiencia obligatoria'
    ],
    benefits: [
      'Pago al finalizar el mes'
    ],
    vacancies: 1,
    salary: 912359,
    address: '9 de Julio 1450, El Talar Argentina',
    radiusKm: 20,
    internal: {
      client: 'BANK SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Industrial / Tecnica / Produccion',
      positionId: 83,
      type: 'Temporarios',
      scope: 'No Calificados',
      priority: 'ALTA',
      searchTypeId: 2,
      modalityId: 1,
      hierarchyId: 1,
      collectiveAgreement: 'MAESTRANZA Y LIMPIEZA (Bs.As/Cap Fed)-CCT 281/96',
      branch: 'Empleados - Jornada completa',
      category: 'Oficial',
      experienceRequired: false,
      reinstatableDismissal: false,
      requiresUniform: false,
      preEmploymentExam: false,
      clientNotes: 'Pedido del cliente: eventuales Pan 29.'
    }
  },
  {
    code: 'LOG7712093',
    title: 'Chofer de camión chasis',
    description: 'Reparto de mercadería en camión chasis por zona oeste y CABA, con carga y descarga en clientes.',
    zoneName: 'Moreno / Parque Avellaneda',
    area: 'Logística',
    schedule: 'Lunes a viernes · 6 a 15 h',
    publishedAt: '2026-10-07',
    requirements: [
      'Licencia profesional vigente',
      'Experiencia en reparto (deseable)',
      'Disponibilidad inmediata'
    ],
    benefits: [
      'Obra social',
      'Viáticos',
      'Continuidad'
    ],
    vacancies: 3,
    salary: 1185000,
    address: 'Av. Victorica 1520, Moreno',
    radiusKm: 15,
    internal: {
      client: 'CLIENTE DEMO 01 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Logistica / Distribucion / Transporte',
      positionId: 100,
      type: 'Temporarios',
      scope: 'Calificados',
      priority: 'ALTA',
      searchTypeId: 2,
      modalityId: 1,
      hierarchyId: 1,
      collectiveAgreement: 'CAMIONEROS - CCT 40/89',
      branch: 'Choferes - Jornada completa',
      category: 'Chofer de 1ra',
      experienceRequired: false,
      reinstatableDismissal: false,
      requiresUniform: true,
      preEmploymentExam: true,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 07/10).'
    }
  },
  {
    code: 'IND3307418',
    title: 'Operario/a de producción · Feteados',
    description: 'Operación de líneas de feteado y envasado en planta de alimentos. Control de calidad básico y cumplimiento de BPM.',
    zoneName: 'Monte Grande',
    area: 'Industria',
    schedule: 'Turno tarde · 14 a 22 h',
    publishedAt: '2026-10-15',
    requirements: [
      'Secundario completo',
      'Experiencia en producción o alimentos',
      'Disponibilidad para turno tarde'
    ],
    benefits: [
      'Comedor en planta',
      'Transporte desde estación',
      'Posibilidad de efectivización'
    ],
    vacancies: 6,
    salary: 948000,
    address: 'Av. Fair 980, Monte Grande',
    radiusKm: 20,
    internal: {
      client: 'CLIENTE DEMO 02 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Industrial / Tecnica / Produccion',
      positionId: 101,
      type: 'Temporarios',
      scope: 'No Calificados',
      priority: 'ALTA',
      searchTypeId: 2,
      modalityId: 1,
      hierarchyId: 1,
      collectiveAgreement: 'ALIMENTACION - CCT 244/94',
      branch: 'Operarios - Turno tarde',
      category: 'Operario',
      experienceRequired: true,
      reinstatableDismissal: false,
      requiresUniform: true,
      preEmploymentExam: true,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 15/10).'
    }
  },
  {
    code: 'COM5520841',
    title: 'Auditor/a de canal masivo',
    description: 'Relevamiento de precios, góndolas y exhibiciones en comercios del canal masivo.',
    zoneName: 'Corrientes Capital',
    area: 'Comercial',
    schedule: 'Lunes a viernes · 9 a 17 h',
    publishedAt: '2026-10-10',
    requirements: [
      'Movilidad propia (deseable)',
      'Manejo de celular y apps',
      'Buena comunicación'
    ],
    benefits: [
      'Celular corporativo',
      'Viáticos'
    ],
    vacancies: 2,
    salary: 1020000,
    address: 'Av. 3 de Abril 1150, Corrientes',
    radiusKm: 25,
    internal: {
      client: 'CLIENTE DEMO 03 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Comercial / Ventas',
      positionId: 102,
      type: 'Efectivos',
      scope: 'Calificados',
      priority: 'MEDIA',
      searchTypeId: 1,
      modalityId: 1,
      hierarchyId: 1,
      collectiveAgreement: 'EMPLEADOS DE COMERCIO - CCT 130/75',
      branch: 'Empleados - Jornada completa',
      category: 'Vendedor B',
      experienceRequired: false,
      reinstatableDismissal: false,
      requiresUniform: false,
      preEmploymentExam: false,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 10/10).'
    }
  },
  {
    code: 'LOG8803174',
    title: 'Maquinista de apiladora y autoelevador',
    description: 'Operación de autoelevador y apiladora en depósito: carga, descarga y ubicación de pallets.',
    zoneName: 'Monte Grande',
    area: 'Logística',
    schedule: 'Rotativo · 3 turnos',
    publishedAt: '2026-10-12',
    requirements: [
      'Carnet de autoelevador vigente',
      '1 año de experiencia',
      'Disponibilidad horaria'
    ],
    benefits: [
      'Plus por turno noche',
      'Obra social'
    ],
    vacancies: 2,
    salary: 1110000,
    address: 'Camino de Cintura 4200, Monte Grande',
    radiusKm: 15,
    internal: {
      client: 'CLIENTE DEMO 04 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Logistica / Distribucion / Transporte',
      positionId: 103,
      type: 'Temporarios',
      scope: 'Calificados',
      priority: 'ALTA',
      searchTypeId: 2,
      modalityId: 1,
      hierarchyId: 1,
      collectiveAgreement: 'CAMIONEROS - CCT 40/89',
      branch: 'Operarios - Turnos rotativos',
      category: 'Maquinista',
      experienceRequired: true,
      reinstatableDismissal: false,
      requiresUniform: true,
      preEmploymentExam: true,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 12/10).'
    }
  },
  {
    code: 'ADM5523105',
    title: 'Analista de pago a proveedores',
    description: 'Gestión de pagos a proveedores, conciliaciones y carga en SAP.',
    zoneName: 'Tortuguitas',
    area: 'Administración',
    schedule: 'Lunes a viernes · 8 a 17 h',
    publishedAt: '2026-10-08',
    requirements: [
      'Estudiante o graduado/a en Ciencias Económicas',
      'Manejo de SAP',
      'Excel intermedio'
    ],
    benefits: [
      'Esquema híbrido',
      'Obra social'
    ],
    vacancies: 1,
    salary: 1350000,
    address: 'Ruta 8 km 39, Tortuguitas',
    radiusKm: 30,
    internal: {
      client: 'CLIENTE DEMO 05 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Administracion / Finanzas',
      positionId: 104,
      type: 'Efectivos',
      scope: 'Profesionales',
      priority: 'MEDIA',
      searchTypeId: 1,
      modalityId: 2,
      hierarchyId: 2,
      collectiveAgreement: 'EMPLEADOS DE COMERCIO - CCT 130/75',
      branch: 'Empleados - Jornada completa',
      category: 'Administrativo A',
      experienceRequired: false,
      reinstatableDismissal: false,
      requiresUniform: false,
      preEmploymentExam: false,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 08/10).'
    }
  },
  {
    code: 'RRH5512135',
    title: 'Responsable de Recursos Humanos',
    description: 'Liderar los procesos de RR. HH. de la sede: selección, relaciones laborales y liquidación.',
    zoneName: 'Salta',
    area: 'RR. HH.',
    schedule: 'Jornada completa',
    publishedAt: '2026-10-06',
    requirements: [
      'Licenciatura en RR. HH. o afines',
      '3 años de experiencia',
      'Liderazgo de equipos'
    ],
    benefits: [
      'Prepaga',
      'Bono anual'
    ],
    vacancies: 1,
    salary: 2250000,
    address: 'Av. Belgrano 1400, Salta',
    radiusKm: 20,
    internal: {
      client: 'CLIENTE DEMO 06 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Recursos Humanos',
      positionId: 105,
      type: 'Efectivos',
      scope: 'Profesionales',
      priority: 'MEDIA',
      searchTypeId: 1,
      modalityId: 1,
      hierarchyId: 3,
      collectiveAgreement: 'Fuera de convenio',
      branch: 'Jefaturas - Jornada completa',
      category: 'Jefatura',
      experienceRequired: true,
      reinstatableDismissal: false,
      requiresUniform: false,
      preEmploymentExam: true,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 06/10).'
    }
  },
  {
    code: 'IND3640414',
    title: 'Operario/a metalúrgico',
    description: 'Operación de prensas y plegadoras en planta metalúrgica.',
    zoneName: 'Villa Maipú',
    area: 'Industria',
    schedule: 'Turno mañana · 6 a 14 h',
    publishedAt: '2026-10-15',
    requirements: [
      'Experiencia en metalúrgica',
      'Lectura de planos (deseable)',
      'Secundario completo'
    ],
    benefits: [
      'Comedor en planta',
      'Ropa de trabajo'
    ],
    vacancies: 4,
    salary: 1060000,
    address: 'Av. Marconi 2350, Villa Maipú',
    radiusKm: 20,
    internal: {
      client: 'CLIENTE DEMO 07 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Industrial / Tecnica / Produccion',
      positionId: 106,
      type: 'Temporarios',
      scope: 'Calificados',
      priority: 'ALTA',
      searchTypeId: 2,
      modalityId: 1,
      hierarchyId: 1,
      collectiveAgreement: 'UOM RAMA METALMECANICA - CCT 260/75',
      branch: 'Operarios - Turno mañana',
      category: 'Oficial',
      experienceRequired: true,
      reinstatableDismissal: false,
      requiresUniform: true,
      preEmploymentExam: true,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 15/10).'
    }
  },
  {
    code: 'COM5844162',
    title: 'Jefe/a de Ventas',
    description: 'Conducción del equipo de ventas, objetivos y desarrollo de cartera en CABA.',
    zoneName: 'CABA',
    area: 'Comercial',
    schedule: 'Jornada completa',
    publishedAt: '2026-10-07',
    requirements: [
      'Experiencia liderando equipos comerciales',
      'Orientación a resultados',
      'Disponibilidad para viajar'
    ],
    benefits: [
      'Auto',
      'Comisiones',
      'Prepaga'
    ],
    vacancies: 1,
    salary: 2600000,
    address: 'Av. Córdoba 3100, CABA',
    radiusKm: 30,
    internal: {
      client: 'CLIENTE DEMO 08 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Comercial / Ventas',
      positionId: 107,
      type: 'Efectivos',
      scope: 'Profesionales',
      priority: 'BAJA',
      searchTypeId: 1,
      modalityId: 2,
      hierarchyId: 3,
      collectiveAgreement: 'Fuera de convenio',
      branch: 'Jefaturas - Jornada completa',
      category: 'Jefatura',
      experienceRequired: true,
      reinstatableDismissal: false,
      requiresUniform: false,
      preEmploymentExam: false,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 07/10).'
    }
  },
  {
    code: 'COM6012450',
    title: 'Repositor/a de supermercado',
    description: 'Reposición de góndolas, control de vencimientos y armado de exhibiciones en hipermercado.',
    zoneName: 'Pilar',
    area: 'Comercial',
    schedule: 'Lunes a sábados · turnos rotativos',
    publishedAt: '2026-10-20',
    requirements: [
      'Secundario completo',
      'Disponibilidad horaria',
      'Experiencia en reposición (deseable)'
    ],
    benefits: [
      'Capacitación paga',
      'Descuentos en comercios'
    ],
    vacancies: 8,
    salary: 905000,
    address: 'Panamericana km 50, Pilar',
    radiusKm: 20,
    internal: {
      client: 'CLIENTE DEMO 09 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Comercial / Ventas',
      positionId: 108,
      type: 'Temporarios',
      scope: 'No Calificados',
      priority: 'ALTA',
      searchTypeId: 2,
      modalityId: 1,
      hierarchyId: 1,
      collectiveAgreement: 'EMPLEADOS DE COMERCIO - CCT 130/75',
      branch: 'Empleados - Turnos rotativos',
      category: 'Maestranza B',
      experienceRequired: false,
      reinstatableDismissal: false,
      requiresUniform: true,
      preEmploymentExam: false,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 20/10).'
    }
  },
  {
    code: 'ADM6034471',
    title: 'Analista de liquidación de sueldos',
    description: 'Liquidación mensual de sueldos, cargas sociales y atención de consultas de colaboradores.',
    zoneName: 'Palermo, CABA',
    area: 'Administración',
    schedule: 'Lunes a viernes · 9 a 18 h',
    publishedAt: '2026-10-19',
    requirements: [
      'Experiencia en liquidación',
      'Conocimiento de convenios',
      'Excel avanzado'
    ],
    benefits: [
      'Esquema híbrido',
      'Prepaga'
    ],
    vacancies: 1,
    salary: 1420000,
    address: 'Av. Santa Fe 4200, Palermo, CABA',
    radiusKm: 25,
    internal: {
      client: 'CLIENTE DEMO 10 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Administracion / Finanzas',
      positionId: 109,
      type: 'Efectivos',
      scope: 'Profesionales',
      priority: 'MEDIA',
      searchTypeId: 1,
      modalityId: 2,
      hierarchyId: 2,
      collectiveAgreement: 'EMPLEADOS DE COMERCIO - CCT 130/75',
      branch: 'Empleados - Jornada completa',
      category: 'Administrativo A',
      experienceRequired: true,
      reinstatableDismissal: false,
      requiresUniform: false,
      preEmploymentExam: false,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 19/10).'
    }
  },
  {
    code: 'IND6045512',
    title: 'Operario/a de planta de alimentos',
    description: 'Operación de líneas de producción en planta de alimentos, con control de calidad y BPM.',
    zoneName: 'Esteban Echeverría',
    area: 'Industria',
    schedule: 'Turno mañana · 6 a 14 h',
    publishedAt: '2026-10-21',
    requirements: [
      'Secundario completo',
      'Disponibilidad para turnos rotativos'
    ],
    benefits: [
      'Comedor en planta',
      'Ropa de trabajo'
    ],
    vacancies: 10,
    salary: 960000,
    address: 'Camino de Cintura 7800, Esteban Echeverría',
    radiusKm: 20,
    internal: {
      client: 'CLIENTE DEMO 11 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Industrial / Tecnica / Produccion',
      positionId: 110,
      type: 'Temporarios',
      scope: 'No Calificados',
      priority: 'ALTA',
      searchTypeId: 2,
      modalityId: 1,
      hierarchyId: 1,
      collectiveAgreement: 'ALIMENTACION - CCT 244/94',
      branch: 'Operarios - Turno mañana',
      category: 'Operario',
      experienceRequired: false,
      reinstatableDismissal: false,
      requiresUniform: true,
      preEmploymentExam: true,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 21/10).'
    }
  },
  {
    code: 'ADM6051903',
    title: 'Asistente administrativo/a',
    description: 'Atención telefónica, agenda, carga de facturas y apoyo administrativo a la gerencia.',
    zoneName: 'San Isidro',
    area: 'Administración',
    schedule: 'Lunes a viernes · 9 a 17 h',
    publishedAt: '2026-10-18',
    requirements: [
      'Estudios secundarios',
      'Manejo de paquete Office',
      'Buena comunicación'
    ],
    benefits: [
      'Obra social',
      'Horario flexible'
    ],
    vacancies: 1,
    salary: 980000,
    address: 'Av. Centenario 450, San Isidro',
    radiusKm: 20,
    internal: {
      client: 'CLIENTE DEMO 12 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Administracion / Finanzas',
      positionId: 111,
      type: 'Efectivos',
      scope: 'No Calificados',
      priority: 'MEDIA',
      searchTypeId: 1,
      modalityId: 1,
      hierarchyId: 1,
      collectiveAgreement: 'EMPLEADOS DE COMERCIO - CCT 130/75',
      branch: 'Empleados - Jornada completa',
      category: 'Administrativo B',
      experienceRequired: false,
      reinstatableDismissal: false,
      requiresUniform: false,
      preEmploymentExam: false,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 18/10).'
    }
  },
  {
    code: 'LOG6066320',
    title: 'Chofer de reparto utilitario',
    description: 'Reparto de pedidos en utilitario por zona sur, con rendición de cobranzas.',
    zoneName: 'Quilmes',
    area: 'Logística',
    schedule: 'Lunes a sábados · 7 a 16 h',
    publishedAt: '2026-10-17',
    requirements: [
      'Licencia de conducir vigente',
      'Conocimiento de la zona sur'
    ],
    benefits: [
      'Viáticos',
      'Obra social'
    ],
    vacancies: 3,
    salary: 1090000,
    address: 'Av. Calchaquí 3000, Quilmes',
    radiusKm: 25,
    internal: {
      client: 'CLIENTE DEMO 13 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Logistica / Distribucion / Transporte',
      positionId: 112,
      type: 'Temporarios',
      scope: 'Calificados',
      priority: 'ALTA',
      searchTypeId: 2,
      modalityId: 1,
      hierarchyId: 1,
      collectiveAgreement: 'CAMIONEROS - CCT 40/89',
      branch: 'Choferes - Jornada completa',
      category: 'Chofer de 2da',
      experienceRequired: false,
      reinstatableDismissal: false,
      requiresUniform: true,
      preEmploymentExam: true,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 17/10).'
    }
  },
  {
    code: 'COM6070245',
    title: 'Vendedor/a de salón',
    description: 'Atención de clientes en salón, asesoramiento y cierre de ventas con objetivos mensuales.',
    zoneName: 'Rosario',
    area: 'Comercial',
    schedule: 'Jornada completa',
    publishedAt: '2026-10-16',
    requirements: [
      'Experiencia en ventas',
      'Orientación al cliente'
    ],
    benefits: [
      'Comisiones',
      'Capacitación continua'
    ],
    vacancies: 2,
    salary: 1015000,
    address: 'Calle Córdoba 1200, Rosario',
    radiusKm: 15,
    internal: {
      client: 'CLIENTE DEMO 14 SA',
      managingCompany: 'GESTION INTEGRAL S.A.',
      businessArea: 'Comercial / Ventas',
      positionId: 113,
      type: 'Efectivos',
      scope: 'Calificados',
      priority: 'MEDIA',
      searchTypeId: 1,
      modalityId: 1,
      hierarchyId: 1,
      collectiveAgreement: 'EMPLEADOS DE COMERCIO - CCT 130/75',
      branch: 'Empleados - Jornada completa',
      category: 'Vendedor B',
      experienceRequired: true,
      reinstatableDismissal: false,
      requiresUniform: false,
      preEmploymentExam: false,
      clientNotes: 'Oferta de ejemplo para pruebas del portal (publicada el 16/10).'
    }
  }
];
