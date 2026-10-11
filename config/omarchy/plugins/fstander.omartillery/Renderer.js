// Original vector artwork on a 2D canvas. Every colour arrives in `theme`, so
// the renderer never names a colour and a theme switch repaints the field
// without touching this file. Coordinates are logical scene pixels; the canvas
// is sized in device pixels and counter-scaled by the view.
function line(c, x1, y1, x2, y2, color, width) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.strokeStyle = color;
  c.lineWidth = width || 1;
  c.stroke();
}

function circle(c, x, y, r, color) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}

// A palette colour at zero alpha, so a gradient can fade out without shifting
// hue on the way.
function clear(hex) {
  return (
    "rgba(" +
    parseInt(hex.slice(1, 3), 16) +
    "," +
    parseInt(hex.slice(3, 5), 16) +
    "," +
    parseInt(hex.slice(5, 7), 16) +
    ",0)"
  );
}

function ring(c, x, y, r, color, width) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.strokeStyle = color;
  c.lineWidth = width || 1;
  c.stroke();
}

// A parallax ridge behind the playfield, drawn from the same seeded shape each
// frame. Cheap: one path, no per-frame allocation beyond the path itself.
function backdrop(c, width, height, theme, phase) {
  var sky = c.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, theme.skyHigh);
  sky.addColorStop(1, theme.skyLow);
  c.fillStyle = sky;
  c.fillRect(0, 0, width, height);
  for (var layer = 0; layer < 2; layer++) {
    var base = height * (0.74 + layer * 0.06),
      amp = 42 - layer * 16,
      step = 64 + layer * 21;
    c.beginPath();
    c.moveTo(0, height);
    for (var x = 0; x <= width + step; x += step) {
      var y =
        base -
        Math.abs(Math.sin((x + layer * 320 + phase * (layer ? 3 : 1.6)) / (210 + layer * 90))) *
          amp;
      c.lineTo(x, y);
    }
    c.lineTo(width, height);
    c.closePath();
    c.fillStyle = layer ? theme.ridgeNear : theme.ridgeFar;
    c.fill();
  }
}

// Biomes use the host palette, with distinct silhouettes and weather. These
// are scenery, not invisible collision geometry; the bright surface is solid.
function scenery(c, width, height, world, theme, phase, moving) {
  var biome = world.biome || "quarry",
    wind = world.weather ? world.weather.value : 0;
  c.save();
  c.fillStyle = theme.ridgeNear;
  c.globalAlpha = 0.85;
  if (biome === "coast") {
    for (var wave = 0; wave < 7; wave++) {
      var wy = height * 0.76 + wave * 12;
      for (var x = 0; x < width; x += 95)
        line(c, x + Math.sin(phase * 0.35 + wave) * 14, wy, x + 48, wy, theme.haze, 1);
    }
    var bx = 420,
      by = height * 0.81;
    c.beginPath();
    c.moveTo(bx - 12, by);
    c.lineTo(bx - 7, by - 66);
    c.lineTo(bx + 7, by - 66);
    c.lineTo(bx + 12, by);
    c.closePath();
    c.fill();
    c.fillRect(bx - 12, by - 72, 24, 8);
    c.globalAlpha = 0.25;
    line(c, bx, by - 67, bx - 80, by - 75 + Math.sin(phase * 0.2) * 8, theme.accent, 2);
  } else if (biome === "industry") {
    for (var block = 0; block < 7; block++) {
      var fx = 130 + block * 177,
        fy = height * 0.86;
      var bh = 35 + ((block * 31) % 62);
      c.fillRect(fx, fy - bh, 110, bh);
      c.fillRect(fx + 15, fy - bh - 38, 12, 40);
      c.fillRect(fx + 73, fy - bh - 21, 8, 24);
      c.globalAlpha = 0.2;
      for (var window = 0; window < 4; window++) {
        c.fillStyle = theme.accent;
        c.fillRect(fx + 12 + window * 23, fy - 24, 8, 4);
      }
      c.fillStyle = theme.ridgeNear;
      c.globalAlpha = 0.85;
    }
  } else if (biome === "snow") {
    for (var peak = 0; peak < 5; peak++) {
      var mx = peak * 320 + 80,
        my = height * 0.57 + (peak % 2) * 50;
      c.fillStyle = theme.ridgeNear;
      c.beginPath();
      c.moveTo(mx - 210, height);
      c.lineTo(mx, my);
      c.lineTo(mx + 210, height);
      c.fill();
      c.fillStyle = theme.haze;
      c.beginPath();
      c.moveTo(mx - 34, my + 61);
      c.lineTo(mx, my);
      c.lineTo(mx + 37, my + 65);
      c.lineTo(mx + 4, my + 43);
      c.closePath();
      c.fill();
    }
    if (moving) {
      c.globalAlpha = 0.28;
      for (var flake = 0; flake < 26; flake++) {
        var sx = (((flake * 191 + phase * wind * 0.15) % width) + width) % width;
        var sy = (flake * 73 + phase * 19) % height;
        circle(c, sx, sy, flake % 3 === 0 ? 1.5 : 0.8, theme.foreground);
      }
    }
  } else {
    for (var shelf = 0; shelf < 4; shelf++) {
      var sy = height * 0.76 + shelf * 25;
      c.fillRect(720 - shelf * 64, sy, 430 + shelf * 90, 26);
      line(c, 720 - shelf * 64, sy, 1150 + shelf * 20, sy, theme.haze, 1);
    }
    line(c, 1120, height * 0.8, 1120, height * 0.59, theme.ridgeNear, 5);
    line(c, 1030, height * 0.62, 1180, height * 0.6, theme.ridgeNear, 4);
    line(c, 1040, height * 0.62, 1040, height * 0.74, theme.ridgeNear, 1);
  }
  c.restore();
}

