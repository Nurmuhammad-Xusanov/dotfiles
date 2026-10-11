-- Extra autostart processes.
-- o.launch_on_start("my-service")
o.launch_on_start("hypridle")
-- Auto-rotate screen based on sensor
o.launch_on_start("~/.config/hypr/scripts/rotate-screen.sh")

-- Fold detection: disables the physical keyboard/touchpad in tablet mode
o.launch_on_start("~/.config/hypr/scripts/tablet-mode.sh")
