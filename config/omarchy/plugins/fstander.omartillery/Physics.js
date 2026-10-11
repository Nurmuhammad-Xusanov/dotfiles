// Ballistics. A shell is a point mass under gravity and quadratic drag. Drag
// acts against the shell's velocity *relative to the air*, so wind is simply
// the air moving: a light, draggy bomblet gets carried by it and a dense
// bunker-buster shrugs it off, with no separate wind rule for either. The air
// moves faster higher up, the way it does over real ground, so a high lob is
// pushed harder than a flat shot.
//
// Everything advances in fixed 120 Hz steps through an accumulator, so a
// flight is bit-for-bit identical whatever the display refresh rate, and the
// offline gunner in tests/balance.cjs plays exactly the game the player does.
//
// QML JavaScript resources cannot import one another, so this module never
// reaches for Terrain.js. The caller hands it the terrain module on
// `world.ground` instead, which also makes the ballistics trivially testable
// against a flat stub.

var GRAVITY = 260; // world px/s^2
var MIN_POWER = 5;
var MAX_POWER = 100;
var MIN_ANGLE = 0;
var MAX_ANGLE = 180;
var MUZZLE_BASE = 70; // px/s at power 0
var MUZZLE_GAIN = 6.9; // px/s per power point
var STEP = 1 / 120; // fixed simulation step
// Gun geometry, shared with the renderer so the shell leaves the drawn barrel
// rather than appearing beside it. The barrel pivots this far above the hull's
// footprint and is this long at rest.
var GUN_PIVOT = 16;
var GUN_BARREL = 34;
var GUN_RADIUS = 22; // the hull, for incoming fire
var GUN_HP = 3;
var MAX_FLIGHT = 24; // seconds before a shell is written off as lost
var BLAST_RADIUS = 46;
var SOCK_RADIUS = 45; // the windsock: the pole and the whole span of the sock
// Wind shear: the air at the top of the field moves this much faster than the
// air at the ground, and keeps growing above the field.
var SHEAR_FLOOR = 0.55;
var SHEAR_CEILING = 1.35;

// The rack. `drag` is the quadratic drag coefficient in 1/px: acceleration is
// -drag * |v_rel| * v_rel. Dense shells have less of it and fly flatter,
// faster and truer in wind.
var WEAPONS = {
  he: {
    id: "he",
    name: "HE",
    caption: "The standard shell. Honest arc, honest blast.",
    drag: 0.00026,
    blast: BLAST_RADIUS,
    damage: 1,
    speed: 1
  },
  cluster: {
    id: "cluster",
    name: "CLUSTER",
    caption:
      "Splits at the top of its arc into five bomblets. Wide, shallow, and at the mercy of the wind.",
    drag: 0.00034,
    blast: 0,
    damage: 0,
    speed: 0.96,
    bomblets: 5,
    bombletDrag: 0.00065,
    bombletBlast: 24,
    bombletDamage: 1,
    spread: 75
  },
  digger: {
    id: "digger",
    name: "DIGGER",
    caption: "Dense and fast. Burrows before it bursts: small crater, deep, and it cracks armour.",
    drag: 0.0001,
    blast: 30,
    damage: 2,
    speed: 1.06,
    penetration: 24
  },
  roller: {
    id: "roller",
    name: "ROLLER",
    caption: "Lands, then rolls with the ground until it meets something. Read the slope.",
    drag: 0.00026,
    blast: 40,
    damage: 1,
    speed: 1,
    rolls: true,
    rollFriction: 26,
    rollBounce: 0.45,
    rollTimeout: 7
  }
};
var WEAPON_ORDER = ["he", "cluster", "digger", "roller"];

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function weapon(id) {
  return WEAPONS[id] || WEAPONS.he;
}

function muzzleSpeed(power, kind) {
  return (MUZZLE_BASE + clamp(power, MIN_POWER, MAX_POWER) * MUZZLE_GAIN) * weapon(kind).speed;
}

