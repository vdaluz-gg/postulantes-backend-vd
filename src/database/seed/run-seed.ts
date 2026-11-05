import 'reflect-metadata';
import dataSource from '../data-source';
import { seedReferenceData } from './seed';

/** npm run seed: carga zonas y ofertas de ejemplo en la base configurada en .env. */
async function run(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('El seed de ejemplo no se corre en producción');
  await dataSource.initialize();
  try {
    // Con DB_SYNCHRONIZE=true (solo desarrollo) se crean las tablas si faltan.
    if (process.env.DB_SYNCHRONIZE === 'true') await dataSource.synchronize();
    const result = await seedReferenceData(dataSource);
    console.log(`Seed listo. Zonas nuevas: ${result.zones} · ofertas nuevas: ${result.offers}`);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
