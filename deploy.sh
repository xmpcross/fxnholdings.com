#!/usr/bin/env bash
# Build and publish fxnholdings.com on this host.
#
#   ./deploy.sh          build the working tree and swap it in
#   ./deploy.sh --pull   git pull --ff-only first
#
# nginx serves dist/. The site is built into .dist-build/ and only swapped in
# when the build succeeds, so a failed build never touches the live site.
set -Eeuo pipefail
cd "$(dirname "$0")"
export PATH="/usr/local/lib/nodejs/current/bin:$PATH"

# Serialise deploys so they cannot rename each other's build/backup directories.
exec 9>.deploy.lock
flock -n 9 || { echo "Another deployment is running." >&2; exit 1; }

if [[ "${1:-}" == "--pull" ]]; then git pull --ff-only; fi

npm ci --omit=dev --no-audit --no-fund >/dev/null
rm -rf .dist-build
BUILD_OUT=.dist-build python3 _src/build.py | tail -1

rm -rf .dist-old
previous=false
if [[ -d dist ]]; then mv dist .dist-old; previous=true; fi
rollback() {
  local status=$?
  trap - ERR
  if [[ "$previous" == true && -d .dist-old ]]; then
    rm -rf dist
    mv .dist-old dist
    echo "Deployment failed; restored the previous static site. Check the API service before retrying." >&2
  fi
  exit "$status"
}
trap rollback ERR
mv .dist-build dist

systemctl restart fxnholdings-api.service
for i in $(seq 1 20); do
  code=$(curl --max-time 2 -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4330/api/health || true)
  [[ "$code" == "200" ]] && break
  sleep 0.5
done
if [[ "$code" != "200" ]]; then
  echo "API health check failed (HTTP $code)." >&2
  false
fi
trap - ERR
echo "api: /api/health answered 200"
echo "deployed $(git rev-parse --short HEAD) on $(git branch --show-current)"