// Angles are degrees measured anticlockwise from the +x axis, so 45 lobs up
// and to the right and 135 lobs up and to the left. Screen y grows downward,
// which is why the vertical component is negated.
// Where the barrel pivots, which is what the player is really aiming.
function pivot(turret) {
  return { x: turret.x, y: turret.y - GUN_PIVOT };
}

// The muzzle: the tip of the barrel at this elevation. Shells start here, so a
// steep shot leaves the top of the barrel instead of the middle of the hull.
function muzzle(turret, angle) {
  var radians = (clamp(angle, MIN_ANGLE, MAX_ANGLE) * Math.PI) / 180;
  return {
    x: turret.x + Math.cos(radians) * GUN_BARREL,
    y: turret.y - GUN_PIVOT - Math.sin(radians) * GUN_BARREL
  };
}

// ---- weather ---------------------------------------------------------------

// The wind is a horizontal air speed in px/s, positive downrange. A level sets
// a prevailing wind and a gust limit; the actual wind wanders between them,
// picking a new target every few seconds and easing toward it, so the sock is
// worth watching and the moment of firing matters. `random` is a seeded
// generator supplied by the level, which keeps the weather reproducible.
function weather(base, gust, random) {
  return {
    base: base,
    gust: gust,
    value: base,
    target: base,
    timer: 0,
    random: random || Math.random
  };
}

function blow(w, dt) {
  if (!w) return 0;
  if (w.gust > 0) {
    w.timer -= dt;
    if (w.timer <= 0) {
      w.target = w.base + (w.random() * 2 - 1) * w.gust;
      w.timer = 1.6 + w.random() * 2.8;
    }
    // Ease with a rate that closes most of the gap in about a second.
    var rate = 1 - Math.exp(-dt * 1.4);
    w.value += (w.target - w.value) * rate;
  } else w.value = w.base;
  return w.value;
}

// Wind at a height: the shear profile scales the reference wind by altitude.
function windAt(world, y) {
  var value = world.weather ? world.weather.value : world.wind || 0;
  var height = world.terrain ? world.terrain.height : 600;
  var altitude = clamp((height - y) / height, 0, 1.6);
  return value * clamp(SHEAR_FLOOR + (1 - SHEAR_FLOOR) * altitude, SHEAR_FLOOR, SHEAR_CEILING);
}

// ---- shells ----------------------------------------------------------------

function launch(x, y, angle, power, kind, owner) {
  var w = weapon(kind);
  var speed = muzzleSpeed(power, kind),
    radians = (clamp(angle, MIN_ANGLE, MAX_ANGLE) * Math.PI) / 180;
  return {
    kind: w.id,
    owner: owner || "player",
    drag: w.drag,
    blast: w.blast,
    damage: w.damage,
    x: x,
    y: y,
    vx: Math.cos(radians) * speed,
    vy: -Math.sin(radians) * speed,
    time: 0,
    acc: 0,
    apex: false,
    rolling: false,
    rollStill: 0,
    trail: [{ x: x, y: y }]
  };
}

function bomblet(parent, vx, vy) {
  var w = WEAPONS.cluster;
  return {
    kind: "bomblet",
    owner: parent.owner,
    drag: w.bombletDrag,
    blast: w.bombletBlast,
    damage: w.bombletDamage,
    x: parent.x,
    y: parent.y,
    vx: vx,
    vy: vy,
    time: parent.time,
    acc: 0,
    apex: true,
    rolling: false,
    rollStill: 0,
    trail: [{ x: parent.x, y: parent.y }]
  };
}