function fieldDetails(c, world, theme, phase, moving) {
  c.save();
  var wind = world.weather ? world.weather.value : 0;
  if (world.biome === "snow") {
    c.globalAlpha = 0.45;
    c.beginPath();
    c.moveTo(0, world.terrain.surface[0]);
    for (var s = 1; s < world.terrain.surface.length; s++)
      c.lineTo(s * world.terrain.step, world.terrain.surface[s]);
    c.strokeStyle = theme.foreground;
    c.lineWidth = 3;
    c.stroke();
  }
  for (var i = 0; i < world.targets.length; i++) {
    var t = world.targets[i];
    if (t.unstable && t.hp > 0) {
      c.globalAlpha = 0.8;
      for (var crack = 0; crack < 3; crack++) {
        var x = t.x - 22 + crack * 18,
          y = world.ground.heightAt(world.terrain, x);
        line(c, x, y + 2, x - 5, y + 10, theme.warning, 1);
        line(c, x - 5, y + 10, x + 4, y + 15, theme.warning, 1);
      }
    }
    if (t.hp > 0) continue;
    for (var puff = 0; puff < 4; puff++) {
      var age = moving ? (phase * 0.3 + puff * 0.25 + t.seed * 0.01) % 1 : puff * 0.25;
      c.globalAlpha = (1 - age) * 0.17;
      circle(c, t.x + age * wind * 0.18, t.y - 10 - age * 75, 4 + age * 13, theme.smoke);
    }
  }
  var props = world.props || [];
  for (var p = 0; p < props.length; p++) {
    var depot = props[p];
    c.globalAlpha = depot.hp > 0 ? 0.95 : 0.3;
    c.fillStyle = theme.ground;
    c.fillRect(depot.x - 16, depot.y - (depot.hp > 0 ? 24 : 5), 32, depot.hp > 0 ? 24 : 5);
    if (depot.hp <= 0) continue;
    c.strokeStyle = theme.warning;
    c.lineWidth = 2;
    c.strokeRect(depot.x - 16, depot.y - 24, 32, 24);
    line(c, depot.x - 11, depot.y - 20, depot.x + 11, depot.y - 4, theme.warning, 1);
    line(c, depot.x + 11, depot.y - 20, depot.x - 11, depot.y - 4, theme.warning, 1);
    c.font = "9px monospace";
    c.textAlign = "center";
    c.fillStyle = theme.warning;
    c.fillText("AMMO", depot.x, depot.y - 32);
  }
  c.restore();
}

