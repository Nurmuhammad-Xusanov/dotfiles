-- Keep only your personal keybinding overrides here. Add new bindings or
-- unbind defaults before replacing them.

-- See current bindings and descriptions:
--   omarchy menu keybindings --print

-- To disable every Omarchy default binding, set this in
-- ~/.config/hypr/hyprland.lua before require("default.hypr.omarchy"), then add
-- only the bindings you want below:
--   omarchy_default_bindings = false

-- To disable all preinstalled app/webapp bindings, set:
--   omarchy_preinstalled_bindings = false

-- Add a new binding.
-- o.bind("SUPER + SHIFT + R", "SSH", "alacritty -e ssh your-server")

-- Change an existing binding by unbinding it first, then binding the key again.
-- This example changes SUPER+SPACE from the launcher to the Omarchy root menu.
-- hl.unbind("SUPER + SPACE")
-- o.bind("SUPER + SPACE", "Omarchy menu", "omarchy-menu toggle root")

-- Disable a default binding without replacing it.
-- hl.unbind("SUPER + SHIFT + B")

-- Logitech MX Keys examples:
-- o.bind("SUPER + SHIFT + S", nil, "omarchy-capture-screenshot")
-- o.bind("SUPER + H", nil, "voxtype record toggle")
-- o.bind("SUPER + PERIOD", nil, "omarchy-shell shell toggle omarchy.emojis")
o.bind("SUPER + SHIFT + S", "Screenshot", "omarchy-capture-screenshot")
o.bind("SUPER + B", "Firefox", "firefox")
o.bind("SUPER + C", "Code", "code")
o.bind("SUPER + SHIFT + C", "Opencode", { tui = "opencode", focus = true })
o.bind("SUPER + SHIFT + T", "Telegram", { launch = "Telegram", focus = "org.telegram.desktop" })
o.bind("SUPER + CTRL + L", "Lock screen", "loginctl lock-session")
o.bind("SUPER + Y", "Yandex Music", { launch = "/opt/yandex-music/yandexmusic --gtk-version=3" })
o.bind("SUPER + CTRL + SHIFT + D", "Rotate display", "omarchy-hyprland-monitor-rotate next")
o.bind("CTRL + SHIFT + Z", "Previous track", "omarchy-shell media previous", { locked = true })
o.bind("CTRL + SHIFT + A", "Next track", "omarchy-shell media next", { locked = true })

-- On-screen keyboard for tablet mode.
--
-- Not SUPER+K: Omarchy already binds that to the keybindings cheatsheet
-- (default/hypr/bindings/utilities.lua), and since that bind is registered
-- first it wins - the keyboard bind was silently dead. SUPER+N is free.
o.bind("SUPER + N", "Toggle Keyboard", "/home/nismo/.config/hypr/scripts/toggle-keyboard.sh")

-- Reading mode: open the most recent PDF in the reader (night + fullscreen).
-- SUPER+ALT+P is free (SUPER+P is pseudo-tiling, SUPER+SHIFT+P is Google Photos).
o.bind("SUPER + ALT + P", "PDF Reader (reading mode)", "/home/nismo/.config/hypr/scripts/reading-mode.sh")
