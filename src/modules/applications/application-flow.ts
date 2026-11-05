import { randomInt } from 'crypto';
import { ApplicationStatus, STATUS_STAGE } from './entities/application.entity';

/** Orden del circuito principal; rechazo y baja se pueden dar desde cualquier estado no final. */
const FLOW: readonly ApplicationStatus[] = ['received', 'ai_review', 'recruiter_review', 'interview', 'hired'];
const FINAL: readonly ApplicationStatus[] = ['hired', 'rejected', 'withdrawn'];

export const isFinalStatus = (s: ApplicationStatus): boolean => FINAL.includes(s);

/** Se puede avanzar (aun saltando etapas), rechazar o dar de baja; no retroceder, repetir ni tocar un estado final. */
export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (isFinalStatus(from) || from === to) return false;
  if (to === 'rejected' || to === 'withdrawn') return true;
  return FLOW.indexOf(to) > FLOW.indexOf(from);
}

export const STAGE_LABELS = ['Postulación', 'Agente IA', 'Selectora', 'Resultado'] as const;
export type StepState = 'done' | 'now' | 'next' | 'bad';

/** Pasos del seguimiento (los 4 del portal) con su estado. */
export function buildSteps(status: ApplicationStatus): { label: string; state: StepState }[] {
  const stage = STATUS_STAGE[status];
  return STAGE_LABELS.map((label, i) => {
    const step = i + 1;
    if (step === 4 && stage === 4) return { label, state: status === 'hired' ? 'done' : 'bad' };
    if (step < stage) return { label, state: 'done' };
    return { label, state: step === stage ? 'now' : 'next' };
  });
}

/** Sin 0/1/O/I para que no se confundan al leerlos o dictarlos. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const TRACKING_CODE_PATTERN = /^GG-[2-9A-HJ-NP-Z]{6}$/;

/** Código de seguimiento (GG-7K2M9Q) generado con aleatoriedad criptográfica. */
export function generateTrackingCode(): string {
  let code = 'GG-';
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}
