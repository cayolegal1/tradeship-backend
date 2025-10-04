# Instructivo para arrancar TradeShip Backend

## 1. Que es el proyecto
TradeShip Backend es la API principal de la plataforma TradeShip. Expone servicios REST y WebSocket construidos con NestJS para que las aplicaciones web y moviles puedan gestionar:
- autenticacion de usuarios y sesiones con JWT
- perfiles, intereses y estadisticas de intercambio
- catalogo de articulos con imagenes, detalles de envio y preferencias de intercambio
- flujo de negociaciones (trades), resenas y calificaciones
- billeteras de usuario con soporte para Stripe (depositos, retiros, escrow)
- notificaciones en tiempo real, correo electronico y recordatorios
- chat en vivo y manejo de archivos adjuntos

El servicio persiste datos en PostgreSQL a traves de Prisma, genera documentacion OpenAPI en tiempo de ejecucion y se integra con servicios externos como Stripe, Supabase (para almacenamiento de imagenes) y AWS S3 (opcional).

## 2. Requisitos previos
- Node.js 18 LTS o superior
- PNPM 8+ (recomendado) o NPM 9+
- PostgreSQL 14+ accesible localmente o via contenedor Docker
- Cuenta de Stripe con llaves de prueba
- Proyecto de Supabase (bucket para imagenes) o, en su defecto, credenciales de AWS S3 si se desea usar S3
- Git instalado y configurado

## 3. Clonado e instalacion de dependencias
```
git clone <url-del-repositorio>
cd tradeship-backend-develop
pnpm install   # o npm install
```

## 4. Variables de entorno
Crea un archivo `.env` en la raiz basandote en `.env.example`. Ajusta los valores a tu entorno:

| Variable | Descripcion | Ejemplo |
| --- | --- | --- |
| `PORT` | Puerto HTTP expuesto por NestJS | `3000` |
| `API_PREFIX` | Prefijo comun para las rutas | `api` |
| `DATABASE_URL` | Cadena de conexion PostgreSQL para Prisma | `postgresql://user:pass@localhost:5432/tradeship?schema=public` |
| `JWT_SECRET` | Llave para firmar tokens de acceso | `super-secret` |
| `JWT_EXPIRES_IN` | Validez del token de acceso | `7d` |
| `JWT_REFRESH_SECRET` | Llave para tokens de refresco | `super-secret-refresh` |
| `JWT_REFRESH_EXPIRES_IN` | Validez del token de refresco | `30d` |
| `THROTTLE_TTL` | Ventana de throttling en segundos | `60` |
| `THROTTLE_LIMIT` | Numero maximo de solicitudes por ventana | `100` |
| `FRONTEND_URL` | URL permitida para CORS y callbacks | `http://localhost:5173` |
| `STRIPE_SECRET_KEY` | Llave privada de Stripe | `sk_test_xxx` |
| `STRIPE_PUBLISHABLE_KEY` | Llave publica de Stripe | `pk_test_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Secreto del webhook de Stripe | `whsec_xxx` |
| `SUPABASE_URL` | URL del proyecto Supabase | `https://<id>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave service role para cargar imagenes | `supabase-service-role` |
| `SUPABASE_ITEMS_BUCKET` | Nombre del bucket para imagenes | `trade-items` |
| `AWS_ACCESS_KEY_ID` | Acceso AWS (opcional si usas S3) | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | Secreto AWS | `abc123` |
| `AWS_S3_BUCKET_NAME` | Bucket S3 para archivos | `tradeship-files` |
| `EMAIL_HOST` | Servidor SMTP | `smtp.mailtrap.io` |
| `EMAIL_PORT` | Puerto SMTP | `2525` |
| `EMAIL_HOST_USER` | Usuario SMTP | `user` |
| `EMAIL_HOST_PASSWORD` | Contrasena SMTP | `pass` |
| `LOG_LEVEL` | Nivel de logs (debug, info, warn, error) | `info` |

> Asegurate de que `DATABASE_URL` apunte a la base correcta. Prisma usa este valor para generar el cliente y ejecutar migraciones.

## 5. Base de datos
1. Levanta PostgreSQL (local o con Docker):
   ```
   docker compose up db -d
   ```
2. Ejecuta las migraciones y genera el cliente Prisma:
   ```
   pnpm prisma:generate
   pnpm prisma:migrate
   ```
3. (Opcional) Rellena datos iniciales:
   ```
   pnpm prisma:seed
   ```

## 6. Servicios externos
- **Stripe**: configura las llaves y crea un endpoint de webhook que apunte a `http://localhost:3000/api/payment/stripe/webhook` si necesitas probar flujos de eventos.
- **Supabase**: crea un bucket (ej. `trade-items`) con acceso publico de lectura. Usa la service role key para que el backend pueda subir las imagenes de los articulos.
- **AWS S3 (alternativa)**: si prefieres S3, configura `USE_S3_FOR_MEDIA=true` y suministra las credenciales AWS y el bucket; ajusta la politica del bucket para permitir lecturas publicas si las imagenes deben ser visibles sin autenticacion.

## 7. Ejecucion en desarrollo
```
pnpm start:dev
```
- El servidor expone la API en `http://localhost:3000` (usa `PORT` para cambiarlo).
- La documentacion Swagger se genera en `http://localhost:3000/api/docs`.
- Se habilita recarga en caliente de controladores y servicios.

## 8. Ejecucion en produccion local
```
pnpm build
pnpm start:prod
```
Asegurate de que el archivo `.env` y las migraciones ya esten aplicadas. Considera usar `pm2` o un servicio del sistema para procesos persistentes.

## 9. Ejecucion con Docker
```
docker compose up --build
```
El `docker-compose.yml` incluye servicios para el API (`app`) y la base (`db`). Personaliza los valores de entorno en la seccion `environment` antes de construir la imagen.

## 10. Pruebas automatizadas
```
pnpm test          # pruebas unitarias
pnpm test:e2e      # pruebas end-to-end
pnpm test:cov      # cobertura
```
Configura una base de datos separada para e2e si necesitas conservar datos locales.

## 11. Notas de arquitectura
- NestJS modulariza la solucion: `auth`, `trade`, `payment`, `notification`, `chat`, entre otros.
- Prisma define el esquema en `prisma/schema.prisma` y sincroniza modelos con la base.
- Las cargas de imagenes de articulos se procesan en memoria (Multer) y luego se suben a Supabase; si el proceso falla se limpian los archivos y registros.
- El throttling global se controla via `THROTTLE_TTL` y `THROTTLE_LIMIT` en `AppModule`.
- El prefijo `API_PREFIX` evita colisiones con otros servicios (por defecto `api`).

Con esta guia cualquier desarrollador puede reproducir el entorno, comprender las piezas principales y ejecutar TradeShip Backend de forma segura.
