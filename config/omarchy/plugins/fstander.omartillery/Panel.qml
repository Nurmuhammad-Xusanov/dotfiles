import QtQuick
import Quickshell
import Quickshell.Hyprland
import Quickshell.Wayland
import qs.Commons as Commons
import "Palette.js" as Palette
import "Profile.js" as Profile

Item {
    id: root
    property var shell: null
    property var manifest: null
    readonly property string moduleName: "fstander.omartillery"
    readonly property bool opened: gameWindow.visible
    property bool closing: false
    property bool placed: false
    property bool stateReady: false
    property var pendingSave: null
    readonly property string build: manifest && manifest.version ? String(manifest.version) : "dev"
    // Gunnery records live on this plugin's own entry in shell.json, written by
    // the host through its scoped settings API. The plugin never opens a file
    // or starts a process; the shell owns the config and its atomic writes.
    readonly property int recordLimit: 16384
    readonly property string windowMatch: "title:^Omartillery$"
    // Follows the shell's Color singleton, which the host updates on theme changes.
    readonly property var theme: Palette.create({
                                                    "background": String(Commons.Color.background),
                                                    "foreground": String(Commons.Color.foreground),
                                                    "accent": String(Commons.Color.accent),
                                                    "urgent": String(Commons.Color.urgent),
                                                    "muted": String(Commons.Color.muted)
                                                })

    onShellChanged: loadRecords()

    function open(payload) {
        gameWindow.visible = true;
        Qt.callLater(function () {
            game.resetFocus();
        });
    }
    function close() {
        closing = true;
        game.suspend();
        gameWindow.visible = false;
        placed = false;
        closing = false;
    }
    function dismiss() {
        close();
        if (shell && typeof shell.hide === "function")
            shell.hide(moduleName);
    }
    function toggleFullscreen() {
        if (!gameWindow.visible)
            return "busy";
        Hyprland.dispatch("hl.dsp.window.fullscreen({ window = \"" + windowMatch + "\", mode = \"fullscreen\" })");
        return "ok";
    }

    // The bar entry that carries this plugin's inline settings, if the widget
    // is in the bar. The host hands panels a read-only copy of the bar config.
    function storedEntry() {
        var config = shell ? shell.barConfig : null;
        var layout = config && config.layout ? config.layout : null;
        if (!layout)
            return null;
        var sections = ["left", "center", "right"];
        for (var s = 0; s < sections.length; s++) {
            var entries = layout[sections[s]];
            if (!Array.isArray(entries))
                continue;
            for (var i = 0; i < entries.length; i++)
                if (entries[i] && entries[i].id === moduleName)
                    return entries[i];
        }
        return null;
    }
    function loadRecords() {
        if (stateReady || !shell)
            return;
        var entry = storedEntry();
        if (entry && entry.records !== undefined && entry.records !== null) {
            try {
                var text = JSON.stringify(entry.records);
                if (typeof text !== "string" || text.length > recordLimit)
                    throw new Error("oversized");
                game.loadProfile(JSON.parse(text));
            } catch (error) {
                console.warn("Omartillery: invalid gunnery records; using defaults");
            }
        } else if (!entry)
            console.warn("Omartillery: bar widget entry not found; records will not be saved");
        stateReady = true;
        flush();
    }
    function flush() {
        if (!stateReady || !pendingSave)
            return;
        var records = pendingSave;
        pendingSave = null;
        var entry = storedEntry();
        if (!entry || !shell || typeof shell.updateEntryInline !== "function")
            return;
        var next = {};
        for (var key in entry)
            if (key !== "id")
                next[key] = entry[key];
        next.records = records;
        if (JSON.stringify(records).length > recordLimit) {
            console.warn("Omartillery: records too large to save");
            return;
        }
        shell.updateEntryInline(moduleName, next);
    }

    // ---- IPC surface -------------------------------------------------------
    // Telemetry and ordinary key input, for integration checks from a shell.
    function snapshot() {
        var world = game.world;
        return JSON.stringify({
                                  "build": root.build,
                                  "page": game.page,
                                  "mode": game.gameMode,
                                  "briefing": game.briefing,
                                  "intel": game.targetIntel,
                                  "operation": game.operation,
                                  "challengeCode": game.dailyChallenge.code,
                                  "dailyBest": game.dailyBest,
                                  "notebook": game.shotHistory.map(function (shot) {
                                      return {
                                          "number": shot.number,
                                          "weapon": shot.weapon,
                                          "angle": shot.angle,
                                          "power": shot.power,
                                          "wind": shot.wind,
                                          "landing": shot.landing,
                                          "kills": shot.kills
                                      };
                                  }),
                                  "status": game.status,
                                  "paused": game.paused,
                                  "visible": gameWindow.visible,
                                  "level": game.levelIndex,
                                  "levelName": world ? world.name : "",
                                  "seed": game.levelSeed,
                                  "angle": game.angle,
                                  "power": game.power,
                                  "weapon": game.weapon,
                                  "rack": game.rack,
                                  "wind": game.windNow,
                                  "windBase": world ? world.wind : 0,
                                  "windReadable": !game.sockDown,
                                  "gunHp": game.gunHp,
                                  "spotter": game.spotter,
                                  "combo": game.combo,
                                  "callout": game.callout,
                                  "projectiles": game.projectiles.length,
                                  "shotsLeft": game.shotsLeft,
                                  "targetsLeft": game.targetsLeft,
                                  "targetsTotal": world ? world.targets.length : 0,
                                  "score": game.score,
                                  "directHits": game.directHits,
                                  "shotX": game.projectiles.length ? game.projectiles[0].x : null,
                                  "shotY": game.projectiles.length ? game.projectiles[0].y : null,
                                  "stars": game.currentStars(),
                                  "sound": game.config.sound,
                                  "mouse": game.config.mouse,
                                  "assist": game.config.assist,
                                  "tracer": game.config.tracer,
                                  "progressStars": game.progress.stars,
                                  "profileLoaded": stateReady
                              });
    }
    function diagnostics() {
        return JSON.stringify({
                                  "build": root.build,
                                  "theme": theme,
                                  "visible": opened,
                                  "simulating": game.flying,
                                  "timeScale": game.timeScale,
                                  "shake": game.shake,
                                  "animating": game.animating,
                                  "frames": game.renderedFrames,
                                  "fps": game.observedFps,
                                  "paints": game.paintCount,
                                  "averagePaintMs": game.paintCount ? game.totalPaintMs / game.paintCount : 0,
                                  "maxPaintMs": game.maxPaintMs,
                                  "activeEffects": game.activeEffects,
                                  "stateReady": stateReady,
                                  "recordsPersistent": storedEntry() !== null
                              });
    }
    function input(arg) {
        var keys = {
            "fire": Qt.Key_Space,
            "enter": Qt.Key_Return,
            "up": Qt.Key_Up,
            "down": Qt.Key_Down,
            "left": Qt.Key_Left,
            "right": Qt.Key_Right,
            "pause": Qt.Key_P,
            "retry": Qt.Key_R,
            "next": Qt.Key_N,
            "tracer": Qt.Key_T,
            "assist": Qt.Key_G,
            "sound": Qt.Key_M,
            "back": Qt.Key_Escape,
            "1": Qt.Key_1,
            "2": Qt.Key_2,
            "3": Qt.Key_3,
            "4": Qt.Key_4,
            "cycle": Qt.Key_Tab,
            "notebook": Qt.Key_B,
            "previousShot": Qt.Key_BracketLeft,
            "nextShot": Qt.Key_BracketRight,
            "recall": Qt.Key_C
        };
        var tokens = String(arg).split(":");
        if (keys[tokens[0]] === undefined)
            return "unknown";
        if (tokens[1] === "up")
            game.keyUp(keys[tokens[0]], 0);
        else
            game.keyDown(keys[tokens[0]], 0);
        return "ok";
    }
    function navigate(arg) {
        if (arg === "operations") {
            game.openOperations();
            return "ok";
        }
        if (arg === "daily") {
            game.openDaily();
            return "ok";
        }
        if (["home", "levels", "settings", "records"].indexOf(arg) < 0)
            return "unknown";
        game.suspend();
        game.setPage(arg);
        return "ok";
    }
    function daily(arg) {
        return game.startDaily(String(arg || "")) ? "ok" : "invalid";
    }
    // operation 'new' | 'resume' | 'route:depot' | 'buy:repair' | 'depart'
    function operation(arg) {
        var parts = String(arg).split(":");
        if (parts[0] === "new") {
            game.newOperation();
            return "ok";
        }
        if (parts[0] === "resume") {
            game.resumeOperation();
            return "ok";
        }
        if (parts[0] === "route" && ["ridge", "depot"].indexOf(parts[1]) >= 0) {
            if (!game.operation || game.operation.state !== "route")
                return "invalid";
            game.chooseRoute(parts[1]);
            return "ok";
        }
        if (parts[0] === "buy")
            return game.buySupply(parts[1]) ? "ok" : "unavailable";
        if (parts[0] === "depart")
            return game.departOperation() ? "ok" : "unavailable";
        return "invalid";
    }

    // startLevel '{"index":3,"seed":42}' — seed is optional and makes the
    // level reproducible, which is what the integration checks use.
    function startLevel(arg) {
        var request;
        try {
            request = JSON.parse(arg);
        } catch (error) {
            return "invalid";
        }
        if (!request || typeof request !== "object")
            return "invalid";
        var index = Number(request.index || 0);
        if (!Number.isInteger(index) || index < 0 || index >= Profile.LEVEL_COUNT)
            return "invalid";
        var seed = request.seed === undefined ? undefined : Number(request.seed) >>> 0;
        return game.start(index, seed) ? "ok" : "locked";
    }
    // setting '{"key":"mouse","value":false}' — flip one setting. Only the
    // known keys are accepted, and only booleans.
    function setting(arg) {
        var request;
        try {
            request = JSON.parse(arg);
        } catch (error) {
            return "invalid";
        }
        if (!request || typeof request !== "object" || typeof request.value !== "boolean")
            return "invalid";
        if (["sound", "effects", "tracer", "assist", "mouse"].indexOf(request.key) < 0)
            return "unknown";
        game.setting(request.key, request.value);
        return "ok";
    }
    // weapon 'digger' — pick a shell from the rack.
    function weapon(arg) {
        return game.selectWeapon(String(arg)) ? "ok" : "unknown";
    }
    // aim '{"angle":52,"power":74}' — set the dials without firing.
    function aim(arg) {
        var request;
        try {
            request = JSON.parse(arg);
        } catch (error) {
            return "invalid";
        }
        if (!request || typeof request !== "object")
            return "invalid";
        if (Number.isFinite(request.angle))
            game.angle = Math.max(0, Math.min(180, Number(request.angle)));
        if (Number.isFinite(request.power))
            game.power = Math.max(5, Math.min(100, Number(request.power)));
        return "ok";
    }

    // Size and centre the floating window on the focused monitor. Geometry
    // comes from Quickshell's Hyprland binding; requests go straight to the
    // compositor socket, so nothing is resolved through PATH.
    function fitWindow() {
        var monitor = Hyprland.focusedMonitor;
        if (!monitor)
            return;
        var scale = monitor.scale > 0 ? monitor.scale : 1;
        var screenW = monitor.width / scale, screenH = monitor.height / scale;
        var w = Math.min(1440, Math.floor(screenW * 0.9));
        var h = Math.min(900, Math.floor(screenH * 0.86));
        w = Math.min(w, Math.floor(h * 1.6));
        h = Math.floor(w / 1.6);
        var x = Math.round(monitor.x + (screenW - w) / 2);
        var y = Math.round(monitor.y + (screenH - h) / 2);
        Hyprland.dispatch("hl.dsp.window.resize({ window = \"" + windowMatch + "\", x = " + w + ", y = " + h + " })");
        Hyprland.dispatch("hl.dsp.window.move({ window = \"" + windowMatch + "\", x = " + x + ", y = " + y + " })");
    }
    Timer {
        id: setupTimer
        interval: 180
        onTriggered: {
            Hyprland.dispatch("hl.dsp.window.float({ window = \"" + root.windowMatch + "\", action = \"float\" })");
            fitTimer.restart();
        }
    }
    Timer {
        id: fitTimer
        interval: 120
        onTriggered: root.fitWindow()
    }

    FloatingWindow {
        id: gameWindow
        title: "Omartillery"
        implicitWidth: 1440
        implicitHeight: 900
        minimumSize: Qt.size(960, 600)
        visible: false
        color: root.theme.background
        onVisibleChanged: {
            // Fullscreen remaps the surface and re-fires this; place once per open.
            if (visible && !root.placed) {
                root.placed = true;
                setupTimer.restart();
            }
            if (!visible) {
                game.suspend();
                if (!root.closing && root.shell && typeof root.shell.hide === "function")
                    root.shell.hide(root.moduleName);
            }
        }
        GameView {
            id: game
            theme: root.theme
            anchors.fill: parent
            shown: gameWindow.visible
            enabled: root.stateReady
            onSaveRequested: function (data) {
                root.pendingSave = data;
                root.flush();
            }
            onCloseRequested: root.dismiss()
            onFullscreenRequested: root.toggleFullscreen()
        }
    }
    IdleInhibitor {
        window: gameWindow
        enabled: game.flying
    }
}
