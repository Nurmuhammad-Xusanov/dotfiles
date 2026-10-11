// A headless game. This is the turn loop the view runs — fire, resolve every
// projectile, let the enemy answer, let the weather move — driven from Node
// so the campaign can be played thousands of times without a display. It
// only ever uses the public simulation surface; nothing here edits the world.
const Terrain = require("../Terrain.js");
const Physics = require("../Physics.js");
const Levels = require("../Levels.js");

const AIM_SECONDS = 2.5; // how long a gunner spends on the dials between shots

function build(index, seed) {
  return Levels.build(index, seed, Terrain, Physics.weather);
}

// Let the wind move for a stretch of wall time in the same small steps the
// view uses, so the harness and the game see the same gusts.
function pass(world, seconds) {
  for (let t = 0; t < seconds; t += 1 / 60) Physics.blow(world.weather, 1 / 60);
}

// Fly one projectile (and anything it becomes) to the end, detonating each
// piece as it lands. Returns the detonations, in order.
function resolve(world, shot, log) {
  const live = [shot];
  const results = [];
  let guard = 0;
  while (live.length && guard++ < 20000) {
    Physics.blow(world.weather, 1 / 60);
    for (let i = live.length - 1; i >= 0; i--) {
      const out = Physics.fly(live[i], 1 / 60, world);
      if (!out) continue;
      live.splice(i, 1);
      if (out.kind === "split") {
        live.push(...out.children);
        continue;
      }
      if (out.kind === "lost") {
        results.push({ impact: out, result: null });
        continue;
      }
      const result = Physics.detonate(world, out);
      results.push({ impact: out, result });
      if (log) log(out, result);
    }
  }
  return results;
}

// A read-only rehearsal: where would this shell land, in the air as it is
// right now? The probe cannot strike anything, and the weather is frozen.
function rehearse(world, angle, power, kind) {
  const still = Physics.stillAir(world, world.weather ? world.weather.value : 0);
  const tip = Physics.muzzle(world.turret, angle);
  const shot = Physics.launch(tip.x, tip.y, angle, power, kind, "probe");
  let out = null,
    guard = 0;
  while (!out && guard++ < 5000) out = Physics.fly(shot, 1 / 60, still);
  if (out && out.kind === "split") {
    // Follow the middle bomblet; the pattern is symmetric about it.
    const mid = out.children[Math.floor(out.children.length / 2)];
    mid.owner = "probe";
    out = null;
    guard = 0;
    while (!out && guard++ < 5000) out = Physics.fly(mid, 1 / 60, still);
  }
  return out || { kind: "lost", x: shot.x, y: shot.y };
}

// The gunner. `noise` is the cadet's hand: fractional power error and degrees
// of angle error applied after the solution is found. Zero is a perfect shot.
function aim(world, target, kind, noise) {
  const score = (probe) =>
    Math.abs(probe.x - target.x) + Math.abs(probe.y - (target.y - target.r * 0.4)) * 0.35;
  let best = null;
  for (const angle of [25, 32, 40, 48, 56, 64, 72, 80, 85]) {
    for (let power = 15; power <= 100; power += 3) {
      const miss = score(rehearse(world, angle, power, kind));
      if (!best || miss < best.miss) best = { angle, power, miss };
    }
  }
  for (let step = 4; step >= 0.1; step /= 2) {
    let improved = true;
    while (improved) {
      improved = false;
      for (const [da, dp] of [
        [0, -step],
        [0, step],
        [-step, 0],
        [step, 0]
      ]) {
        const angle = Physics.clamp(best.angle + da, 1, 89);
        const power = Physics.clamp(best.power + dp, 5, 100);
        const miss = score(rehearse(world, angle, power, kind));
        if (miss < best.miss - 1e-6) {
          best = { angle, power, miss };
          improved = true;
        }
      }
    }
  }
  if (noise) {
    best.angle = Physics.clamp(best.angle + (noise.random() * 2 - 1) * noise.angle, 1, 89);
    best.power = Physics.clamp(best.power * (1 + (noise.random() * 2 - 1) * noise.power), 5, 100);
  }
  return best;
}

// Which shell for this target: a digger for armour if there is one, a cluster
// when two live targets sit within a pattern of each other, and the last of
// whatever is left when the HE runs out.
function chooseWeapon(world, target) {
  const rack = world.rack;
  const live = world.targets.filter((t) => t.hp > 0);
  const spotter = world.spotter >= 0 ? world.targets[world.spotter] : null;
  // Diggers are for the bunker that is ranging you. Spending one on a quiet
  // bunker leaves nothing for the one that matters.
  const ranging = !spotter || spotter.hp <= 0 || target === spotter;
  if (target.hp > 1 && rack.digger > 0 && ranging) return "digger";
  if (rack.cluster > 0 && live.some((t) => t !== target && Math.abs(t.x - target.x) < 130))
    return "cluster";
  if (rack.he > 0) return "he";
  for (const kind of Physics.WEAPON_ORDER) if (rack[kind] > 0) return kind;
  return null;
}

// The target to engage: the emplacement currently ranging the gun if any has
// fired, else the nearest live one.
function chooseTarget(world) {
  const live = world.targets.filter((t) => t.hp > 0);
  if (!live.length) return null;
  const spotter = world.spotter >= 0 ? world.targets[world.spotter] : null;
  if (spotter && spotter.hp > 0 && spotter.fired) return spotter;
  return live.reduce((a, b) => (a.x < b.x ? a : b));
}

// Play one level to the end. Returns what the result card would show.
function play(index, seed, options = {}) {
  const world = options.world || build(index, seed);
  const random = Terrain.rng((seed >>> 0) ^ 0xa5a5a5a5);
  const noise = options.noise
    ? { ...options.noise, random: Terrain.rng((seed >>> 0) ^ 0x71c89a5b) }
    : null;
  let shots = 0,
    destroyed = 0,
    gunHits = 0,
    enemyShots = 0;
  while (Physics.remaining(world) > 0 && world.shotsLeft > 0 && world.turret.hp > 0) {
    pass(world, AIM_SECONDS);
    const target = chooseTarget(world);
    const kind = chooseWeapon(world, target);
    if (!kind) break;
    const pick = aim(world, target, kind, noise);
    world.rack[kind]--;
    world.shotsLeft--;
    shots++;
    const tip = Physics.muzzle(world.turret, pick.angle);
    const shot = Physics.launch(tip.x, tip.y, pick.angle, pick.power, kind, "player");
    if (world.payload && kind === "he") shot.blast += 8;
    for (const { result } of resolve(world, shot)) if (result) destroyed += result.destroyed.length;
    if (Physics.remaining(world) === 0) break;
    // Return fire.
    if (world.enemy) {
      pass(world, 0.75);
      const plan = Physics.enemyTurn(world, random, Levels.nextSpotter);
      for (let i = 0; i < plan.replies.length; i++) {
        if (i) pass(world, 0.55);
        enemyShots++;
        for (const { result } of resolve(world, plan.replies[i].shot))
          if (result && result.gunHit) gunHits++;
        if (world.turret.hp <= 0) break;
      }
    }
  }
  const cleared = Physics.remaining(world) === 0;
  return {
    index,
    seed,
    name: world.name,
    cleared,
    destroyedGun: world.turret.hp <= 0,
    shots,
    allowance: world.shots,
    destroyed,
    gunHits,
    gunHp: world.turret.hp,
    enemyShots,
    stars: cleared ? Levels.stars(world) : 0
  };
}

module.exports = {
  build,
  pass,
  resolve,
  rehearse,
  aim,
  chooseWeapon,
  chooseTarget,
  play,
  AIM_SECONDS
};
