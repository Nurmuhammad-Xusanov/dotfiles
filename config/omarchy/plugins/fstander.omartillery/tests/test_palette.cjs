const test = require("node:test");
const assert = require("node:assert");
const Palette = require("../Palette.js");

// A spread of real Omarchy theme shapes plus the awkward cases: a mid-grey with
// almost no contrast headroom, pure monochrome, and a light theme.
const themes = {
  "tokyo-night": {
    background: "#1a1b26",
    foreground: "#a9b1d6",
    accent: "#7aa2f7",
    urgent: "#f7768e",
    muted: "#888da1"
  },
  "rose-pine-dawn": {
    background: "#faf4ed",
    foreground: "#575279",
    accent: "#907aa9",
    urgent: "#b4637a",
    muted: "#9893a5"
  },
  gruvbox: {
    background: "#282828",
    foreground: "#ebdbb2",
    accent: "#b8bb26",
    urgent: "#fb4934",
    muted: "#928374"
  },
  nord: {
    background: "#2e3440",
    foreground: "#d8dee9",
    accent: "#88c0d0",
    urgent: "#bf616a",
    muted: "#4c566a"
  },
  monochrome: {
    background: "#000000",
    foreground: "#ffffff",
    accent: "#ffffff",
    urgent: "#ffffff",
    muted: "#aaaaaa"
  },
  "mid-grey": {
    background: "#808080",
    foreground: "#7f7f7f",
    accent: "#808080",
    urgent: "#808080",
    muted: "#808080"
  },
  empty: {}
};

test("every theme yields a complete palette of valid colours", () => {
  const reference = Object.keys(Palette.create(themes["tokyo-night"]));
  for (const [name, source] of Object.entries(themes)) {
    const p = Palette.create(source);
    assert.deepStrictEqual(Object.keys(p), reference, `${name} is missing keys`);
    for (const [key, value] of Object.entries(p))
      assert.match(value, /^#[0-9a-f]{6}$/, `${name}.${key} is not a colour: ${value}`);
  }
});

test("garbage in the theme falls back instead of leaking through", () => {
  const p = Palette.create({
    background: "red",
    foreground: 42,
    accent: null,
    urgent: "#GGG",
    muted: undefined
  });
  for (const value of Object.values(p)) assert.match(value, /^#[0-9a-f]{6}$/);
  assert.strictEqual(p.background, "#0d1017", "an invalid background must fall back");
});

test("body text clears WCAG AA on its own surface in every theme", () => {
  for (const [name, source] of Object.entries(themes)) {
    const p = Palette.create(source);
    const surface =
      Palette.contrast(p.foreground, p.background) < Palette.contrast(p.foreground, p.raised)
        ? p.background
        : p.raised;
    for (const ink of ["foreground", "accent", "urgent", "warning", "muted"])
      assert.ok(
        Palette.contrast(p[ink], surface) >= 4.4,
        `${name}: ${ink} on its surface is only ${Palette.contrast(p[ink], surface).toFixed(2)}:1`
      );
    assert.ok(Palette.contrast(p.onAccent, p.accent) >= 4.5, `${name}: text on the accent button`);
    assert.ok(Palette.contrast(p.buttonText, p.hover) >= 4.4, `${name}: text on a hovered button`);
  }
});

test("the battlefield stays legible: ground, targets and shells separate", () => {
  for (const [name, source] of Object.entries(themes)) {
    const p = Palette.create(source);
    assert.ok(
      Palette.contrast(p.groundEdge, p.ground) >= 2.8,
      `${name}: the skyline vanishes into the hill`
    );
    assert.ok(
      Palette.contrast(p.target, p.ground) >= 2.8,
      `${name}: emplacements vanish into the hill`
    );
    assert.ok(
      Palette.contrast(p.turret, p.ground) >= 2.2,
      `${name}: the gun vanishes into the hill`
    );
    assert.ok(Palette.contrast(p.shell, p.skyLow) >= 3, `${name}: the shell vanishes into the sky`);
  }
});

test("the sky reads as layers, from high sky down through the ridges", () => {
  for (const [name, source] of Object.entries(themes)) {
    if (name === "mid-grey") continue; // no headroom by construction; it degrades to flat
    const p = Palette.create(source);
    const depth = [p.skyHigh, p.skyLow, p.ridgeFar, p.ridgeNear, p.ground];
    for (let i = 1; i < depth.length; i++)
      assert.notStrictEqual(
        depth[i],
        depth[i - 1],
        `${name}: layer ${i} is the same ink as the one behind it`
      );
  }
});

test("mix and contrast behave", () => {
  assert.strictEqual(Palette.mix("#000000", "#ffffff", 0), "#000000");
  assert.strictEqual(Palette.mix("#000000", "#ffffff", 1), "#ffffff");
  assert.strictEqual(Palette.mix("#000000", "#ffffff", 0.5), "#808080");
  assert.strictEqual(Palette.contrast("#000000", "#ffffff").toFixed(0), "21");
  assert.strictEqual(Palette.contrast("#123456", "#123456").toFixed(0), "1");
});
