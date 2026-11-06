# Postulantes · Backend

API del portal de empleo. Hoy funciona como **backend mock con base de datos de ejemplo**: sirve para probar el
front de postulantes y para que, cuando estén las APIs definitivas, la unión sea un cambio de URL y no una
reescritura.

## Propósito

Permitir que una persona se postule a una búsqueda laboral (subiendo su CV o completando un formulario con
validación campo por campo) y darle al equipo de selección un backoffice para gestionar postulantes,
postulaciones, ofertas y entrevistas.

## Requisitos

| Para | Necesitás |
|------|-----------|
| Levantarlo con Docker | Docker y Docker Compose |
| Levantarlo sin Docker | Node.js 22 y un PostgreSQL 16 |
| Correr los tests | Node.js 22 (**no** hace falta Docker ni Postgres: usan una base en memoria) |

## Tecnologías

TypeScript sobre Node.js 22 · Nest.js 11 · TypeORM 0.3 · PostgreSQL 16 · Jest y Supertest (tests) ·
pg-mem (Postgres en memoria para los tests) · Docker / Docker Compose · Swagger (documentación de la API).

## Qué hace

**Postulante (API pública, `/api/v1`)**
- Subir su CV (PDF, DOC o DOCX): se lee el texto del archivo y se precargan nombre y apellido (por separado), mail,
  DNI, CUIL, WhatsApp y zona. Sin dependencias externas; un PDF escaneado (solo imagen) deja el formulario vacío.
- Completar el formulario a mano con validación campo por campo: nombre, apellido, mail, DNI, CUIL (opcional, tiene
  que coincidir con el DNI), WhatsApp, zona y puesto. Nombre y apellido se guardan por separado.
- Buscar ofertas con texto libre y con los filtros del front (rubro, zona, cercanía).
- Ver ofertas cerca de su ubicación (latitud, longitud y radio).
- Aceptar o rechazar los permisos de voz, imagen y ubicación (queda registrado el consentimiento).
- Postularse, con o sin oferta, y consultar el estado con un código de seguimiento. Cuando se le agenda una
  entrevista, ve el día, la hora y el lugar.
- Responder los campos que el backoffice agregó al formulario (`answers`): se revisan contra la configuración
  publicada y se guardan con la postulación, con la etiqueta que tenían.
- Leer la configuración publicada de su portal: `GET /site-config/:audience` (postulantes, clientes o colaboradores).

**Backoffice (API privada, `/api/v1/backoffice`, con sesión de administrador)**
- Alta de administradores (con una clave de alta) e inicio de sesión con JWT.
- Postulantes: listar, ver, crear, editar y eliminar; con filtros por zona, canal de origen y estado de identidad.
- Postulaciones: listar, ver el historial y cambiar el estado (recibida, revisión de IA, revisión de la selectora,
  entrevista, contratada, rechazada o baja).
- Ofertas y zonas: alta, edición, publicación y cierre.
- Matching: postulantes sugeridos para una oferta, con puntaje y el motivo.
- Salas y entrevistas: agenda sin superposiciones de sala ni de postulante.
- Alta del colaborador al contratar (hoy mock; si el sistema externo falla, queda pendiente y se reintenta).
- Reportes de postulaciones por estado, canal y oferta.
- Configuración de los portales (campos, documentos, avisos, canales y textos): guardar borrador y publicar.
  Cada guardado es una versión nueva; si otra persona guardó antes, responde 409. Nombre y apellido, mail, DNI y
  WhatsApp no se pueden ocultar ni volver opcionales en el formulario de postulación.

**Preparado para el futuro:** validación de identidad contra un servicio oficial. Hoy hay una interfaz y un
proveedor mock (ver `docs/renaper-integracion.md`).

## Cómo levantarlo

### Con Docker (API + base de datos)

```bash
cp .env.example .env        # en Windows PowerShell: Copy-Item .env.example .env
# Editá .env y cambiá DB_PASSWORD, JWT_SECRET y ADMIN_REGISTRATION_KEY
docker compose up --build -d
```

- API: http://localhost:3000/api/v1
- **Swagger (probar todo desde el navegador):** http://localhost:3000/api/docs
- Estado: http://localhost:3000/api/v1/health
- Logs: `docker compose logs -f api` · Apagar: `docker compose down` (con `-v` también borra la base)

Con `SEED_ON_BOOT=true` (viene así en `.env.example`) se cargan solas las zonas y ofertas de ejemplo.

### Sin Docker

```bash
cp .env.example .env
docker compose up -d db     # o apuntá DB_HOST y DB_PORT a tu propio PostgreSQL
npm install
npm run start:dev           # API con recarga automática
npm run seed                # opcional: carga zonas y ofertas de ejemplo
```

### Variables de entorno (`.env.example`)

