export interface DniDataInput {
  readonly dni: string;
  readonly fullName: string;
}

export interface VerificationOutcome {
  readonly result: 'verified' | 'rejected';
  /** Coincidencia 0–100 si el proveedor la informa. */
  readonly score?: number;
  readonly reason?: string;
}

/**
 * Puerto de validación de identidad. Lo cumple hoy un mock; mañana, RENAPER SID (ver docs/renaper-integracion.md).
 *
 * Las validaciones biométricas (huella y rostro) se declaran como opcionales: un proveedor que no las soporta no
 * las implementa y la API responde 501. Cuando se agreguen, las imágenes se envían al proveedor y NUNCA se
 * guardan en nuestra base: solo se persiste el resultado.
 */
export interface IdentityValidationProvider {
  readonly name: string;
  verifyDniData(input: DniDataInput): Promise<VerificationOutcome>;
  verifyFingerprint?(input: { dni: string; fingerprint: Buffer }): Promise<VerificationOutcome>;
  verifyFace?(input: { dni: string; selfie: Buffer }): Promise<VerificationOutcome>;
}

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
