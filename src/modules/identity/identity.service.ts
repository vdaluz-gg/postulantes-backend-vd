import { BadGatewayException, Inject, Injectable, Logger, NotFoundException, NotImplementedException } from '@nestjs/common';
import { errorForLog } from '../../common/utils/redact';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from '../candidates/entities/candidate.entity';
import { IdentityVerification, VerificationKind } from './entities/identity-verification.entity';
import { IDENTITY_PROVIDER, IdentityValidationProvider } from './ports/identity-validation-provider';

export interface IdentityVerificationDto {
  id: string;
  kind: VerificationKind;
  provider: string;
  result: string;
  score: number | null;
  reason: string | null;
  createdAt: Date;
}

const toDto = (v: IdentityVerification): IdentityVerificationDto => ({
  id: v.id,
  kind: v.kind,
  provider: v.provider,
  result: v.result,
  score: v.score,
  reason: v.reason,
  createdAt: v.createdAt,
});

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    @InjectRepository(IdentityVerification) private readonly verifications: Repository<IdentityVerification>,
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
    @Inject(IDENTITY_PROVIDER) private readonly provider: IdentityValidationProvider,
  ) {}

  private async loadCandidate(id: string): Promise<Candidate> {
    const c = await this.candidates.findOneBy({ id });
    if (!c) throw new NotFoundException('Postulante no encontrado');
    return c;
  }

  async history(candidateId: string): Promise<IdentityVerificationDto[]> {
    await this.loadCandidate(candidateId);
    const rows = await this.verifications.find({ where: { candidateId }, order: { createdAt: 'DESC' } });
    return rows.map(toDto);
  }

  async verify(candidateId: string, kind: VerificationKind): Promise<IdentityVerificationDto> {
    const candidate = await this.loadCandidate(candidateId);
    // Las validaciones biométricas se suman cuando el proveedor las soporte (ver el puerto).
    if (kind !== 'dni_data') throw new NotImplementedException('Esta validación todavía no está disponible');

    try {
      const outcome = await this.provider.verifyDniData({ dni: candidate.dni, fullName: candidate.fullName });
      const saved = await this.verifications.save(
        this.verifications.create({
          candidateId,
          kind,
          provider: this.provider.name,
          result: outcome.result,
          score: outcome.score ?? null,
          reason: outcome.reason ?? null,
        }),
      );
      candidate.identityStatus = outcome.result;
      await this.candidates.save(candidate);
      return toDto(saved);
    } catch (e) {
      this.logger.error(`Falló la validación de identidad (${this.provider.name}): ${errorForLog(e)}`);
      // Queda constancia del intento, sin copiar el detalle del proveedor (puede traer datos sensibles).
      await this.verifications.save(
        this.verifications.create({ candidateId, kind, provider: this.provider.name, result: 'error', score: null, reason: 'Error del proveedor' }),
      );
      throw new BadGatewayException('No pudimos consultar el servicio de identidad. Probá de nuevo más tarde');
    }
  }
}
