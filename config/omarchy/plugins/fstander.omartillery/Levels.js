// The campaign. Each level is a terrain recipe plus a target brief; `build`
// turns one into a playable world. Levels are deterministic given their index,
// together with a seed; replay keeps the seed and New Ground changes it.
//
// Difficulty is carried by four dials, in the order a new player meets them:
// distance, then wind, then relief, then cover.
var FIELD_WIDTH = 1280;
var FIELD_HEIGHT = 600;
var TURRET_X = 96;
var TARGET_RADIUS = 19;
var MIN_SPACING = 88;

// `rack` is the ammunition for the level; `shots` is its total. `wind` is a
// prevailing air speed in px/s and `gust` how far the actual wind wanders from
// it. `enemy` turns on return fire: each emplacement opens with an aim error
// of `error` px that shrinks by `decay` every time it shoots, down to `min`.
var levels = [
  {
    name: "Proving Ground",
    brief: "Flat ground, dead calm, nothing shooting back. Find your range.",
    targets: 2,
    rack: { he: 6 },
    wind: 0,
    gust: 0,
    hilliness: 0.12,
    roughness: 0.5,
    span: [520, 900]
  },
  {
    name: "First Light",
    brief: "Three emplacements, still no wind. Bracket them: short, over, on.",
    targets: 3,
    rack: { he: 7 },
    wind: 0,
    gust: 0,
    hilliness: 0.2,
    roughness: 0.7,
    span: [520, 1080]
  },
  {
    name: "Crosswind",
    brief:
      "A steady breeze. Watch the sock and lead it — a high lob drifts further than a flat shot.",
    targets: 3,
    rack: { he: 7 },
    wind: 100,
    gust: 0,
    hilliness: 0.22,
    roughness: 0.7,
    span: [560, 1120]
  },
  {
    name: "Counter-Battery",
    brief: "They shoot back now. Whoever is ranging you gets closer every shot — kill the spotter.",
    targets: 3,
    rack: { he: 6, cluster: 1 },
    wind: 80,
    gust: 30,
    hilliness: 0.24,
    roughness: 0.7,
    span: [560, 1120],
    enemy: { error: 280, decay: 0.72, min: 26 }
  },
  {
    name: "Broken Country",
    brief: "Ridges eat a flat shot, and a roller follows the ground down into a hollow.",
    targets: 4,
    rack: { he: 6, cluster: 1, roller: 1 },
    wind: 100,
    gust: 40,
    hilliness: 0.55,
    roughness: 1.05,
    span: [520, 1180],
    enemy: { error: 270, decay: 0.72, min: 26 }
  },
  {
    name: "The Wall",
    brief:
      "The mesa gun stands on fractured rock. Undermine it with a digger, or hit the magazine between the two lower bunkers for a chain reaction.",
    targets: 3,
    rack: { he: 5, digger: 1, roller: 1 },
    wind: 90,
    gust: 30,
    hilliness: 0.3,
    roughness: 0.7,
    span: [520, 1180],
    positions: [600, 920, 1040],
    unstable: [0],
    armour: 2,
    pillars: [{ x: 600, width: 84, height: 268 }],
    enemy: { error: 260, decay: 0.72, min: 26 }
  },
  {
    name: "Hardened",
    brief: "Bunkers shrug off a near miss. A digger cracks them; so does a direct hit.",
    targets: 4,
    rack: { he: 5, digger: 2, cluster: 1 },
    wind: 110,
    gust: 50,
    hilliness: 0.4,
    roughness: 0.9,
    span: [560, 1180],
    armour: 2,
    enemy: { error: 260, decay: 0.7, min: 24 }
  },
  {
    name: "Gale",
    brief:
      "The wind is stronger than your aim and it will not sit still. Fire on the lull, or fire dense.",
    targets: 4,
    rack: { he: 6, cluster: 1, digger: 1 },
    wind: 210,
    gust: 110,
    hilliness: 0.45,
    roughness: 0.95,
    span: [600, 1200],
    enemy: { error: 250, decay: 0.72, min: 24 }
  },
  {
    name: "Twin Keeps",
    brief: "Two walls, two pockets. The pockets are roller country.",
    targets: 4,
    rack: { he: 5, cluster: 1, digger: 1, roller: 2 },
    wind: 130,
    gust: 60,
    hilliness: 0.35,
    roughness: 0.8,
    span: [700, 1200],
    pillars: [
      { x: 520, width: 74, height: 225 },
      { x: 900, width: 74, height: 255 }
    ],
    enemy: { error: 240, decay: 0.7, min: 22 }
  },
  {
    name: "Last Battery",
    brief: "Five hardened guns in a gale, and they are good. Earn it.",
    targets: 5,
    rack: { he: 6, cluster: 2, digger: 2, roller: 1 },
    wind: 190,
    gust: 100,
    hilliness: 0.6,
    roughness: 1.1,
    span: [560, 1210],
    pillars: [{ x: 760, width: 80, height: 255 }],
    armour: 2,
    enemy: { error: 240, decay: 0.7, min: 22 }
  }
];

