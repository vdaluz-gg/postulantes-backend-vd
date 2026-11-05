import { Injectable } from '@nestjs/common';
import { DniDataInput, IdentityValidationProvider, VerificationOutcome } from './ports/identity-validation-provider';

/**
 * Mock para desarrollo y pruebas. Regla simple y predecible: un DNI que termina en 0 se rechaza; cualquier otro
 * se da por verificado. Sirve para probar los dos caminos desde el backoffice.
 */
@Injectable()
export class MockIdentityProvider implements IdentityValidationProvider {
  readonly name = 'mock';

  async verifyDniData(input: DniDataInput): Promise<VerificationOutcome> {
    return input.dni.endsWith('0')
      ? { result: 'rejected', score: 12, reason: 'Los datos no coinciden con el registro (simulado)' }
      : { result: 'verified', score: 98 };
  }
}
