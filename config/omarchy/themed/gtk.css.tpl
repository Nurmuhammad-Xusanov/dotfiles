/* Omarchy Adaptive GTK & Libadwaita Theme Template */
/* Generated dynamically by omarchy-theme-set from the active theme's colors.toml */

/* Core Libadwaita Colors */
@define-color accent_color {{ accent }};
@define-color accent_bg_color {{ accent }};
@define-color accent_fg_color {{ background }};

@define-color window_bg_color {{ background }};
@define-color window_fg_color {{ foreground }};

@define-color view_bg_color {{ background }};
@define-color view_fg_color {{ foreground }};

@define-color headerbar_bg_color {{ dark_background }};
@define-color headerbar_fg_color {{ foreground }};
@define-color headerbar_border_color {{ darker_background }};
@define-color headerbar_backdrop_color {{ background }};

@define-color sidebar_bg_color {{ dark_background }};
@define-color sidebar_fg_color {{ foreground }};
@define-color sidebar_backdrop_color {{ background }};
@define-color sidebar_border_color {{ darker_background }};

@define-color secondary_sidebar_bg_color {{ darker_background }};
@define-color secondary_sidebar_fg_color {{ foreground }};

@define-color card_bg_color {{ dark_background }};
@define-color card_fg_color {{ foreground }};
@define-color card_border_color {{ darker_background }};

@define-color popover_bg_color {{ dark_background }};
@define-color popover_fg_color {{ foreground }};

@define-color dialog_bg_color {{ dark_background }};
@define-color dialog_fg_color {{ foreground }};

/* GTK3 Compatibility */
@define-color theme_bg_color {{ dark_background }};
@define-color theme_fg_color {{ foreground }};
@define-color theme_base_color {{ background }};
@define-color theme_text_color {{ foreground }};
@define-color theme_selected_bg_color {{ accent }};
@define-color theme_selected_fg_color {{ background }};
@define-color borders {{ darker_background }};

/* Nautilus Polish */
.nautilus-window {
  background-color: @window_bg_color;
  color: @window_fg_color;
}

.nautilus-window .sidebar {
  background-color: @sidebar_bg_color;
  color: @sidebar_fg_color;
}

.nautilus-window .view {
  background-color: @view_bg_color;
  color: @view_fg_color;
}

.nautilus-window .floating-bar {
  background-color: @card_bg_color;
  color: @card_fg_color;
  border: 1px solid @headerbar_border_color;
  border-radius: 8px;
}
