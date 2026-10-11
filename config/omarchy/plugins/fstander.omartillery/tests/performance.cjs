// Measures simulation cost only — the canvas is not involved. The live paint
// cost is reported by the running plugin instead:
//   omarchy-shell shell call fstander.omartillery diagnostics ''
const Terrain = require("../Terrain.js");
const Physics = require("../Physics.js");
const Levels = require("../Levels.js");

function time(label, iterations, fn) {
  fn(); // warm up
  const started = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn(i);
  const perCall = Number(process.hrtime.bigint() - started) / 1e6 / iterations;
  console.log(`${label.padEnd(38)} ${perCall.toFixed(4)} ms`);
  return perCall;
}

const budget = 1000 / 120; // one 120 Hz simulation step
let failures = 0;
function within(label, ms, limit) {
  if (ms > limit) {
    console.log(`  OVER BUDGET: ${label} took ${ms.toFixed(4)}ms, budget ${limit}ms`);
    failures++;
  }
}

const world = Levels.build(9, 12345, Terrain, Physics.weather);
const aimTip = Physics.muzzle(world.turret, 50);

within(
  "level build",
  time("build a level (terrain + targets)", 400, (i) => Levels.build(i % 10, i, Terrain)),
  8
);

// The cost that actually runs every frame: one 60 Hz slice of flight, which
// Physics.fly internally divides into fixed 120 Hz steps.
const flightShot = () => {
  const tip = Physics.muzzle(world.turret, 55);
  return Physics.launch(tip.x, tip.y, 55, 80, "he", "probe");
};
let shot = flightShot();
const step = time("one 60Hz flight step (drag + wind)", 200000, () => {
  Physics.blow(world.weather, 1 / 60);
  if (Physics.fly(shot, 1 / 60, world)) shot = flightShot();
});
within("flight step", step, budget);

// Five bomblets in the air at once is the busiest the field gets.
let cluster = [];
const salvo = time("a cluster salvo, one 60Hz step", 100000, () => {
  if (!cluster.length) {
    const tip = Physics.muzzle(world.turret, 55);
    cluster = [Physics.launch(tip.x, tip.y, 55, 70, "cluster", "probe")];
  }
  for (let i = cluster.length - 1; i >= 0; i--) {
    const out = Physics.fly(cluster[i], 1 / 60, world);
    if (!out) continue;
    cluster.splice(i, 1);
    if (out.kind === "split")
      for (const b of out.children) cluster.push(Object.assign(b, { owner: "probe" }));
  }
});
within("cluster step", salvo, budget);

// The enemy's firing solution runs once per turn, on the player's frame.
const shooter = world.targets[0];
within(
  "enemy solution",
  time("return-fire solution (bisection over 14 flights)", 200, () => {
    shooter.error = 200;
    Physics.enemyShot(world, shooter, Math.random);
  }),
  30
);

within(
  "terrain query",
  time("heightAt", 500000, (i) => Terrain.heightAt(world.terrain, (i * 7) % 1280)),
  0.001
);

const carveWorld = Levels.build(4, 7, Terrain);
within(
  "detonation",
  time("detonate (carve + damage + settle)", 20000, (i) =>
    Physics.detonate(carveWorld, {
      kind: "ground",
      x: 200 + ((i * 37) % 900),
      y: 400,
      shot: Physics.launch(0, 0, 45, 50)
    })
  ),
  0.3
);

within(
  "aim preview",
  time("preview arc (aim assist, once per repaint)", 20000, () =>
    Physics.preview(aimTip.x, aimTip.y, 50, 70, world, "he")
  ),
  2
);

// A whole level's worth of flight, to show the simulation never drifts upward.
const long = time("100 full shots, start to impact", 100, () => {
  const w = Levels.build(9, 1, Terrain, Physics.weather);
  const tip = Physics.muzzle(w.turret, 60);
  let s = Physics.launch(tip.x, tip.y, 60, 85, "he", "probe"),
    impact = null,
    guard = 0;
  while (!impact && guard++ < 4000) impact = Physics.fly(s, 1 / 60, w);
});
within("full shot", long, 12);

console.log(
  failures ? `\n${failures} measurement(s) over budget` : "\nevery measurement within budget"
);
process.exit(failures ? 1 : 0);
