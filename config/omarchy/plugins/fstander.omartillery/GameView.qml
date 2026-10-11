pragma ComponentBehavior: Bound
import QtQuick
import QtMultimedia
import "Terrain.js" as Terrain
import "Physics.js" as Physics
import "Levels.js" as Levels
import "Profile.js" as Profile
import "Renderer.js" as Renderer
import "Palette.js" as Palette
import "Operations.js" as Operations
import "Challenges.js" as Challenges

FocusScope {
    id: root
    focus: true

    // ---- host-facing state -------------------------------------------------
    property bool shown: true
    property bool audioAllowed: true
    property var theme: Palette.create()
    property var profile: Profile.fresh()
    signal saveRequested(var data)
    signal closeRequested
    signal fullscreenRequested

    // ---- game state --------------------------------------------------------
    // "home" | "levels" | "game" | "settings" | "records"
    property string page: "home"
    property string gameMode: "campaign"
    property bool briefing: false
    property bool notebookOpen: true
    property var shotHistory: []
    property int historySelection: 0
    property var activeShot: null
    property var targetIntel: []
    property int collapseCount: 0
    property int chainCount: 0
    property int clusterMulti: 0
    // The three curiosities a battle can turn up: the windsock shot off its
    // pole, one of your own shells on your own position, and an enemy engineer
    // left with nothing to repair and no reason to keep at it.
    property bool sockDown: false
    property bool selfHit: false
    property bool ceasefire: false
    // 0 to 1 while the flag of truce goes up, then a beat to look at it before
    // the result card covers the field.
    property real ceasefireRaise: 0
    property real surrenderHold: 0
    property real holdFire: 0
    // What this turn's shell turned up, if it was not an emplacement. Held
    // until the turn ends, because the spotter's range call would otherwise
    // overwrite it the moment the salvo settles.
    property string curioText: ""
    property color curioInk: "transparent"
    // Published by refresh(): every surviving position is an engineer.
    property bool engineersOnly: false
    property bool usedAssist: false
    property var dailyChallenge: Challenges.today()
    property string dailyMessage: ""
    property bool dailyNewBest: false
    readonly property var operation: profile.operation
    readonly property string dailyBest: bestDailyText()
    property var enemyReplies: []
    property bool enemyPlanBuilt: false
    property int gunMaxHp: 3
    // "aiming"   the player's turn, dials live
    // "flying"   the player's shells are in the air
    // "incoming" the enemy's turn: a pause, then their shell in the air
    // "cleared" | "failed" | "destroyed"
    property string status: "aiming"
    property int levelIndex: 0
    property int levelSeed: 1
    property var world: null
    // Every shell in the air, whoever fired it. Cluster shells become several.
    property var projectiles: []
    property string weapon: "he"
    property real angle: 45
    property real power: 60
    property int score: 0
    property int destroyed: 0
    property int directHits: 0
    property int bestMultiKill: 0
    property int combo: 0
    property int gunHitsTaken: 0
    // Tallies for the salvo in the air, folded into the call when it is down.
    property int turnKills: 0
    property real turnImpactX: 0
    property int turnImpacts: 0
    property int spotterKills: 0
    property int diggerKills: 0
    property int rollerKills: 0
    property bool paused: false
    property bool resultSaved: false
    property string earned: ""
    property var lastTracers: []
    property real recoil: 0
    // Fire control: the spotter's call after each of the player's turns, and
    // what it needs to remember to call a bracket or a walk-on.
    property string callout: ""
    property color calloutInk: theme.foreground
    property real calloutLeft: 0
    property var misses: ({})
    // The enemy's turn.
    property real incomingDelay: 0
    property bool enemyFired: false
    property var enemyRandom: null
    // Juice.
    property real timeScale: 1
    property real slowLeft: 0
    property real shake: 0

    // Held-key adjustment, applied per frame so the rate does not depend on
    // the operating system's key-repeat settings.
    property int angleDir: 0
    property int powerDir: 0
    property bool fineAdjust: false

    property var effects: ({
                               "blasts": [],
                               "particles": [],
                               "popups": [],
                               "flashes": []
                           })
    property real phase: 0
    property real renderClock: 0
    property real renderCadence: 0
    property real impactHold: 0

    // ---- instrumentation (read by the panel's diagnostics IPC) -------------
    property int renderedFrames: 0
    property real observedFps: 0
    property real fpsElapsed: 0
    property int fpsFrames: 0
    property real totalPaintMs: 0
    property real maxPaintMs: 0
    property int paintCount: 0

    readonly property var config: profile.settings
    // Handed to the renderer so the drawn barrel and the launch point agree.
    readonly property var gunGeometry: ({
                                            "pivotY": Physics.GUN_PIVOT,
                                            "barrel": Physics.GUN_BARREL
                                        })
    readonly property var levelSpec: Levels.spec(levelIndex)
    // The world is a plain JavaScript object mutated in place by the physics,
    // so a binding onto its fields would never re-evaluate. These are pushed
    // explicitly by refresh() whenever the world changes underneath them.
    property int targetsLeft: 0
    property int shotsLeft: 0
    property int gunHp: 3
    property int spotter: -1
    property real windNow: 0
    property var rack: ({})
    property int activeEffects: 0
    property int levelStars: 0
    readonly property bool inGame: page === "game" && world !== null
    readonly property bool turnOver: status === "cleared" || status === "failed" || status === "destroyed"
    readonly property bool flying: inGame && (status === "flying" || status === "incoming") && !paused && shown
    readonly property bool cardShown: inGame && (briefing || paused || turnOver)
    // Menus and cards are walked with the arrow keys; the field is not.
    readonly property bool menuNavigation: !inGame || cardShown
    readonly property string navigationContext: page + ":" + (inGame ? (briefing ? "briefing" : paused ? "paused" :
                                                                                                         status) : "")
                                                + ":" + (operation ? operation.state : "")
    // Gusting wind earns a repaint only while there is a sock to blow: once it
    // is shot off its pole nothing on the field reads the wind any more.
    readonly property bool weatherMoving: inGame && world.gust > 0 && !sockDown
    readonly property var progress: Profile.progress(profile)
    // Idle artwork is worth a frame budget only while the field is on screen.
    readonly property bool animating: shown && (holdFire > 0 || surrenderHold > 0 || (inGame && engineersOnly &&
                                                                                      !cardShown) || flying
                                                || impactHold > 0 || activeEffects > 0 || angleDir !== 0 || powerDir !== 0
                                                || calloutLeft > 0 || slowLeft > 0 || shake > 0 || (inGame &&
                                                                                                    !cardShown && (
                                                                                                        config.effects
                                                                                                        || weatherMoving)))

    onThemeChanged: canvas.requestPaint()
    onNavigationContextChanged: Qt.callLater(resetFocus)
    onShownChanged: if (shown)
                        Qt.callLater(resetFocus)
    Component.onCompleted: Qt.callLater(resetFocus)

    // ---- records -----------------------------------------------------------
    function loadProfile(value) {
        profile = Profile.clean(value);
    }
    function persist() {
        profile = Profile.clean(profile);
        saveRequested(profile);
    }
    function setting(key, value) {
        var next = profile.settings;
        next[key] = value;
        profile.settings = next;
        if (key === "assist" && value && inGame)
            usedAssist = true;
        persist();
        canvas.requestPaint();
    }

    // ---- lifecycle ---------------------------------------------------------
    // Re-publish everything the UI reads out of the mutable world object.
    function refresh() {
        shotsLeft = world ? world.shotsLeft : 0;
        targetsLeft = world ? Physics.remaining(world) : 0;
        gunHp = world ? world.turret.hp : 0;
        gunMaxHp = world ? world.turret.maxHp : 3;
        // Counted before the intel is built, because the intel reads it.
        var engineers = 0, others = 0;
        if (world)
            for (var e = 0; e < world.targets.length; e++) {
                if (world.targets[e].hp <= 0)
                    continue;
                if (world.targets[e].role === "engineer")
                    engineers++;
                else
                    others++;
            }
        engineersOnly = engineers > 0 && others === 0;
        var intel = [];
        if (world)
            for (var t = 0; t < world.targets.length; t++) {
                var target = world.targets[t];
                if (target.hp <= 0)
                    continue;
                intel.push({
                               "id": t + 1,
                               "name": Physics.role(target).name,
                               "hint": Physics.role(target).hint,
                               "intent": !world.enemy ? "TRAINING TARGET" : ceasefire ? "STOOD DOWN" : (target.role
                                                                                                        === "engineer"
                                                                                                        && engineersOnly
                                                                                                        ? "NOTHING LEFT TO REPAIR" :
                                                                                                          Physics.intent(
                                                                                                              target, world.spotter
                                                                                                              === t)),
                               "hp": target.hp,
                               "maxHp": target.maxHp,
                               "urgent": (world.spotter === t && target.fired > 0) || (target.role === "heavy"
                                                                                       && target.charge === 2),
                               "unstable": !!target.unstable
                           });
            }
        targetIntel = intel;
        sockDown = !!(world && world.sock && world.sock.hp <= 0);
        spotter = world ? world.spotter : -1;
        windNow = world && world.weather ? world.weather.value : 0;
        var copy = {};
        if (world)
            for (var key in world.rack)
                copy[key] = world.rack[key];
        rack = copy;
        activeEffects = effects.blasts.length + effects.particles.length + effects.popups.length
                + effects.flashes.length;
    }

    function suspend() {
        angleDir = 0;
        powerDir = 0;
        if (flying)
            paused = true;
    }
    // ---- keyboard navigation ----------------------------------------------
    // Every visible, enabled, navigable GunButton on the stage, in tree order.
    function menuButtons() {
        var buttons = [];
        function visit(item) {
            if (!item.visible || !item.enabled)
                return;
            if (item.isGunButton === true) {
                if (item.navigable)
                    buttons.push(item);
                return;
            }
            for (var i = 0; i < item.children.length; i++)
                visit(item.children[i]);
            // A freshly shown grid may not have laid out yet; resolve it before
            // measuring button positions.
            if (typeof item.forceLayout === "function")
                item.forceLayout();
        }
        visit(stage);
        return buttons;
    }
    function defaultMenuButton(buttons) {
        return buttons.filter(function (b) {
            return b.primary;
        })[0] || buttons[0] || null;
    }
    function focusedMenuButton(buttons) {
        return buttons.filter(function (b) {
            return b.activeFocus;
        })[0] || defaultMenuButton(buttons);
    }
    // Focus lands on the default button whenever the screen changes, and goes
    // back to the field when the game takes over.
    function resetFocus() {
        if (!menuNavigation) {
            root.forceActiveFocus();
            return;
        }
        var button = defaultMenuButton(menuButtons());
        if (button)
            button.forceActiveFocus();
        else
            root.forceActiveFocus();
    }
    // Spatial navigation: the nearest button in the pressed direction, with a
    // preference for ones that overlap the current row or column. Tab walks in
    // tree order.
    function moveMenuFocus(key) {
        var buttons = menuButtons(), current = focusedMenuButton(buttons);
        if (!current)
            return;
        if (key === Qt.Key_Tab || key === Qt.Key_Backtab) {
            var offset = key === Qt.Key_Backtab ? -1 : 1;
            buttons[(buttons.indexOf(current) + offset + buttons.length) % buttons.length].forceActiveFocus();
            return;
        }
        var horizontal = key === Qt.Key_Left || key === Qt.Key_Right;
        var direction = key === Qt.Key_Left || key === Qt.Key_Up ? -1 : 1;
        function rect(button) {
            var p = button.mapToItem(stage, 0, 0);
            return {
                "x": p.x,
                "y": p.y,
                "w": button.width,
                "h": button.height
            };
        }
        var origin = rect(current), best = null, bestScore = Infinity;
        for (var i = 0; i < buttons.length; i++) {
            if (buttons[i] === current)
                continue;
            var r = rect(buttons[i]);
            var dx = r.x + r.w / 2 - origin.x - origin.w / 2;
            var dy = r.y + r.h / 2 - origin.y - origin.h / 2;
            var along = (horizontal ? dx : dy) * direction;
            if (along <= 1)
                continue;
            var across = Math.abs(horizontal ? dy : dx);
            var overlap = horizontal ? Math.min(r.y + r.h, origin.y + origin.h) - Math.max(r.y, origin.y) : Math.min(
                                           r.x + r.w, origin.x + origin.w) - Math.max(r.x, origin.x);
            var score = along + across * 0.35 + (overlap < 0 ? 10000 : 0);
            if (score < bestScore) {
                bestScore = score;
                best = buttons[i];
            }
        }
        (best || current).forceActiveFocus();
    }
    function setPage(next) {
        angleDir = 0;
        powerDir = 0;
        page = next;
        canvas.requestPaint();
    }
    function home() {
        suspend();
        setPage("home");
    }
    function unlocked(index) {
        return Profile.unlocked(profile, index);
    }
    // The level the PLAY button should drop the player into: the first one they
    // have not cleared, or the last if they have cleared everything.
    function nextLevel() {
        for (var i = 0; i < Profile.LEVEL_COUNT; i++)
            if (!Profile.cleared(profile, i))
                return unlocked(i) ? i : Math.max(0, i - 1);
        return Profile.LEVEL_COUNT - 1;
    }

    function start(index, seed, mode, prepared) {
        if ((!mode || mode === "campaign") && !unlocked(index))
            return false;
        levelIndex = index;
        levelSeed = seed === undefined ? (Math.floor(Math.random() * 1e9) >>> 0) : (seed >>> 0);
        gameMode = mode || "campaign";
        world = prepared || Levels.build(levelIndex, levelSeed, Terrain, Physics.weather);
        levelSeed = world.seed;
        briefing = true;
        shotHistory = [];
        historySelection = 0;
        activeShot = null;
        turnKills = 0;
        turnImpactX = 0;
        turnImpacts = 0;
        collapseCount = 0;
        chainCount = 0;
        clusterMulti = 0;
        sockDown = false;
        selfHit = false;
        curioText = "";
        ceasefire = false;
        holdFire = 0;
        usedAssist = config.assist;
        dailyNewBest = false;
        enemyReplies = [];
        enemyPlanBuilt = false;
        phase = 0;
        // The enemy's dice: seeded by the level, so a replay of the same seed is
        // the same fight, return fire included.
        enemyRandom = Terrain.rng(levelSeed ^ 0xa5a5a5a5);
        projectiles = [];
        lastTracers = [];
        status = "aiming";
        paused = false;
        resultSaved = false;
        earned = "";
        levelStars = 0;
        score = 0;
        destroyed = 0;
        directHits = 0;
        bestMultiKill = 0;
        combo = 0;
        gunHitsTaken = 0;
        spotterKills = 0;
        diggerKills = 0;
        rollerKills = 0;
        recoil = 0;
        angle = 45;
        power = 60;
        impactHold = 0;
        callout = "";
        calloutLeft = 0;
        misses = {};
        incomingDelay = 0;
        enemyFired = false;
        timeScale = 1;
        slowLeft = 0;
        shake = 0;
        weapon = "he";
        effects = {
            "blasts": [],
            "particles": [],
            "popups": [],
            "flashes": []
        };
        refresh();
        setPage("game");
        cue("ready");
        return true;
    }
    function retry() {
        if (!world)
            return;
        if (gameMode === "operation") {
            if (turnOver) {
                if (status !== "cleared")
                    newOperation(operation ? operation.seed : levelSeed);
                return;
            }
            resumeOperation();
        } else if (gameMode === "daily")
            startDaily(dailyChallenge.code);
        else
            start(levelIndex, levelSeed);
        briefing = false;
    }
    function reroll() {
        if (gameMode !== "campaign") {
            retry();
            return;
        }
        if (world)
            start(levelIndex, undefined);
    }
    function advance() {
        if (gameMode === "operation") {
            setPage("operations");
            return;
        }
        if (gameMode === "daily") {
            setPage("daily");
            return;
        }
        var next = levelIndex + 1;
        if (next < Profile.LEVEL_COUNT && unlocked(next))
            start(next, undefined);
        else
            home();
    }

    // ---- operations and daily challenges -----------------------------------
    function openOperations() {
        suspend();
        setPage("operations");
    }
    function newOperation(seed) {
        profile.operation = Operations.fresh(seed === undefined ? Math.floor(Math.random() * 4294967296) : seed);
        persist();
        setPage("operations");
    }
    function updateOperation(next) {
        if (!next)
            return false;
        profile.operation = next;
        persist();
        return true;
    }
    function chooseRoute(id) {
        if (updateOperation(Operations.choose(operation, id)))
            resumeOperation();
    }
    function resumeOperation() {
        if (!operation || operation.state !== "battle") {
            setPage("operations");
            return;
        }
        var prepared = Operations.build(operation, Levels, Terrain, Physics);
        if (prepared)
            start(prepared.index, prepared.seed, "operation", prepared);
    }
    function buySupply(id) {
        return updateOperation(Operations.buy(operation, id));
    }
    function departOperation() {
        return updateOperation(Operations.depart(operation));
    }
    function openDaily() {
        suspend();
        dailyChallenge = Challenges.today();
        dailyMessage = "";
        setPage("daily");
    }
    function bestDailyText() {
        var code = dailyChallenge ? dailyChallenge.code : "";
        // A code that is not a day keeps no leaderboard; it pays a medal once.
        if (dailyChallenge && dailyChallenge.secret)
            return "NO LEADERBOARD HERE. CLEAR IT ONCE AND IT IS ON YOUR RECORD.";
        var manual = profile.daily[code + ":manual"], assisted = profile.daily[code + ":assist"];
        return (manual ? "BEST " + manual.score + " · " + manual.spares + " SHELLS LEFT" : "NO UNASSISTED CLEAR YET") + (
                    assisted ? "   /   ASSISTED " + assisted.score : "");
    }
    function startDaily(code) {
        var challenge = Challenges.parse(code || Challenges.today().code);
        if (!challenge) {
            dailyMessage = "Use a valid BAT1-YYYYMMDD code, for example " + Challenges.today().code;
            return false;
        }
        dailyChallenge = challenge;
        dailyMessage = "";
        var prepared = Challenges.build(challenge, Levels, Terrain, Physics);
        return start(challenge.index, challenge.seed, "daily", prepared);
    }
    function beginAiming() {
        briefing = false;
        angleDir = 0;
        powerDir = 0;
        root.forceActiveFocus();
        canvas.requestPaint();
    }
    function selectHistory(index) {
        if (!shotHistory.length)
            return;
        // The book runs newest at the top to oldest at the bottom, and the ends
        // are ends. Stepping past the last entry used to wrap round to the
        // first, which reads as a jump rather than as a step.
        historySelection = Math.max(0, Math.min(shotHistory.length - 1, index));
        canvas.requestPaint();
    }
    function recallShot() {
        if (status !== "aiming" || cardShown || !shotHistory.length)
            return;
        var shot = shotHistory[historySelection];
        angle = shot.angle;
        power = shot.power;
        var stocked = world.rack[shot.weapon] > 0;
        if (stocked)
            selectWeapon(shot.weapon);
        say(stocked ? "DIALS RECALLED · CHECK THE WIND" : "DIALS RECALLED · " + shot.weapon.toUpperCase() + " EMPTY",
            theme.muted);
        root.forceActiveFocus();
    }

    // ---- the rack ----------------------------------------------------------
    function selectWeapon(kind) {
        if (!inGame || !world.rack.hasOwnProperty(kind))
            return false;
        weapon = kind;
        canvas.requestPaint();
        return true;
    }
    // Cycle to the next shell type that still has rounds.
    function cycleWeapon(step) {
        if (!inGame)
            return;
        var order = Physics.WEAPON_ORDER.filter(function (k) {
            return world.rack.hasOwnProperty(k);
        });
        if (!order.length)
            return;
        var at = Math.max(0, order.indexOf(weapon));
        for (var i = 1; i <= order.length; i++) {
            var candidate = order[(at + step * i + order.length * i) % order.length];
            if (world.rack[candidate] > 0) {
                weapon = candidate;
                canvas.requestPaint();
                return;
            }
        }
    }

    // ---- firing ------------------------------------------------------------
    // An engineer repairs other positions and shoots at nothing. Once it is the
    // only thing left alive it has no work and no fight, and a gunner who stops
    // shooting will eventually be told so.
    // The position the flag of truce is raised over, or null.
    function parleyFlag() {
        if (!ceasefire || !inGame)
            return null;
        for (var i = 0; i < world.targets.length; i++)
            if (world.targets[i].hp > 0)
                return {
                    "x": world.targets[i].x,
                    "y": world.targets[i].y,
                    "raise": ceasefireRaise
                };
        return null;
    }
    function surrenderOffered() {
        return inGame && !!world.enemy && !ceasefire && !turnOver && engineersOnly;
    }
    // The flag goes up on the field first. The result card would cover the
    // position it is raised over, so it waits until there has been time to
    // watch it.
    function surrender() {
        ceasefire = true;
        ceasefireRaise = 0;
        surrenderHold = 3.4;
        say("THEY HAVE HAD ENOUGH", theme.accent);
        cue("parley");
        refresh();
    }

    function fire() {
        if (!inGame || status !== "aiming" || cardShown || ceasefire || world.shotsLeft <= 0)
            return false;
        if (!(world.rack[weapon] > 0)) {
            cycleWeapon(1);
            if (!(world.rack[weapon] > 0))
                return false;
        }
        world.rack[weapon]--;
        world.shotsLeft--;
        var tip = Physics.muzzle(world.turret, angle);
        var shot = Physics.launch(tip.x, tip.y, angle, power, weapon, "player");
        if (world.payload && weapon === "he")
            shot.blast += 8;
        projectiles = [shot];
        activeShot = {
            "number": world.shots - world.shotsLeft,
            "weapon": weapon,
            "angle": angle,
            "power": power,
            // No sock, no reading: the notebook logs what the gunner could
            // actually see. Entries from before it came down keep theirs.
            "wind": sockDown ? null : windNow,
            "impacts": [],
            "traces": []
        };
        if (config.assist)
            usedAssist = true;
        lastTracers = [];
        status = "flying";
        recoil = 1;
        shake = Math.max(shake, 2);
        cue("fire");
        refresh();
        canvas.requestPaint();
        return true;
    }

    function spawnBlast(x, y, radius, hostile, kind) {
        var fx = effects;
        fx.blasts.push({
                           "x": x,
                           "y": y,
                           "r": Math.max(18, radius),
                           "age": 0,
                           "life": 0.55,
                           "hostile": !!hostile,
                           "kind": kind || "he"
                       });
        if (config.effects) {
            var count = kind === "depot" ? 32 : kind === "digger" ? 22 : radius > 30 ? 14 : 7;
            for (var i = 0; i < count; i++) {
                var a = Math.PI * (0.05 + Math.random() * 0.9), speed = 60 + Math.random() * 190;
                fx.particles.push({
                                      "x": x,
                                      "y": y,
                                      "vx": Math.cos(a) * speed * (Math.random() < 0.5 ? -1 : 1),
                                      "vy": -Math.sin(a) * speed,
                                      "age": 0,
                                      "life": 0.5 + Math.random() * 0.7,
                                      "size": 1.5 + Math.random() * 2.5,
                                      "smoke": i % 3 === 0,
                                      "kind": kind || "he"
                                  });
            }
        }
        // Bound both pools so a long level cannot grow them without limit.
        if (fx.blasts.length > 16)
            fx.blasts.splice(0, fx.blasts.length - 16);
        if (fx.particles.length > 300)
            fx.particles.splice(0, fx.particles.length - 300);
        effects = fx;
    }

    function popup(x, y, text, ink) {
        var fx = effects;
        fx.popups.push({
                           "x": x,
                           "y": y,
                           "text": text,
                           "ink": ink,
                           "age": 0,
                           "life": 1.3
                       });
        if (fx.popups.length > 12)
            fx.popups.splice(0, fx.popups.length - 12);
        effects = fx;
    }

    function say(text, ink) {
        callout = text;
        calloutInk = ink || theme.foreground;
        calloutLeft = 2.4;
    }

    // ---- resolving a turn --------------------------------------------------
    // One of the player's shells has stopped. Everything it hit is scored here;
    // the spotter's call waits until the whole salvo is down.
    function resolvePlayer(hit) {
        if (hit.kind === "lost") {
            cue("miss");
            return;
        }
        var result = Physics.detonate(world, hit);
        for (var blastIndex = 0; blastIndex < result.blasts.length; blastIndex++) {
            var blast = result.blasts[blastIndex];
            spawnBlast(blast.x, blast.y, blast.radius, false, blast.kind);
        }
        collapseCount += result.collapses.length;
        chainCount += result.chains;
        for (var fallen = 0; fallen < result.collapses.length; fallen++)
            popup(result.collapses[fallen].x, result.collapses[fallen].y - 45, "COLLAPSE", theme.warning);
        if (result.chains > 0) {
            popup(result.x, result.y - 75, "CHAIN REACTION", theme.warning);
            cue("depot");
        } else if (hit.shot.kind === "digger" || hit.shot.kind === "roller")
            cue(hit.shot.kind);
        if (activeShot)
            activeShot.impacts.push({
                                        "x": result.x,
                                        "y": result.y
                                    });
        shake = Math.max(shake, hit.shot.kind === "bomblet" ? 1.5 : 3);
        var kills = result.destroyed.length;
        if (kills > 0) {
            var direct = 0;
            for (var i = 0; i < kills; i++) {
                var t = result.destroyed[i];
                if (t.direct)
                    direct++;
                if (world.targets.indexOf(t) === world.spotter && t.fired >= 3)
                    spotterKills++;
            }
            if (hit.shot.kind === "digger")
                diggerKills += kills;
            if (hit.shot.kind === "roller")
                rollerKills += kills;
            destroyed += kills;
            directHits += direct;
            bestMultiKill = Math.max(bestMultiKill, kills);
            turnKills += kills;
            var multiplier = Levels.comboMultiplier(combo + 1);
            var points = Math.round(Levels.scoreFor(kills, direct) * multiplier);
            score += points;
            popup(result.x, result.y - 30, "+" + points + (multiplier > 1 ? "  ×" + multiplier.toFixed(1) : ""),
                  theme.accent);
            if (direct > 0)
                popup(result.x, result.y - 52, "DIRECT HIT", theme.warning);
            cue(direct > 0 ? "direct" : "kill");
            shake = Math.max(shake, 5);
            if (Physics.remaining(world) === 0) {
                // The last emplacement goes slowly.
                timeScale = 0.28;
                slowLeft = 0.9;
            }
        } else
            cue("impact");
        if (result.gunHit)
            gunHitsTaken++;
        if (result.sockHit) {
            sockDown = true;
            popup(result.x, result.y + 30, "WINDSOCK DOWN", theme.warning);
            curioText = "THAT WAS OUR ONLY WINDSOCK";
            curioInk = theme.muted;
        }
        if (result.selfHit) {
            selfHit = true;
            popup(world.turret.x, world.turret.y - 50, "DANGER CLOSE", theme.urgent);
            curioText = "THAT WAS OUR OWN POSITION";
            curioInk = theme.urgent;
        }
        turnImpactX += result.x;
        turnImpacts++;
        impactHold = 0.45;
    }
    // The salvo is down: make the call, settle the combo, hand over the turn.
    function endPlayerTurn() {
        bestMultiKill = Math.max(bestMultiKill, turnKills);
        if (activeShot) {
            activeShot.traces = lastTracers.slice();
            activeShot.kills = turnKills;
            if (activeShot.weapon === "cluster" && turnKills > 1)
                clusterMulti++;
            var landings = activeShot.impacts;
            activeShot.landing = landings.length ? Math.round(landings.reduce(function (sum, p) {
                return sum + p.x;
            }, 0) / landings.length - world.turret.x) : null;
            shotHistory = [activeShot].concat(shotHistory).slice(0, 3);
            activeShot = null;
            historySelection = 0;
        }
        if (turnKills > 0) {
            combo++;
            say(turnKills > 1 ? "ON TARGET  ×" + turnKills : "ON TARGET", theme.accent);
        } else {
            combo = 0;
            // callMiss still runs for its walking-on score, but a shell spent
            // on the windsock or on your own position has the last word.
            if (turnImpacts > 0)
                callMiss(turnImpactX / turnImpacts);
            else
                say("LOST", theme.muted);
            if (curioText)
                say(curioText, curioInk);
        }
        curioText = "";
        turnKills = 0;
        turnImpactX = 0;
        turnImpacts = 0;
        refresh();
        if (world.turret.hp <= 0)
            finish("destroyed");
        else if (Physics.remaining(world) === 0)
            finish("cleared");
        else if (world.shotsLeft <= 0)
            finish("failed");
        else if (world.enemy) {
            status = "incoming";
            incomingDelay = 0.75;
            enemyFired = false;
            enemyPlanBuilt = false;
            enemyReplies = [];
        } else
            status = "aiming";
    }

    // SHORT or OVER, by how much, and whether that brackets the target or walks
    // onto it. A walk-on pays: getting closer is the whole craft.
    function callMiss(x) {
        var call = Physics.spot(world, x);
        if (!call) {
            say("MISS", theme.muted);
            return;
        }
        var key = String(world.targets.indexOf(call.target));
        var previous = misses[key];
        var side = call.offset < 0 ? "SHORT" : "OVER";
        var text = side + " " + Math.round(call.distance);
        var ink = theme.foreground;
        if (previous && previous.side !== side) {
            text = "BRACKETED · " + text;
            ink = theme.warning;
        }
        if (previous && call.distance < previous.distance - 4) {
            score += Levels.SCORE.walk;
            popup(x, call.target.y - 40, "WALKING ON  +" + Levels.SCORE.walk, theme.muted);
        }
        var next = misses;
        next[key] = {
            "side": side,
            "distance": call.distance
        };
        misses = next;
        say(text, ink);
    }

    // The enemy's shell has stopped.
    function resolveEnemy(hit) {
        if (hit.kind === "lost")
            return;
        var result = Physics.detonate(world, hit);
        spawnBlast(result.x, result.y, result.radius, true);
        var near = Math.hypot(result.x - world.turret.x, result.y - world.turret.y);
        shake = Math.max(shake, near < 140 ? 6 : 2.5);
        if (result.gunHit) {
            gunHitsTaken++;
            shake = Math.max(shake, 14);
            popup(world.turret.x, world.turret.y - 50, world.turret.hp > 0 ? "GUN HIT" : "GUN DESTROYED", theme.urgent);
            cue(world.turret.hp > 0 ? "hit" : "fail");
            say(world.turret.hp > 0 ? "WE ARE HIT" : "GUN DESTROYED", theme.urgent);
        } else
            cue("impact");
        impactHold = 0.45;
    }

    function endEnemyTurn() {
        refresh();
        if (world.turret.hp <= 0)
            finish("destroyed");
        else
            status = "aiming";
    }

    function enemyFire() {
        if (!enemyPlanBuilt) {
            var plan = Physics.enemyTurn(world, enemyRandom, Levels.nextSpotter);
            enemyReplies = plan.replies;
            enemyPlanBuilt = true;
            for (var eventIndex = 0; eventIndex < plan.events.length; eventIndex++) {
                var event = plan.events[eventIndex];
                popup(event.x, event.y - 40, event.text, theme.warning);
            }
        }
        if (!enemyReplies.length) {
            enemyFired = true;
            endEnemyTurn();
            return;
        }
        var replies = enemyReplies.slice();
        var reply = replies.shift();
        enemyReplies = replies;
        projectiles = [reply.shot];
        var fx = effects;
        fx.flashes.push({
                            "x": reply.from.x,
                            "y": reply.from.y,
                            "age": 0,
                            "life": 0.3
                        });
        effects = fx;
        enemyFired = true;
        cue("incoming");
        say(reply.heavy ? "HEAVY SALVO INCOMING" : "INCOMING · WATCH THEIR CORRECTIONS", theme.urgent);
        refresh();
    }

    function finish(outcome) {
        status = outcome;
        if (resultSaved)
            return;
        resultSaved = true;
        var cleared = outcome === "cleared";
        var stars = cleared ? Levels.stars(world) : 0;
        levelStars = stars;
        if (cleared)
            score += Levels.SCORE.clear + world.shotsLeft * Levels.SCORE.spare;
        var operationComplete = false;
        if (gameMode === "operation") {
            var nextOperation = Operations.finish(operation, world, score, cleared);
            if (nextOperation) {
                operationComplete = nextOperation.state === "complete";
                profile.operation = nextOperation;
                if (operationComplete) {
                    profile.operationsCompleted++;
                    profile.bestOperation = Math.max(profile.bestOperation, nextOperation.score);
                }
            }
        }
        if (gameMode === "daily")
            dailyNewBest = Profile.recordDaily(profile, dailyChallenge.code, {
                                                   "cleared": cleared,
                                                   "score": score,
                                                   "spares": shotsLeft,
                                                   "stars": stars
                                               }, usedAssist);
        var medals = Profile.record(profile, {
                                        "index": levelIndex,
                                        "mode": gameMode,
                                        "operationComplete": operationComplete,
                                        "collapses": collapseCount,
                                        "chains": chainCount,
                                        "clusterMulti": clusterMulti,
                                        "cleared": cleared,
                                        "score": score,
                                        "stars": stars,
                                        "shotsUsed": world.shots - world.shotsLeft,
                                        "targets": world.targets.length,
                                        "destroyed": destroyed,
                                        "directHits": directHits,
                                        "hasCover": !!(levelSpec.pillars && levelSpec.pillars.length),
                                        "hasEnemy": !!world.enemy,
                                        "wind": world.wind,
                                        "bestMultiKill": bestMultiKill,
                                        "gunHits": gunHitsTaken,
                                        "spotterKills": spotterKills,
                                        "diggerKills": diggerKills,
                                        "rollerKills": rollerKills,
                                        "sockHit": sockDown,
                                        "selfHit": selfHit,
                                        "ceasefire": ceasefire,
                                        "secret": gameMode === "daily" ? (dailyChallenge.secret || "") : ""
                                    });
        earned = medals.join(" · ");
        persist();
        cue(cleared ? "clear" : "fail");
    }

    function currentStars() {
        return status === "cleared" ? levelStars : 0;
    }

    // ---- simulation --------------------------------------------------------
    function applyAdjust(dt) {
        var rate = fineAdjust ? 7 : 34;
        if (angleDir !== 0)
            angle = Physics.clamp(angle + angleDir * rate * dt, Physics.MIN_ANGLE, Physics.MAX_ANGLE);
        if (powerDir !== 0)
            power = Physics.clamp(power + powerDir * rate * dt, Physics.MIN_POWER, Physics.MAX_POWER);
    }

    function advanceEffects(dt) {
        var fx = effects, i;
        for (i = fx.blasts.length - 1; i >= 0; i--) {
            fx.blasts[i].age += dt;
            if (fx.blasts[i].age >= fx.blasts[i].life)
                fx.blasts.splice(i, 1);
        }
        for (i = fx.particles.length - 1; i >= 0; i--) {
            var p = fx.particles[i];
            p.age += dt;
            p.vy += Physics.GRAVITY * 1.6 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.smoke) {
                p.vx += (windNow * 0.35 - p.vx) * Math.min(1, dt * 1.5);
                p.vy -= Physics.GRAVITY * 1.9 * dt;
            } else
                p.vx *= 1 - Math.min(0.9, 1.6 * dt);
            if (p.age >= p.life)
                fx.particles.splice(i, 1);
        }
        for (i = fx.popups.length - 1; i >= 0; i--) {
            fx.popups[i].age += dt;
            fx.popups[i].y -= 22 * dt;
            if (fx.popups[i].age >= fx.popups[i].life)
                fx.popups.splice(i, 1);
        }
        for (i = fx.flashes.length - 1; i >= 0; i--) {
            fx.flashes[i].age += dt;
            if (fx.flashes[i].age >= fx.flashes[i].life)
                fx.flashes.splice(i, 1);
        }
        activeEffects = fx.blasts.length + fx.particles.length + fx.popups.length + fx.flashes.length;
    }

    // Advance every shell in the air by one slice of simulated time, resolving
    // the ones that stop. Bomblets join the list as their parent opens.
    function flyAll(dt) {
        var live = projectiles, i;
        var settled = false;
        for (i = live.length - 1; i >= 0; i--) {
            var shot = live[i];
            var out = Physics.fly(shot, dt, world);
            if (!out)
                continue;
            live.splice(i, 1);
            settled = true;
            if (out.kind === "split") {
                for (var c = 0; c < out.children.length; c++)
                    live.push(out.children[c]);
                cue("split");
                lastTracers = lastTracers.concat([shot.trail.slice()]);
                continue;
            }
            if (shot.owner === "player") {
                lastTracers = lastTracers.concat([shot.trail.slice()]);
                resolvePlayer(out);
            } else
                resolveEnemy(out);
        }
        projectiles = live;
        if (settled)
            refresh();
        if (live.length === 0) {
            if (status === "flying")
                endPlayerTurn();
            else if (status === "incoming" && enemyFired) {
                if (enemyReplies.length) {
                    incomingDelay = 0.55;
                    enemyFired = false;
                } else
                    endEnemyTurn();
            }
        }
    }

    function tick(realDt) {
        var dt = realDt * timeScale;
        phase += realDt;
        if (recoil > 0)
            recoil = Math.max(0, recoil - realDt * 4.5);
        if (shake > 0)
            shake = Math.max(0, shake - realDt * 16);
        if (calloutLeft > 0)
            calloutLeft = Math.max(0, calloutLeft - realDt);
        if (slowLeft > 0) {
            slowLeft = Math.max(0, slowLeft - realDt);
            if (slowLeft === 0)
                timeScale = 1;
        }
        if (!paused && !briefing && inGame) {
            if (!cardShown)
                applyAdjust(realDt);
            if (ceasefire && surrenderHold > 0) {
                ceasefireRaise = Math.min(1, ceasefireRaise + realDt / 1.2);
                surrenderHold = Math.max(0, surrenderHold - realDt);
                if (surrenderHold === 0)
                    finish("cleared");
            }
            if (status === "aiming" && !cardShown && surrenderOffered()) {
                var wasHolding = holdFire;
                holdFire += realDt;
                // A nudge first, so that holding fire is something a gunner can
                // notice and then choose, rather than a timer nobody waits out.
                if (wasHolding < 4 && holdFire >= 4)
                    say("THE ENGINEER HAS STOPPED WORKING", theme.muted);
                if (holdFire >= 10)
                    surrender();
            } else if (holdFire !== 0)
                holdFire = 0;
            if (!turnOver && world.weather) {
                windNow = Physics.blow(world.weather, dt);
            }
            advanceEffects(dt);
            if (impactHold > 0)
                impactHold = Math.max(0, impactHold - dt);
            if (status === "flying" && projectiles.length)
                flyAll(dt);
            else if (status === "incoming") {
                if (projectiles.length)
                    flyAll(dt);
                else if (!enemyFired) {
                    incomingDelay -= dt;
                    if (incomingDelay <= 0)
                        enemyFire();
                }
            }
        }
        canvas.requestPaint();
    }

    // Flight redraws on every display frame so the arc is evenly paced on any
    // refresh rate; the ballistics still advance in fixed 120 Hz steps inside
    // Physics.fly. Idle artwork runs at 24 Hz; menus and pause do no work.
    function frame(dt) {
        dt = Math.min(dt, 0.1);
        renderClock += dt;
        if (flying || effects.particles.length > 0 || shake > 0)
            renderCadence = 0;
        else {
            renderCadence += dt;
            if (renderCadence + 1e-8 < 1 / 24)
                return;
            renderCadence = Math.max(0, renderCadence - 1 / 24) % (1 / 24);
        }
        var elapsed = renderClock;
        renderClock = 0;
        tick(elapsed);
        renderedFrames++;
        fpsFrames++;
        fpsElapsed += elapsed;
        if (fpsElapsed >= 1) {
            observedFps = fpsFrames / fpsElapsed;
            fpsFrames = 0;
            fpsElapsed = 0;
        }
    }

    // The aim-assist arc leaves the muzzle too, so it lines up with the barrel.
    function previewArc() {
        var tip = Physics.muzzle(world.turret, angle);
        return Physics.preview(tip.x, tip.y, angle, power, world, weapon);
    }

    // ---- audio -------------------------------------------------------------
    function cue(name) {
        if (!config.sound || !audioAllowed)
            return;
        var effect = ({
                          "fire": fireSound,
                          "impact": impactSound,
                          "kill": killSound,
                          "direct": killSound,
                          "miss": impactSound,
                          "clear": clearSound,
                          "fail": failSound,
                          "ready": readySound,
                          "split": splitSound,
                          "incoming": incomingSound,
                          "hit": hitSound,
                          "digger": diggerSound,
                          "roller": rollerSound,
                          "depot": depotSound,
                          "parley": parleySound
                      })[name];
        if (!effect)
            return;
        effect.stop();
        effect.play();
    }

    // ---- input -------------------------------------------------------------
    function keyDown(key, modifiers) {
        fineAdjust = (modifiers & Qt.ShiftModifier) !== 0;
        if (key === Qt.Key_Escape) {
            if (briefing && inGame) {
                home();
                return true;
            }
            if (page === "game" && !cardShown && !paused)
                paused = true;
            else if (page === "game")
                home();
            else if (page === "home")
                root.closeRequested();
            else
                setPage("home");
            return true;
        }
        if (key === Qt.Key_M) {
            setting("sound", !config.sound);
            // Muting is the one toggle with nothing on the field to show for
            // it, so it says so; the HUD legend then keeps the state.
            if (inGame && !briefing)
                say(config.sound ? "SOUND ON" : "SOUND OFF", config.sound ? theme.accent : theme.muted);
            return true;
        }
        if (key === Qt.Key_F11 || key === Qt.Key_F) {
            root.fullscreenRequested();
            return true;
        }
        if (menuNavigation && menuKey(key, modifiers))
            return true;
        if (page !== "game")
            return false;
        return gameKey(key);
    }

    // Arrows, Tab and Enter drive whichever menu or card is showing. Keys the
    // menu does not use fall through to the game shortcuts (R, N, T, G …).
    function menuKey(key, modifiers) {
        if (key === Qt.Key_Tab || key === Qt.Key_Backtab) {
            moveMenuFocus(key === Qt.Key_Tab && (modifiers & Qt.ShiftModifier) ? Qt.Key_Backtab : key);
            return true;
        }
        if ([Qt.Key_Left, Qt.Key_Right, Qt.Key_Up, Qt.Key_Down].indexOf(key) >= 0) {
            moveMenuFocus(key);
            return true;
        }
        // Space activates in the menus only: a player hammering it to fire
        // should not skip straight through the result card.
        if (key === Qt.Key_Return || key === Qt.Key_Enter || (key === Qt.Key_Space && !inGame)) {
            var button = focusedMenuButton(menuButtons());
            if (button) {
                button.clicked();
                return true;
            }
        }
        return false;
    }

    function gameKey(key) {
        if (key === Qt.Key_B && !cardShown) {
            notebookOpen = !notebookOpen;
            return true;
        }
        if (key === Qt.Key_BracketLeft && !cardShown) {
            selectHistory(historySelection + 1);
            return true;
        }
        if (key === Qt.Key_BracketRight && !cardShown) {
            selectHistory(historySelection - 1);
            return true;
        }
        if (key === Qt.Key_C && !cardShown) {
            recallShot();
            return true;
        }
        if (key === Qt.Key_P) {
            if (!cardShown || paused)
                paused = !paused;
            return true;
        }
        if (key === Qt.Key_R) {
            retry();
            return true;
        }
        if (key === Qt.Key_T) {
            setting("tracer", !config.tracer);
            return true;
        }
        if (key === Qt.Key_G) {
            setting("assist", !config.assist);
            return true;
        }
        if (status === "cleared" && key === Qt.Key_N) {
            advance();
            return true;
        }
        if (cardShown || paused)
            return false;
        // The rack: number keys pick a shell, Tab and Q walk through the ones
        // with rounds left.
        var slot = [Qt.Key_1, Qt.Key_2, Qt.Key_3, Qt.Key_4].indexOf(key);
        if (slot >= 0) {
            selectWeapon(Physics.WEAPON_ORDER[slot]);
            return true;
        }
        if (key === Qt.Key_Tab || key === Qt.Key_Q) {
            cycleWeapon(1);
            return true;
        }
        // Up and down elevate and depress the gun; left and right wind the
        // charge down and up, so "more" runs the same way as downrange.
        if (key === Qt.Key_Up || key === Qt.Key_W) {
            angleDir = 1;
            return true;
        }
        if (key === Qt.Key_Down || key === Qt.Key_S) {
            angleDir = -1;
            return true;
        }
        if (key === Qt.Key_Right || key === Qt.Key_D) {
            powerDir = 1;
            return true;
        }
        if (key === Qt.Key_Left || key === Qt.Key_A) {
            powerDir = -1;
            return true;
        }
        if (key === Qt.Key_Space || key === Qt.Key_Return || key === Qt.Key_Enter) {
            fire();
            return true;
        }
        return false;
    }

    function keyUp(key, modifiers) {
        fineAdjust = (modifiers & Qt.ShiftModifier) !== 0;
        if (key === Qt.Key_Up || key === Qt.Key_W || key === Qt.Key_Down || key === Qt.Key_S)
            angleDir = 0;
        else if (key === Qt.Key_Left || key === Qt.Key_A || key === Qt.Key_Right || key === Qt.Key_D)
            powerDir = 0;
    }

    Keys.onPressed: function (event) {
        event.accepted = root.keyDown(event.key, event.modifiers);
    }
    Keys.onReleased: function (event) {
        if (!event.isAutoRepeat)
            root.keyUp(event.key, event.modifiers);
    }

    // ---- audio assets ------------------------------------------------------
    SoundEffect {
        id: parleySound
        muted: !root.config.sound || !root.audioAllowed
        source: Qt.resolvedUrl("sounds/parley.wav")
        volume: 0.32
    }
    SoundEffect {
        id: fireSound
        muted: !root.config.sound || !root.audioAllowed
        source: Qt.resolvedUrl("sounds/fire.wav")
        volume: 0.3
    }
    SoundEffect {
        id: impactSound
        muted: !root.config.sound || !root.audioAllowed
        source: Qt.resolvedUrl("sounds/impact.wav")
        volume: 0.28
    }
    SoundEffect {
        id: killSound
        muted: !root.config.sound || !root.audioAllowed
        source: Qt.resolvedUrl("sounds/kill.wav")
        volume: 0.32
    }
    SoundEffect {
        id: clearSound
        muted: !root.config.sound || !root.audioAllowed
        source: Qt.resolvedUrl("sounds/clear.wav")
        volume: 0.3
    }
    SoundEffect {
        id: failSound
        muted: !root.config.sound || !root.audioAllowed
        source: Qt.resolvedUrl("sounds/fail.wav")
        volume: 0.28
    }
    SoundEffect {
        id: readySound
        muted: !root.config.sound || !root.audioAllowed
        source: Qt.resolvedUrl("sounds/ready.wav")
        volume: 0.22
    }
    SoundEffect {
        id: splitSound
        muted: !root.config.sound || !root.audioAllowed
        source: Qt.resolvedUrl("sounds/split.wav")
        volume: 0.24
    }
    SoundEffect {
        id: incomingSound
        muted: !root.config.sound || !root.audioAllowed
        source: Qt.resolvedUrl("sounds/incoming.wav")
        volume: 0.26
    }
    SoundEffect {
        id: hitSound
        muted: !root.config.sound || !root.audioAllowed
        source: Qt.resolvedUrl("sounds/hit.wav")
        volume: 0.34
    }

    SoundEffect {
        id: diggerSound
        muted: !root.config.sound || !root.audioAllowed
        source: Qt.resolvedUrl("sounds/digger.wav")
        volume: 0.3
    }
    SoundEffect {
        id: rollerSound
        muted: !root.config.sound || !root.audioAllowed
        source: Qt.resolvedUrl("sounds/roller.wav")
        volume: 0.25
    }
    SoundEffect {
        id: depotSound
        muted: !root.config.sound || !root.audioAllowed
        source: Qt.resolvedUrl("sounds/depot.wav")
        volume: 0.34
    }

    FrameAnimation {
        running: root.animating
        onRunningChanged: {
            root.renderClock = 0;
            root.renderCadence = 0;
        }
        onTriggered: root.frame(frameTime)
    }

    Rectangle {
        anchors.fill: parent
        color: root.theme.background
    }

    // The stage is designed at 1280x800 and scaled to fit. On wider or taller
    // windows it grows past that size so the field fills the window; menus stay
    // centred in whatever extra space there is.
    Item {
        id: stage
        readonly property real fit: Math.min(root.width / 1280, root.height / 800)
        readonly property real extraW: width - 1280
        readonly property real extraH: height - 800
        width: Math.max(1280, Math.round(root.width / fit))
        height: Math.max(800, Math.round(root.height / fit))
        anchors.centerIn: parent
        scale: fit

        Canvas {
            id: canvas
            objectName: "fieldCanvas"
            // The stage is scaled as a whole, which would magnify a fixed-size
            // raster. Size the canvas in window pixels and counter-scale it.
            readonly property real pixelScale: Math.max(0.5, stage.scale)
            readonly property real logicalWidth: 1280 + stage.extraW
            readonly property real logicalHeight: 600 + stage.extraH
            x: 0
            y: 72
            width: Math.round(logicalWidth * pixelScale)
            height: Math.round(logicalHeight * pixelScale)
            scale: 1 / pixelScale
            transformOrigin: Item.TopLeft
            visible: root.inGame
            renderStrategy: Canvas.Cooperative
            onWidthChanged: requestPaint()
            onHeightChanged: requestPaint()
            onPaint: {
                if (!root.inGame)
                    return;
                var started = Date.now();
                Renderer.draw(getContext("2d"), logicalWidth, logicalHeight, root.world, {
                                  "theme": root.theme,
                                  "pixelScale": width / logicalWidth,
                                  "phase": root.phase,
                                  "effects": root.config.effects,
                                  "angle": root.angle,
                                  "recoil": root.recoil,
                                  "shots": root.projectiles,
                                  "tracers": root.config.tracer ? (root.shotHistory.length
                                                                   ? root.shotHistory[root.historySelection].traces :
                                                                     root.lastTracers) : null,
                                  "aim": root.config.assist && root.status === "aiming" && !root.paused ? root.previewArc(
                                                                                                              ) : null,
                                  "gun": root.gunGeometry,
                                  "spotter": root.spotter,
                                  "parley": root.parleyFlag(),
                                  "shake": root.shake,
                                  "windLimit": root.world.windLimit
                              }, root.effects);
                var elapsed = Date.now() - started;
                root.totalPaintMs += elapsed;
                root.maxPaintMs = Math.max(root.maxPaintMs, elapsed);
                root.paintCount++;
            }

            MouseArea {
                anchors.fill: parent
                acceptedButtons: Qt.LeftButton
                // Hover aiming is what lets a stray pointer overwrite an angle
                // set from the keyboard, so it is switched off wholesale with
                // the rest of the battlefield mouse input.
                hoverEnabled: root.config.mouse
                onPositionChanged: function (mouse) {
                    if (!root.config.mouse || !root.inGame || root.cardShown || root.status !== "aiming")
                        return;
                    // Aim along the line from the pivot to the pointer. The
                    // canvas is counter-scaled, so undo that first.
                    var s = canvas.width / canvas.logicalWidth;
                    var hinge = Physics.pivot(root.world.turret);
                    var dx = mouse.x / s - hinge.x;
                    var dy = hinge.y - mouse.y / s;
                    if (dx === 0 && dy === 0)
                        return;
                    root.angle = Physics.clamp(Math.atan2(dy, dx) * 180 / Math.PI, Physics.MIN_ANGLE,
                                               Physics.MAX_ANGLE);
                    canvas.requestPaint();
                }
                onClicked: {
                    // Clicking always returns keyboard focus to the game, even
                    // with mouse control off; only firing is withheld.
                    root.forceActiveFocus();
                    if (root.config.mouse)
                        root.fire();
                }
                onWheel: function (wheel) {
                    if (!root.config.mouse || !root.inGame || root.cardShown)
                        return;
                    root.power = Physics.clamp(root.power + (wheel.angleDelta.y > 0 ? 2 : -2), Physics.MIN_POWER,
                                               Physics.MAX_POWER);
                    canvas.requestPaint();
                }
            }
        }

        // The spotter's call, over the field.
        Text {
            x: 0
            y: 72 + 118
            width: stage.width
            horizontalAlignment: Text.AlignHCenter
            visible: root.inGame && root.calloutLeft > 0 && !root.cardShown
            opacity: Math.min(1, root.calloutLeft / 0.5)
            text: root.callout
            font.family: "monospace"
            font.pixelSize: 26
            font.bold: true
            font.letterSpacing: 4
            color: root.calloutInk
            style: Text.Outline
            styleColor: root.theme.background
        }

        Header {
            id: header
            theme: root.theme
            width: stage.width
            title: root.inGame ? ((root.gameMode === "campaign" ? "LEVEL " + (root.levelIndex + 1) + " · " :
                                                                  root.gameMode === "operation" ? "OP " + (
                                                                                                      root.world.battle
                                                                                                      || 1) + " · " :
                                                                                                  "") + root.world.name) :
                                 "OMARTILLERY"
            detail: root.inGame ? ("SCORE " + root.score + (root.combo > 1 ? "   ×" + Levels.comboMultiplier(
                                                                                 root.combo).toFixed(1) : "")) : (
                                      root.progress.stars + "/" + root.progress.total + " ★")
            canGoBack: root.page !== "home"
            onBackRequested: root.home()
            onFullscreenRequested: root.fullscreenRequested()
            onCloseRequested: root.closeRequested()
        }

        Hud {
            theme: root.theme
            width: stage.width
            y: 72 + canvas.logicalHeight
            height: stage.height - y
            visible: root.inGame
            angle: root.angle
            power: root.power
            wind: root.windNow
            windLimit: root.inGame ? root.world.windLimit : 0
            gusty: root.inGame && root.world.gust > 0
            shotsLeft: root.shotsLeft
            shotsTotal: root.inGame ? root.world.shots : 0
            targetsLeft: root.targetsLeft
            targetsTotal: root.inGame ? root.world.targets.length : 0
            gunHp: root.gunHp
            gunMaxHp: root.gunMaxHp
            underFire: root.inGame && !!root.world.enemy
            rack: root.rack
            weapon: root.weapon
            mouseControl: root.config.mouse
            sound: root.config.sound
            windReadable: !root.sockDown
            onWeaponPicked: function (kind) {
                root.selectWeapon(kind);
                root.forceActiveFocus();
            }
        }

        Notebook {
            x: 24
            y: 160
            theme: root.theme
            view: root
            visible: root.inGame && !root.cardShown && root.notebookOpen
        }
        IntelPanel {
            anchors.right: parent.right
            anchors.rightMargin: 24
            y: 156
            theme: root.theme
            intel: root.targetIntel
            visible: root.inGame && !root.cardShown
        }
        Text {
            x: 26
            y: 85
            // The notebook keys are the one set the HUD legend has no room for,
            // so they stay here in every mode; a daily code or an operation's
            // carry-forward note is prefixed when there is one.
            text: {
                var mode = root.gameMode === "daily" ? root.dailyChallenge.code + (root.usedAssist ? " · ASSISTED" :
                                                                                                     " · UNASSISTED") :
                                                       root.gameMode === "operation"
                                                       ? "HEALTH + AMMUNITION CARRY FORWARD" : "";
                return (mode ? mode + "   ·   " : "") + "B NOTEBOOK   [ OLDER SHOT   ] NEWER   C RECALL DIALS";
            }
            color: root.theme.muted
            font.family: "monospace"
            font.pixelSize: 10
            visible: root.inGame && !root.cardShown
        }
        BriefingCard {
            anchors.centerIn: parent
            theme: root.theme
            view: root
            visible: root.inGame && root.briefing
        }

        MenuPage {
            anchors.centerIn: parent
            width: 1280
            height: 800 - 72
            y: 72
            theme: root.theme
            view: root
            visible: !root.inGame
        }

        ResultCard {
            anchors.centerIn: parent
            theme: root.theme
            view: root
            visible: root.cardShown && !root.briefing
        }
    }
}