// Visual identity and tactical roles arrive with the relevant lesson. Support
// units count as targets, but only guns and spotters do ordinary ranging.
var BIOMES = [
  "quarry",
  "coast",
  "coast",
  "industry",
  "quarry",
  "quarry",
  "industry",
  "snow",
  "snow",
  "industry"
];
var ROLE_SETS = [
  [],
  [],
  [],
  ["spotter", "gun", "gun"],
  ["gun", "supply", "gun", "gun"],
  ["gun", "gun", "gun"],
  ["spotter", "engineer", "gun", "gun"],
  ["spotter", "heavy", "gun", "gun"],
  ["gun", "heavy", "supply", "gun"],
  ["spotter", "engineer", "heavy", "supply", "gun"]
];

function count() {
  return levels.length;
}

function rackTotal(rack) {
  var total = 0;
  for (var key in rack) total += rack[key];
  return total;
}

function spec(index) {
  return levels[Math.max(0, Math.min(levels.length - 1, Math.floor(index || 0)))];
}

// A mesa casts a shadow: a target tucked against its far foot cannot be
// reached by any arc. Targets therefore sit either squarely on top of a mesa
// or a clear span away from it, whichever is nearer — never in the dead pocket
// behind the wall.
function clearOfCover(level, x, forwardOnly) {
  var pillars = level.pillars || [];
  for (var i = 0; i < pillars.length; i++) {
    var p = pillars[i],
      half = p.width / 2,
      offset = x - p.x;
    if (Math.abs(offset) <= half * 0.34) continue; // squarely on top, fine
    var clearance = half + 78;
    if (Math.abs(offset) >= clearance) continue; // well clear, fine
    // forwardOnly is used when resolving a spacing conflict: pushing back
    // toward the previous target would just recreate the conflict.
    x = forwardOnly
      ? p.x + clearance
      : Math.abs(offset) < half * 0.62
        ? p.x
        : p.x + (offset < 0 ? -clearance : clearance);
  }
  return x;
}

// Push x far enough past the previous emplacement, then out of any cover it
// landed in — repeatedly, because clearing one mesa can drop it into the next.
function spaceOut(level, x, previous) {
  if (x - previous >= MIN_SPACING) return x;
  x = previous + MIN_SPACING;
  for (var guard = 0; guard < 4; guard++) {
    var pushed = clearOfCover(level, x, true);
    if (pushed <= x) break;
    x = pushed;
  }
  return x;
}

// Targets are spread across the level's span with a jittered even spacing, so
// they never stack and never clump into a single easy bracket.
function placeTargets(level, terrain, ground, random) {
  var span = level.span,
    n = level.targets,
    slot = (span[1] - span[0]) / n,
    out = [];
  for (var i = 0; i < n; i++) {
    var x = span[0] + slot * (i + 0.5) + (random() * 2 - 1) * slot * 0.3;
    if (level.positions) x = level.positions[i];
    x = clearOfCover(level, Math.max(span[0], Math.min(span[1], x)), false);
    // Never on the sheer side of a mesa: nudge to the flatter of two probes.
    if (Math.abs(ground.heightAt(terrain, x + 14) - ground.heightAt(terrain, x)) > 26) x -= 22;
    // Clearing cover can shunt two emplacements onto the same spot, so spacing
    // is settled last and only ever pushes forward.
    if (i > 0) x = spaceOut(level, x, out[i - 1].x);
    out.push({
      x: x,
      y: ground.heightAt(terrain, x),
      r: TARGET_RADIUS,
      homeX: x,
      direction: 1,
      role: "gun",
      charge: 0,
      unstable: !!(level.unstable && level.unstable.indexOf(i) >= 0),
      hp: level.armour || 1,
      maxHp: level.armour || 1,
      direct: false,
      seed: Math.floor(random() * 1000),
      // Return fire state. `error` is this emplacement's aim error in px and
      // shrinks each time it shoots; the one with the smallest error is the
      // one ranging the gun, and the one to kill.
      error: level.enemy ? level.enemy.error : 0,
      decay: level.enemy ? level.enemy.decay : 1,
      minError: level.enemy ? level.enemy.min : 0,
      fired: 0
    });
  }
  return out;
}

