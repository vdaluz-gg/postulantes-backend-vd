export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** Recorta una lista ya ordenada en la página pedida. */
export function paginate<T>(all: readonly T[], page: number, limit: number): Page<T> {
  const start = (page - 1) * limit;
  return { items: all.slice(start, start + limit), total: all.length, page, limit };
}
