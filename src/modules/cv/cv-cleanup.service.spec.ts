import { AppEnv } from '../../config/env.validation';
import { CvCleanupService, CLEANUP_INTERVAL_MS } from './cv-cleanup.service';

const HOUR = 3_600_000;

function build(env: Partial<AppEnv>) {
  const service = new CvCleanupService({} as never, {} as never, { CV_CLEANUP_ENABLED: false, CV_ORPHAN_TTL_HOURS: 24, ...env } as AppEnv);
  const purge = jest.spyOn(service, 'purgeOrphans').mockResolvedValue(0);
  return { service, purge };
}

describe('CvCleanupService (programación)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('apagada: no programa nada (es lo normal en local y en los tests)', () => {
    const { service, purge } = build({ CV_CLEANUP_ENABLED: false });
    service.onModuleInit();
    jest.advanceTimersByTime(CLEANUP_INTERVAL_MS * 3);
    expect(purge).not.toHaveBeenCalled();
    service.onModuleDestroy();
  });

  it('encendida: limpia cada hora los CV más viejos que el plazo configurado', () => {
    jest.setSystemTime(new Date('2026-11-11T12:00:00Z'));
    const { service, purge } = build({ CV_CLEANUP_ENABLED: true, CV_ORPHAN_TTL_HOURS: 48 });
    service.onModuleInit();
    jest.advanceTimersByTime(CLEANUP_INTERVAL_MS);
    expect(purge).toHaveBeenCalledTimes(1);
    const cutoff = purge.mock.calls[0][0];
    expect(cutoff.getTime()).toBe(new Date('2026-11-11T13:00:00Z').getTime() - 48 * HOUR);
    service.onModuleDestroy();
  });

  it('al apagar la app libera el temporizador: no queda nada corriendo', () => {
    const { service, purge } = build({ CV_CLEANUP_ENABLED: true });
    service.onModuleInit();
    service.onModuleDestroy();
    jest.advanceTimersByTime(CLEANUP_INTERVAL_MS * 5);
    expect(purge).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('un error al limpiar no tira la app ni corta la programación', async () => {
    const { service, purge } = build({ CV_CLEANUP_ENABLED: true });
    purge.mockRejectedValueOnce(new Error('base caída para 38412907')).mockResolvedValue(0);
    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(CLEANUP_INTERVAL_MS * 2);
    expect(purge).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
  });
});
