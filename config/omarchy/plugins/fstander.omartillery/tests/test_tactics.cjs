const test = require("node:test");
const assert = require("node:assert/strict");
const Physics = require("../Physics.js");
const Terrain = require("../Terrain.js");
const Levels = require("../Levels.js");

function field() {
  const w = Levels.build(0, 42, Terrain, Physics.weather);
  w.terrain.surface.fill(500);
  w.turret.y = 500;
  w.targets = [];
  w.props = [];
  return w;
}
function target(x, hp = 2, role = "gun") {
  return {
    x,
    y: 500,
    homeX: x,
    r: 19,
    hp,
    maxHp: hp,
    role,
    charge: 0,
    error: 240,
    decay: 0.72,
    minError: 22,
    fired: 0,
    direct: false,
    seed: 1
  };
}
function impact(x, y, extra = {}) {
  return { kind: "ground", x, y, shot: Physics.launch(0, 0, 45, 50), ...extra };
}

test("large falls hurt, small craters preserve the armour rule", () => {
  const w = field();
  const small = target(500),
    large = target(800, 1);
  w.targets = [small, large];
  Terrain.carve(w.terrain, small.x, small.y, 32);
  Terrain.carve(w.terrain, large.x, large.y, 80);
  const out = Physics.settle(w);
  assert.equal(small.hp, 2);
  assert.equal(large.hp, 0);
  assert.deepEqual(out.destroyed, [large]);
  assert.equal(out.collapses.length, 1);
  assert.equal(large.direct, false);
});

test("an eroded unstable shoulder slides downhill within a bounded distance", () => {
  const w = field();
  for (let i = 0; i < w.terrain.surface.length; i++)
    w.terrain.surface[i] = 250 + i * w.terrain.step * 0.4;
  const t = target(600, 3);
  t.y = Terrain.heightAt(w.terrain, t.x);
  t.unstable = true;
  w.targets = [t];
  Terrain.carve(w.terrain, 620, t.y, 30);
  const before = t.x;
  Physics.settle(w);
  assert.ok(t.x !== before, "the damaged shoulder should move the position");
  assert.ok(Math.abs(t.x - before) <= 36);
  assert.ok(t.y >= Terrain.heightAt(w.terrain, t.x) - 1);
});

test("magazines chain once each and report every destroyed target once", () => {
  const w = field();
  w.props = [600, 680].map((x) => ({ kind: "depot", x, y: 500, hp: 1, blast: 110 }));
  w.targets = [target(640), target(730)];
  const out = Physics.detonate(w, impact(600, 488, { kind: "direct", prop: w.props[0] }));
  assert.equal(out.chains, 2);
  assert.equal(out.blasts.length, 3);
  assert.equal(new Set(out.destroyed).size, out.destroyed.length);
  assert.equal(out.destroyed.length, 2);
  assert.ok(w.props.every((p) => p.hp === 0));
  assert.equal(Physics.detonate(w, impact(600, 500)).chains, 0);
});

test("a buried digger can collapse a fractured footing outside its damage radius", () => {
  const w = field(),
    bunker = target(600);
  bunker.unstable = true;
  w.targets = [bunker];
  const out = Physics.detonate(
    w,
    impact(644, 500, { shot: Physics.launch(0, 0, 45, 50, "digger") })
  );
  assert.equal(out.damaged, 0, "the shell did not hit the bunker with blast damage");
  assert.equal(out.collapses.length, 1);
  assert.equal(bunker.hp, 0);
  assert.equal(bunker.direct, false);
});

test("a magazine is a physical target for player shells", () => {
  const w = field();
  const depot = { kind: "depot", x: 600, y: 500, hp: 1, blast: 110 };
  w.props = [depot];
  const shot = Physics.launch(600, 480, 0, 5);
  const out = Physics.fly(shot, 1 / 60, w);
  assert.equal(out.kind, "direct");
  assert.equal(out.prop, depot);
});

test("a supply truck's ammunition damages nearby armour", () => {
  const w = field();
  const truck = target(600, 1, "supply"),
    bunker = target(655);
  w.targets = [truck, bunker];
  const out = Physics.detonate(w, impact(600, 488, { kind: "direct", target: truck }));
  assert.equal(out.chains, 1);
  assert.equal(bunker.hp, 0);
  assert.equal(out.destroyed.length, 2);
});

test("heavy guns telegraph and release a salvo every third enemy turn", () => {
  const w = field(),
    heavy = target(850, 2, "heavy");
  w.targets = [heavy];
  const random = Terrain.rng(4);
  assert.equal(Physics.intent(heavy, false), "SALVO IN 3");
  assert.equal(Physics.enemyTurn(w, random, Levels.nextSpotter).replies.length, 0);
  assert.equal(Physics.intent(heavy, false), "SALVO IN 2");
  assert.equal(Physics.enemyTurn(w, random, Levels.nextSpotter).replies.length, 0);
  assert.equal(Physics.intent(heavy, false), "SALVO IN 1");
  const salvo = Physics.enemyTurn(w, random, Levels.nextSpotter);
  assert.equal(salvo.replies.length, 1);
  assert.equal(salvo.replies[0].shot.blast, 64);
  assert.equal(heavy.charge, 0);
  assert.equal(w.spotter, -1);
  heavy.hp = 0;
  for (let i = 0; i < 4; i++)
    assert.equal(Physics.enemyTurn(w, random, Levels.nextSpotter).replies.length, 0);
});

test("engineers heal nearby survivors but never revive wrecks or repair themselves", () => {
  const w = field();
  const engineer = target(600, 2, "engineer"),
    hurt = target(700),
    dead = target(550),
    far = target(1000);
  engineer.hp = hurt.hp = far.hp = 1;
  dead.hp = 0;
  w.targets = [engineer, hurt, dead, far];
  const out = Physics.enemyTurn(w, Terrain.rng(1), Levels.nextSpotter);
  assert.equal(hurt.hp, 2);
  assert.equal(engineer.hp, 1);
  assert.equal(dead.hp, 0);
  assert.equal(far.hp, 1);
  assert.equal(out.events.filter((e) => e.kind === "repair").length, 1);
});

test("supply movement respects patrol limits and other positions", () => {
  const w = field(),
    truck = target(600, 1, "supply"),
    bunker = target(670);
  w.targets = [truck, bunker];
  const random = Terrain.rng(8),
    positions = [];
  for (let i = 0; i < 10; i++) {
    Physics.enemyTurn(w, random, Levels.nextSpotter);
    positions.push(truck.x);
    assert.ok(truck.x >= 568 && truck.x <= 632);
    assert.ok(Math.abs(truck.x - bunker.x) >= 42);
  }
  assert.ok(new Set(positions).size > 1);
});

test("ranging labels reflect the actual gun and reset when it dies", () => {
  const w = field(),
    a = target(600, 2, "spotter"),
    b = target(900);
  w.targets = [a, b, target(1050, 2, "engineer")];
  a.fired = 3;
  a.error = 85;
  assert.equal(Physics.intent(a, true), "LOCKED ON");
  assert.equal(Levels.nextSpotter(w, Terrain.rng(1)), 0);
  a.hp = 0;
  assert.equal(Levels.nextSpotter(w, Terrain.rng(1)), 1);
  assert.equal(Physics.intent(b, false), "SEARCHING");
});
