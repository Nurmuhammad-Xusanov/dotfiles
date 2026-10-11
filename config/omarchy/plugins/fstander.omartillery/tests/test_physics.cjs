const test = require("node:test");
const assert = require("node:assert");
const Terrain = require("../Terrain.js");
const Physics = require("../Physics.js");
const Levels = require("../Levels.js");

// Shells leave the muzzle, exactly as they do in the game.
const muzzleOf = (w, angle) => {
  const tip = Physics.muzzle(w.turret, angle);
  return [tip.x, tip.y];
};

// A flat, still field: the cleanest place to measure the ballistics.
function flat(overrides) {
  const terrain = Terrain.generate(1280, 600, { seed: 1 });
  for (let i = 0; i < terrain.surface.length; i++) terrain.surface[i] = 560;
  return Object.assign(
    {
      terrain,
      ground: Terrain,
      targets: [],
      turret: { x: 96, y: 560, hp: 3, maxHp: 3 },
      weather: Physics.weather(0, 0),
      wind: 0,
      spotter: -1
    },
    overrides
  );
}

function world(overrides) {
  const w = Levels.build(0, 42, Terrain, Physics.weather);
  return Object.assign(w, overrides);
}

// Fly a shell (and anything it becomes) to the end. Returns every impact.
function fire(w, angle, power, kind = "he", dt = 1 / 60, owner = "player") {
  const shot = Physics.launch(...muzzleOf(w, angle), angle, power, kind, owner);
  const live = [shot];
  const impacts = [];
  let guard = 0;
  while (live.length && guard++ < 20000) {
    for (let i = live.length - 1; i >= 0; i--) {
      const out = Physics.fly(live[i], dt, w);
      if (!out) continue;
      live.splice(i, 1);
      if (out.kind === "split") live.push(...out.children);
      else impacts.push(out);
    }
  }
  return { impacts, impact: impacts[0], shot };
}

function target(x, y, hp = 1) {
  return {
    x,
    y,
    r: 19,
    hp,
    maxHp: hp,
    direct: false,
    seed: 1,
    error: 200,
    decay: 0.7,
    minError: 20,
    fired: 0
  };
}

// ---- launch and geometry ----------------------------------------------------

test("launch turns angle and power into a velocity", () => {
  const up = Physics.launch(0, 0, 90, 100);
  assert.ok(Math.abs(up.vx) < 1e-9);
  assert.ok(up.vy < 0, "90 degrees must send the shell upward (screen y grows down)");
  const flatShot = Physics.launch(0, 0, 0, 100);
  assert.ok(flatShot.vx > 0 && Math.abs(flatShot.vy) < 1e-9);
  const back = Physics.launch(0, 0, 135, 100);
  assert.ok(back.vx < 0 && back.vy < 0, "past 90 degrees the shell lobs backward");
  assert.ok(Physics.muzzleSpeed(100) > Physics.muzzleSpeed(50));
  assert.strictEqual(Physics.muzzleSpeed(1e6), Physics.muzzleSpeed(Physics.MAX_POWER));
});

test("the shell leaves the tip of the barrel, not the hull", () => {
  const turret = { x: 100, y: 500 };
  const pivot = Physics.pivot(turret);
  assert.deepStrictEqual(pivot, { x: 100, y: 500 - Physics.GUN_PIVOT });
  for (const angle of [0, 15, 45, 70, 90, 135, 180]) {
    const tip = Physics.muzzle(turret, angle);
    assert.ok(Math.abs(Math.hypot(tip.x - pivot.x, tip.y - pivot.y) - Physics.GUN_BARREL) < 1e-9);
    const bearing = (Math.atan2(pivot.y - tip.y, tip.x - pivot.x) * 180) / Math.PI;
    assert.ok(Math.abs(bearing - angle) < 1e-9, `angle ${angle}: the muzzle is off the elevation`);
  }
});

test("a shell fired straight up comes back down on the gun", () => {
  const w = flat();
  const { impact } = fire(w, 90, 60);
  assert.ok(Math.abs(impact.x - w.turret.x) < 1, `it drifted ${impact.x - w.turret.x}px sideways`);
});

// ---- the air ----------------------------------------------------------------

