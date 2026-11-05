import { DataSource } from 'typeorm';
import { JobOffer } from '../../modules/job-offers/entities/job-offer.entity';
import { Zone } from '../../modules/zones/entities/zone.entity';
import { OFFERS_SEED } from './offers.seed';
import { ZONES_SEED } from './zones.seed';

/**
 * Carga zonas y ofertas de ejemplo. Es idempotente: lo que ya existe (por nombre de zona o código de
 * oferta) no se duplica ni se pisa.
 */
export async function seedReferenceData(dataSource: DataSource): Promise<{ zones: number; offers: number }> {
  const zones = dataSource.getRepository(Zone);
  const offers = dataSource.getRepository(JobOffer);

  let newZones = 0;
  for (const z of ZONES_SEED) {
    if (!(await zones.existsBy({ name: z.name }))) {
      await zones.save(zones.create({ ...z, active: true }));
      newZones++;
    }
  }

  const byName = new Map((await zones.find()).map((z) => [z.name, z]));
  let newOffers = 0;
  for (const o of OFFERS_SEED) {
    if (await offers.existsBy({ code: o.code })) continue;
    const zone = byName.get(o.zoneName);
    if (!zone) throw new Error(`Zona inexistente en el seed: ${o.zoneName}`);
    await offers.save(
      offers.create({
        code: o.code,
        title: o.title,
        description: o.description,
        zoneId: zone.id,
        area: o.area,
        schedule: o.schedule,
        publishedAt: o.publishedAt,
        requirements: [...o.requirements],
        benefits: [...o.benefits],
        vacancies: o.vacancies,
        salary: o.salary,
        address: o.address,
        latitude: zone.latitude,
        longitude: zone.longitude,
        radiusKm: o.radiusKm,
        status: 'published',
        internal: o.internal,
      }),
    );
    newOffers++;
  }
  return { zones: newZones, offers: newOffers };
}
