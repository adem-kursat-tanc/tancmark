FROM ubuntu@sha256:1e0a86e57d247923571b75e0aaf48a1449cf8c543d51fb3e07a4a7d7bfa79316 AS runtime-builder

ARG DEBIAN_FRONTEND=noninteractive
ARG USERNAME=tancmark
ARG USER_UID=1000
ARG USER_GID=1000

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      autoconf automake build-essential ca-certificates cmake curl gfortran git \
      libbz2-dev libdb-dev libexpat1-dev libffi-dev libgdbm-dev liblzma-dev \
      libncurses-dev libnss3-dev libopus-dev libreadline-dev libsqlite3-dev \
      libssl-dev libtool libuuid1 libvpx-dev libx11-dev libxext-dev libxrender-dev \
      libxt-dev meson nasm ninja-build patchelf pkg-config tk-dev unzip xz-utils \
      yasm zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

COPY .devcontainer/install-demo-runtime.sh /usr/local/sbin/install-tancmark-demo-runtime
RUN chmod 0755 /usr/local/sbin/install-tancmark-demo-runtime \
    && /usr/local/sbin/install-tancmark-demo-runtime \
    && rm -f /usr/local/sbin/install-tancmark-demo-runtime

RUN PATH=/opt/tancmark-demo/node-v24.19.0-linux-x64/bin:/usr/bin:/bin \
      COREPACK_HOME=/opt/tancmark-demo/corepack \
      /opt/tancmark-demo/node-v24.19.0-linux-x64/bin/corepack prepare pnpm@10.34.5 --activate \
    && test "$(PATH=/opt/tancmark-demo/node-v24.19.0-linux-x64/bin:/usr/bin:/bin \
      COREPACK_HOME=/opt/tancmark-demo/corepack \
      /opt/tancmark-demo/node-v24.19.0-linux-x64/bin/corepack pnpm --version)" = "10.34.5" \
    && rm -rf /root/.cache/node/corepack

FROM ubuntu@sha256:1e0a86e57d247923571b75e0aaf48a1449cf8c543d51fb3e07a4a7d7bfa79316

ARG DEBIAN_FRONTEND=noninteractive
ARG USERNAME=tancmark
ARG USER_UID=1000
ARG USER_GID=1000

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
      ca-certificates curl git openssl \
      libbrotli1 libbsd0 libbz2-1.0 libdb5.3t64 libexpat1 libffi8 \
      libfontconfig1 libfreetype6 libgcc-s1 libgdbm6t64 liblzma5 libmd0 \
      libncursesw6 libopus0 libpng16-16t64 libreadline8t64 libsqlite3-0 \
      libssl3t64 libstdc++6 libtcl8.6 libtinfo6 libtk8.6 libuuid1 libvpx9 \
      libx11-6 libxau6 libxcb1 libxdmcp6 libxext6 libxft2 libxrender1 \
      libxss1 zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY --from=runtime-builder /opt/tancmark-demo /opt/tancmark-demo

RUN cp /opt/tancmark-demo/python-3.14.7/bin/python3.14 \
      /opt/tancmark-demo/venv/bin/python-tancmark \
    && chmod 0755 /opt/tancmark-demo/venv/bin/python-tancmark

RUN selected_gid="${USER_GID}"; selected_uid="${USER_UID}"; \
    if getent group "${selected_gid}" >/dev/null; then selected_gid=10001; fi; \
    if getent passwd "${selected_uid}" >/dev/null; then selected_uid=10001; fi; \
    test -z "$(getent group "${selected_gid}" || true)" \
    && test -z "$(getent passwd "${selected_uid}" || true)" \
    && groupadd --gid "${selected_gid}" "${USERNAME}" \
    && useradd --uid "${selected_uid}" --gid "${selected_gid}" --create-home --shell /bin/bash "${USERNAME}" \
    && mkdir -p /tmp/tancmark-demo /home/${USERNAME}/.cache/corepack /workspaces/tancmark \
    && chown -R "${USERNAME}:${USERNAME}" \
      /tmp/tancmark-demo /home/${USERNAME} /workspaces/tancmark

ENV PATH="/opt/tancmark-demo/node-v24.19.0-linux-x64/bin:/usr/bin:/bin"
ENV COREPACK_HOME="/opt/tancmark-demo/corepack"
ENV LD_LIBRARY_PATH="/opt/tancmark-demo/python-3.14.7/lib:/opt/tancmark-demo/ffmpeg-8.1.2-linux-demo/lib"

USER ${USERNAME}
WORKDIR /workspaces/tancmark
CMD ["sleep", "infinity"]
