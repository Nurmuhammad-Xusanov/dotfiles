# dotfiles

Personal configuration for an Omarchy / Hyprland setup.
Restore your whole environment on a fresh machine in one step.

Contents (mostly under `~/.config/`):

| What | Where |
|------|-------|
| Hyprland (bindings, monitors, input, look'n'feel, scripts) | `config/hypr/` |
| Omarchy shell, bar, plugins, hooks, themes | `config/omarchy/` |
| Terminals | `config/alacritty`, `config/foot`, `config/kitty`, `config/ghostty` |
| Other tools | `config/btop`, `config/cava`, `config/fastfetch`, `config/tmux`, `config/nvim` |
| System integration | `config/autostart`, `config/wireplumber`, `config/fcitx5`, `config/touchegg`, `config/fontconfig` |
| Misc | `config/starship.toml`, `config/git/config`, `config/mimeapps.list` |

## Install on a new machine

```bash
git clone https://github.com/Nurmuhammad-Xusanov/dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

`install.sh` symlinks every config directory into `~/.config/`.
Existing files are backed up automatically as `*.bak.<timestamp>`.

After installing, restart the session or run:

```bash
omarchy restart shell
```

## Saving changes

Because the configs are symlinked, edits under `~/.config/` land directly in this repo:

```bash
cd ~/dotfiles
git add -A
git commit -m "update"
git push
```

## Notes

- **Secrets** (e.g. `~/.config/gh` tokens) are intentionally excluded — run
  `gh auth login` on the new machine.
- **Nested `.git` directories** (plugin and theme repos) were stripped, so
  `omarchy plugin update` may not work for them — re-clone instead:
  `omarchy plugin clone <name>`.
- Theme: `rainynight`; wallpapers live in `config/omarchy/backgrounds/`.
