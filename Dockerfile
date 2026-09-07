#
# Airbase-compatible Dockerfile for the LTFEM_public site, fronted by an
# Express server that gates access behind Microsoft Entra ID login.
#
# This repo pre-renders its Rmd pages locally (rmarkdown::render_site())
# into static HTML under docs/. We do NOT render inside the image — R and
# its package stack (sf, leaflet, BIOMASS, AICcmodavg, etc.) are heavy and
# also depend on sibling data repos (../LTFEM_Veg, ../LTFEM_Veg_AGB) that
# aren't part of this repo, so a container build can't reproduce them
# anyway. Re-run `rmarkdown::render_site()` locally and commit the
# refreshed docs/ output before building this image.
#

# Stage 1: install production dependencies
FROM gdssingapore/airbase:node-22-builder AS builder

WORKDIR /app
COPY --chown=app:app package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: runtime
FROM gdssingapore/airbase:node-22

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=app:app --from=builder /app/node_modules ./node_modules
COPY --chown=app:app package.json ./
COPY --chown=app:app src ./src
COPY --chown=app:app docs ./docs

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "src/index.js"]
