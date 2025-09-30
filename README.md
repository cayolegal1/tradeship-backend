# Tradeship Backend

Plataforma backend construida con Django REST Framework para Tradeship, un marketplace de intercambio que combina catalogo de items, compraventa mediante escrow y mensajeria en tiempo real entre usuarios. El servicio expone una API versionada bajo `/api/` y provee integraciones con Stripe, almacenamiento S3 opcional y herramientas de correo para entornos locales.

## Arquitectura y modulos principales
- `core`: configuracion base del proyecto (settings, URLs, middleware) gestionada con Pydantic y soporte para entornos `.env`.
- `apps.auth`: modelo de usuario personalizado, registro, login con JWT, perfiles y endpoints para actualizar credenciales.
- `apps.trade`: administracion de items, imagenes, archivos, acuerdos de intercambio, calificaciones y reglas de negocio asociadas a las negociaciones.
- `apps.payment`: billetera virtual, transacciones, metodos de pago y servicios de escrow integrados con Stripe.
- `apps.notification`: notificaciones en lote, preferencias de usuarios y mensajeria tipo chat entre participantes.

## Servicios de soporte
- PostgreSQL (Docker) como base de datos principal.
- Mailhog (Docker) para capturar correos en desarrollo (`http://localhost:8025`).
- Stripe (API externa) para pagos y escrow.
- AWS S3 opcional para almacenamiento de archivos cuando `USE_S3_FOR_MEDIA=True`.

## Requisitos previos
- Python 3.12 (ver `.python-version`).
- Docker Desktop con soporte para Docker Compose.
- Opcional pero recomendado: [`uv`](https://docs.astral.sh/uv/) para instalar dependencias a partir de `uv.lock`.

## Paso a paso para levantar el proyecto
1. **Clonar el repositorio y entrar en la carpeta** (si aun no lo hiciste).

2. **Crear y activar un entorno virtual** (PowerShell):
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate
   ```
   Con `uv` puedes activar el entorno en un solo paso cuando ejecutes `uv sync`.

3. **Instalar dependencias**:
   - Con `uv` (usa el candado `uv.lock`):
     ```powershell
     uv sync
     ```
   - Con `pip` tradicional:
     ```powershell
     python -m pip install --upgrade pip
     pip install -e .
     ```

4. **Copiar las variables de entorno** y completar credenciales reales:
   ```powershell
   Copy-Item .env.example .env
   ```
   Ajusta `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `STRIPE_*`, `FRONTEND_URL` y cualquier otra variable requerida.

5. **Levantar los servicios de infraestructura** (base de datos y correo):
   ```powershell
   docker compose up -d db mailhog
   ```
   Para detenerlos: `docker compose down`.

6. **Aplicar migraciones** con el entorno virtual activo:
   ```powershell
   python manage.py migrate
   ```

7. *(Opcional)* **Crear un superusuario** para acceder a Django Admin:
   ```powershell
   python manage.py createsuperuser
   ```

8. **Ejecutar el servidor de desarrollo**:
   ```powershell
   python manage.py runserver
   ```
   La API estara disponible en `http://127.0.0.1:8000/api/` y el panel de administracion en `http://127.0.0.1:8000/admin/`.

9. **Probar la instalacion** ejecutando los tests basicos:
   ```powershell
   python manage.py test
   ```

## Comandos utiles
- `docker compose logs -f db` para ver la salida de PostgreSQL cuando depures conexiones.
- `uv run <comando>` para ejecutar scripts asegurando el entorno aislado.
- `python manage.py shell_plus` (requiere `django-extensions`) para sesiones interactivas con modelos precargados.

## Buenas practicas para contribuir
- Actualiza `README.md` si agregas servicios o pasos nuevos.
- Usa migraciones autogeneradas (`python manage.py makemigrations`) y revisa su contenido antes de subirlas.
- Ejecuta los tests y revisa Mailhog cuando trabajes con correos o notificaciones.
