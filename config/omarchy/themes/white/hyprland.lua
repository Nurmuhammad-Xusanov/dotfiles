-- White theme Hyprland customization: pure white borders with soft glow
local active_border_color = "rgb(ffffff)"
local inactive_border_color = "rgba(ffffff44)"
local active_shadow_color = "rgba(ffffff4d)"
local inactive_shadow_color = "rgba(ffffff15)"

hl.config({
  general = {
    col = {
      active_border = active_border_color,
      inactive_border = inactive_border_color,
    },
  },

  group = {
    col = {
      border_active = active_border_color,
      border_inactive = inactive_border_color,
    },
  },

  decoration = {
    shadow = {
      enabled = true,
      range = 18,
      render_power = 3,
      color = active_shadow_color,
      color_inactive = inactive_shadow_color,
    },
  },
})
