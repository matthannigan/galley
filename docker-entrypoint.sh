#!/bin/sh
set -e

# Ensure data subdirectories exist and are owned by the galley user
for dir in docs backups config; do
  mkdir -p "/data/$dir"
  chown galley:galley "/data/$dir"
done

# Seed with sample document if docs directory is empty
if [ -z "$(ls -A /data/docs 2>/dev/null)" ] && [ -f /app/docs/sample.html ]; then
  cp /app/docs/sample.html /data/docs/
  chown galley:galley /data/docs/sample.html
fi

# Drop privileges and run the app
exec su-exec galley "$@"
