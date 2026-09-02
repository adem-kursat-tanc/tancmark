#!/usr/bin/env bash
set -euo pipefail
umask 022

runtime_root=/opt/tancmark-demo
source_root=${runtime_root}/sources
build_root=${runtime_root}/build
mkdir -p "${source_root}" "${build_root}"

download_verified() {
  local url=$1
  local sha=$2
  local output=$3
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 --output "${output}" "${url}"
  printf '%s  %s\n' "${sha}" "${output}" | sha256sum --check --strict
}

node_sha=14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647
python_sha=3b48dac8fb59f62eaa67ac83c1eb12bda1b7a08406dd286e252c11a66be27f81
ffmpeg_sha=464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c
numpy_sha=d482d171c406ae88c5b19cad3b6a1c4c5209f886ab74bc44c2c865c23f52d860
pyav_sha=4ef7e72c3d3a872584a1215173b16e0226811037f40dcdbf75992631098df1ba
mediamtx_sha=035ee04f91b1c7a0c02e13b2139ca2456e43b6bd6a80e3100e8c228556e07807

download_verified "https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz" "${node_sha}" "${source_root}/node.tar.xz"
tar -xJf "${source_root}/node.tar.xz" -C "${runtime_root}"
export PATH="${runtime_root}/node-v24.19.0-linux-x64/bin:/usr/bin:/bin"
"${runtime_root}/node-v24.19.0-linux-x64/bin/corepack" enable
COREPACK_HOME="${runtime_root}/corepack" "${runtime_root}/node-v24.19.0-linux-x64/bin/corepack" prepare pnpm@10.34.5 --activate

download_verified "https://www.python.org/ftp/python/3.14.7/Python-3.14.7.tar.xz" "${python_sha}" "${source_root}/python.tar.xz"
tar -xJf "${source_root}/python.tar.xz" -C "${build_root}"
pushd "${build_root}/Python-3.14.7"
./configure --prefix="${runtime_root}/python-3.14.7" --enable-shared --with-ensurepip=install
make -j2
make install
popd

download_verified "https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz" "${ffmpeg_sha}" "${source_root}/ffmpeg.tar.xz"
tar -xJf "${source_root}/ffmpeg.tar.xz" -C "${build_root}"
pushd "${build_root}/ffmpeg-8.1.2"
./configure \
  --prefix="${runtime_root}/ffmpeg-8.1.2-linux-demo" \
  --arch=x86_64 --target-os=linux --cc=gcc --cxx=g++ --ar=ar --nm=nm \
  --ranlib=ranlib --strip=strip --pkg-config=pkg-config \
  --disable-gpl --disable-nonfree --disable-autodetect --enable-shared --disable-static \
  --disable-doc --disable-debug --disable-network --enable-zlib --enable-libvpx \
  --enable-libopus --enable-pic --extra-version=tancmark-codespaces-linux-demo-v1
make -j2
make install
make distclean
./configure \
  --prefix="${runtime_root}/ffmpeg-8.1.2-linux-transport" \
  --disable-gpl --disable-nonfree --disable-autodetect --enable-shared --disable-static \
  --disable-doc --disable-debug --enable-network --enable-zlib --enable-libvpx \
  --enable-libopus --enable-pic --extra-version=tancmark-codespaces-linux-demo-transport-v1
make -j2
make install
popd

download_verified "https://files.pythonhosted.org/packages/source/n/numpy/numpy-2.5.2.tar.gz" "${numpy_sha}" "${source_root}/numpy.tar.gz"
download_verified "https://files.pythonhosted.org/packages/source/a/av/av-18.0.0.tar.gz" "${pyav_sha}" "${source_root}/av.tar.gz"
export LD_LIBRARY_PATH="${runtime_root}/python-3.14.7/lib:${runtime_root}/ffmpeg-8.1.2-linux-demo/lib"
"${runtime_root}/python-3.14.7/bin/python3" -m venv "${runtime_root}/venv"
"${runtime_root}/venv/bin/python" -m pip install --disable-pip-version-check "${source_root}/numpy.tar.gz"
PKG_CONFIG_PATH="${runtime_root}/ffmpeg-8.1.2-linux-demo/lib/pkgconfig" \
  "${runtime_root}/venv/bin/python" -m pip install --disable-pip-version-check "${source_root}/av.tar.gz"

