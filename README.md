# Arch Linux / Hyprland Dotfiles (`omarchy-hyprland-dotfiles`)

Personal system configuration and desktop environment for an **Arch Linux + Omarchy / Hyprland (Wayland)** workflow, optimized for convertibles/2-in-1s and multi-monitor workstations.

Featuring custom-built display management utilities, hardware kernel event hooks, touch & stylus calibration, Howdy Face ID PAM biometric authentication, and dual monochrome themes (**Vantablack** & **White**).

---

<div align="center">
  <img src="assets/desktop-vantablack.png" alt="Vantablack Hyprland Desktop Preview" width="100%" />
  <p><em>Vantablack Monochrome Desktop — Pure #000000 OLED theme, minimal top bar, and custom workspace indicators</em></p>
</div>

---

## Highlights & Engineering Features

- **Hyprland Lua Configuration Architecture**: Built on modern Hyprland Lua configuration with dynamic evaluation and zero hardcoded paths.
- **Biometric Face ID & PAM Integration**:
  - Infrared facial recognition integration via **Howdy** and Linux Pluggable Authentication Modules (PAM).
  - Configured for instantaneous, zero-touch authentication across `hyprlock` (lockscreen) and `sudo` terminal privilege elevation with automatic password fallback.
  - Low-power 2 FPS camera motion detection mode (`omarchy-face-id`) to conserve battery when idle.
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

## Biometric PAM Configuration (Howdy Face ID)

PAM service configurations are provided under `config/pam.d/`:

### 1. Hyprlock Lockscreen (`config/pam.d/hyprlock`)
```text
auth    sufficient    pam_howdy.so

auth    required      pam_faillock.so preauth silent
auth    [success=1 default=bad] pam_unix.so try_first_pass
auth    [default=die] pam_faillock.so authfail

account include system-local-login
password include system-local-login
session include system-local-login
```

### 2. Sudo Terminal Elevation (`config/pam.d/sudo`)
```text
auth            sufficient      /usr/lib/security/pam_howdy.so
auth            include         system-auth
account         include         system-auth
session         include         system-auth
```

### 3. Face ID Low-Power Watcher (`config/omarchy-face-id/config.toml`)
Controls camera polling sensitivity, rejection hold timeouts, and sleep indicators so the IR camera does not consume power when the display is sleeping.

---

## Directory Structure

```text
├── assets/
│   └── desktop-vantablack.png # Desktop preview screenshot
├── config/
│   ├── hypr/
│   │   ├── bindings.lua           # Keybindings & input lock submaps
│   │   ├── hyprland.lua           # Hyprland bootstrap & module loader
│   │   ├── input.lua              # MPP 2.0 stylus & touchscreen calibration
│   │   ├── looknfeel.lua          # Window styling, blur, borders, and animations
│   │   ├── monitors.lua           # Display layout & color management
│   │   ├── plugins.lua            # Plugin lifecycle loader (hyprgrass)
│   │   └── scripts/
│   │       ├── display-manager.py         # Full GTK3 display configuration utility
│   │       ├── display-switcher-popup.py  # Win+P style projector quick-switcher
│   │       ├── tablet-mode.sh             # Kernel WMI fold event detector
│   │       ├── rotate-screen.sh           # Sensor-driven orientation daemon
│   │       ├── lock-mode.sh               # Device-level input lock controller
│   │       └── toggle-keyboard.sh         # On-screen keyboard daemon
│   ├── pam.d/                     # Pluggable Authentication Module templates
│   │   ├── hyprlock               # Face ID lockscreen unlock
│   │   └── sudo                   # Biometric terminal privilege elevation
│   ├── omarchy-face-id/           # Face ID runtime configuration
│   ├── omarchy/
│   │   ├── themes/                # Custom themes (vantablack, white, rainynight)
│   │   ├── backgrounds/           # Themed wallpapers (vantablack, white)
│   │   ├── hooks/theme-set.d/     # Dynamic theme sync hooks (GTK, Firefox, CAVA)
│   │   ├── themed/                # Template files for dynamic palette injection
│   │   ├── plugins/               # Custom desktop widgets (multi-monitor workspaces)
│   │   ├── shell.json             # Desktop shell layout and clock configs
│   │   └── shell.toml             # Global shell parameters
│   ├── alacritty/                 # Alacritty terminal configuration
│   ├── foot/                      # Foot Wayland terminal configuration
│   ├── kitty/                     # Kitty GPU-accelerated terminal
│   ├── ghostty/                   # Ghostty terminal configuration
│   ├── btop/                      # Resource monitor configuration & themes
│   ├── cava/                      # Audio visualizer settings & shaders
│   └── fastfetch/                 # System information display
├── install.sh                     # Idempotent installer and symlink manager
└── README.md
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