// One fixed step of free flight: semi-implicit Euler with quadratic drag
// against the local air.
function advance(shot, dt, world) {
  var air = windAt(world, shot.y);
  var rx = shot.vx - air,
    ry = shot.vy;
  var speed = Math.sqrt(rx * rx + ry * ry);
  // A world may scale drag away entirely; see the old gun drill in
  // Challenges.js, which flies the school parabola on purpose.
  var drag = world.dragScale === undefined ? shot.drag : shot.drag * world.dragScale;
  shot.vx += -drag * speed * rx * dt;
  shot.vy += (GRAVITY - drag * speed * ry) * dt;
  shot.x += shot.vx * dt;
  shot.y += shot.vy * dt;
  shot.time += dt;
  return shot;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// A live target the shell can strike directly.
function hitTarget(targets, x, y) {
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    if (t.hp <= 0) continue;
    if (distance(x, y, t.x, t.y - t.r * 0.4) <= t.r) return t;
  }
  return null;
}

function hitGun(gun, x, y) {
  return gun && gun.hp > 0 && distance(x, y, gun.x, gun.y - GUN_PIVOT) <= GUN_RADIUS;
}

// What a shell can strike depends on who fired it: the enemy's shells ignore
// their own emplacements and look for the gun instead.
function struck(shot, world, x, y) {
  if (shot.owner === "probe") return null;
  if (shot.owner === "enemy") return hitGun(world.turret, x, y) ? { gun: true } : null;
  var target = hitTarget(world.targets, x, y);
  if (target) return { target: target };
  var props = world.props || [];
  for (var i = 0; i < props.length; i++) {
    var prop = props[i];
    if (prop.hp > 0 && distance(x, y, prop.x, prop.y - 12) <= 18) return { prop: prop };
  }
  // The windsock is scenery, not a target: it counts for nothing and ends
  // nothing. It is here because a gunner with a spare shell will eventually
  // try it, and a game should notice when you do.
  var sock = world.sock;
  if (sock && sock.hp > 0 && distance(x, y, sock.x, sock.y) <= SOCK_RADIUS) return { sock: sock };
  return null;
}

function offField(shot, world) {
  return (
    shot.x < -240 ||
    shot.x > world.terrain.width + 240 ||
    shot.y > world.terrain.height + 200 ||
    shot.time >= MAX_FLIGHT
  );
}

function recordTrail(shot) {
  var tail = shot.trail[shot.trail.length - 1];
  if (!tail || distance(tail.x, tail.y, shot.x, shot.y) >= 9) {
    shot.trail.push({ x: shot.x, y: shot.y });
    if (shot.trail.length > 400) shot.trail.shift();
  }
}

// The slope of the ground under x as dy/dx in screen space (positive means
// the ground falls away to the right).
function slopeAt(world, x) {
  var h = 3;
  return (
    (world.ground.heightAt(world.terrain, x + h) - world.ground.heightAt(world.terrain, x - h)) /
    (2 * h)
  );
}

// A roller on the ground: it keeps the along-slope part of its velocity, then
// gravity and friction along the surface decide where it ends up.
function roll(shot, dt, world) {
  var w = WEAPONS.roller;
  var slope = slopeAt(world, shot.x);
  // Tangential gravity along +x is g * sin(theta) with tan(theta) = slope.
  var along = (GRAVITY * slope) / Math.sqrt(1 + slope * slope);
  var friction = w.rollFriction * (shot.vx > 0 ? -1 : shot.vx < 0 ? 1 : 0);
  var next = shot.vx + (along + friction) * dt;
  // Friction never reverses the roll on its own.
  if (
    shot.vx !== 0 &&
    ((shot.vx > 0 && next < 0) || (shot.vx < 0 && next > 0)) &&
    Math.abs(along) < w.rollFriction
  )
    next = 0;
  shot.vx = next;
  shot.x += shot.vx * dt;
  shot.y = world.ground.heightAt(world.terrain, shot.x);
  shot.vy = 0;
  shot.time += dt;
  shot.rollStill = Math.abs(shot.vx) < 6 ? shot.rollStill + dt : 0;
  var hit = struck(shot, world, shot.x, shot.y - 4);
  if (hit) return impact(shot, "adjacent", hit);
  if (shot.rollStill >= 0.35 || shot.time >= MAX_FLIGHT) return impact(shot, "ground", null);
  if (shot.x < -60 || shot.x > world.terrain.width + 60)
    return { kind: "lost", x: shot.x, y: shot.y, shot: shot };
  return null;
}

