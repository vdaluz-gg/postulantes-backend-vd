/**
 * Unitarios (src/**\/*.spec.ts) e integración (test/**\/*.e2e-spec.ts).
 * Los de integración usan Postgres en memoria (pg-mem): no hace falta Docker para testear.
 */
module.exports = {
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  testEnvironment: 'node',
  // Cada suite de integración levanta la app completa; con muchas en paralelo 5 s (el valor por defecto) no alcanza.
  testTimeout: 30000,
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/database/seed/run-seed.ts', '!src/database/data-source.ts', '!src/**/*.module.ts'],
  coverageDirectory: 'coverage',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
};
