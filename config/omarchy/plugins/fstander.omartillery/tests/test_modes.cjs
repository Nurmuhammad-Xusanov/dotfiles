const test = require("node:test");
const assert = require("node:assert/strict");
const Operations = require("../Operations.js");
const Challenges = require("../Challenges.js");
const Profile = require("../Profile.js");
const Levels = require("../Levels.js");
const Physics = require("../Physics.js");
const Terrain = require("../Terrain.js");
const { play } = require("./play.cjs");
const build = (run) => Operations.build(run, Levels, Terrain, Physics);

test("daily codes are versioned, validated calendar dates in UTC", () => {
  const today = Challenges.today(new Date("2026-09-13T23:59:59-02:00"));
  assert.equal(today.code, "BAT1-20260914");
  assert.equal(Challenges.parse(" bat1-20280229 ").label, "2028-02-29");
  for (const code of [
    "BAT2-20260913",
    "BAT1-20260229",
    "BAT1-20261301",
    "BAT1-20260900",
    "BAT1-20260931",
    "BAT1-00000913",
    null,
    {},
    "BAT1-20260913junk"
  ])
    assert.equal(Challenges.parse(code), null);
});

test("the same challenge code rebuilds ground, roles, rack and gust stream", () => {
  const c = Challenges.parse("BAT1-20260913");
  const a = Challenges.build(c, Levels, Terrain, Physics),
    b = Challenges.build(c, Levels, Terrain, Physics);
  assert.deepEqual(a.terrain.surface, b.terrain.surface);
  assert.deepEqual(a.targets, b.targets);
  assert.deepEqual(a.rack, Challenges.RACK);
  assert.equal(a.shots, 12);
  for (let i = 0; i < 1000; i++)
    assert.equal(Physics.blow(a.weather, 1 / 60), Physics.blow(b.weather, 1 / 60));
  a.rack.he--;
  assert.equal(b.rack.he, 6);
  assert.equal(Challenges.RACK.he, 6);
});

test("daily bests improve and assisted records stay separate from unassisted ones", () => {
  const p = Profile.fresh(),
    code = "BAT1-20260913";
  const result = { cleared: true, score: 900, spares: 4, stars: 2 };
  assert.equal(Profile.recordDaily(p, code, result, false), true);
  assert.equal(Profile.recordDaily(p, code, { ...result, score: 800 }, false), false);
  assert.equal(
    Profile.recordDaily(p, code, { ...result, cleared: false, score: 2000 }, false),
    false
  );
  assert.equal(Profile.recordDaily(p, code, { ...result, score: 1200 }, true), true);
  const saved = Profile.clean(JSON.parse(JSON.stringify(p)));
  assert.equal(saved.daily[code + ":manual"].score, 900);
  assert.equal(saved.daily[code + ":assist"].score, 1200);
  assert.deepEqual(saved.levels, {});
});

test("daily history is bounded and hostile records are rejected", () => {
  const p = Profile.fresh();
  for (let n = 1; n <= 45; n++) {
    const c = Challenges.today(new Date(Date.UTC(2026, 8, n)));
    Profile.recordDaily(p, c.code, { cleared: true, score: n, spares: 2, stars: 3 }, false);
  }
  p.daily["BAT1-20269999:manual"] = { score: 1, spares: 1, stars: 3 };
  p.daily["__proto__"] = null;
  const saved = Profile.clean(p);
  assert.equal(Object.keys(saved.daily).length, 30);
  assert.equal(saved.daily["BAT1-20269999:manual"], undefined);
  assert.ok(JSON.stringify(saved).length < 16384);
});

test("operation routes create distinct repeatable encounters from an isolated loadout", () => {
  const run = Operations.fresh(42),
    a = Operations.choose(run, "ridge"),
    b = Operations.choose(run, "depot");
  assert.equal(run.state, "route");
  assert.equal(Operations.choose(run, "bogus"), null);
  assert.equal(Operations.choose(a, "depot"), null);
  assert.deepEqual(build(a).terrain.surface, build(a).terrain.surface);
  assert.notDeepEqual(build(a).terrain.surface, build(b).terrain.surface);
  const w = build(a);
  w.rack.he--;
  assert.equal(a.rack.he, 16);
  assert.equal(w.targets.length, Levels.spec(w.index).targets - 1);
  assert.ok(build(b).props.length > 0);
});

