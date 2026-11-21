/* Omarchy Firefox Theme Template */
:root {
  --b-theme-mode: {{ mode }};
  --b-bg: {{ background }};
  --b-surface: {{ mix background foreground 5% }};
  --b-surface-high: {{ mix background foreground 10% }};
  --b-tab-selected: {{ mix background foreground 7% }};
  --b-border: color-mix(in srgb, {{ foreground }} 18%, transparent);
  --b-border-subtle: color-mix(in srgb, {{ foreground }} 35%, transparent);
  --b-fg: {{ foreground }};
  --b-muted: {{ muted }};
  --b-dim: color-mix(in srgb, {{ foreground }} 50%, transparent);
  --b-accent: {{ accent }};
  --b-accent-fg: {{ background }};
  --b-scrollbar-thumb: {{ mix background foreground 20% }};
  --b-scrollbar-track: {{ background }};
  --b-selection-bg: {{ selection }};
  --b-selection-fg: {{ foreground }};
  --b-radius: 6px;
}
