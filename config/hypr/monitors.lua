-- Auto-configured by Hyprland Display Settings
local omarchy_gdk_scale = 1
local omarchy_monitor_scale = 1

hl.env("GDK_SCALE", tostring(omarchy_gdk_scale))
hl.env("FREETYPE_PROPERTIES", "cff:no-stem-darkening=0 autofitter:no-stem-darkening=0 type1:no-stem-darkening=0 t1cid:no-stem-darkening=0")

-- PC Display (eDP-1)
hl.monitor({
  output = "eDP-1",
  mode = "1920x1200@60",
  position = "0x0",
  scale = 1.0,
  bitdepth = 10,
})

-- External Display (HDMI-A-1)
hl.monitor({
  output = "HDMI-A-1",
  mode = "1920x1080@100",
  position = "auto-up",
  scale = 1.0,
})

-- Default fallback for any other external monitors
hl.monitor({
  output = "",
  mode = "preferred",
  position = "auto",
  scale = omarchy_monitor_scale,
})
