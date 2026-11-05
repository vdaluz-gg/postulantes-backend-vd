import { Logger } from '@nestjs/common';
import { AppEnv } from '../../config/env.validation';
import { DniDataInput, IdentityValidationProvider, VerificationOutcome } from './ports/identity-validation-provider';

/**
 * Esqueleto del proveedor real (RENAPER SID). Todavía no hay credenciales ni contrato de la API: por eso falla
 * de forma explícita en vez de inventar endpoints. Los pasos para completarlo están en docs/renaper-integracion.md.
 */
export class RenaperSidProvider implements IdentityValidationProvider {
  readonly name = 'renaper-sid';
  private readonly logger = new Logger(RenaperSidProvider.name);

  constructor(private readonly env: Pick<AppEnv, 'RENAPER_BASE_URL' | 'RENAPER_CLIENT_ID' | 'RENAPER_CLIENT_SECRET'>) {}

  async verifyDniData(_input: DniDataInput): Promise<VerificationOutcome> {
    // Pendiente: 1) autenticar con RENAPER_CLIENT_ID/SECRET, 2) consultar la validación de datos del DNI,
    // 3) mapear la respuesta a VerificationOutcome. Con timeout y reintentos acotados.
    this.logger.warn(`Integración RENAPER pendiente (base: ${this.env.RENAPER_BASE_URL})`);
    throw new Error('Integración con RENAPER SID pendiente de implementar');
  }
}
