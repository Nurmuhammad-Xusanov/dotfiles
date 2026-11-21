-- Change the default Omarchy look'n'feel.

-- https://wiki.hypr.land/Configuring/Basics/Variables/#general
-- hl.config({
--   general = {
--     -- No gaps between windows or borders.
--     gaps_in = 0,
--     gaps_out = 0,
--     border_size = 0,
--
--     -- Change to niri-like side-scrolling layout.
--     layout = "scrolling",
--   },
-- })

hl.config({
  general = {
    gaps_in = 5,
    gaps_out = 10,
    border_size = 2,
    resize_on_border = true,
  },
})

hl.config({
  decoration = {
    -- Use round window corners.
    rounding = 10,

    -- Window opacity
    active_opacity = 1.0,
    inactive_opacity = 0.94,

    -- Dim unfocused windows (0.0 = no dim, 1.0 = fully dimmed).
    dim_inactive = true,
    dim_strength = 0.1,

    -- Smooth drop shadows for depth
    shadow = {
      enabled = true,
      range = 20,
      render_power = 3,
      color = "rgba(00000066)",
    },

    -- Frosted glass blur effect
    blur = {
      enabled = true,
      size = 6,
      passes = 3,
      new_optimizations = true,
      vibrancy = 0.17,
      ignore_opacity = true,
    },
  },
})

-- https://wiki.hypr.land/Configuring/Basics/Variables/#decoration
hl.animation({
  leaf = "windows",
  enabled = true,
  speed = 5.5,
  bezier = "easeOutQuint",
})

hl.animation({
  leaf = "windowsIn",
  enabled = true,
  speed = 5.5,
  bezier = "easeOutQuint",
  style = "popin 88%",
})

hl.animation({
  leaf = "windowsOut",
  enabled = true,
  speed = 4.5,
  bezier = "easeInOutCubic",
  style = "popin 88%",
})

hl.animation({
  leaf = "windowsMove",
  enabled = true,
  speed = 5.5,
  bezier = "easeOutQuint",
})

hl.animation({
  leaf = "border",
  enabled = true,
  speed = 5.5,
  bezier = "easeOutQuint",
})

hl.animation({
  leaf = "layers",
  enabled = true,
  speed = 4.5,
  bezier = "easeOutQuint",
})

hl.animation({
  leaf = "fade",
  enabled = true,
  speed = 4.5,
  bezier = "easeInOutCubic",
})

hl.animation({
  leaf = "workspaces",
  enabled = true,
  speed = 6.5,
  bezier = "easeOutQuint",
  style = "slide",
})
-- https://wiki.hypr.land/Configuring/Basics/Variables/#layout
-- hl.config({
--   layout = {
--     -- Avoid overly wide single-window layouts on wide screens.
--     single_window_aspect_ratio = { 1, 1 },
--   },
-- })

-- https://wiki.hypr.land/Configuring/Layouts/Scrolling-Layout/
-- hl.config({
--   scrolling = {
--     -- See only one column per screen instead of two.
--     column_width = 0.97,
--   },
hl.config({
  gestures = {
    workspace_swipe_invert = false,
    workspace_swipe_distance = 500,
    workspace_swipe_cancel_ratio = 0.2,
    workspace_swipe_create_new = false,
  },
})

hl.gesture({ fingers = 3, direction = "horizontal", action = "workspace" })
-- Disable color management clamping so OLED wide gamut (DCI-P3) outputs natively and vividly
hl.config({
  render = {
    cm_enabled = false,
  },
})

-- Float and center display switcher and settings windows
hl.window_rule({
  name = "display-popup-float",
  match = { class = "display-switcher-popup.py" },
  float = true,
  center = true,
  size = { 360, 430 },
})

hl.window_rule({
  name = "display-manager-float",
  match = { class = "display-manager.py" },
  float = true,
  center = true,
  size = { 700, 600 },
})



-- Opt another application in to Omarchy's standard transparency.
-- Find its class with: hyprctl clients
-- o.transparent_window("my-app")
-- o.transparent_window("my-app", "0.9 0.85") -- Custom active/inactive opacity.
