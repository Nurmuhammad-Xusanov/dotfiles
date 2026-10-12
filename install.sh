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

# --- PDF Reader desktop integration -------------------------------------
# If the app is present, register its .desktop entry, icon and make it the
# default application for PDFs.
PDR="$HOME/Projects/pdfreader"
if [ -f "$PDR/com.nismo.pdfreader.desktop" ]; then
  APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  ICONS="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/scalable/apps"
  mkdir -p "$APPS" "$ICONS"
  cp -f "$PDR/com.nismo.pdfreader.desktop" "$APPS/"
  [ -f "$PDR/com.nismo.pdfreader.svg" ] && cp -f "$PDR/com.nismo.pdfreader.svg" "$ICONS/"
  update-desktop-database "$APPS" 2>/dev/null || true
  gtk-update-icon-cache -f -t "${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor" 2>/dev/null || true
  xdg-mime default com.nismo.pdfreader.desktop application/pdf 2>/dev/null || true
  echo "pdf   desktop entry + default application/pdf"
fi

echo
echo "Done. Restart the session (or run 'omarchy restart shell') to apply."
