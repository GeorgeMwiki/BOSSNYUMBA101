#!/bin/bash
# Generate PWA icons from SVG placeholders.
set -e
ICONS_DIR="$(cd "$(dirname "$0")/../public/icons" && pwd)"
cd "$ICONS_DIR"
sips -s format png icon-192.svg --out icon-192.png 2>/dev/null || true
sips -s format png icon-512.svg --out icon-512.png 2>/dev/null || true
for size in 72 96 128 144 152 384; do sips -z $size $size icon-192.png --out icon-$size.png; done
echo "Icons generated"
