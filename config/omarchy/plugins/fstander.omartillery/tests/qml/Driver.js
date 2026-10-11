// Read-only aiming helper for end-to-end tests. It fires through GameView;
// it never edits health, ammunition, terrain, or the result state.
function pick(world, physics) {
  var live = world.targets.filter(function (t) {
    return t.hp > 0;
  });
  var target =
    world.spotter >= 0 && world.targets[world.spotter].hp > 0
      ? world.targets[world.spotter]
      : live[0];
  var kind = target.hp > 1 && world.rack.digger > 0 ? "digger" : "he";
  if (!(world.rack[kind] > 0))
    kind = physics.WEAPON_ORDER.filter(function (k) {
      return world.rack[k] > 0;
    })[0];
  if (!kind) return null;
  // Physics.stillAir is the only place a derived world is built: it carries
  // across everything that changes how a shell flies, so a rehearsal here and
  // the real shot agree even on a battlefield with its own rules.
  var frozen = physics.stillAir(world, world.weather.value);
  function score(angle, power) {
    var tip = physics.muzzle(world.turret, angle);
    var shot = physics.launch(tip.x, tip.y, angle, power, kind, "probe"),
      out = null;
    for (var frame = 0; frame < 1600 && !out; frame++) out = physics.fly(shot, 1 / 60, frozen);
    if (out && out.kind === "split") {
      shot = out.children[2];
      shot.owner = "probe";
      out = null;
      for (var f = 0; f < 1600 && !out; f++) out = physics.fly(shot, 1 / 60, frozen);
    }
    return Math.abs(shot.x - target.x) + Math.abs(shot.y - target.y + target.r * 0.4) * 0.35;
  }
  var best = { miss: Infinity, angle: 45, power: 60, kind: kind };
  var angles = [25, 32, 40, 48, 56, 64, 72, 80, 85];
  for (var a = 0; a < angles.length; a++)
    for (var p = 15; p <= 100; p += 3) {
      var miss = score(angles[a], p);
      if (miss < best.miss) best = { miss: miss, angle: angles[a], power: p, kind: kind };
    }
  for (var step = 2; step >= 0.125; step /= 2) {
    var improved = true,
      guard = 0;
    while (improved && guard++ < 100) {
      improved = false;
      var offsets = [
        [0, step],
        [0, -step],
        [step, 0],
        [-step, 0]
      ];
      for (var i = 0; i < offsets.length; i++) {
        var angle = physics.clamp(best.angle + offsets[i][0], 1, 89);
        var power = physics.clamp(best.power + offsets[i][1], 5, 100);
        var m = score(angle, power);
        if (m < best.miss - 0.001) {
          best = { miss: m, angle: angle, power: power, kind: kind };
          improved = true;
        }
      }
    }
  }
  return best;
}
