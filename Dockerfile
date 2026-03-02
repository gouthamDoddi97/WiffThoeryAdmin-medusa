FROM node:20-slim

WORKDIR /app

# Copy lockfiles first so this layer is cached unless deps change
COPY package.json package-lock.json ./

# Install all deps (dev deps needed for the build step)
RUN npm ci --legacy-peer-deps

# Copy the rest of the source
COPY . .

# Build Medusa backend + admin dashboard
RUN npx medusa build

# Install production deps inside the built server output
WORKDIR /app/.medusa/server
RUN npm install --legacy-peer-deps

EXPOSE 9000

ENV NODE_ENV=production

CMD ["npx", "medusa", "start"]