test("more power carries further, and range is monotonic in power", () => {
  const w = flat();
  let previous = -Infinity;
  for (const power of [30, 40, 50, 60, 70, 80]) {
    const { impact } = fire(w, 45, power);
    assert.strictEqual(impact.kind, "ground");
    assert.ok(impact.x > previous, `power ${power} fell short of the weaker shot`);
    previous = impact.x;
  }
});

test("drag shortens the flight and makes the arc fall steeper than it rose", () => {
  // In a vacuum the arc is symmetric. With drag the shell arrives slower and
  // steeper than it left, which is what makes plunging fire plunge.
  const w = flat();
  const shot = Physics.launch(...muzzleOf(w, 45), 45, 70, "he");
  const launchAngle = Math.atan2(-shot.vy, shot.vx);
  let out = null;
  while (!out) out = Physics.fly(shot, 1 / 60, w);
  const arrivalAngle = Math.atan2(shot.vy, shot.vx);
  assert.ok(arrivalAngle > launchAngle + 0.05, "the shell came down no steeper than it went up");
  const arrivalSpeed = Math.hypot(shot.vx, shot.vy);
  assert.ok(arrivalSpeed < Physics.muzzleSpeed(70) * 0.95, "the shell lost no speed to the air");
});

test("a dense shell flies further than a draggy one at the same charge", () => {
  const w = flat();
  const he = fire(w, 45, 60, "he").impact.x;
  const digger = fire(w, 45, 60, "digger").impact.x;
  assert.ok(digger > he + 80, `the digger (${digger}) should outrange HE (${he})`);
});

test("wind pushes the shell, and the sign is the direction of the push", () => {
  const still = fire(flat(), 45, 60).impact.x;
  const tail = fire(flat({ weather: Physics.weather(200, 0) }), 45, 60).impact.x;
  const head = fire(flat({ weather: Physics.weather(-200, 0) }), 45, 60).impact.x;
  assert.ok(tail > still + 30, "a tailwind must carry the shell further");
  assert.ok(head < still - 30, "a headwind must bring it up short");
});

test("wind moves a draggy shell more than a dense one", () => {
  const drift = (kind) =>
    fire(flat({ weather: Physics.weather(200, 0) }), 45, 60, kind).impact.x -
    fire(flat(), 45, 60, kind).impact.x;
  const he = drift("he");
  const digger = drift("digger");
  assert.ok(digger < he * 0.8, `the digger drifted ${digger}px against HE's ${he}px`);
  // Bomblets are the lightest thing in the air; the cluster pattern's centre
  // must move more than an HE shell does.
  const clusterCentre = (wind) => {
    const { impacts } = fire(flat({ weather: Physics.weather(wind, 0) }), 45, 60, "cluster");
    return impacts.reduce((sum, i) => sum + i.x, 0) / impacts.length;
  };
  assert.ok(clusterCentre(200) - clusterCentre(0) > he, "bomblets should blow further than HE");
});

test("the wind is stronger higher up, so a lob pays more for it than a flat shot", () => {
  const w = flat({ weather: Physics.weather(200, 0) });
  assert.ok(Physics.windAt(w, 0) > Physics.windAt(w, 560), "no shear");
  assert.ok(
    Physics.windAt(w, -400) <= 200 * Physics.SHEAR_CEILING + 1e-9,
    "shear must be capped above the field"
  );
  const shift = (angle) => fire(w, angle, 70).impact.x - fire(flat(), angle, 70).impact.x;
  assert.ok(
    shift(65) > shift(30) * 1.3,
    `the lob shifted ${shift(65)}px, the flat shot ${shift(30)}px`
  );
});

