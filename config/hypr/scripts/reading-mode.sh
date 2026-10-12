#!/usr/bin/env bash
# Reading mode: open a PDF in the reader (night + fullscreen).
#
#   reading-mode.sh [file.pdf]
#
# With no argument it opens the most recently modified PDF found under the
# usual document locations.
#
# Bound to a 4-finger swipe up (hyprgrass) and SUPER + ALT + P.
set -euo pipefail

READER="$HOME/Projects/pdfreader/run.sh"

if [ ! -x "$READER" ]; then
    notify-send "PDF Reader" "run.sh topilmadi: $READER" 2>/dev/null || true
    exit 1
fi

file="${1:-}"
if [ -z "$file" ] || [ ! -f "$file" ]; then
    file="$(find "$HOME/Documents" "$HOME/Downloads" "$HOME/Desktop" \
        -maxdepth 4 -type f -iname '*.pdf' -printf '%T@\t%p\n' 2>/dev/null \
        | sort -rn | head -n1 | cut -f2-)"
fi

if [ -z "${file:-}" ]; then
    notify-send "PDF Reader" "PDF fayl topilmadi" 2>/dev/null || true
    exit 0
fi

exec "$READER" --reading-mode "$file"
