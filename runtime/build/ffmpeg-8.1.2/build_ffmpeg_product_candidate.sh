#!/usr/bin/env bash
set -euo pipefail

stage_root="${1:?stage root is required}"
source_root="$stage_root/build/ffmpeg-source"
build_root="$stage_root/build/ffmpeg-build"
prefix_root="$stage_root/prefix/ffmpeg-8.1.2-lgpl-zlib"
log_root="$stage_root/logs/ffmpeg"

export PATH="/ucrt64/bin:/usr/bin"
export LC_ALL=C
export TZ=UTC
export SOURCE_DATE_EPOCH=1787443200
export ZERO_AR_DATE=1
export ARFLAGS=rcD

mkdir -p "$build_root" "$prefix_root" "$log_root"

configure_args=(
  "--prefix=$prefix_root"
  "--arch=x86_64"
  "--target-os=mingw32"
  "--cc=gcc"
  "--cxx=g++"
  "--ar=ar"
  "--nm=nm"
  "--ranlib=ranlib"
  "--strip=strip"
  "--pkg-config=pkgconf"
  "--disable-gpl"
  "--disable-nonfree"
  "--disable-autodetect"
  "--enable-shared"
  "--disable-static"
  "--disable-doc"
  "--disable-debug"
  "--disable-network"
  "--enable-d3d11va"
  "--enable-mediafoundation"
  "--enable-zlib"
  "--extra-version=tancmark-video-primary-stage4-zlib"
  "--extra-cflags=-ffile-prefix-map=$source_root=/usr/src/ffmpeg-8.1.2 -fdebug-prefix-map=$source_root=/usr/src/ffmpeg-8.1.2"
  "--extra-ldflags=-Wl,--no-insert-timestamp"
)

printf '%s\n' "${configure_args[@]}" > "$log_root/configure-arguments.txt"
cd "$build_root"
"$source_root/configure" "${configure_args[@]}" 2>&1 | tee "$log_root/configure.log"
make -j"$(nproc)" V=1 2>&1 | tee "$log_root/build.log"
make install 2>&1 | tee "$log_root/install.log"
"$prefix_root/bin/ffmpeg.exe" -hide_banner -buildconf > "$log_root/ffmpeg-buildconf.txt" 2>&1
"$prefix_root/bin/ffmpeg.exe" -hide_banner -encoders > "$log_root/ffmpeg-encoders.txt" 2>&1
"$prefix_root/bin/ffprobe.exe" -hide_banner -version > "$log_root/ffprobe-version.txt" 2>&1
