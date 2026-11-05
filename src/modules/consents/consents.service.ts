import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RecordConsentsDto } from './dto/consent.dto';
import { Consent } from './entities/consent.entity';

@Injectable()
export class ConsentsService {
  constructor(@InjectRepository(Consent) private readonly consents: Repository<Consent>) {}

  /** Registra las decisiones de la persona. Es un historial: cada decisión nueva suma un registro. */
  async record(dto: RecordConsentsDto, userAgent?: string): Promise<{ recorded: number }> {
    const types = dto.decisions.map((d) => d.type);
    if (new Set(types).size !== types.length) throw new BadRequestException('Cada permiso se informa una sola vez');
    await this.consents.save(
      dto.decisions.map((d) =>
        this.consents.create({
          sessionId: dto.sessionId,
          candidateId: null,
          type: d.type,
          granted: d.granted,
          userAgent: userAgent?.slice(0, 255) ?? null,
        }),
      ),
    );
    return { recorded: dto.decisions.length };
  }

  /** Une los permisos anónimos de la sesión con el postulante, al postularse. */
  async linkSession(sessionId: string, candidateId: string, repo: Repository<Consent> = this.consents): Promise<void> {
    await repo.update({ sessionId, candidateId: IsNull() }, { candidateId });
  }
}
