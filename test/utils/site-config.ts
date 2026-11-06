import { FieldType } from '../../src/modules/site-config/site-config.rules';

/** Configuración mínima válida, con la forma que manda el backoffice del front. */

type Field = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  visible: boolean;
  readonly: boolean;
  tone: string;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  validation?: Record<string, unknown>;
};

export const field = (id: string, label: string, type: FieldType = 'text', extra: Partial<Field> = {}): Field => ({
  id,
  label,
  type,
  required: false,
  visible: true,
  readonly: false,
  tone: 'neutral',
  ...extra,
});

export const coreApplicationFields = (): Field[] => [
  field('firstName', 'Nombre', 'text', { required: true, placeholder: 'Como figura en tu DNI' }),
  field('lastName', 'Apellido', 'text', { required: true, placeholder: 'Como figura en tu DNI' }),
  field('dni', 'DNI', 'text', { required: true }),
  field('email', 'Email', 'email', { required: true }),
  field('whatsapp', 'WhatsApp', 'tel', { required: true }),
  field('zone', 'Zona donde vivís', 'text', { required: true }),
  field('position', 'Puesto', 'text', { readonly: true, tone: 'section' }),
  field('cuil', 'CUIL', 'text', { placeholder: 'XX-XXXXXXXX-X' }),
];

const audience = (name: string, sections: unknown[] = []) => ({ audience: name, sections, documents: [], alerts: [], channels: [], copy: [] });

export const siteConfig = (applicationFields: Field[] = coreApplicationFields(), version = 1) => ({
  version,
  status: 'published',
  updatedAt: '2026-11-05T12:00:00.000Z',
  updatedBy: 'Configuración inicial',
  audiences: {
    postulantes: {
      ...audience('postulantes', [
        { id: 'application', title: 'Postulación', description: 'Datos de la portada.', screen: 'Portada · Postularme', fields: applicationFields },
      ]),
      copy: [{ id: 'title', label: 'Título', value: 'El trabajo de la Argentina, en movimiento.', multiline: false }],
    },
    clientes: audience('clientes'),
    colaboradores: audience('colaboradores'),
  },
});
