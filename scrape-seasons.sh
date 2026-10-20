#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <country> <league> [startYear=2013] [endYear=2025] [fileType=json]"
  echo "Example: $0 france ligue-1"
  exit 1
fi

country="$1"
league="$2"
start="${3:-2013}"
end="${4:-2025}"
fileType="${5:-json}"

for ((y = start; y <= end; y++)); do
  docker compose run --rm -T scraper country="$country" league="$league-$y-$((y + 1))" fileType="$fileType"
done
