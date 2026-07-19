#!/bin/sh
set -e
if [ -n "$AI_ENGINE_API_KEY" ]; then
  sed -i "s|__AI_ENGINE_API_KEY__|$AI_ENGINE_API_KEY|g" /etc/nginx/conf.d/default.conf
fi
