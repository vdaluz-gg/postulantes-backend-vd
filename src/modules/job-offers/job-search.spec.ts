import { normalizeText, searchOffers, SearchableOffer } from './job-search';

const offer = (over: Partial<SearchableOffer> & { title: string }): SearchableOffer => ({
  description: '',
  area: '',
  zone: '',
  requirements: [],
  ...over,
});

const chofer = offer({ title: 'Chofer de camión chasis', area: 'Logística', zone: 'Moreno / Parque Avellaneda', requirements: ['Licencia profesional'] });
const operario = offer({ title: 'Operario/a de producción', area: 'Industria', zone: 'Monte Grande' });
const auditor = offer({ title: 'Auditor/a de canal masivo', area: 'Comercial', zone: 'Corrientes Capital' });
const all = [chofer, operario, auditor];

describe('normalizeText', () => {
  it('pasa a minúsculas y saca tildes', () => expect(normalizeText('Logística CAMIÓN')).toBe('logistica camion'));
});

describe('searchOffers', () => {
  it('sin consulta devuelve todas y matched', () => {
    expect(searchOffers('  ', all)).toEqual({ query: '', items: all, matched: true });
  });

  it('encuentra por puesto, ignorando tildes y mayúsculas', () => {
    expect(searchOffers('CAMION', all).items).toEqual([chofer]);
  });

  it('encuentra por zona y por rubro', () => {
    expect(searchOffers('monte grande', all).items).toEqual([operario]);
    expect(searchOffers('logistica', all).items).toEqual([chofer]);
  });

  it('encuentra por requisitos', () => {
    expect(searchOffers('licencia', all).items).toEqual([chofer]);
  });

  it('ordena de más a menos coincidencias y respeta el orden original en empates', () => {
    const r = searchOffers('chofer moreno', [operario, chofer, auditor]);
    expect(r.items[0]).toBe(chofer);
  });

  it('ignora palabras vacías como "trabajo" o "cerca"', () => {
    const r = searchOffers('busco trabajo cerca', all);
    expect(r.matched).toBe(true);
    expect(r.items).toEqual(all);
  });

  it('si nada coincide devuelve todas con matched=false', () => {
    expect(searchOffers('astronauta', all)).toEqual({ query: 'astronauta', items: all, matched: false });
  });
});
