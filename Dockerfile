FROM node:20-slim

WORKDIR /app

# Copy lockfiles first so this layer is cached unless deps change
COPY package.json package-lock.json ./

# Skip postinstall during ci — scripts/ is not copied yet (see below)
RUN npm ci --legacy-peer-deps --ignore-scripts

# Copy the rest of the source
COPY . .

# Admin upload patch (normally runs via npm postinstall locally)
RUN node scripts/patch-medusa-dashboard-upload-limit.js

# Build Medusa backend + admin dashboard
RUN npx medusa build

EXPOSE 9000

ENV NODE_ENV=production

CMD ["sh", "-c", "cd /app/.medusa/server && npx medusa db:migrate && npx medusa start"]
