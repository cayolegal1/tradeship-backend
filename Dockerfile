# ============================================================
# Base image: build and prepare dependencies
# ============================================================
FROM node:22-alpine AS base
RUN corepack enable && corepack use pnpm@10.4
ENV NODE_ENV=development

WORKDIR /app

# Copiar solo lo necesario para instalar dependencias y generar prisma client
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Generar Prisma Client (con binario correcto para Alpine/OpenSSL 3)
RUN pnpm exec prisma generate

# Copiar el resto del código y compilar
COPY . /app
RUN pnpm build

# Quitar dependencias de desarrollo
RUN pnpm prune --prod


# ============================================================
# Final production image
# ============================================================
FROM node:22-alpine AS prod
RUN apk add --no-cache openssl tzdata
ENV TZ=America/Asuncion

WORKDIR /app

# Copiar desde la etapa base lo mínimo necesario
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/prisma ./prisma

# Puerto de la aplicación
EXPOSE 3000

# Comando de inicio
CMD ["node", "dist/src/main.js"]
