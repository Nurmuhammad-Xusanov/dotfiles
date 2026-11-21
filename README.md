# System Dotfiles & Environment Architecture

Personal system configuration and desktop environment for an **Omarchy / Hyprland (Wayland)** workflow, optimized for convertibles/2-in-1s and multi-monitor workstations.

Featuring custom-built display management utilities, hardware kernel event hooks, touch & stylus calibration, and dual monochrome themes (**Vantablack** & **White**).

---

## Highlights & Engineering Features

- **Hyprland Lua Configuration Architecture**: Built on modern Hyprland Lua configuration with dynamic evaluation and zero hardcoded paths.
- **Hardware Integration & Linux Tablet Mode**: Real-time HP OmniBook X Flip 14 tablet fold detection via Linux kernel WMI event parsing (`hp_wmi`), automatically switching input states between laptop and tablet/stylus modes.
- **Custom Display Switcher & Manager (`display-manager.py`, `display-switcher-popup.py`)**:
  - Python / GTK3 native desktop applications for display arrangement, multi-monitor configuration (e.g., eDP-1 10-bit OLED + 100Hz HDMI external), resolution/refresh rate negotiation, and `Win+P` quick-projection switching.
- **Stylus & Touch Digitizer Calibration**: 1:1 hardware coordinate mapping and auto-rotation for MPP 2.0 stylus and capacitive touchscreen via accelerometer sensors (`iio-sensor-proxy`).
- **Complete Input Interception Submap**: Low-level Hyprland submap for full input device locking (touchpad, touch, keyboards, external USB mice).
- **Dual Monochrome Aesthetic Themes**:
  - **Vantablack**: Pure `#000000` pitch-black dark theme engineered for OLED battery savings and focus.
  - **White**: Pure `#ffffff` high-contrast crisp light theme.
  - **Dynamic Cross-Application Theming Hooks**: Automated synchronization hooks applying color palettes across GTK3/4, Firefox (`user.js` / `userChrome`), CAVA visualizer, and Omarchy shell surfaces on theme switches.

---

## Directory Structure

```text
config/
├── hypr/
│   ├── bindings.lua           # Keybindings & input lock submaps
│   ├── hyprland.lua           # Hyprland bootstrap & module loader
│   ├── input.lua              # MPP 2.0 stylus & touchscreen calibration
│   ├── looknfeel.lua          # Window styling, blur, borders, and animations
│   ├── monitors.lua           # Display layout & color management
│   ├── plugins.lua            # Plugin lifecycle loader (hyprgrass)
│   └── scripts/
│       ├── display-manager.py         # Full GTK3 display configuration utility
│       ├── display-switcher-popup.py  # Win+P style projector quick-switcher
│       ├── tablet-mode.sh             # Kernel WMI fold event detector
│       ├── rotate-screen.sh           # Sensor-driven orientation daemon
│       ├── lock-mode.sh               # Device-level input lock controller
│       └── toggle-keyboard.sh         # On-screen keyboard daemon
├── omarchy/
│   ├── themes/                # Custom themes (vantablack, white, rainynight)
│   ├── backgrounds/           # Themed wallpapers (vantablack, white)
│   ├── hooks/theme-set.d/     # Dynamic theme sync hooks (GTK, Firefox, CAVA)
│   ├── themed/                # Template files for dynamic palette injection
│   ├── plugins/               # Custom desktop widgets (multi-monitor workspaces)
│   ├── shell.json             # Desktop shell layout and clock configs
│   └── shell.toml             # Global shell parameters
├── alacritty/                 # Alacritty terminal configuration
├── foot/                      # Foot Wayland terminal configuration
├── kitty/                     # Kitty GPU-accelerated terminal
├── ghostty/                   # Ghostty terminal configuration
├── btop/                      # Resource monitor configuration & themes
├── cava/                      # Audio visualizer settings & shaders
└── fastfetch/                 # System information display
```

---

## Quick Installation

```bash
git clone https://github.com/Nurmuhammad-Xusanov/dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

`install.sh` automatically creates symlinks from this repository into `~/.config/`, safely creating timestamped backups (`*.bak.<timestamp>`) of any pre-existing configuration files.

To apply changes to the live desktop session:
```bash
omarchy restart shell
```

---

## License

Personal dotfiles released under the [MIT License](LICENSE).
