ARG NODE_IMAGE
FROM ${NODE_IMAGE} AS build
WORKDIR /opt/v-sub
ENV CI=1 ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ NEXT_TELEMETRY_DISABLED=1
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
 && apt-get update && apt-get install -y --no-install-recommends python3 make g++ cmake curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y --no-install-recommends patch && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --registry=https://registry.npmmirror.com
COPY scripts/lib ./scripts/lib
COPY scripts/fetch-whisper-addon.mjs scripts/vos-sherpa.mjs scripts/vos-native.mjs ./scripts/
RUN VSUB_WEB=1 node node_modules/electron/install.js \
 && node scripts/vos-sherpa.mjs \
 && VSUB_WEB=1 node scripts/vos-native.mjs
COPY . .
RUN npm run build:vos

FROM ${NODE_IMAGE} AS runtime-base
WORKDIR /opt/v-sub
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
 && apt-get update && apt-get install -y --no-install-recommends xvfb xauth libnss3 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libasound2 libxss1 libgomp1 ffmpeg fonts-noto-cjk curl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

FROM runtime-base AS runtime
WORKDIR /opt/v-sub
COPY --from=build /opt/v-sub/node_modules ./node_modules
COPY --from=build /opt/v-sub/app ./app
COPY --from=build /opt/v-sub/extraResources ./extraResources
COPY --from=build /opt/v-sub/package.json ./package.json
COPY --from=build /opt/v-sub/vos ./vos
RUN ln -sf /usr/bin/ffmpeg node_modules/ffmpeg-static/ffmpeg
ENV NODE_ENV=production PORT=7090 VSUB_APP_ROOT=/opt/v-sub VSUB_DATA_DIR=/data
EXPOSE 7090
ENTRYPOINT ["tini", "--"]
CMD ["xvfb-run", "-a", "-s", "-screen 0 1280x900x24 -ac", "node", "vos/gateway.mjs"]
