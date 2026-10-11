// Derives the game palette from the Omarchy theme, nudging each ink toward
// black or white until it meets a contrast target on the surface it sits on.
// Every colour the game draws comes from here, so a theme switch repaints the
// whole battlefield without the renderer knowing a theme exists.
function color(value, fallback) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback;
}
function rgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
}
function mix(a, b, amount) {
  a = rgb(a);
  b = rgb(b);
  return (
    "#" +
    a
      .map(function (v, i) {
        return Math.round(v + (b[i] - v) * amount)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}
function luminance(hex) {
  return rgb(hex)
    .map(function (v) {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    })
    .reduce(function (sum, v, i) {
      return sum + v * [0.2126, 0.7152, 0.0722][i];
    }, 0);
}
function contrast(a, b) {
  a = luminance(a);
  b = luminance(b);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function readable(ink, background, ratio) {
  if (contrast(ink, background) >= ratio) return ink;
  var end =
    contrast("#ffffff", background) > contrast("#000000", background) ? "#ffffff" : "#000000";
  for (var step = 1; step <= 40; step++) {
    var candidate = mix(ink, end, step / 40);
    if (contrast(candidate, background) >= ratio) return candidate;
  }
  return end;
}
function create(source) {
  source = source || {};
  var background = color(source.background, "#0d1017");
  var foreground = readable(color(source.foreground, "#e4e6ec"), background, 7);
  // Mid-grey custom backgrounds have very little contrast headroom. Move their
  // panels away from the text instead of washing that last contrast out.
  var tint =
    contrast(foreground, background) < 7
      ? luminance(foreground) > luminance(background)
        ? "#000000"
        : "#ffffff"
      : foreground;
  var surface = mix(background, tint, 0.025),
    raised = mix(background, tint, 0.05);
  var textSurface =
    contrast(foreground, background) < contrast(foreground, raised) ? background : raised;
  var accent = readable(color(source.accent, "#7fd1c1"), textSurface, 4.5);
  var urgent = readable(color(source.urgent, "#e0685c"), textSurface, 4.5);
  // Omarchy themes carry only five inks, and none of them is a warning colour.
  // Mixing one would invent a hue the theme never chose, so warning falls back
  // to urgent and the game separates those roles by shape instead: armour gets
  // a second ring, danger gets weight.
  var warning = readable(color(source.warning, color(source.urgent, "#e8b96b")), textSurface, 4.5);
  var muted = readable(color(source.muted, mix(background, foreground, 0.6)), textSurface, 4.5);
  var hover = mix(background, tint, 0.09),
    accentHover = mix(accent, foreground, 0.12);
  // The battlefield reads as sky over ground. Both are derived from the theme
  // background so the scene never fights the desktop it is drawn on.
  var ground = mix(background, tint, 0.17);
  return {
    background: background,
    foreground: foreground,
    surface: surface,
    raised: raised,
    muted: muted,
    accent: accent,
    urgent: urgent,
    warning: warning,
    border: mix(background, foreground, 0.23),
    strongBorder: mix(background, foreground, 0.4),
    hover: hover,
    accentHover: accentHover,
    onAccent: readable(background, accent, 7),
    buttonText: readable(foreground, hover, 4.5),
    buttonMuted: readable(muted, hover, 4.5),
    skyHigh: mix(background, accent, 0.02),
    skyLow: mix(background, accent, 0.09),
    haze: mix(background, accent, 0.13),
    ridgeFar: mix(background, tint, 0.075),
    ridgeNear: mix(background, tint, 0.115),
    ground: ground,
    groundDeep: mix(background, tint, 0.075),
    groundEdge: readable(mix(background, accent, 0.55), ground, 3),
    scorch: mix(mix(ground, "#000000", 0.45), urgent, 0.14),
    turret: readable(mix(background, foreground, 0.45), ground, 2.5),
    turretDark: mix(background, foreground, 0.24),
    target: readable(color(source.accent, "#7fd1c1"), ground, 3),
    targetArmour: readable(warning, ground, 3),
    targetDead: mix(background, foreground, 0.18),
    shell: readable(foreground, mix(background, accent, 0.05), 5),
    tracer: mix(background, foreground, 0.5),
    grid: mix(background, foreground, 0.24),
    aim: mix(background, accent, 0.45),
    blast: readable(warning, mix(background, accent, 0.09), 3),
    blastCore: readable(color(source.urgent, "#e0685c"), mix(background, accent, 0.09), 3),
    smoke: mix(background, foreground, 0.3),
    hostile: readable(color(source.urgent, "#e0685c"), mix(background, accent, 0.05), 4),
    flag: readable(accent, mix(background, accent, 0.05), 3),
    // A flag of truce: as close to white as the theme allows while still
    // clearing contrast against the ground it is raised over. On a light
    // theme legibility wins and it comes out pale rather than white.
    parley: readable(mix(background, "#ffffff", 0.92), ground, 3)
  };
}
if (typeof module !== "undefined")
  module.exports = { create: create, mix: mix, contrast: contrast };
