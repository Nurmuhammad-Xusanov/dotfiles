const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("the manifest declares what the shell needs", () => {
  assert.strictEqual(manifest.schemaVersion, 1);
  assert.match(manifest.id, /^[a-z0-9-]+\.[a-z0-9-]+$/, "ids are <author>.<plugin>");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.ok(manifest.name && manifest.author && manifest.license && manifest.description);
  assert.deepStrictEqual(manifest.kinds, ["panel", "bar-widget"]);
  assert.strictEqual(manifest.barWidget.allowMultiple, false, "one gun is enough");
  assert.ok(["left", "center", "right"].includes(manifest.barWidget.defaultSection));
});

test("every declared entry point exists", () => {
  for (const file of Object.values(manifest.entryPoints))
    assert.ok(fs.existsSync(path.join(root, file)), `${file} is declared but missing`);
});

test("the panel and bar widget agree with the manifest id", () => {
  for (const file of ["Panel.qml", "BarWidget.qml"])
    assert.ok(
      read(file).includes(`"${manifest.id}"`),
      `${file} does not use the manifest id ${manifest.id}`
    );
});

test("every sound the game asks for is shipped", () => {
  const referenced = [...read("GameView.qml").matchAll(/sounds\/([\w-]+\.wav)/g)].map((m) => m[1]);
  assert.ok(referenced.length >= 5, "the game seems to have lost its audio cues");
  for (const name of new Set(referenced))
    assert.ok(fs.existsSync(path.join(root, "sounds", name)), `sounds/${name} is missing`);
  // And nothing is shipped that nothing plays.
  for (const name of fs.readdirSync(path.join(root, "sounds")))
    if (name.endsWith(".wav")) assert.ok(referenced.includes(name), `sounds/${name} is unused`);
});

