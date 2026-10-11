#!/usr/bin/env bash
set -euo pipefail

DOTFILES="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${XDG_CONFIG_HOME:-$HOME/.config}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$TARGET"

shopt -s dotglob nullglob

for entry in "$DOTFILES"/config/*; do
  name="$(basename "$entry")"
  dest="$TARGET/$name"

  if [ -L "$dest" ] && [ "$(readlink "$dest")" = "$entry" ]; then
    echo "ok    $name"
    continue
  fi

  if [ -e "$dest" ] || [ -L "$dest" ]; then
    echo "bak   $name -> $name.bak.$STAMP"
    mv "$dest" "$dest.bak.$STAMP"
  fi

  ln -s "$entry" "$dest"
  echo "link  $name"
done

echo
echo "Done. Restart the session (or run 'omarchy restart shell') to apply."