test("gusts wander within the level's limit and settle when there are none", () => {
  const random = Terrain.rng(5);
  const w = Physics.weather(100, 60, random);
  let low = Infinity,
    high = -Infinity;
  for (let i = 0; i < 60 * 60; i++) {
    const value = Physics.blow(w, 1 / 60);
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  assert.ok(low >= 40 - 1e-6 && high <= 160 + 1e-6, `the wind left its band: ${low}..${high}`);
  assert.ok(high - low > 40, "the wind never really moved");
  const calm = Physics.weather(80, 0);
  for (let i = 0; i < 100; i++) Physics.blow(calm, 1 / 60);
  assert.strictEqual(calm.value, 80);
});

test("gusts are reproducible from their seed", () => {
  const a = Physics.weather(100, 60, Terrain.rng(9));
  const b = Physics.weather(100, 60, Terrain.rng(9));
  for (let i = 0; i < 600; i++)
    assert.strictEqual(Physics.blow(a, 1 / 60), Physics.blow(b, 1 / 60));
});

// ---- determinism and collision ----------------------------------------------

test("the flight is identical whatever the frame rate", () => {
  // Fixed 120 Hz steps through an accumulator: the display rate cannot leak
  // into the physics at all, so these agree to the bit, not to a tolerance.
  const a = fire(flat({ weather: Physics.weather(120, 0) }), 50, 70, "he", 1 / 30).impact;
  const b = fire(flat({ weather: Physics.weather(120, 0) }), 50, 70, "he", 1 / 240).impact;
  const c = fire(flat({ weather: Physics.weather(120, 0) }), 50, 70, "he", 1 / 144).impact;
  assert.strictEqual(a.x, b.x);
  assert.strictEqual(a.x, c.x);
});

test("a fast shell cannot tunnel through the ground", () => {
  const w = world({ targets: [] });
  for (let angle = 5; angle <= 89; angle += 2)
    for (const power of [40, 70, 100]) {
      const { impact } = fire(w, angle, power, "digger", 1 / 30);
      assert.ok(impact, "the shell never resolved");
      if (impact.kind !== "ground") continue;
      const ground = Terrain.heightAt(w.terrain, impact.x);
      assert.ok(
        Math.abs(impact.y - ground) < 1.5,
        `impact at ${angle}/${power} is off the surface`
      );
    }
});

test("a shell that leaves the field is lost, not silently dropped", () => {
  assert.strictEqual(fire(flat(), 170, 100).impact.kind, "lost");
  assert.ok(["lost", "ground"].includes(fire(flat(), 45, 100).impact.kind));
});

// ---- the rack ---------------------------------------------------------------

test("a cluster shell opens at the top of its arc into five bomblets", () => {
  const w = flat();
  const shot = Physics.launch(...muzzleOf(w, 50), 50, 60, "cluster");
  let out = null;
  while (!out) out = Physics.fly(shot, 1 / 60, w);
  assert.strictEqual(out.kind, "split");
  assert.strictEqual(out.children.length, Physics.WEAPONS.cluster.bomblets);
  assert.ok(Math.abs(shot.vy) < 15, "it should open where it stops climbing");
  for (const b of out.children) {
    assert.strictEqual(b.kind, "bomblet");
    assert.strictEqual(b.owner, "player");
    assert.ok(b.blast > 0 && b.blast < Physics.WEAPONS.he.blast, "bomblets are small");
  }
  const { impacts } = fire(w, 50, 60, "cluster");
  assert.strictEqual(impacts.length, 5, "every bomblet must land");
  const xs = impacts.map((i) => i.x).sort((a, b) => a - b);
  assert.ok(xs[4] - xs[0] > 100, "the pattern should spread");
});

test("a cluster is the same pattern every time — no dice in the split", () => {
  const a = fire(flat(), 50, 60, "cluster").impacts.map((i) => i.x);
  const b = fire(flat(), 50, 60, "cluster").impacts.map((i) => i.x);
  assert.deepStrictEqual(a, b);
});

test("a digger bursts below the surface: a deep crater, and it cracks armour", () => {
  const w = flat({ targets: [target(700, 560, 2)] });
  const hit = { kind: "ground", x: 700 + 20, y: 560, shot: Physics.launch(0, 0, 45, 50, "digger") };
  const result = Physics.detonate(w, hit);
  assert.strictEqual(result.destroyed.length, 1, "one digger near miss should kill a 2-hp bunker");
  assert.ok(result.y > hit.y, "the burst point is below the impact point");
  // Compared with HE on the same spot, the digger's crater is deeper and
  // narrower. Deep ground, so neither crater is clamped by the field floor.
  const deep = () => {
    const w = flat();
    for (let i = 0; i < w.terrain.surface.length; i++) w.terrain.surface[i] = 460;
    return w;
  };
  const he = deep();
  Physics.detonate(he, {
    kind: "ground",
    x: 700,
    y: 460,
    shot: Physics.launch(0, 0, 45, 50, "he")
  });
  const dg = deep();
  Physics.detonate(dg, {
    kind: "ground",
    x: 700,
    y: 460,
    shot: Physics.launch(0, 0, 45, 50, "digger")
  });
  assert.ok(
    Terrain.heightAt(dg.terrain, 700) > Terrain.heightAt(he.terrain, 700) + 4,
    "the digger crater is not deeper"
  );
  assert.ok(
    Terrain.heightAt(dg.terrain, 740) < Terrain.heightAt(he.terrain, 740),
    "the digger crater is not narrower"
  );
});

test("a roller lands, rolls downhill, and bursts on what it meets", () => {
  // A slope falling to the right with a bunker at the bottom of it.
  const w = flat();
  for (let i = 0; i < w.terrain.surface.length; i++) {
    const x = i * w.terrain.step;
    w.terrain.surface[i] = x < 500 ? 560 : x < 900 ? 560 - (x - 500) * 0.25 + (x - 500) * 0.5 : 760;
  }
  // Clamp to the field: the slope runs from 560 at x=500 down to 660 at x=900.
  for (let i = 0; i < w.terrain.surface.length; i++)
    w.terrain.surface[i] = Math.min(w.terrain.surface[i], 590);
  w.targets = [target(880, Terrain.heightAt(w.terrain, 880))];
  // Land the roller on the slope short of the target and let it run.
  const shot = Physics.launch(...muzzleOf(w, 40), 40, 48, "roller");
  let out = null,
    landed = false,
    guard = 0;
  while (!out && guard++ < 20000) {
    out = Physics.fly(shot, 1 / 60, w);
    if (shot.rolling) landed = true;
  }
  assert.ok(landed, "the roller never touched down");
  assert.ok(shot.x > 600, `it should have rolled on from its landing, reached ${shot.x}`);
  assert.ok(["adjacent", "ground"].includes(out.kind));
});

test("a roller comes to rest in a hollow and bursts there", () => {
  const w = flat();
  // A bowl: down from x=600 to 700, up again to 800.
  for (let i = 0; i < w.terrain.surface.length; i++) {
    const x = i * w.terrain.step;
    w.terrain.surface[i] =
      x < 600 || x > 800 ? 540 : 540 + 40 * Math.sin(((x - 600) / 200) * Math.PI);
  }
  const shot = Physics.launch(...muzzleOf(w, 42), 42, 46, "roller");
  let out = null,
    guard = 0;
  while (!out && guard++ < 30000) out = Physics.fly(shot, 1 / 60, w);
  assert.strictEqual(out.kind, "ground");
  assert.ok(shot.x > 620 && shot.x < 780, `it should settle in the bowl, not at ${shot.x}`);
  assert.ok(shot.time < Physics.MAX_FLIGHT, "it should stop on its own, not on the timeout");
});

// ---- detonation ------------------------------------------------------------

test("a direct hit kills armour outright; a near miss only chips it", () => {
  const w = flat({ targets: [target(600, 560, 2)] });
  const he = () => Physics.launch(0, 0, 45, 50, "he");
  const near = { kind: "ground", x: 640, y: 560, shot: he() };
  let result = Physics.detonate(w, near);
  assert.strictEqual(result.destroyed.length, 0, "a near miss should not kill armour");
  assert.strictEqual(w.targets[0].hp, 1);
  result = Physics.detonate(w, near);
  assert.strictEqual(result.destroyed.length, 1, "a second near miss should finish it");

  const w2 = flat({ targets: [target(600, 560, 2)] });
  const direct = { kind: "direct", x: 600, y: 552, target: w2.targets[0], shot: he() };
  assert.strictEqual(Physics.detonate(w2, direct).destroyed.length, 1);
  assert.strictEqual(w2.targets[0].direct, true);
});

test("one blast can take two targets that are close together", () => {
  const w = flat({ targets: [target(600, 560), target(640, 560)] });
  const result = Physics.detonate(w, {
    kind: "ground",
    x: 620,
    y: 560,
    shot: Physics.launch(0, 0, 45, 50)
  });
  assert.strictEqual(result.destroyed.length, 2);
  assert.strictEqual(Physics.remaining(w), 0);
});

test("a blast far from everything destroys nothing but still digs", () => {
  const w = world({});
  const before = Physics.remaining(w);
  const result = Physics.detonate(w, {
    kind: "ground",
    x: 200,
    y: Terrain.heightAt(w.terrain, 200),
    shot: Physics.launch(0, 0, 45, 50)
  });
  assert.strictEqual(result.destroyed.length, 0);
  assert.strictEqual(Physics.remaining(w), before);
  assert.ok(w.terrain.craters.length > 0);
});

test("survivors — and the gun — settle when the ground is dug out from under them", () => {
  const w = world({});
  const t = w.targets[0];
  const startY = t.y;
  Terrain.carve(w.terrain, t.x, Terrain.heightAt(w.terrain, t.x), 70);
  const gunY = w.turret.y;
  Terrain.carve(w.terrain, w.turret.x, w.turret.y, 40);
  Physics.settle(w);
  assert.ok(t.y > startY, "the target hung in the air over its own crater");
  assert.ok(w.turret.y > gunY, "the gun hung in the air over the crater under it");
});

test("dead targets are never damaged or settled again", () => {
  const w = world({});
  const t = w.targets[0];
  Physics.detonate(w, {
    kind: "direct",
    x: t.x,
    y: t.y,
    target: t,
    shot: Physics.launch(0, 0, 45, 50)
  });
  const restingPlace = t.y;
  Terrain.carve(w.terrain, t.x, Terrain.heightAt(w.terrain, t.x), 80);
  Physics.settle(w);
  assert.strictEqual(t.y, restingPlace);
  const again = Physics.detonate(w, {
    kind: "ground",
    x: t.x,
    y: t.y,
    shot: Physics.launch(0, 0, 45, 50)
  });
  assert.strictEqual(again.destroyed.length, 0);
});

// ---- return fire ------------------------------------------------------------

test("an enemy shell ignores its own side and strikes only the gun", () => {
  const w = flat({ targets: [target(300, 560), target(700, 560)] });
  const enemy = Physics.launch(700, 540, 115, 60, "he", "enemy");
  const shell = Physics.launch(...muzzleOf(w, 45), 45, 60, "he", "player");
  assert.strictEqual(Physics.hitGun(w.turret, w.turret.x, w.turret.y - 10), true);
  // Fly the enemy shell straight through the emplacement at 300: no strike.
  const flyThrough = { ...enemy, x: 300, y: 545, vx: -200, vy: 0 };
  const out = Physics.fly(flyThrough, 1 / 60, w);
  assert.ok(!out || out.kind !== "direct" || !out.target, "an enemy shell struck an emplacement");
  // A player shell over the gun does nothing to the gun.
  const overGun = { ...shell, x: w.turret.x, y: w.turret.y - 30, vx: 0, vy: 200 };
  const own = Physics.fly(overGun, 1 / 60, w);
  assert.ok(!own || !own.gun, "a player's own shell struck the gun");
});

test("an enemy detonation damages the gun and nothing else", () => {
  const w = flat({ targets: [target(700, 560)] });
  const hit = {
    kind: "ground",
    x: w.turret.x + 30,
    y: w.turret.y,
    shot: Physics.launch(0, 0, 115, 50, "he", "enemy")
  };
  const result = Physics.detonate(w, hit);
  assert.strictEqual(result.gunHit, true);
  assert.strictEqual(w.turret.hp, 2);
  assert.strictEqual(w.targets[0].hp, 1, "friendly fire");
  const far = {
    kind: "ground",
    x: 600,
    y: 560,
    shot: Physics.launch(0, 0, 115, 50, "he", "enemy")
  };
  assert.strictEqual(Physics.detonate(w, far).gunHit, false);
  assert.strictEqual(w.turret.hp, 2);
  // A shell through the hull hurts twice as much.
  const direct = { kind: "direct", x: w.turret.x, y: w.turret.y - 10, gun: true, shot: hit.shot };
  Physics.detonate(w, direct);
  assert.strictEqual(w.turret.hp, 0);
});

test("solvePower finds the charge that lands on a mark, in either direction", () => {
  const w = flat();
  const from = { x: 96, y: 520 };
  for (const mark of [500, 800, 1100]) {
    const power = Physics.solvePower(w, from, 55, mark, "he", "probe");
    const probe = Physics.launch(from.x, from.y, 55, power, "he", "probe");
    let out = null;
    while (!out) out = Physics.fly(probe, 1 / 60, w);
    assert.ok(Math.abs(out.x - mark) < 12, `aimed at ${mark}, landed at ${out.x.toFixed(0)}`);
  }
  // And back the other way, the way an emplacement fires.
  const back = { x: 1000, y: 520 };
  const power = Physics.solvePower(w, back, 115, 300, "he", "probe");
  const probe = Physics.launch(back.x, back.y, 115, power, "he", "probe");
  let out = null;
  while (!out) out = Physics.fly(probe, 1 / 60, w);
  assert.ok(Math.abs(out.x - 300) < 12, `aimed back at 300, landed at ${out.x.toFixed(0)}`);
});

test("return fire walks on: the opening shots miss, then close in", () => {
  const w = flat({ targets: [target(900, 560)] });
  const shooter = w.targets[0];
  const random = Terrain.rng(3);
  const misses = [];
  for (let i = 0; i < 7; i++) {
    const before = shooter.error;
    const reply = Physics.enemyShot(w, shooter, random);
    misses.push(Math.abs(reply.aimX - w.turret.x));
    assert.strictEqual(reply.shot.owner, "enemy");
    assert.ok(
      shooter.error < before || shooter.error === shooter.minError,
      "the error never shrinks"
    );
    assert.ok(reply.shot.vx < 0, "it should fire back toward the gun");
  }
  // The first two aim points are deliberately clear of the gun.
  assert.ok(
    misses[0] > 60 && misses[1] > 60,
    `the opening shots were already on: ${misses.slice(0, 2)}`
  );
  assert.ok(misses[6] < misses[0], "the ranging never closed");
  assert.strictEqual(shooter.fired, 7);
  assert.ok(shooter.error >= shooter.minError);
});

test("the spotter's call reads short and over against the nearest live target", () => {
  const w = flat({ targets: [target(600, 560), target(900, 560)] });
  assert.deepStrictEqual(
    (({ offset, distance, target: t }) => ({ offset, distance, x: t.x }))(Physics.spot(w, 520)),
    { offset: -80, distance: 80, x: 600 }
  );
  assert.strictEqual(Physics.spot(w, 950).offset, 50);
  w.targets[0].hp = 0;
  assert.strictEqual(Physics.spot(w, 520).target.x, 900, "a dead target is not a target");
  w.targets[1].hp = 0;
  assert.strictEqual(Physics.spot(w, 520), null);
});

test("the preview stops at the ground, ignores the wind, and is bounded", () => {
  const w = world({ targets: [], weather: Physics.weather(200, 0) });
  const points = Physics.preview(...muzzleOf(w, 45), 45, 60, w, "he");
  assert.ok(points.length > 4 && points.length <= 220);
  const last = points[points.length - 1];
  assert.ok(last.y <= Terrain.heightAt(w.terrain, last.x) + 20);
  const still = Physics.preview(...muzzleOf(w, 45), 45, 60, world({ targets: [] }), "he");
  assert.deepStrictEqual(points, still, "the preview should not see the wind");
});

test("the trail is recorded but bounded", () => {
  const { shot } = fire(flat(), 60, 80);
  assert.ok(shot.trail.length > 2);
  assert.ok(shot.trail.length <= 400);
});

test("a cluster shell struck before its apex bursts instead of being wasted", () => {
  // Fired flat, or into the face of a mesa, the shell never reaches the top of
  // its arc. It must still open: a silently deleted round is the worst thing a
  // rack-limited game can do to a player.
  const world = Levels.build(5, 3, Terrain, Physics.weather);
  const tip = Physics.muzzle(world.turret, 0);
  const shot = Physics.launch(tip.x, tip.y, 0, 20, "cluster", "player");
  let out = null,
    guard = 0;
  while (!out && guard++ < 4000) out = Physics.fly(shot, 1 / 60, world);
  assert.strictEqual(out.kind, "split", "a premature cluster impact must still open");
  assert.strictEqual(out.children.length, Physics.WEAPONS.cluster.bomblets);
  // And the bomblets are real: they carry the cluster's bomblet blast.
  for (const child of out.children)
    assert.strictEqual(child.blast, Physics.WEAPONS.cluster.bombletBlast);
});

test("the HE blast radius has one definition", () => {
  // Two copies of 46 drift apart; the rack entry must be the constant itself.
  assert.strictEqual(Physics.WEAPONS.he.blast, Physics.BLAST_RADIUS);
});

test("the windsock is scenery: hittable, but it scores and ends nothing", () => {
  const world = Levels.build(3, 7, Terrain, Physics.weather);
  assert.equal(world.sock.hp, 1);
  const before = Physics.remaining(world);
  // A shell put through the sock takes it off its pole.
  const shot = Physics.launch(world.sock.x - 40, world.sock.y, 0, 60, "he", "player");
  let out = null,
    guard = 0;
  while (!out && guard++ < 400) out = Physics.fly(shot, 1 / 120, world);
  assert.equal(out.kind, "direct", "the sock must stop a shell");
  const result = Physics.detonate(world, out);
  assert.equal(result.sockHit, true);
  assert.equal(world.sock.hp, 0);
  assert.equal(result.destroyed.length, 0, "the sock is not a target");
  assert.equal(Physics.remaining(world), before, "shooting it must not clear anything");
  // And it only comes down once.
  assert.equal(Physics.detonate(world, out).sockHit, false);
});

test("the enemy's shells ignore the windsock", () => {
  const world = Levels.build(3, 7, Terrain, Physics.weather);
  const shot = Physics.launch(world.sock.x + 40, world.sock.y, 180, 60, "he", "enemy");
  let out = null,
    guard = 0;
  while (!out && guard++ < 400) out = Physics.fly(shot, 1 / 120, world);
  assert.equal(world.sock.hp, 1, "an enemy shell must pass straight through it");
  assert.ok(out === null || !out.sock);
});

test("a shell of your own on your own position is recorded, and never damaging", () => {
  const world = Levels.build(3, 7, Terrain, Physics.weather);
  const hp = world.turret.hp;
  const gun = { x: world.turret.x, y: world.turret.y - 16 };
  const own = Physics.detonate(world, {
    kind: "ground",
    x: gun.x,
    y: gun.y,
    shot: { kind: "he", blast: 46, damage: 1, owner: "player" }
  });
  assert.equal(own.selfHit, true);
  assert.equal(own.gunHit, false, "only the enemy's shells hurt the gun");
  assert.equal(world.turret.hp, hp);
  // A shell that lands downrange is not a self-hit.
  const away = Physics.detonate(world, {
    kind: "ground",
    x: gun.x + 400,
    y: gun.y,
    shot: { kind: "he", blast: 46, damage: 1, owner: "player" }
  });
  assert.equal(away.selfHit, false);
});

test("the windsock never sits in the line of fire", () => {
  const Play = require("./play.cjs");
  let closest = Infinity;
  let where = null;
  for (let index = 0; index < 10; index++)
    for (let seed = 1; seed <= 4; seed++) {
      const world = Play.build(index, seed);
      let guard = 0;
      while (
        Physics.remaining(world) > 0 &&
        world.shotsLeft > 0 &&
        world.turret.hp > 0 &&
        guard++ < 30
      ) {
        const target = Play.chooseTarget(world);
        const kind = Play.chooseWeapon(world, target);
        const best = Play.aim(world, target, kind, null);
        const tip = Physics.muzzle(world.turret, best.angle);
        // Fly the same solution as a probe, measuring its clearance all the way.
        const probe = Physics.launch(tip.x, tip.y, best.angle, best.power, kind, "probe");
        let out = null,
          steps = 0;
        while (!out && steps++ < 3000) {
          out = Physics.fly(probe, 1 / 120, world);
          const gap = Math.hypot(probe.x - world.sock.x, probe.y - world.sock.y);
          if (gap < closest) {
            closest = gap;
            where = "level " + (index + 1) + " seed " + seed;
          }
        }
        world.rack[kind]--;
        world.shotsLeft--;
        Play.resolve(world, Physics.launch(tip.x, tip.y, best.angle, best.power, kind, "player"));
        Play.pass(world, Play.AIM_SECONDS);
      }
    }
  // Hitting it has to be a deliberate act, never something that eats a shell
  // aimed at an emplacement.
  assert.ok(
    closest > 100,
    "a shot at a target came within " + Math.round(closest) + "px of the windsock (" + where + ")"
  );
});

test("the windsock can be reached from the gun on every campaign level", () => {
  for (let index = 0; index < 10; index++) {
    const world = Levels.build(index, 7, Terrain, Physics.weather);
    let found = null;
    for (let angle = 30; angle <= 60 && !found; angle++)
      for (let power = 80; power <= 100 && !found; power++) {
        const tip = Physics.muzzle(world.turret, angle);
        const shot = Physics.launch(tip.x, tip.y, angle, power, "he", "player");
        let out = null,
          steps = 0;
        while (!out && steps++ < 3000) out = Physics.fly(shot, 1 / 120, world);
        if (out && out.sock) found = angle + "/" + power;
      }
    assert.ok(found, "level " + (index + 1) + " must leave the windsock reachable");
  }
});