test("the simulation modules are self-contained QML JavaScript", () => {
  // QML JavaScript resources cannot require() or import one another, so a
  // stray dependency here would work under Node and fail in the shell.
  for (const file of [
    "Terrain.js",
    "Physics.js",
    "Levels.js",
    "Profile.js",
    "Renderer.js",
    "Palette.js",
    "Operations.js",
    "Challenges.js"
  ]) {
    const source = read(file);
    const body = source.replace(/if \(typeof module !== "undefined"\)[\s\S]*$/, "");
    assert.ok(!/\brequire\s*\(/.test(body), `${file} calls require()`);
    assert.ok(!/^\s*(import|export)\s/m.test(body), `${file} uses ES module syntax`);
    assert.ok(/module\.exports/.test(source), `${file} is not testable from Node`);
    // ES5-compatible surface only: V4 is forgiving, but arrow functions and
    // spread in shared code have bitten QML plugins before.
    assert.ok(!/=>/.test(body), `${file} uses arrow functions`);
    assert.ok(!/\.\.\./.test(body), `${file} uses spread syntax`);
  }
});

test("the QML never reaches outside the shell's sanctioned APIs", () => {
  for (const file of fs.readdirSync(root).filter((f) => f.endsWith(".qml"))) {
    const source = read(file);
    assert.ok(
      !/Quickshell\.Io|\bProcess\s*{|execDetached/.test(source),
      `${file} starts processes`
    );
    assert.ok(!/FileView|writeFile|readFile/.test(source), `${file} touches files directly`);
  }
});

test("nothing mutated in place is exposed to QML through a binding", () => {
  // A QML binding onto a field of a `property var` never re-evaluates when the
  // object is mutated in place, which silently freezes the UI on stale values.
  // Anything the physics mutates must be republished through a plain property.
  const view = read("GameView.qml");
  const animating = view.match(/readonly property bool animating:[\s\S]*?\n\n/);
  assert.ok(animating, "the animating binding moved");
  assert.ok(
    !/effects\.(blasts|particles)\.length/.test(animating[0]),
    "animating binds to a mutated array length and will never settle"
  );
  for (const stale of [
    "world.shotsLeft",
    "Physics.remaining(world)",
    "world.turret.hp",
    "world.spotter",
    "world.weather.value",
    "world.rack["
  ]) {
    const binding = new RegExp(`property[^\n]*:[^\n]*${stale.replace(/[.()[\]]/g, "\\$&")}`);
    assert.ok(!binding.test(view), `a binding reads ${stale}, which is mutated in place`);
  }
  for (const file of ["ResultCard.qml", "Hud.qml", "MenuPage.qml"])
    assert.ok(
      !/view\.world\.(shotsLeft|targets|turret|rack|weather|spotter)\b|Levels\.stars\(/.test(
        read(file)
      ),
      `${file} reaches into the mutable world object from a binding`
    );
  // The projectile list is replaced, never mutated, when a shell settles —
  // otherwise the renderer would keep drawing a shell that has landed.
  assert.ok(!/projectiles\.(push|splice)\(/.test(view), "projectiles is mutated in place");
});

test("the arrow keys elevate the gun and set the power, and release cleanly", () => {
  const view = read("GameView.qml");
  const block = view.slice(view.indexOf("function gameKey"), view.indexOf("function keyUp"));
  const bind = (key) => {
    const m = block.match(new RegExp(`Qt\\.Key_${key}\\b[^{]*\\{\\s*(angleDir|powerDir) = (-?1)`));
    return m && `${m[1]}=${m[2]}`;
  };
  assert.strictEqual(bind("Up"), "angleDir=1", "Up must raise the gun");
  assert.strictEqual(bind("Down"), "angleDir=-1", "Down must lower the gun");
  assert.strictEqual(bind("Right"), "powerDir=1", "Right must add power");
  assert.strictEqual(bind("Left"), "powerDir=-1", "Left must take power off");

  // Whatever sets a direction must be able to clear it, or a dial sticks.
  const release = view.slice(view.indexOf("function keyUp"));
  for (const key of ["Up", "Down", "W", "S"])
    assert.ok(
      new RegExp(`Qt\\.Key_${key}\\b[^\\n]*\\)\\n?\\s*angleDir = 0`).test(release) ||
        release.split("angleDir = 0")[0].includes(`Qt.Key_${key}`),
      `${key} never clears angleDir`
    );
  for (const key of ["Left", "Right", "A", "D"])
    assert.ok(
      release.split("powerDir = 0")[0].includes(`Qt.Key_${key}`),
      `${key} never clears powerDir`
    );

  // The on-screen hint has to describe the bindings that actually exist.
  assert.match(read("Hud.qml"), /↑\/↓ ANGLE\s+←\/→ POWER/, "the HUD hint is out of date");
});

test("mouse control can be switched off, and switching it off is complete", () => {
  const view = read("GameView.qml");
  const area = view.slice(view.indexOf("MouseArea {", view.indexOf("Canvas {")));
  const block = area.slice(0, area.indexOf("\n            }"));

  // Hover is the part that steals a keyboard-set elevation, so it has to be
  // gated at the property, not only inside the handler.
  assert.match(block, /hoverEnabled: root\.config\.mouse/, "hover aiming is always on");
  for (const handler of ["onPositionChanged", "onWheel"]) {
    const body = block.slice(block.indexOf(handler));
    const guard = body.slice(0, body.indexOf("return;"));
    assert.ok(guard.includes("root.config.mouse"), `${handler} ignores the setting`);
  }
  const click = block.slice(block.indexOf("onClicked"));
  assert.ok(
    /if \(root\.config\.mouse\)\s*\n?\s*root\.fire\(\)/.test(click),
    "click-to-fire ignores the setting"
  );
  // ...but clicking must still hand keyboard focus back, or turning the mouse
  // off would leave no way to focus the game by pointer.
  assert.ok(
    click.indexOf("forceActiveFocus") < click.indexOf("root.config.mouse"),
    "clicking no longer restores keyboard focus"
  );

  // The setting is offered in the UI and the hint stops promising the mouse.
  assert.match(read("MenuPage.qml"), /"key": "mouse"/, "there is no settings toggle");
  assert.match(
    read("Hud.qml"),
    /root\.mouseControl\s*\?\s*"MOUSE AIM/,
    "the hint always claims mouse aim"
  );
  assert.match(view, /mouseControl: root\.config\.mouse/, "the HUD is not told about the setting");

  // Every settings key the UI offers must be one the records model validates.
  const offered = [...read("MenuPage.qml").matchAll(/"key": "(\w+)"/g)].map((m) => m[1]);
  const kept = Object.keys(require("../Profile.js").fresh().settings);
  for (const key of offered)
    assert.ok(kept.includes(key), `settings offers "${key}", which is never saved`);
  assert.deepStrictEqual(
    [...offered].sort(),
    [...kept].sort(),
    "the settings page and the records model disagree"
  );
});

test("every menu and card can be driven from the keyboard", () => {
  const view = read("GameView.qml");
  const button = read("GunButton.qml");
  // The view walks the stage for GunButtons, so the button must announce
  // itself and draw its own focus ring; the header's buttons opt out because
  // they have keys of their own.
  assert.match(button, /readonly property bool isGunButton: true/);
  assert.match(button, /visible: root\.activeFocus && root\.navigable/, "no focus ring");
  assert.match(view, /function moveMenuFocus\(key\)/);
  assert.match(view, /menuNavigation && menuKey\(key, modifiers\)/, "menu keys are not routed");
  for (const key of ["Key_Left", "Key_Right", "Key_Up", "Key_Down", "Key_Tab"])
    assert.ok(
      view.slice(view.indexOf("function menuKey")).includes(key),
      `${key} does not navigate`
    );
  // Focus must land somewhere on open and every time the screen changes,
  // and go back to the field when the game takes over.
  assert.match(view, /Component\.onCompleted: Qt\.callLater\(resetFocus\)/);
  assert.match(view, /onNavigationContextChanged: Qt\.callLater\(resetFocus\)/);
  const header = read("Header.qml");
  assert.strictEqual(
    (header.match(/navigable: false/g) || []).length,
    3,
    "header buttons are walked"
  );
  // Space fires; it must not also punch through a result card.
  assert.match(view, /key === Qt\.Key_Space && !inGame/, "space activates cards");
});

test("the shell is launched from the same barrel the renderer draws", () => {
  // The launch point and the drawn barrel are one geometry, passed to the
  // renderer, so they cannot drift apart the way two copies of 34 would.
  const view = read("GameView.qml");
  assert.match(view, /Physics\.muzzle\(world\.turret, angle\)/, "fire() does not use the muzzle");
  assert.match(view, /"gun": root\.gunGeometry/, "the renderer is not given the gun geometry");
  const renderer = read("Renderer.js");
  const turret = renderer.slice(
    renderer.indexOf("function turret"),
    renderer.indexOf("function target")
  );
  // The hull outline has coordinates of its own; only the pivot height and the
  // barrel length must come from the shared geometry.
  assert.ok(!/y - 16\b/.test(turret), "the barrel pivot height is hard-coded");
  assert.ok(!/\b34\b/.test(turret), "the barrel length is hard-coded");
  assert.match(turret, /geometry\.pivotY/);
  assert.match(turret, /geometry\.barrel/);
});

test("the repository is ready to be listed", () => {
  // Marketplace validation looks for a root README carrying installation and
  // removal instructions, a licence, and an optional root preview.
  const readme = read("README.md");
  assert.match(readme, /omarchy plugin add \S+/, "no install command");
  assert.match(readme, /omarchy plugin remove fstander\.omartillery/, "no removal instructions");
  assert.ok(!/<you>|<your|YOUR_|example\.com/.test(readme), "the README still has a placeholder");
  assert.ok(fs.existsSync(path.join(root, "LICENSE")), "no licence file");
  assert.ok(fs.existsSync(path.join(root, "preview.png")), "no listing preview");
  // Nothing in the installable tree may steer a coding agent, and nothing may
  // be named so the security baseline treats it as an installer.
  const walk = (dir, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else out.push(path.relative(root, full));
    }
    return out;
  };
  for (const file of walk(root)) {
    assert.ok(
      !/(^|\/)(install|setup|uninstall)[^/]*$/i.test(file),
      `${file} would be scanned as an installer`
    );
    assert.ok(
      !/(^|\/)(AGENTS\.md|CLAUDE\.md|SKILL\.md|\.pyc)$/i.test(file),
      `${file} does not belong in an installable plugin`
    );
  }
});

test("the plugin stays small enough to clone quickly", () => {
  let total = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else total += fs.statSync(full).size;
    }
  };
  walk(root);
  assert.ok(total < 2 * 1024 * 1024, `the plugin is ${(total / 1024 / 1024).toFixed(1)}MB`);
});
