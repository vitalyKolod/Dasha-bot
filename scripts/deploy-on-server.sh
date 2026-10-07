#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

APP_DIR=/opt/dasha-bot
REPO_URL=https://github.com/vitalyKolod/Dasha-bot.git
LOCK_FILE=/run/lock/dasha-bot-deploy.lock

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

current_sha=$(git -C "$APP_DIR" rev-parse HEAD)
target_sha=$(git ls-remote "$REPO_URL" refs/heads/main | cut -f1)
if [[ -z "$target_sha" ]]; then
  echo 'Could not resolve GitHub main' >&2
  exit 1
fi
if [[ "$current_sha" == "$target_sha" ]]; then
  echo "Already deployed: ${current_sha:0:12}"
  exit 0
fi

stage=$(mktemp -d /opt/dasha-bot-staging.XXXXXX)
backup="/opt/dasha-bot-rollback-${current_sha:0:12}-$(date +%s)"
cleanup() {
  if [[ -d "$stage" ]]; then rm -rf -- "$stage"; fi
}
trap cleanup EXIT

git clone --quiet --depth 1 --branch main "$REPO_URL" "$stage"
if [[ $(git -C "$stage" rev-parse HEAD) != "$target_sha" ]]; then
  echo 'GitHub main changed while preparing deployment; retry on next run' >&2
  exit 1
fi
cp "$APP_DIR/.env" "$stage/.env"
chmod 600 "$stage/.env"
(
  cd "$stage"
  npm ci --silent
  npm run format:check
  npm run lint
  npm run typecheck
  npm test -- --reporter=dot
  npm run build
)

mv "$APP_DIR" "$backup"
mv "$stage" "$APP_DIR"
stage=''
if pm2 restart dasha-bot --update-env; then
  for _ in {1..15}; do
    if curl --fail --silent --max-time 2 http://127.0.0.1:3001/health >/dev/null; then
      pm2 save
      echo "Deployed: ${target_sha:0:12}"
      exit 0
    fi
    sleep 2
  done
fi

echo 'Health check failed; restoring previous release' >&2
mv "$APP_DIR" "/opt/dasha-bot-failed-${target_sha:0:12}-$(date +%s)"
mv "$backup" "$APP_DIR"
pm2 restart dasha-bot --update-env
exit 1
