# dotfiles

Omarchy / Hyprland muhitining shaxsiy konfiguratsiyalari.
Yangi tizimga o'tganda bir zumda o'z muhitini tiklash uchun.

Tarkibi (asosan `~/.config/` ichida):

| Nima | Joyi |
|------|------|
| Hyprland (binding, monitor, input, look'n'feel, scripts) | `config/hypr/` |
| Omarchy shell, bar, pluginlar, hooks, mavzular | `config/omarchy/` |
| Terminallar | `config/alacritty`, `config/foot`, `config/kitty`, `config/ghostty` |
| Boshqa vositalar | `config/btop`, `config/cava`, `config/fastfetch`, `config/tmux`, `config/nvim` |
| Tizim integratsiyasi | `config/autostart`, `config/wireplumber`, `config/fcitx5`, `config/touchegg`, `config/fontconfig` |
| Boshqa | `config/starship.toml`, `config/git/config`, `config/mimeapps.list` |

## Yangi tizimga o'rnatish

```bash
git clone https://github.com/Nurmuhammad-Xusanov/dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

`install.sh` har bir konfiguratsiya papkasini `~/.config/` ichiga symlink qiladi.
Mavjud fayllar avtomatik `*.bak.<sana>` ko'rinishida zaxiralanadi.

O'rnatgandan keyin sessiyani qayta ishga tushirish yoki:

```bash
omarchy restart shell
```

## O'zgarishlarni saqlash

Symlink ishlatilgani uchun `~/.config/` dagi tahrirlar to'g'ridan-to'g'ri shu repoga tushadi:

```bash
cd ~/dotfiles
git add -A
git commit -m "update"
git push
```

## Eslatmalar

- **Maxfiy ma'lumotlar** (`~/.config/gh` tokenlari va h.k.) ataylab qo'shilmagan —
  yangi tizimda `gh auth login` qilish kerak.
- **Ichki `.git` papkalar** (plugin va mavzu repolari) olib tashlangan, shu sababli
  ularni yangilash uchun `omarchy plugin update` ishlamasligi mumkin — qayta klonlang:
  `omarchy plugin clone <nom>`.
- Mavzu: `rainynight`, fon rasmlari `config/omarchy/backgrounds/` ichida.
