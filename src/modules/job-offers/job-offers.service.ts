import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coordinate, distanceKm } from '../../common/utils/geo';
import { paginate } from '../../common/pagination';
import { ListJobOffersQueryDto, NearbyJobOffersQueryDto } from './dto/job-offer-query.dto';
import { OfferFiltersDto, PublicJobPostingDto, PublicOffersPageDto, toPublicPosting } from './dto/public-job-posting.dto';
import { JobOffer } from './entities/job-offer.entity';
import { searchOffers } from './job-search';

interface Candidate {
  offer: JobOffer;
  distanceKm?: number;
  /** Campos sobre los que se busca texto. */
  title: string;
  description: string;
  area: string;
  zone: string;
  requirements: string[];
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

@Injectable()
export class JobOffersService {
  constructor(@InjectRepository(JobOffer) private readonly offers: Repository<JobOffer>) {}

  /** Ofertas publicadas, de la más reciente a la más antigua. Todo valor del usuario va como parámetro. */
  private async published(filters: { area?: string; zoneId?: string } = {}): Promise<JobOffer[]> {
    const qb = this.offers
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.zone', 'z')
      .where('o.status = :status', { status: 'published' })
      .orderBy('o.publishedAt', 'DESC')
      .addOrderBy('o.code', 'ASC');
    if (filters.area) qb.andWhere('o.area = :area', { area: filters.area });
    if (filters.zoneId) qb.andWhere('o.zoneId = :zoneId', { zoneId: filters.zoneId });
    return qb.getMany();
  }

  private toCandidate(offer: JobOffer, origin?: Coordinate): Candidate {
    const lat = offer.latitude ?? offer.zone.latitude;
    const lng = offer.longitude ?? offer.zone.longitude;
    return {
      offer,
      distanceKm: origin ? round1(distanceKm(origin, { lat, lng })) : undefined,
      title: offer.title,
      description: offer.description,
      area: offer.area,
      zone: offer.zone.name,
      requirements: offer.requirements,
    };
  }

  async search(query: ListJobOffersQueryDto): Promise<PublicOffersPageDto> {
    const hasLat = query.lat !== undefined;
    const hasLng = query.lng !== undefined;
    if (hasLat !== hasLng) throw new BadRequestException('lat y lng se envían juntas');
    if ((query.sort === 'nearest' || query.radiusKm !== undefined) && !hasLat) {
      throw new BadRequestException('Para ordenar o filtrar por cercanía enviá lat y lng');
    }
    const origin = hasLat ? { lat: query.lat as number, lng: query.lng as number } : undefined;

    const offers = await this.published({ area: query.area, zoneId: query.zone });
    let candidates = offers.map((o) => this.toCandidate(o, origin));

    if (origin && query.radiusKm !== undefined) {
      candidates = candidates.filter((c) => (c.distanceKm as number) <= (query.radiusKm as number));
    }

    const found = searchOffers(query.q ?? '', candidates);
    let ordered = [...found.items];
    if (query.sort === 'nearest') {
      ordered = ordered.sort((a, b) => (a.distanceKm as number) - (b.distanceKm as number));
    }

    const page = paginate(ordered, query.page, query.limit);
    return {
      ...page,
      items: page.items.map((c) => toPublicPosting(c.offer, c.distanceKm)),
      query: found.query,
      matched: found.matched,
    };
  }

  async nearby(query: NearbyJobOffersQueryDto): Promise<PublicOffersPageDto> {
    const origin = { lat: query.lat, lng: query.lng };
    const within = (await this.published())
      .map((o) => this.toCandidate(o, origin))
      .filter((c) => (c.distanceKm as number) <= query.radiusKm)
      .sort((a, b) => (a.distanceKm as number) - (b.distanceKm as number));
    const page = paginate(within, query.page, query.limit);
    return { ...page, items: page.items.map((c) => toPublicPosting(c.offer, c.distanceKm)), query: '', matched: true };
  }

  /** Rubros y zonas con ofertas publicadas, para armar los chips del front. */
  async filters(): Promise<OfferFiltersDto> {
    const offers = await this.published();
    const areas = [...new Set(offers.map((o) => o.area))].sort((a, b) => a.localeCompare(b, 'es'));
    const zones = new Map(offers.map((o) => [o.zone.id, { id: o.zone.id, name: o.zone.name }]));
    return { areas, zones: [...zones.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')) };
  }

  async findPublicByCode(code: string): Promise<PublicJobPostingDto> {
    const offer = await this.offers.findOne({ where: { code, status: 'published' } });
    if (!offer) throw new NotFoundException('Oferta no encontrada');
    return toPublicPosting(offer);
  }
}