function impact(shot, kind, hit) {
  var out = { kind: kind, x: shot.x, y: shot.y, shot: shot };
  if (hit && hit.target) out.target = hit.target;
  if (hit && hit.gun) out.gun = true;
  if (hit && hit.prop) out.prop = hit.prop;
  if (hit && hit.sock) out.sock = hit.sock;
  return out;
}

// Step one shell forward by dt in fixed increments, sampling each swept
// segment so a fast shell cannot tunnel through a thin ridge or clip past a
// target between frames. Returns null while the shell is still flying, an
// impact description when it stops, or { kind: "split" } with the bomblets
// a cluster shell has become.
function fly(shot, dt, world) {
  shot.acc += dt;
  while (shot.acc >= STEP - 1e-9) {
    shot.acc -= STEP;
    if (shot.rolling) {
      var rolled = roll(shot, STEP, world);
      if (rolled) return rolled;
      recordTrail(shot);
      continue;
    }
    var px = shot.x,
      py = shot.y,
      pvy = shot.vy;
    advance(shot, STEP, world);
    // A cluster shell opens at the top of its arc, which is the first step on
    // which it stops climbing.
    if (shot.kind === "cluster" && !shot.apex && pvy < 0 && shot.vy >= 0) {
      shot.apex = true;
      return { kind: "split", x: shot.x, y: shot.y, shot: shot, children: split(shot, world) };
    }
    var samples = Math.max(2, Math.ceil(distance(px, py, shot.x, shot.y) / 6));
    for (var i = 1; i <= samples; i++) {
      var f = i / samples,
        x = px + (shot.x - px) * f,
        y = py + (shot.y - py) * f;
      var hit = struck(shot, world, x, y);
      if (hit) {
        shot.x = x;
        shot.y = y;
        // A cluster shell has no filler of its own: struck on the way up it
        // bursts where it is rather than being wasted.
        if (shot.kind === "cluster" && !shot.apex) {
          shot.apex = true;
          return { kind: "split", x: shot.x, y: shot.y, shot: shot, children: split(shot, world) };
        }
        return impact(shot, "direct", hit);
      }
      if (y >= 0 && world.ground.isSolid(world.terrain, x, y)) {
        shot.x = x;
        shot.y = world.ground.heightAt(world.terrain, x);
        if (shot.kind === "cluster" && !shot.apex) {
          shot.apex = true;
          return { kind: "split", x: shot.x, y: shot.y, shot: shot, children: split(shot, world) };
        }
        if (shot.kind === "roller") {
          // Land: keep the along-slope component, lose the rest to the bounce.
          var slope = slopeAt(world, shot.x),
            tx = 1 / Math.sqrt(1 + slope * slope),
            ty = slope * tx;
          shot.vx = (shot.vx * tx + shot.vy * ty) * WEAPONS.roller.rollBounce * tx;
          shot.vy = 0;
          shot.rolling = true;
          shot.rollStill = 0;
          break;
        }
        return impact(shot, "ground", null);
      }
    }
    // Leaving the field sideways, or falling past the bottom of it, is a miss.
    // A shell above the field is still in play; high lobs are the whole game.
    if (!shot.rolling && offField(shot, world))
      return { kind: "lost", x: shot.x, y: shot.y, shot: shot };
    recordTrail(shot);
  }
  return null;
}

// The bomblets fan out around the parent's velocity, each with its own kick.
// The spread pattern is fixed rather than random so a cluster shot is a
// repeatable, learnable weapon.
function split(shot, world) {
  var w = WEAPONS.cluster,
    n = w.bomblets,
    out = [];
  for (var i = 0; i < n; i++) {
    var f = n === 1 ? 0 : i / (n - 1) - 0.5; // -0.5 .. 0.5
    out.push(
      bomblet(
        shot,
        shot.vx * (1 + f * 0.35) + f * w.spread,
        shot.vy - Math.abs(f) * w.spread * 0.4 - 18
      )
    );
  }
  return out;
}