download_verified "https://github.com/bluenviron/mediamtx/releases/download/v1.19.1/mediamtx_v1.19.1_linux_amd64.tar.gz" "${mediamtx_sha}" "${source_root}/mediamtx.tar.gz"
mkdir -p "${runtime_root}/mediamtx-1.19.1"
tar -xzf "${source_root}/mediamtx.tar.gz" -C "${runtime_root}/mediamtx-1.19.1" mediamtx LICENSE
chmod 0755 "${runtime_root}/mediamtx-1.19.1/mediamtx"

"${runtime_root}/node-v24.19.0-linux-x64/bin/node" --version
"${runtime_root}/node-v24.19.0-linux-x64/bin/corepack" pnpm --version
"${runtime_root}/ffmpeg-8.1.2-linux-demo/bin/ffmpeg" -version
"${runtime_root}/mediamtx-1.19.1/mediamtx" --version
LD_LIBRARY_PATH="${LD_LIBRARY_PATH}" "${runtime_root}/venv/bin/python" -c 'import av,numpy; print(av.__version__, numpy.__version__)'

authoritative_binary_sha=$(sha256sum "${runtime_root}/ffmpeg-8.1.2-linux-demo/bin/ffmpeg" | awk '{print $1}')
authoritative_probe_sha=$(sha256sum "${runtime_root}/ffmpeg-8.1.2-linux-demo/bin/ffprobe" | awk '{print $1}')
transport_binary_sha=$(sha256sum "${runtime_root}/ffmpeg-8.1.2-linux-transport/bin/ffmpeg" | awk '{print $1}')
mediamtx_binary_sha=$(sha256sum "${runtime_root}/mediamtx-1.19.1/mediamtx" | awk '{print $1}')

test "${authoritative_binary_sha}" = "69274076177abb5a998133711361addcd347d446327655ef0be1dbc751e62c11"
test "${authoritative_probe_sha}" = "86b4f307d12b18d528435b189f7fef942fb045e745d01717a5bdb26a735070b5"
test "${transport_binary_sha}" = "741e8c7719b806785be6f3934a4d1fd9163db5ddc5059105f8660ee0ff21276a"

cat > "${runtime_root}/runtime-provenance.json" <<EOF
{
  "schemaVersion": "tancmark-linux-demo-runtime-provenance-v1",
  "node": {"version": "24.19.0", "archiveSha256": "${node_sha}", "license": "MIT"},
  "pnpm": {"version": "10.34.5", "license": "MIT"},
  "python": {"version": "3.14.7", "archiveSha256": "${python_sha}", "license": "PSF-2.0"},
  "ffmpeg": {"version": "8.1.2", "archiveSha256": "${ffmpeg_sha}", "authoritativeBinarySha256": "${authoritative_binary_sha}", "authoritativeProbeSha256": "${authoritative_probe_sha}", "transportBinarySha256": "${transport_binary_sha}", "gpl": false, "nonfree": false, "license": "LGPL-2.1-or-later"},
  "numpy": {"version": "2.5.2", "archiveSha256": "${numpy_sha}", "license": "BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0"},
  "pyav": {"version": "18.0.0", "archiveSha256": "${pyav_sha}", "license": "BSD-3-Clause"},
  "mediamtx": {"version": "1.19.1", "archiveSha256": "${mediamtx_sha}", "binarySha256": "${mediamtx_binary_sha}", "license": "MIT"}
}
EOF

rm -rf "${build_root}" "${source_root}"
