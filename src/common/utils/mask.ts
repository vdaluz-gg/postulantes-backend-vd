const stars = (n: number): string => '*'.repeat(Math.max(0, n));

/** DNI para listados: solo los últimos 4 dígitos. El valor completo se ve en el detalle de cada persona. */
export function maskDni(dni: string): string {
  const d = dni.replace(/\D/g, '');
  if (d.length <= 4) return stars(d.length);
  return stars(d.length - 4) + d.slice(-4);
}

/** WhatsApp para listados: prefijo +54 y últimos 4 dígitos. */
export function maskWhatsapp(whatsapp: string): string {
  if (whatsapp.length <= 4) return stars(whatsapp.length);
  if (whatsapp.startsWith('+54')) return `+54${stars(whatsapp.length - 7)}${whatsapp.slice(-4)}`;
  return stars(whatsapp.length - 4) + whatsapp.slice(-4);
}

/** CUIL para listados: el del medio es el DNI, así que se aplica la misma regla (últimos 4 dígitos del DNI). */
export function maskCuil(cuil: string | null): string | null {
  if (cuil === null) return null;
  const d = cuil.replace(/\D/g, '');
  if (d.length !== 11) return '***';
  return `**-${maskDni(d.slice(2, 10))}-*`;
}
