#!/bin/sh
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

# Resolve or create a group with the requested GID
TARGET_GROUP=$(getent group "$PGID" | cut -d: -f1)
if [ -z "$TARGET_GROUP" ]; then
  addgroup -g "$PGID" -S galley
  TARGET_GROUP=galley
fi

# Resolve or create a user with the requested UID in the target group
TARGET_USER=$(getent passwd "$PUID" | cut -d: -f1)
if [ -z "$TARGET_USER" ]; then
  adduser -u "$PUID" -G "$TARGET_GROUP" -S galley
  TARGET_USER=galley
fi

# Ensure data subdirectories exist and are owned by the target user
for dir in docs backups config; do
  mkdir -p "/data/$dir"
  chown "$PUID:$PGID" "/data/$dir"
done

# Seed with sample document if docs directory is empty
if [ -z "$(ls -A /data/docs 2>/dev/null)" ] && [ -f /app/docs/sample.html ]; then
  cp /app/docs/sample.html /data/docs/
  chown "$PUID:$PGID" /data/docs/sample.html
fi

# Drop privileges and run the app
exec su-exec "$TARGET_USER" "$@"
