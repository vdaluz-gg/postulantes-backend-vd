import { OfferInternalData } from '../../modules/job-offers/entities/job-offer.entity';

export interface ZoneSeed {
  readonly name: string;
  readonly province: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface JobOfferSeed {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly zoneName: string;
  readonly area: string;
  readonly schedule: string;
  readonly publishedAt: string;
  readonly requirements: readonly string[];
  readonly benefits: readonly string[];
  readonly vacancies: number;
  readonly salary: number;
  readonly address: string;
  readonly radiusKm: number;
  readonly internal: OfferInternalData;
}
