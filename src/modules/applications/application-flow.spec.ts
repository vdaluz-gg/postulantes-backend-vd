import { buildSteps, canTransition, generateTrackingCode, isFinalStatus, TRACKING_CODE_PATTERN } from './application-flow';

describe('canTransition', () => {
  it('permite avanzar en el circuito, incluso saltando etapas', () => {
    expect(canTransition('received', 'ai_review')).toBe(true);
    expect(canTransition('ai_review', 'interview')).toBe(true);
    expect(canTransition('interview', 'hired')).toBe(true);
  });

  it('no permite retroceder ni repetir el estado', () => {
    expect(canTransition('interview', 'received')).toBe(false);
    expect(canTransition('recruiter_review', 'ai_review')).toBe(false);
    expect(canTransition('received', 'received')).toBe(false);
  });

  it('permite rechazar o dar de baja desde cualquier estado no final', () => {
    for (const from of ['received', 'ai_review', 'recruiter_review', 'interview'] as const) {
      expect(canTransition(from, 'rejected')).toBe(true);
      expect(canTransition(from, 'withdrawn')).toBe(true);
    }
  });

  it('los estados finales no se pueden cambiar', () => {
    for (const from of ['hired', 'rejected', 'withdrawn'] as const) {
      expect(isFinalStatus(from)).toBe(true);
      expect(canTransition(from, 'interview')).toBe(false);
      expect(canTransition(from, 'rejected')).toBe(false);
    }
  });
});

describe('buildSteps', () => {
  it('marca hecho / actual / siguiente según la etapa', () => {
    expect(buildSteps('ai_review')).toEqual([
      { label: 'Postulación', state: 'done' },
      { label: 'Agente IA', state: 'now' },
      { label: 'Selectora', state: 'next' },
      { label: 'Resultado', state: 'next' },
    ]);
  });

  it('entrevista cuenta como etapa Selectora', () => {
    expect(buildSteps('interview').map((s) => s.state)).toEqual(['done', 'done', 'now', 'next']);
  });

  it('contratado completa todo; rechazado y baja marcan el resultado', () => {
    expect(buildSteps('hired').map((s) => s.state)).toEqual(['done', 'done', 'done', 'done']);
    expect(buildSteps('rejected').map((s) => s.state)).toEqual(['done', 'done', 'done', 'bad']);
    expect(buildSteps('withdrawn')[3].state).toBe('bad');
  });
});

describe('generateTrackingCode', () => {
  it('genera códigos con el formato esperado y sin caracteres ambiguos', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateTrackingCode();
      expect(code).toMatch(TRACKING_CODE_PATTERN);
      expect(code).not.toMatch(/[01OIl]/);
    }
  });

  it('no repite en una tanda razonable', () => {
    const set = new Set(Array.from({ length: 500 }, generateTrackingCode));
    expect(set.size).toBe(500);
  });
});