test("supply purchases consume credits, respect caps, and affect the next battle", () => {
  let run = Operations.fresh(99);
  run.state = "supply";
  run.stage = 1;
  run.hp = 1;
  run.credits = 20;
  run = Operations.buy(run, "repair");
  assert.equal(run.hp, 2);
  assert.equal(run.credits, 18);
  run = Operations.buy(run, "armour");
  run = Operations.buy(run, "armour");
  assert.equal(run.maxHp, 5);
  assert.equal(run.hp, 4);
  assert.equal(Operations.buy(run, "armour"), null);
  run = Operations.buy(run, "payload");
  assert.equal(Operations.buy(run, "payload"), null);
  run = Operations.buy(run, "he");
  assert.equal(run.rack.he, 20);
  const next = Operations.choose(Operations.depart(run), "ridge");
  const w = build(next);
  assert.equal(w.turret.maxHp, 5);
  assert.equal(w.turret.hp, 4);
  assert.equal(w.payload, true);
  assert.equal(w.rack.he, 20);
  assert.equal(Operations.buy(next, "repair"), null);
});

test("all four operation battles play through while carrying health and ammunition", () => {
  for (const seed of [42, 7932, 15851])
    for (const route of ["ridge", "depot"]) {
      let run = Operations.fresh(seed);
      for (let stage = 0; stage < 4; stage++) {
        run = Operations.choose(run, route);
        const restored = Profile.cleanOperation(JSON.parse(JSON.stringify(run)));
        assert.deepEqual(restored, run);
        const w = build(restored);
        assert.deepEqual(w.rack, run.rack);
        assert.equal(w.turret.hp, run.hp);
        const result = play(w.index, w.seed, { world: w });
        assert.equal(result.cleared, true, `operation ${seed}/${route}/${stage}`);
        run = Operations.finish(run, w, 1000, true);
        assert.equal(run.stage, stage + 1);
        assert.equal(run.hp, w.turret.hp);
        assert.equal(run.rack.digger, w.rack.digger);
        if (stage < 3) {
          while (run.hp < run.maxHp && run.credits >= 2) run = Operations.buy(run, "repair");
          if (run.credits >= 2) run = Operations.buy(run, "he");
          run = Operations.depart(run);
        }
      }
      assert.equal(run.state, "complete");
      assert.equal(run.score, 4000);
      assert.deepEqual(Profile.cleanOperation(run), run);
    }
});

test("invalid operation checkpoints cannot create impossible progress or inventory", () => {
  const good = Operations.choose(Operations.fresh(42), "ridge");
  for (const patch of [
    { version: 9 },
    { hp: 8 },
    { hp: 0 },
    { stage: 4 },
    { stage: -1 },
    { route: "bogus" },
    { credits: -1 },
    { rack: { he: 1000 } },
    { seed: -1 },
    { payload: "yes" }
  ])
    assert.equal(Profile.cleanOperation({ ...good, ...patch }), null);
  assert.deepEqual(
    Profile.clean({ version: 1, levels: { 0: { stars: 2, score: 1000 } } }).levels[0],
    { stars: 2, score: 1000 }
  );
});

test("clears outside the campaign do not unlock campaign levels", () => {
  for (const mode of ["daily", "operation"]) {
    const p = Profile.fresh();
    Profile.record(p, {
      mode,
      index: 0,
      cleared: true,
      score: 1000,
      stars: 3,
      shotsUsed: 2,
      targets: 2,
      destroyed: 2,
      directHits: 2
    });
    assert.deepEqual(p.levels, {});
    assert.equal(Profile.unlocked(p, 1), false);
    assert.equal(p.targetsDestroyed, 2);
  }
});

test("a clock outside the supported range still yields a playable challenge", () => {
  // A machine with a dead RTC reads 1970. today() must not hand the daily
  // screens a null: every one of them dereferences .code.
  for (const clock of [new Date(0), new Date("2200-01-01T00:00:00Z")]) {
    const challenge = Challenges.today(clock);
    assert.ok(challenge, "today() must never return null");
    assert.equal(challenge.code, "BAT1-20260101");
    assert.ok(Challenges.build(challenge, Levels, Terrain, Physics));
  }
  // Parsing is unchanged: an out-of-range code is still rejected outright.
  assert.equal(Challenges.parse("BAT1-19700101"), null);
  assert.equal(Challenges.parse("BAT1-21000101"), null);
});