// A detonation can undermine a position or set off a magazine. Resolve the
// complete chain here, so scoring, the offline gunner and QML see one result.
function detonate(world, hit) {
  var shot = hit.shot,
    cx = hit.x,
    cy = hit.y;
  if (shot.kind === "digger" && hit.kind !== "lost") cy += WEAPONS.digger.penetration;
  var result = {
    destroyed: [],
    damaged: 0,
    gunHit: false,
    radius: shot.blast,
    x: cx,
    y: cy,
    blasts: [],
    collapses: [],
    chains: 0,
    sockHit: false,
    selfHit: false
  };
  var hostile = shot.owner === "enemy";
  if (!hostile && hit.sock && hit.sock.hp > 0) {
    hit.sock.hp = 0;
    result.sockHit = true;
  }
  // A shell of your own coming down on your own position. It cannot hurt the
  // gun — only the enemy's shells do that — so this is purely a matter of
  // record, and the crew's opinion.
  if (!hostile && world.turret && world.turret.hp > 0)
    result.selfHit =
      distance(cx, cy, world.turret.x, world.turret.y - GUN_PIVOT) <= shot.blast + GUN_RADIUS;
  var queue = [
    { x: cx, y: cy, radius: shot.blast, damage: shot.damage, kind: shot.kind, first: true }
  ];
  var props = world.props || [];
  function killed(t) {
    if (result.destroyed.indexOf(t) >= 0) return;
    t.hp = 0;
    result.destroyed.push(t);
    if (t.role === "supply" && !hostile) {
      queue.push({ x: t.x, y: t.y, radius: 86, damage: 2, kind: "depot" });
      result.chains++;
    }
  }
  for (var q = 0; q < queue.length && q < 32; q++) {
    var blast = queue[q];
    result.blasts.push(blast);
    if (hostile) {
      var gun = world.turret;
      if (
        gun &&
        gun.hp > 0 &&
        ((blast.first && hit.gun) ||
          distance(blast.x, blast.y, gun.x, gun.y - GUN_PIVOT) <= blast.radius + GUN_RADIUS * 0.6)
      ) {
        gun.hp = Math.max(0, gun.hp - (blast.first && hit.gun ? 2 : 1));
        result.gunHit = true;
      }
    } else {
      for (var i = 0; i < world.targets.length; i++) {
        var t = world.targets[i];
        if (t.hp <= 0) continue;
        var direct =
          blast.first && (hit.kind === "direct" || hit.kind === "adjacent") && hit.target === t;
        if (!direct && distance(blast.x, blast.y, t.x, t.y - t.r * 0.4) > blast.radius + t.r * 0.6)
          continue;
        t.hp = direct ? 0 : t.hp - blast.damage;
        result.damaged++;
        if (t.hp <= 0) {
          t.direct = direct && hit.kind === "direct";
          killed(t);
        }
      }
    }
    if (blast.radius > 0) world.ground.carve(world.terrain, blast.x, blast.y, blast.radius);
    // Fractured ledges transmit a buried digger's shock through the footing.
    // The crack markings advertise this terrain tactic; intact positions keep
    // the ordinary blast and fall rules.
    if (!hostile && blast.first && shot.kind === "digger") {
      for (var support = 0; support < world.targets.length; support++) {
        var position = world.targets[support];
        if (
          position.hp > 0 &&
          position.unstable &&
          Math.abs(cx - position.x) <= 64 &&
          cy >= position.y - 8 &&
          cy <= position.y + 95
        )
          world.ground.carve(world.terrain, position.x, position.y + 24, 42);
      }
    }
    var fallen = settle(world, !hostile);
    for (var f = 0; f < fallen.destroyed.length; f++) killed(fallen.destroyed[f]);
    result.collapses = result.collapses.concat(fallen.collapses);
    result.gunHit = result.gunHit || fallen.gunHit;
    for (var j = 0; j < props.length; j++) {
      var prop = props[j];
      if (prop.hp <= 0) continue;
      var under = world.ground.heightAt(world.terrain, prop.x);
      var drop = Math.max(0, under - prop.y);
      prop.y = Math.max(prop.y, under);
      if (
        !hostile &&
        ((blast.first && hit.prop === prop) ||
          drop >= 30 ||
          distance(blast.x, blast.y, prop.x, prop.y - 10) <= blast.radius + 14)
      ) {
        // Mark before enqueueing: overlapping magazines each explode once.
        prop.hp = 0;
        queue.push({ x: prop.x, y: prop.y, radius: prop.blast || 110, damage: 2, kind: "depot" });
        result.chains++;
      }
    }
  }
  return result;
}

