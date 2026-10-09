#!/usr/bin/env bash
# Build and publish fxnholdings.com on this host.
#
#   ./deploy.sh          build the working tree and swap it in
#   ./deploy.sh --pull   git pull --ff-only first
#
# nginx serves dist/. The site is built into .dist-build/ and only swapped in
# when the build succeeds, so a failed build never touches the live site.
set -euo pipefail
cd "$(dirname "$0")"
export PATH="/usr/local/lib/nodejs/current/bin:$PATH"

if [[ "${1:-}" == "--pull" ]]; then git pull --ff-only; fi

npm ci --omit=dev --no-audit --no-fund >/dev/null
rm -rf .dist-build
BUILD_OUT=.dist-build python3 _src/build.py | tail -1

rm -rf .dist-old
[[ -d dist ]] && mv dist .dist-old
mv .dist-build dist
rm -rf .dist-old

systemctl restart fxnholdings-api.service
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:4330/api/contact || true)
  [[ "$code" == "400" ]] && break
  sleep 0.5
done
echo "api: /api/contact answered $code (400 = up and validating)"
echo "deployed $(git rev-parse --short HEAD) on $(git branch --show-current)"