test("a secret code is not a date and keeps no leaderboard", () => {
  const drill = Challenges.parse("bat0-gundrill");
  const scorched = Challenges.parse("BAT1-SCORCHED");
  assert.equal(drill.secret, "gundrill");
  assert.equal(scorched.secret, "scorched");
  // An ordinary daily still reports no secret, and the near misses stay closed.
  assert.equal(Challenges.parse("BAT1-20260913").secret, "");
  for (const near of ["BAT0-20260913", "BAT1-SCORCHE", "BAT2-GUNDRILL", "BAT1-GUNDRILL", ""])
    assert.equal(Challenges.parse(near), null, near + " must not open anything");
  // Neither secret can be recorded as a daily best: they are medals, not scores.
  const p = Profile.fresh();
  for (const code of ["BAT0-GUNDRILL", "BAT1-SCORCHED"])
    assert.equal(
      Profile.recordDaily(p, code, { cleared: true, score: 9000, spares: 5, stars: 3 }, false),
      false
    );
  assert.deepEqual(p.daily, {});
});

test("both secret battlefields are winnable, and three stars is reachable", () => {
  // The naive bound (one shell per position) does not hold on the scorched
  // battery, which is built to be cleared through its magazines, so this plays
  // each one with the offline gunner the campaign balance check uses.
  const Play = require("./play.cjs");
  function clear(code) {
    const world = Challenges.build(Challenges.parse(code), Levels, Terrain, Physics);
    let guard = 0;
    while (
      Physics.remaining(world) > 0 &&
      world.shotsLeft > 0 &&
      world.turret.hp > 0 &&
      guard++ < 40
    ) {
      const target = Play.chooseTarget(world);
      const kind = Play.chooseWeapon(world, target);
      const best = Play.aim(world, target, kind, null);
      const tip = Physics.muzzle(world.turret, best.angle);
      world.rack[kind]--;
      world.shotsLeft--;
      Play.resolve(world, Physics.launch(tip.x, tip.y, best.angle, best.power, kind, "player"));
      Play.pass(world, Play.AIM_SECONDS);
    }
    return {
      name: world.name,
      cleared: Physics.remaining(world) === 0,
      stars: Physics.remaining(world) === 0 ? Levels.stars(world) : 0
    };
  }
  for (const [code, name] of [
    ["BAT1-SCORCHED", "The Scorched Battery"],
    ["BAT0-GUNDRILL", "Old Gun Drill"]
  ]) {
    const out = clear(code);
    assert.equal(out.name, name);
    assert.ok(out.cleared, name + " must be winnable");
    assert.equal(out.stars, 3, name + " must reward a perfect gunner with three stars");
  }
});

test("the gun drill flies the school parabola, and the preview agrees with it", () => {
  const world = Challenges.build(Challenges.parse("BAT0-GUNDRILL"), Levels, Terrain, Physics);
  assert.equal(world.dragScale, 0);
  assert.equal(world.enemy, null);
  assert.equal(world.weather.base, 0);
  // Flat: every sample of the surface is the same height.
  const surface = world.terrain.surface;
  for (let i = 0; i < surface.length; i++) assert.equal(surface[i], surface[0]);
  function shoot(into, angle) {
    const from = Physics.muzzle(into.turret, angle);
    const shot = Physics.launch(from.x, from.y, angle, 70, "he", "probe");
    const launched = shot.vx;
    let out = null,
      guard = 0;
    while (!out && guard++ < 5000) out = Physics.fly(shot, 1 / 120, into);
    return { from: from, landed: out.x, launched: launched, arrived: shot.vx };
  }
  // No drag means horizontal speed is untouched from muzzle to impact. An
  // ordinary battlefield is the control: there it bleeds away.
  const drill = shoot(world, 40);
  assert.equal(drill.arrived, drill.launched, "the drill must not slow the shell down");
  const ordinary = shoot(Levels.build(3, 7, Terrain, Physics.weather), 40);
  assert.ok(ordinary.arrived < ordinary.launched * 0.85, "an ordinary shell loses speed to drag");
  // Aim assist rehearses through Physics.stillAir, so it has to carry the
  // drill's physics across or the dotted arc would lie about where to shoot.
  const arc = Physics.preview(drill.from.x, drill.from.y, 40, 70, world, "he");
  const last = arc[arc.length - 1];
  assert.ok(
    Math.abs(last.x - drill.landed) < 24,
    "aim assist must match the shell: preview " +
      Math.round(last.x) +
      " vs " +
      Math.round(drill.landed)
  );
});