// Ordinary craters change elevation. Large falls hurt, and marked unstable
// positions can slide down an eroded shoulder. Each slide is bounded and
// stops before another live position; no terrain tunnels or floating islands.
function settle(world, damageAllowed) {
  var result = { destroyed: [], collapses: [], gunHit: false };
  for (var i = 0; i < world.targets.length; i++) {
    var t = world.targets[i];
    if (t.hp <= 0) continue;
    var ground = world.ground.heightAt(world.terrain, t.x);
    if (ground <= t.y) continue;
    var oldY = t.y,
      oldX = t.x;
    if (t.unstable && ground - oldY > 2) {
      for (var step = 0; step < 9; step++) {
        var slope = slopeAt(world, t.x);
        if (Math.abs(slope) < 0.65) break;
        var next = clamp(t.x + (slope > 0 ? 4 : -4), 220, world.terrain.width - t.r);
        var blocked = false;
        for (var j = 0; j < world.targets.length; j++)
          if (
            j !== i &&
            world.targets[j].hp > 0 &&
            Math.abs(world.targets[j].x - next) < t.r + world.targets[j].r + 4
          )
            blocked = true;
        if (blocked || next === t.x) break;
        t.x = next;
      }
      ground = world.ground.heightAt(world.terrain, t.x);
    }
    t.y = Math.min(Math.max(oldY, ground), world.terrain.floor);
    var drop = t.y - oldY,
      threshold = t.unstable ? 26 : 52;
    if (damageAllowed !== false && drop >= threshold) {
      t.hp = Math.max(0, t.hp - Math.floor(drop / threshold));
      t.direct = false;
      result.collapses.push({ x: t.x, y: t.y, fromX: oldX, fromY: oldY, drop: drop });
      if (t.hp === 0) result.destroyed.push(t);
    }
  }
  var gun = world.turret;
  if (gun && gun.hp > 0) {
    var under = world.ground.heightAt(world.terrain, gun.x);
    if (under > gun.y) {
      if (under - gun.y >= 75) {
        gun.hp = Math.max(0, gun.hp - 1);
        result.gunHit = true;
      }
      gun.y = Math.min(under, world.terrain.floor);
    }
  }
  return result;
}

// Public descriptions are shared by the briefing, field labels and notebook.
var ROLES = {
  gun: { name: "GUN", hint: "Ranges your position after each shot." },
  spotter: { name: "SPOTTER", hint: "Ranges you quickly. Destroy it to reset their corrections." },
  heavy: { name: "HEAVY GUN", hint: "Charges for three turns, then fires a heavy shell." },
  engineer: {
    name: "ENGINEER",
    hint: "Repairs one nearby damaged position each turn. Cannot revive wrecks."
  },
  supply: {
    name: "SUPPLY TRUCK",
    hint: "Moves between turns. Its ammunition explodes when destroyed."
  }
};
function role(t) {
  return ROLES[t.role] || ROLES.gun;
}
function intent(t, active) {
  if (t.role === "heavy") return "SALVO IN " + (3 - (t.charge || 0));
  if (t.role === "engineer") return "REPAIRS NEARBY";
  if (t.role === "supply") return "MOVES / EXPLOSIVE";
  if (!active || !t.fired) return "SEARCHING";
  return t.error <= 100 ? "LOCKED ON" : "ADJUSTING";
}