// Faint range marks every 200 px from the gun. They fill the sky with
// something useful rather than decoration: a player brackets a target by
// reading off how many marks short the last shell fell.
function rangeGrid(c, width, height, originX, theme) {
  c.save();
  c.globalAlpha = 0.65;
  c.font = "10px monospace";
  c.textAlign = "center";
  for (var x = originX + 200; x < width; x += 200) {
    line(c, x, height * 0.14, x, height, theme.grid, 1);
    c.fillStyle = theme.grid;
    c.fillText(String(Math.round(x - originX)), x, height * 0.12);
  }
  c.restore();
}

// Trace the filled body of the hill: along the surface, then back along the
// bottom of the field. Used both to fill the ground and to clip scorch marks
// into it.
function groundPath(c, terrain) {
  var step = terrain.step,
    surface = terrain.surface;
  c.beginPath();
  c.moveTo(0, terrain.height + 8);
  for (var i = 0; i < surface.length; i++) c.lineTo(i * step, surface[i]);
  c.lineTo((surface.length - 1) * step, terrain.height + 8);
  c.closePath();
}

// The heightmap as one filled polygon, its craters burnt into it, and a bright
// surface line over the top. Columns are emitted at the terrain's own sample
// spacing, so the drawn detail matches the physics exactly.
function ground(c, terrain, theme) {
  groundPath(c, terrain);
  var fill = c.createLinearGradient(0, 0, 0, terrain.height);
  fill.addColorStop(0, theme.ground);
  fill.addColorStop(1, theme.groundDeep);
  c.fillStyle = fill;
  c.fill();
  // Scorch marks are clipped to the hill. Without the clip the half of each
  // blast circle above the surface would hang in the sky as a disc.
  var craters = terrain.craters;
  if (craters.length) {
    c.save();
    groundPath(c, terrain);
    c.clip();
    // The burn is a radial fade centred on the blast: darkest at the crater
    // lip, gone before it reaches a full radius past it. Clipped to the hill,
    // the visible part is a charred rim following the bowl, not a disc.
    for (var i = Math.max(0, craters.length - 40); i < craters.length; i++) {
      var k = craters[i];
      var reach = k.r * 1.6;
      var burn = c.createRadialGradient(k.x, k.y, k.r * 0.8, k.x, k.y, reach);
      burn.addColorStop(0, theme.scorch);
      burn.addColorStop(1, clear(theme.scorch));
      c.fillStyle = burn;
      c.beginPath();
      c.arc(k.x, k.y, reach, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
  var surface = terrain.surface;
  c.beginPath();
  c.moveTo(0, surface[0]);
  for (var j = 1; j < surface.length; j++) c.lineTo(j * terrain.step, surface[j]);
  c.strokeStyle = theme.groundEdge;
  c.lineWidth = 2;
  c.stroke();
}

// `geometry` is { pivotY, barrel } and comes from Physics, so the drawn barrel
// and the point shells actually leave from can never drift apart.
function turret(c, gun, angle, theme, recoil, geometry) {
  var x = gun.x,
    y = gun.y,
    radians = (angle * Math.PI) / 180;
  var pivotY = y - geometry.pivotY;
  var kick = recoil || 0;
  // Recoil shortens the barrel and slides the whole gun back along its own axis.
  var barrel = geometry.barrel - kick * 8;
  // Barrel first so the mantlet covers its root.
  var bx = x + Math.cos(radians) * barrel,
    by = pivotY - Math.sin(radians) * barrel;
  line(
    c,
    x - Math.cos(radians) * kick * 5,
    pivotY + Math.sin(radians) * kick * 5,
    bx,
    by,
    theme.turret,
    7
  );
  line(c, x, pivotY, bx, by, theme.turretDark, 3);
  // A damaged gun smokes; a dead one is a wreck.
  if (gun.hp !== undefined && gun.maxHp && gun.hp < gun.maxHp) {
    c.save();
    c.globalAlpha = gun.hp <= 0 ? 0.7 : 0.35;
    circle(c, x + 6, y - 24, 7 + (gun.maxHp - gun.hp) * 3, theme.smoke);
    c.restore();
  }
  // Hull: a squat wedge that reads at a glance without any sprite work.
  c.beginPath();
  c.moveTo(x - 24, y);
  c.lineTo(x - 18, y - 13);
  c.lineTo(x + 16, y - 13);
  c.lineTo(x + 24, y);
  c.closePath();
  c.fillStyle = gun.hp === 0 ? theme.turretDark : theme.turret;
  c.fill();
  circle(c, x, y - 15, 9, theme.turretDark);
  ring(c, x, y - 15, 9, gun.hp === 0 ? theme.turretDark : theme.turret, 2);
  line(c, x - 24, y, x + 24, y, theme.turretDark, 3);
}

// A bunker with a slit. Armour shows as a second shell, damage as a gap.
function target(c, t, theme, phase) {
  var x = t.x,
    y = t.y;
  if (t.hp <= 0) {
    c.save();
    c.globalAlpha = 0.55;
    c.beginPath();
    c.moveTo(x - t.r, y);
    c.lineTo(x - t.r * 0.5, y - t.r * 0.35);
    c.lineTo(x + t.r * 0.6, y - t.r * 0.2);
    c.lineTo(x + t.r, y);
    c.closePath();
    c.fillStyle = theme.targetDead;
    c.fill();
    c.restore();
    return;
  }
  if (t.role === "supply") {
    c.fillStyle = theme.ground;
    c.strokeStyle = theme.warning;
    c.lineWidth = 2;
    c.fillRect(x - 21, y - 23, 27, 18);
    c.strokeRect(x - 21, y - 23, 27, 18);
    c.fillRect(x + 7, y - 18, 14, 13);
    c.strokeRect(x + 7, y - 18, 14, 13);
    circle(c, x - 12, y - 3, 5, theme.warning);
    circle(c, x + 13, y - 3, 5, theme.warning);
    line(c, x - 16, y - 19, x + 1, y - 9, theme.warning, 1);
    line(c, x + 1, y - 19, x - 16, y - 9, theme.warning, 1);
    return;
  }
  var armoured = t.maxHp > 1,
    hurt = t.hp < t.maxHp;
  var ink = armoured ? theme.targetArmour : theme.target;
  c.beginPath();
  c.moveTo(x - t.r, y);
  c.lineTo(x - t.r * 0.78, y - t.r * 1.05);
  c.lineTo(x + t.r * 0.78, y - t.r * 1.05);
  c.lineTo(x + t.r, y);
  c.closePath();
  c.fillStyle = hurt ? theme.targetDead : theme.ground;
  c.fill();
  c.strokeStyle = ink;
  c.lineWidth = armoured ? 3 : 2;
  c.stroke();
  // Firing slit, with a slow blink so a live emplacement reads as alive.
  var glow = 0.55 + 0.45 * Math.sin(phase * 2.2 + t.seed);
  c.save();
  c.globalAlpha = hurt ? glow * 0.4 : glow;
  c.fillStyle = ink;
  c.fillRect(x - t.r * 0.5, y - t.r * 0.78, t.r, 4);
  c.restore();
  if (armoured) ring(c, x, y - t.r * 0.5, t.r * 1.35, ink, 1);
  if (t.role === "engineer") {
    // A spanner. It was a cross once, which read as a medic rather than as
    // the position that repairs the others.
    c.save();
    c.strokeStyle = theme.accent;
    c.lineCap = "round";
    c.lineWidth = 3;
    line(c, x - 7, y - 4, x + 2, y - 15, theme.accent, 3);
    c.lineWidth = 2.6;
    c.beginPath();
    c.arc(x + 4, y - 18, 4.8, Math.PI * 0.35, Math.PI * 1.75);
    c.strokeStyle = theme.accent;
    c.stroke();
    c.restore();
  } else if (t.role === "spotter") {
    line(c, x + 9, y - 20, x + 9, y - 43, ink, 2);
    ring(c, x + 9, y - 37, 6, ink, 1);
  } else {
    var aim = ((115 + Math.sin(phase * 0.7 + t.seed) * 2) * Math.PI) / 180;
    var length = t.role === "heavy" ? 32 : 21;
    line(
      c,
      x,
      y - 18,
      x + Math.cos(aim) * length,
      y - 18 - Math.sin(aim) * length,
      ink,
      t.role === "heavy" ? 6 : 3
    );
    if (t.role === "heavy")
      for (var charge = 0; charge < 3; charge++)
        circle(
          c,
          x - 9 + charge * 9,
          y - 7,
          2,
          charge < (t.charge || 0) ? theme.hostile : theme.targetDead
        );
  }
}

// The paths the last salvo took, so a player can read their own correction.
function tracers(c, list, theme) {
  for (var i = 0; i < list.length; i++) tracer(c, list[i], theme);
}
function tracer(c, points, theme) {
  if (!points || points.length < 2) return;
  c.save();
  c.globalAlpha = 0.55;
  c.setLineDash([3, 7]);
  c.beginPath();
  c.moveTo(points[0].x, points[0].y);
  for (var i = 1; i < points.length; i++) c.lineTo(points[i].x, points[i].y);
  c.strokeStyle = theme.tracer;
  c.lineWidth = 1.5;
  c.stroke();
  c.setLineDash([]);
  c.restore();
}

// The optional no-wind aim preview. Deliberately drawn faint and dotted: it is
// a training wheel, and it is wrong the moment there is any wind.
function aimArc(c, points, theme) {
  if (!points || points.length < 2) return;
  c.save();
  c.globalAlpha = 0.4;
  for (var i = 0; i < points.length; i += 2) circle(c, points[i].x, points[i].y, 1.6, theme.aim);
  c.restore();
}

// Every shell in the air. Each type has its own silhouette so a glance says
// what is coming down: HE a dot, the digger a dart, the cluster a fat round
// that becomes a spray of specks, the roller a wheel. The enemy's are drawn
// in the hostile ink whatever they are.
function shell(c, shot, theme) {
  if (!shot) return;
  var hostile = shot.owner === "enemy";
  var ink = hostile ? theme.hostile : theme.shell;
  var trail = shot.trail;
  if (trail && trail.length > 1) {
    c.save();
    var start = Math.max(0, trail.length - (shot.kind === "bomblet" ? 10 : 26));
    for (var i = start; i < trail.length - 1; i++) {
      c.globalAlpha = ((i - start) / (trail.length - start)) * 0.7;
      line(
        c,
        trail[i].x,
        trail[i].y,
        trail[i + 1].x,
        trail[i + 1].y,
        ink,
        shot.kind === "bomblet" ? 1 : 2
      );
    }
    c.restore();
  }
  if (shot.kind === "bomblet") {
    circle(c, shot.x, shot.y, 2, ink);
    return;
  }
  if (shot.kind === "digger") {
    // A dart, pointed along its velocity.
    var speed = Math.hypot(shot.vx, shot.vy) || 1,
      ux = shot.vx / speed,
      uy = shot.vy / speed;
    line(c, shot.x - ux * 6, shot.y - uy * 6, shot.x + ux * 5, shot.y + uy * 5, ink, 3.5);
    return;
  }
  if (shot.kind === "roller") {
    circle(c, shot.x, shot.y - (shot.rolling ? 4 : 0), 4.5, ink);
    // A spoke, so it visibly rolls.
    var a = shot.x / 6;
    line(
      c,
      shot.x - Math.cos(a) * 4,
      shot.y - (shot.rolling ? 4 : 0) - Math.sin(a) * 4,
      shot.x + Math.cos(a) * 4,
      shot.y - (shot.rolling ? 4 : 0) + Math.sin(a) * 4,
      theme.background,
      1.5
    );
    return;
  }
  if (shot.kind === "cluster") {
    circle(c, shot.x, shot.y, 4.5, ink);
    ring(c, shot.x, shot.y, 7, ink, 1);
    return;
  }
  circle(c, shot.x, shot.y, 3.5, ink);
}

// A flag of truce going up over a position that has stopped fighting. `raise`
// runs 0 to 1: the pole goes up first, then the cloth unfurls along it, and
// once it is up it keeps a slow wave so it reads as cloth rather than a mark.
function parleyFlag(c, x, y, raise, theme, phase) {
  var pole = Math.min(1, raise / 0.45),
    cloth = Math.max(0, (raise - 0.4) / 0.6);
  if (pole <= 0) return;
  var foot = y - 14,
    head = foot - 40 * pole;
  c.save();
  c.lineCap = "round";
  line(c, x, foot, x, head, theme.turret, 2.5);
  if (cloth > 0) {
    var span = 30 * Math.min(1, cloth),
      drop = 17;
    c.beginPath();
    c.moveTo(x, head);
    for (var i = 0; i <= 8; i++) {
      var f = i / 8;
      c.lineTo(x + span * f, head + Math.sin(phase * 2.6 + f * 3.4) * 2.2 * f + f * 2);
    }
    for (var j = 8; j >= 0; j--) {
      var g = j / 8;
      c.lineTo(x + span * g, head + drop + Math.sin(phase * 2.6 + g * 3.4) * 2.2 * g - g * 2);
    }
    c.closePath();
    c.fillStyle = theme.parley;
    c.fill();
  }
  c.restore();
}

// The emplacement ranging the gun: a chevron over it, pulsing, so the player
// can see who to kill.
function spotterMark(c, t, theme, phase) {
  if (!t || t.hp <= 0) return;
  var y = t.y - t.r * 1.05 - 16 - Math.abs(Math.sin(phase * 3)) * 4;
  c.save();
  c.globalAlpha = 0.85;
  c.beginPath();
  c.moveTo(t.x - 7, y - 9);
  c.lineTo(t.x, y);
  c.lineTo(t.x + 7, y - 9);
  c.strokeStyle = theme.hostile;
  c.lineWidth = 2.5;
  c.stroke();
  c.restore();
}

// The gun's muzzle flash when an emplacement fires, and score text lifting
// off an impact.
function flashes(c, effects, theme) {
  var list = effects.flashes || [];
  for (var i = 0; i < list.length; i++) {
    var f = list[i],
      t = f.age / f.life;
    if (t >= 1) continue;
    c.save();
    c.globalAlpha = (1 - t) * 0.9;
    circle(c, f.x, f.y, 6 + t * 16, theme.hostile);
    c.restore();
  }
}

function popups(c, effects, theme) {
  var list = effects.popups || [];
  if (!list.length) return;
  c.save();
  c.font = "bold 13px monospace";
  c.textAlign = "center";
  for (var i = 0; i < list.length; i++) {
    var p = list[i],
      t = p.age / p.life;
    if (t >= 1) continue;
    c.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
    c.fillStyle = p.ink || theme.foreground;
    c.fillText(p.text, p.x, p.y);
  }
  c.restore();
}

// Blast rings and sparks. Particles are plain objects updated in place by the
// view; nothing is allocated per frame here.
function blasts(c, effects, theme) {
  var list = effects.blasts;
  for (var i = 0; i < list.length; i++) {
    var b = list[i],
      t = b.age / b.life;
    if (t >= 1) continue;
    c.save();
    c.globalAlpha = (1 - t) * 0.8;
    ring(
      c,
      b.x,
      b.y,
      b.r * (0.35 + t * 0.95),
      b.hostile ? theme.hostile : theme.blast,
      3 * (1 - t) + 0.6
    );
    if (b.kind === "depot") ring(c, b.x, b.y, b.r * (0.5 + t * 1.5), theme.blastCore, 5 * (1 - t));
    if (b.kind === "digger") {
      for (var jet = -2; jet <= 2; jet++)
        line(
          c,
          b.x,
          b.y,
          b.x + jet * 9 * t,
          b.y - b.r * (1 + t) * 2,
          theme.groundEdge,
          2 * (1 - t)
        );
    }
    if (b.kind === "roller") ring(c, b.x, b.y, b.r * (0.2 + t * 0.6), theme.foreground, 1);
    c.globalAlpha = Math.max(0, 1 - t * 2.2) * 0.85;
    circle(c, b.x, b.y, b.r * 0.42 * (1 - t * 0.5), b.hostile ? theme.hostile : theme.blastCore);
    c.restore();
  }
  var sparks = effects.particles;
  for (var j = 0; j < sparks.length; j++) {
    var p = sparks[j],
      f = p.age / p.life;
    if (f >= 1) continue;
    c.save();
    c.globalAlpha = (1 - f) * 0.9;
    circle(c, p.x, p.y, p.size * (1 - f * 0.4), p.smoke ? theme.smoke : theme.blast);
    c.restore();
  }
}

// A windsock at the top of the field: length and lean show strength and side.
// `sock` carries its position and whether it is still on its pole.
function windsock(c, sock, wind, limit, theme, phase) {
  var x = sock.x,
    y = sock.y,
    strength = limit > 0 ? Math.min(1, Math.abs(wind) / Math.max(1, limit)) : 0;
  var direction = wind >= 0 ? 1 : -1,
    span = 20 + strength * 46;
  line(c, x, y - 14, x, y + 22, theme.muted, 2);
  // Shot off its pole: a scorched stub, hanging where the sock used to fly.
  if (sock.hp <= 0) {
    c.save();
    c.globalAlpha = 0.55;
    line(c, x, y - 12, x + direction * 9, y - 4, theme.scorch, 3);
    line(c, x + direction * 9, y - 4, x + direction * 5, y + 5, theme.scorch, 2);
    c.restore();
    return;
  }
  if (Math.abs(wind) < 0.5) {
    c.save();
    c.globalAlpha = 0.7;
    line(c, x, y - 10, x + 14, y - 10, theme.muted, 2);
    c.restore();
    return;
  }
  c.beginPath();
  c.moveTo(x, y - 12);
  for (var i = 0; i <= 6; i++) {
    var f = i / 6;
    c.lineTo(x + direction * span * f, y - 12 + Math.sin(phase * 4 + f * 3) * 3 * f + f * 7);
  }
  for (var j = 6; j >= 0; j--) {
    var g = j / 6;
    c.lineTo(x + direction * span * g, y - 12 + Math.sin(phase * 4 + g * 3) * 3 * g - g * 7);
  }
  c.closePath();
  c.fillStyle = theme.flag;
  c.save();
  c.globalAlpha = 0.75;
  c.fill();
  c.restore();
}

// options: { theme, effects, phase, aim, tracers, shots, recoil, angle, gun,
//            spotter, parley, shake, windLimit, pixelScale }
function draw(c, width, height, world, options, effects) {
  var theme = options.theme;
  // QML's Canvas exposes reset() rather than resetTransform(); it clears the
  // whole context state, so the scale has to be re-applied after it.
  c.reset();
  c.scale(options.pixelScale || 1, options.pixelScale || 1);
  c.fillStyle = theme.background;
  c.fillRect(0, 0, width, height);
  // Screen shake: a small random offset that the caller decays each frame.
  if (options.shake > 0)
    c.translate(
      (Math.random() * 2 - 1) * options.shake,
      (Math.random() * 2 - 1) * options.shake * 0.6
    );
  backdrop(c, width, height, theme, options.effects ? options.phase : 0);
  if (!world) return;
  scenery(c, width, height, world, theme, options.effects ? options.phase : 0, options.effects);
  rangeGrid(c, width, height, world.turret.x, theme);
  ground(c, world.terrain, theme);
  fieldDetails(c, world, theme, options.phase, options.effects);
  var phase = options.effects ? options.phase : 1.2;
  for (var i = 0; i < world.targets.length; i++) {
    var t = world.targets[i];
    target(c, t, theme, phase);
    if (t.hp > 0) {
      c.save();
      c.font = "10px monospace";
      c.textAlign = "center";
      c.fillStyle = theme.muted;
      c.fillText(String(i + 1), t.x - t.r - 9, t.y - 14);
      c.restore();
    }
  }
  if (options.spotter >= 0) spotterMark(c, world.targets[options.spotter], theme, phase);
  if (options.parley)
    parleyFlag(c, options.parley.x, options.parley.y, options.parley.raise, theme, phase);
  if (options.tracers) tracers(c, options.tracers, theme);
  if (options.aim) aimArc(c, options.aim, theme);
  turret(c, world.turret, options.angle, theme, options.recoil, options.gun);
  var shots = options.shots || [];
  for (var j = 0; j < shots.length; j++) shell(c, shots[j], theme);
  blasts(c, effects, theme);
  flashes(c, effects, theme);
  popups(c, effects, theme);
  var wind = world.weather ? world.weather.value : world.wind;
  if (world.sock)
    windsock(
      c,
      world.sock,
      wind,
      options.windLimit || world.windLimit,
      theme,
      options.effects ? options.phase : 0
    );
}

if (typeof module !== "undefined") module.exports = { draw: draw };
