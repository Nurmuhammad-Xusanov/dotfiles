// The battlefield: a seeded heightmap that shells fly over and craters eat
// into. Everything here is pure and deterministic, so a level number plus a
// seed always rebuilds the identical ground on any machine.
var STEP = 4; // world pixels between surface samples

// mulberry32: small, fast, and stable across engines, which matters because
// the offline tests and the running game must agree on every level.
function rng(seed) {
  var state = seed >>> 0;
  return function () {
    state = (state + 0x6d2b79f5) >>> 0;
    var t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

// Midpoint displacement over a power-of-two span, then resampled to the
// column count. Roughness scales the initial displacement; each subdivision
// halves it, which is what gives the ridges their self-similar look.
function ridgeline(random, count, roughness) {
  var size = 1;
  while (size + 1 < count) size *= 2;
  var points = new Array(size + 1);
  points[0] = random();
  points[size] = random();
  var span = size,
    amplitude = roughness;
  while (span > 1) {
    var half = span >> 1;
    for (var i = half; i < size; i += span)
      points[i] = (points[i - half] + points[i + half]) / 2 + (random() * 2 - 1) * amplitude;
    span = half;
    amplitude *= 0.5;
  }
  var out = new Array(count);
  for (var c = 0; c < count; c++) {
    var t = (c / (count - 1)) * size,
      base = Math.floor(t),
      frac = t - base;
    var a = points[Math.min(base, size)],
      b = points[Math.min(base + 1, size)];
    out[c] = a + (b - a) * frac;
  }
  return out;
}

// options: { seed, roughness, hilliness, pillars: [{ x, width, height }] }
function generate(width, height, options) {
  options = options || {};
  var random = rng(options.seed === undefined ? 1 : options.seed);
  var count = Math.max(8, Math.ceil(width / STEP) + 1);
  var raw = ridgeline(random, count, options.roughness === undefined ? 0.9 : options.roughness);
  var low = Math.min.apply(null, raw),
    high = Math.max.apply(null, raw),
    range = high - low || 1;
  // The playable band. The floor sits near the bottom of the field and the
  // band always has some depth, so even the calmest level reads as a landscape
  // with mass under it rather than a line ruled across the bottom.
  var hilliness = options.hilliness === undefined ? 0.3 : options.hilliness;
  var floorY = height * 0.96,
    ceilY = floorY - (64 + 210 * hilliness);
  var surface = new Array(count);
  for (var i = 0; i < count; i++) {
    var normal = (raw[i] - low) / range;
    surface[i] = floorY - normal * (floorY - ceilY);
  }
  var terrain = {
    step: STEP,
    width: width,
    height: height,
    floor: height,
    surface: surface,
    craters: []
  };
  var pillars = options.pillars || [];
  for (var p = 0; p < pillars.length; p++) raise(terrain, pillars[p]);
  return terrain;
}

// A hard-edged obstacle to arc over: a mesa pushed up out of the ridgeline.
function raise(terrain, pillar) {
  var half = pillar.width / 2;
  for (var i = 0; i < terrain.surface.length; i++) {
    var x = i * terrain.step,
      offset = Math.abs(x - pillar.x);
    if (offset > half) continue;
    // Flat on top with a short shoulder, so it reads as a wall, not a bump.
    var shoulder = clamp((half - offset) / Math.max(1, half * 0.25), 0, 1);
    var top = terrain.height * 0.96 - pillar.height * shoulder;
    terrain.surface[i] = Math.min(terrain.surface[i], top);
  }
}

// Surface y at a world x, linearly interpolated between samples. Off the ends
// the ground continues flat so a shell leaving the field still has a floor.
function heightAt(terrain, x) {
  var t = x / terrain.step,
    last = terrain.surface.length - 1;
  if (t <= 0) return terrain.surface[0];
  if (t >= last) return terrain.surface[last];
  var base = Math.floor(t),
    frac = t - base;
  return terrain.surface[base] + (terrain.surface[base + 1] - terrain.surface[base]) * frac;
}

function isSolid(terrain, x, y) {
  return y >= heightAt(terrain, x);
}

// Carve a bowl out of the ground. Columns inside the blast drop to the lower
// edge of the circle, which leaves the classic scorched crater rather than a
// square bite, and never dig past the bottom of the field.
function carve(terrain, cx, cy, radius) {
  var first = Math.max(0, Math.floor((cx - radius) / terrain.step));
  var last = Math.min(terrain.surface.length - 1, Math.ceil((cx + radius) / terrain.step));
  var moved = 0;
  for (var i = first; i <= last; i++) {
    var dx = i * terrain.step - cx,
      inside = radius * radius - dx * dx;
    if (inside <= 0) continue;
    var reach = Math.sqrt(inside),
      top = cy - reach,
      bottom = cy + reach;
    var y = terrain.surface[i];
    if (y >= top && y < bottom) {
      var next = Math.min(bottom, terrain.floor);
      moved += next - y;
      terrain.surface[i] = next;
    }
  }
  if (moved > 0) terrain.craters.push({ x: cx, y: cy, r: radius });
  // The scorch list is cosmetic; cap it so a long level cannot grow unbounded.
  if (terrain.craters.length > 80) terrain.craters.splice(0, terrain.craters.length - 80);
  return moved;
}

function snapshot(terrain) {
  return {
    step: terrain.step,
    width: terrain.width,
    height: terrain.height,
    floor: terrain.floor,
    surface: terrain.surface.slice(),
    craters: terrain.craters.slice()
  };
}

if (typeof module !== "undefined")
  module.exports = {
    rng: rng,
    generate: generate,
    heightAt: heightAt,
    isSolid: isSolid,
    carve: carve,
    snapshot: snapshot
  };