// One enemy turn, including support actions and charged guns. The caller
// animates the returned shots in order. All randomness comes from the run seed.
function enemyTurn(world, random, chooseSpotter) {
  var events = [],
    replies = [];
  world.enemyTurns = (world.enemyTurns || 0) + 1;
  for (var i = 0; i < world.targets.length; i++) {
    var t = world.targets[i];
    if (t.hp <= 0) continue;
    if (t.role === "engineer") {
      var patient = null;
      for (var j = 0; j < world.targets.length; j++) {
        var candidate = world.targets[j];
        if (
          candidate !== t &&
          candidate.hp > 0 &&
          candidate.hp < candidate.maxHp &&
          Math.abs(candidate.x - t.x) <= 210 &&
          (!patient || candidate.hp < patient.hp)
        )
          patient = candidate;
      }
      if (patient) {
        patient.hp++;
        events.push({ kind: "repair", x: patient.x, y: patient.y, text: "REPAIRED +1" });
      }
    } else if (t.role === "supply") {
      var direction = t.direction || 1;
      var nx = clamp(t.x + direction * 24, t.homeX - 32, t.homeX + 32);
      var ny = world.ground.heightAt(world.terrain, nx),
        blocked = Math.abs(ny - t.y) > 22;
      for (var k = 0; k < world.targets.length; k++)
        if (
          k !== i &&
          world.targets[k].hp > 0 &&
          Math.abs(nx - world.targets[k].x) < t.r + world.targets[k].r + 6
        )
          blocked = true;
      if (blocked || nx === t.x) t.direction = -direction;
      else {
        t.x = nx;
        t.y = ny;
        events.push({ kind: "move", x: nx, y: ny, text: "RELOCATING" });
      }
    } else if (t.role === "heavy") {
      t.charge = (t.charge || 0) + 1;
    }
  }
  var spotter = chooseSpotter(world, random);
  world.spotter = spotter;
  if (spotter >= 0) replies.push(enemyShot(world, world.targets[spotter], random));
  for (var h = 0; h < world.targets.length; h++) {
    var heavy = world.targets[h];
    if (heavy.hp <= 0 || heavy.role !== "heavy" || heavy.charge < 3) continue;
    heavy.charge = 0;
    var reply = enemyShot(world, heavy, random);
    reply.shot.blast = 64;
    reply.heavy = true;
    replies.push(reply);
  }
  return { replies: replies, events: events };
}

function remaining(world) {
  return world.targets.filter(function (t) {
    return t.hp > 0;
  }).length;
}

// ---- fire control ----------------------------------------------------------

// The spotter's call after a shot, measured against the nearest live target
// downrange: how far short or over the shell fell, in px along the ground.
function spot(world, x) {
  var nearest = null,
    best = Infinity;
  for (var i = 0; i < world.targets.length; i++) {
    var t = world.targets[i];
    if (t.hp <= 0) continue;
    var d = Math.abs(t.x - x);
    if (d < best) {
      best = d;
      nearest = t;
    }
  }
  if (!nearest) return null;
  var offset = x - nearest.x;
  return { target: nearest, offset: offset, distance: Math.abs(offset) };
}