// `ground` is the Terrain module, handed in by the caller; see Physics.js for
// why these modules never import one another. `weather` is Physics.weather,
// handed in the same way, or omitted by callers that only need the ground.
function build(index, seed, ground, weather) {
  var level = spec(index);
  var random = ground.rng((seed >>> 0) ^ ((index + 1) * 0x9e3779b9));
  var terrain = ground.generate(FIELD_WIDTH, FIELD_HEIGHT, {
    seed: (seed >>> 0) + index * 7919,
    roughness: level.roughness,
    hilliness: level.hilliness,
    pillars: level.pillars
  });
  // The gun stands on its own flattened apron so the barrel never clips dirt.
  var apron = ground.heightAt(terrain, TURRET_X);
  for (var i = 0; i * terrain.step < TURRET_X + 60; i++)
    terrain.surface[i] = apron + Math.max(0, (TURRET_X - 60 - i * terrain.step) / 20);
  // A whisper of wind is worse than none: it only misleads. When a level asks
  // for wind it always gets at least 45% of its figure, in either direction.
  var wind = 0;
  if (level.wind > 0) {
    var magnitude = level.wind * (0.45 + random() * 0.55);
    wind = random() < 0.5 ? -magnitude : magnitude;
  }
  var rack = {};
  for (var key in level.rack) rack[key] = level.rack[key];
  var shots = rackTotal(rack);
  // The weather gets its own seeded stream so the gusts do not disturb the
  // layout, and the layout does not disturb the gusts.
  var gustRandom = ground.rng((seed >>> 0) ^ 0x5bd1e995 ^ (index * 40503));
  var targets = placeTargets(level, terrain, ground, random);
  for (var t = 0; t < targets.length; t++) {
    targets[t].role = (ROLE_SETS[index] || [])[t] || "gun";
    if (targets[t].role === "spotter") targets[t].decay *= 0.94;
  }
  var props = [];
  if (index === 5 || index === 8 || index === 9) {
    var last = targets[targets.length - 1],
      before = targets[targets.length - 2];
    var px = (last.x + before.x) / 2;
    props.push({ kind: "depot", x: px, y: ground.heightAt(terrain, px), hp: 1, blast: 110 });
  }
  return {
    biome: BIOMES[index] || "quarry",
    props: props,
    // Scenery, at a fixed place on the field rather than in the corner of the
    // window, so that what is drawn and what can be hit are the same thing on
    // every window shape.
    sock: { x: FIELD_WIDTH - 118, y: 34, hp: 1 },
    enemyTurns: 0,
    index: index,
    name: level.name,
    brief: level.brief,
    terrain: terrain,
    ground: ground,
    targets: targets,
    turret: { x: TURRET_X, y: apron, hp: 3, maxHp: 3 },
    wind: wind,
    windLimit: level.wind + level.gust,
    gust: level.gust,
    weather: weather ? weather(wind, level.gust, gustRandom) : null,
    enemy: level.enemy || null,
    rack: rack,
    shots: shots,
    shotsLeft: shots,
    seed: seed >>> 0,
    // The emplacement currently ranging the gun, chosen by Physics.enemyShot's
    // caller; -1 until the first one opens up.
    spotter: -1
  };
}

// Which emplacement fires next: the one that has already got closest, so the
// threat is legible — it is the one that has been shooting at you — and
// killing it buys a fresh, wild spotter. Ties (nobody has fired yet) go to
// the seeded random so the opening shot is not always from the same place.
function nextSpotter(world, random) {
  var best = null,
    bestError = Infinity,
    fresh = [];
  for (var i = 0; i < world.targets.length; i++) {
    var t = world.targets[i];
    if (t.hp <= 0 || t.role === "engineer" || t.role === "supply" || t.role === "heavy") continue;
    if (!t.fired) fresh.push(i);
    else if (t.error < bestError) {
      bestError = t.error;
      best = i;
    }
  }
  if (best !== null) return best;
  if (!fresh.length) return -1;
  var leaders = fresh.filter(function (id) {
    return world.targets[id].role === "spotter";
  });
  var pool = leaders.length ? leaders : fresh;
  return pool[Math.floor(random() * pool.length)];
}

// Three stars for clearing with most of the ammunition still in the rack.
function stars(level) {
  if (!level || level.shotsLeft < 0) return 0;
  var used = level.shots - level.shotsLeft,
    ratio = used / level.shots;
  return ratio <= 0.45 ? 3 : ratio <= 0.72 ? 2 : 1;
}

var SCORE = { kill: 250, direct: 100, clear: 500, spare: 150, walk: 50, combo: 0.5 };

// A kill streak pays more for each consecutive shell that kills: the second
// pays one and a half times, the third twice, and so on.
function comboMultiplier(streak) {
  return 1 + Math.max(0, streak - 1) * SCORE.combo;
}

function scoreFor(destroyed, directHits) {
  return destroyed * SCORE.kill + directHits * SCORE.direct;
}

if (typeof module !== "undefined")
  module.exports = {
    FIELD_HEIGHT: FIELD_HEIGHT,
    TURRET_X: TURRET_X,
    SCORE: SCORE,
    comboMultiplier: comboMultiplier,
    rackTotal: rackTotal,
    nextSpotter: nextSpotter,
    MIN_SPACING: MIN_SPACING,
    levels: levels,
    count: count,
    spec: spec,
    build: build,
    stars: stars,
    scoreFor: scoreFor
  };
