FROM node:16.13.0-alpine3.14 AS builder

WORKDIR /app

COPY . .

# Install modules, build and remove unnecessary modules after
RUN npm install \
    && npm run build \
    && npm prune --production \
    && npm install --production \
    && rm -rf src \
    && rm -f .npmrc

FROM node:16.13.0-alpine3.14

RUN apk add --no-cache redis

RUN rm -rf /usr/local/lib/node_modules/npm/ /usr/local/bin/npm

RUN mkdir /tmp/recipe && chmod 755 /tmp

WORKDIR /app

COPY --from=builder /app .

EXPOSE 1086 1087

ENTRYPOINT redis-server --daemonize yes && \
        node -r dotenv/config ./dist/server.js dotenv_config_path=/var/run/secrets/environment
