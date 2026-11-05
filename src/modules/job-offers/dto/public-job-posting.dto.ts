import { JobOffer } from '../entities/job-offer.entity';

/**
 * Oferta como la ve el postulante: solo la publicación. Tiene los mismos nombres que `JobPosting` del front.
 * Salario, vacantes, domicilio, cliente, convenio y el resto de la ficha interna no salen nunca por acá.
 */
export interface PublicJobPostingDto {
  ref: string;
  title: string;
  description: string;
  zone: string;
  area: string;
  schedule: string;
  publishedOn: string;
  requirements: string[];
  benefits: string[];
  /** Distancia a la ubicación pedida, en km (solo si se pidió con lat/lng). */
  distanceKm?: number;
}

export function toPublicPosting(o: JobOffer, distanceKm?: number): PublicJobPostingDto {
  const dto: PublicJobPostingDto = {
    ref: o.code,
    title: o.title,
    description: o.description,
    zone: o.zone.name,
    area: o.area,
    schedule: o.schedule,
    publishedOn: o.publishedAt,
    requirements: o.requirements,
    benefits: o.benefits,
  };
  if (distanceKm !== undefined) dto.distanceKm = distanceKm;
  return dto;
}

export interface PublicOffersPageDto {
  items: PublicJobPostingDto[];
  total: number;
  page: number;
  limit: number;
  /** Texto buscado tal como se escribió. */
  query: string;
  /** false cuando nada coincidió con el texto y se muestran todas. */
  matched: boolean;
}

export interface OfferFiltersDto {
  areas: string[];
  zones: { id: string; name: string }[];
}