| Variable | Para qué sirve |
|----------|----------------|
| `PORT` | Puerto de la API (3000). |
| `CORS_ORIGINS` | Orígenes del front permitidos, separados por coma (por defecto `http://localhost:4200`). |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión a PostgreSQL. |
| `DB_SYNCHRONIZE` | Crea las tablas solas. **Solo desarrollo/mock**; en producción se usan migraciones. |
| `SEED_ON_BOOT` | Carga los datos de ejemplo al arrancar (nunca en producción). |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Firma y duración de la sesión del backoffice. |
| `ADMIN_REGISTRATION_KEY` | Clave que hay que enviar para registrar un administrador. |
| `UPLOAD_DIR` | Carpeta donde se guardan los CV. |

No se versiona ningún secreto: todo va en `.env`, que está ignorado por git.

## Cómo testearlo

```bash
npm test             # unitarios + integración (base en memoria, sin Docker)
npm run typecheck    # chequeo de tipos
npm run test:cov     # con cobertura
```

Los tests se escriben **antes** que el código de cada endpoint. `npm test` y `npm run typecheck` tienen que pasar
antes de cada commit.

## Conexión con el front

El front (`postulantes-front-vd`, Angular) trae sus contratos con datos simulados. La unión consiste en usar la
implementación HTTP en lugar del mock:

1. Dejá la API corriendo en `http://localhost:3000/api/v1` (es la URL base que el front ya trae).
2. En el front, `USE_BACKEND = true` en `src/app/app.backend.ts` activa las llamadas reales.
3. El front corre en `http://localhost:4200`; si usás otro puerto o dominio, agregalo en `CORS_ORIGINS`.

| Front | Backend |
|-------|---------|
| Lectura del CV | `POST /cv` → `prefill` con nombre, DNI, WhatsApp y zona |
| Postularse | `POST /applications` |
| Listado de ofertas | `GET /job-offers` (mismos nombres de campos que el front) |
| Ofertas cercanas | `GET /job-offers/nearby?lat=&lng=&radiusKm=` |
| Validación del formulario | `POST /candidates/validate` (devuelve el mensaje por campo) |
| Permisos de voz, imagen y ubicación | `POST /consents` |
| Seguimiento | `GET /applications/track/:code` |

Los errores siempre tienen el mismo formato (`statusCode`, `error`, `message`, `path`, `timestamp`).

## Qué datos usar para probar

Datos **de ejemplo** que pasan la validación (no son personas reales):

| Campo | Válido | Inválido (para ver el mensaje de error) |
|-------|--------|------------------------------------------|
| Nombre y apellido | `Martina Rodríguez`, `Ana María O'Connor` | `Martina` (falta apellido), `Mar@tina Pérez` |
| Mail | `martina@ejemplo.com` | `martina@`, `x` |
| DNI | `38412907` o `38.412.907` (7 u 8 dígitos) | `12`, `abc` |
| WhatsApp | `11 5555-0142` (10 dígitos con código de área) | `123` |
| Zona | un `id` de `GET /zones` (ej.: Monte Grande, Pilar, CABA) | un UUID inexistente |
| Oferta | `IND3307418`, `LOG7712093` (códigos del seed) | `NOEXISTE` |
| CV | PDF, DOC o DOCX de hasta 5 MB | cualquier otro tipo (se valida por contenido, no por extensión) |
| Cercanía | `lat=-34.815&lng=-58.469&radiusKm=20` (zona de Monte Grande) | — |

**Probar el backoffice paso a paso (en Swagger):**
1. `POST /auth/register` con un mail, un nombre, una contraseña (mínimo 10 caracteres, con mayúscula, minúscula y
   número) y la `ADMIN_REGISTRATION_KEY` de tu `.env`.
2. `POST /auth/login` y copiá el `accessToken`.
3. Botón **Authorize** de Swagger y pegá el token.
4. Creá una sala (`POST /backoffice/interview-rooms`), postulate desde la API pública, pasá la postulación a
   `recruiter_review` y agendá la entrevista.

Los pedidos tienen límite por minuto: si recibís un `429`, esperá un momento.

## Ramas

| Rama | Contenido |
|------|-----------|
| `test` | El código del proyecto (ambiente de pruebas). |
| `main` | Solo este README, que explica el proyecto y cómo conseguir el código. |
| `prod` | Vacía hasta el primer pase a producción. |

Para obtener el código: `git clone -b test <url-del-repositorio>`.

## Estructura

```
src/
  common/       validadores, filtros de error y utilidades compartidas
  config/       lectura y validación de variables de entorno
  database/     conexión, entidades y datos de ejemplo
  modules/      una carpeta por funcionalidad (controlador, servicio, entidades y DTO)
test/           tests de integración
docs/           documentación del proyecto (solo local)
```
