import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Guardia contra la inyección SQL: la regla del proyecto es consultar solo con TypeORM y parámetros, nunca armando
 * SQL concatenando texto. Este test lee el código de src/ y falla si encuentra una consulta o condición armada con
 * una plantilla (`${...}`) o con `+`. Si una construcción es segura de verdad (por ejemplo, une fragmentos fijos), se
 * revisa a mano y se marca en esa línea o la anterior con el comentario `sql-seguro: <por qué>`.
 */
const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

/** Métodos que reciben SQL o un trozo de SQL como texto. */
const SQL_CALL = /\.(query|where|andWhere|orWhere|having|andHaving|orHaving|orderBy|addOrderBy|groupBy|addGroupBy|select|addSelect|innerJoin|leftJoin|innerJoinAndSelect|leftJoinAndSelect)\(\s*([`'"])/;
const MARK = 'sql-seguro:';

function findings(): string[] {
  const out: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const call = SQL_CALL.exec(line);
      if (!call) return;
      // Desde la apertura del primer argumento hasta donde empiezan los parámetros: lo que se concatena o interpola.
      const argument = line.slice(call.index + call[0].length - 1);
      const dynamic = call[2] === '`' ? /\$\{/.test(argument) : /['"]\s*\+/.test(argument);
      if (!dynamic) return;
      if (line.includes(MARK) || (lines[i - 1] ?? '').includes(MARK)) return;
      out.push(`${relative(SRC, file)}:${i + 1}  ${line.trim()}`);
    });
  }
  return out;
}

describe('SQL siempre parametrizado', () => {
  it('no hay consultas armadas con plantillas o concatenación (revisar o marcar con "sql-seguro:")', () => {
    expect(findings()).toEqual([]);
  });

  it('la regla detecta una construcción insegura (si esto falla, el test de arriba no protege nada)', () => {
    const insegura = 'qb.andWhere(`c.dni = ${dni}`);';
    expect(SQL_CALL.exec(insegura)).not.toBeNull();
    expect(/\$\{/.test(insegura.slice(SQL_CALL.exec(insegura)!.index + SQL_CALL.exec(insegura)![0].length - 1))).toBe(true);
    const concatenada = `ds.query('SELECT * FROM x WHERE id = ' + id);`;
    expect(/['"]\s*\+/.test(concatenada.slice(SQL_CALL.exec(concatenada)!.index + SQL_CALL.exec(concatenada)![0].length - 1))).toBe(true);
  });

  it('las consultas con parámetros no se marcan', () => {
    const buena = "qb.andWhere('c.dni = :dni', { dni });";
    const call = SQL_CALL.exec(buena)!;
    expect(/['"]\s*\+/.test(buena.slice(call.index + call[0].length - 1))).toBe(false);
  });
});