// Find the power that lands a shell at `targetX` from `from` at a fixed
// elevation, by bisection. Range grows with power, so the search is sound;
// the flight is simulated against the real ground and the current air, so a
// mesa in the way or a gust at launch is part of the answer.
function solvePower(world, from, angle, targetX, kind, owner) {
  var low = MIN_POWER,
    high = MAX_POWER;
  function landing(power) {
    var probe = launch(from.x, from.y, angle, power, kind, owner);
    var guard = 0,
      out = null;
    // Solutions must never disturb the world, so they see it but cannot strike:
    // an owner of "probe" matches nothing.
    probe.owner = "probe";
    while (!out && guard++ < 3000) out = fly(probe, 1 / 60, world);
    return out ? out.x : from.x;
  }
  for (var i = 0; i < 14; i++) {
    var mid = (low + high) / 2;
    if (landing(mid) < targetX === angle <= 90) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

// An emplacement returns fire. It aims at the gun with an error that shrinks
// every time it shoots — the classic bracket — and it fires steeply so a mesa
// between it and the gun is no shelter.
function enemyShot(world, shooter, random) {
  var gun = world.turret;
  var from = { x: shooter.x, y: shooter.y - shooter.r * 1.05 };
  var error = shooter.error === undefined ? 150 : shooter.error;
  // Ranging walks on: the miss is never less than a third of the current
  // error, so the opening shots land clearly off and each one lands closer.
  // A spotter becomes dangerous on about its fourth shot — which is the
  // player's window to kill it.
  var offset = error * (0.35 + 0.65 * random());
  var aimX = gun.x + (random() < 0.5 ? -offset : offset);
  // 115 degrees lobs up and back toward the gun on the left.
  var angle = 115;
  var power = solvePower(world, from, angle, aimX, "he", "enemy");
  shooter.error = Math.max(
    shooter.minError === undefined ? 18 : shooter.minError,
    error * (shooter.decay || 0.68)
  );
  shooter.fired = (shooter.fired || 0) + 1;
  return { shot: launch(from.x, from.y, angle, power, "he", "enemy"), aimX: aimX, from: from };
}

// A read-only copy of a world with its weather pinned, for rehearsing a shot
// without disturbing anything. Every derived world must be built through this:
// it is the one place that remembers to carry across the properties that
// change how a shell flies, such as a world that scales drag away.
function stillAir(world, wind) {
  return {
    terrain: world.terrain,
    ground: world.ground,
    targets: [],
    turret: null,
    wind: wind || 0,
    weather: wind ? { value: wind, gust: 0, base: wind } : null,
    dragScale: world.dragScale
  };
}

// A dotted preview of where a shell would go in still air. Used by the
// optional aim assist, never by the simulation.
function preview(x, y, angle, power, world, kind) {
  var terrain = world.terrain,
    still = stillAir(world, 0);
  var shot = launch(x, y, angle, power, kind, "probe"),
    points = [],
    guard = 0;
  while (guard++ < 1200) {
    var out = fly(shot, STEP * 3, still);
    if (out) break;
    if (shot.x < -200 || shot.x > terrain.width + 200 || shot.y > terrain.height + 160) break;
    if (guard % 4 === 0) points.push({ x: shot.x, y: shot.y });
    if (points.length >= 220) break;
  }
  return points;
}

if (typeof module !== "undefined")
  module.exports = {
    GRAVITY: GRAVITY,
    MIN_POWER: MIN_POWER,
    MAX_POWER: MAX_POWER,
    MIN_ANGLE: MIN_ANGLE,
    MAX_ANGLE: MAX_ANGLE,
    GUN_PIVOT: GUN_PIVOT,
    stillAir: stillAir,
    GUN_BARREL: GUN_BARREL,
    GUN_HP: GUN_HP,
    MAX_FLIGHT: MAX_FLIGHT,
    BLAST_RADIUS: BLAST_RADIUS,
    SHEAR_CEILING: SHEAR_CEILING,
    WEAPONS: WEAPONS,
    WEAPON_ORDER: WEAPON_ORDER,
    clamp: clamp,
    weapon: weapon,
    muzzleSpeed: muzzleSpeed,
    pivot: pivot,
    muzzle: muzzle,
    weather: weather,
    blow: blow,
    windAt: windAt,
    launch: launch,
    fly: fly,
    detonate: detonate,
    settle: settle,
    remaining: remaining,
    role: role,
    intent: intent,
    enemyTurn: enemyTurn,
    spot: spot,
    solvePower: solvePower,
    enemyShot: enemyShot,
    preview: preview,
    hitGun: hitGun
  };
