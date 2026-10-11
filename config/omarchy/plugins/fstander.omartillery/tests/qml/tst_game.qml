import QtQuick
import QtTest
import "../.." as Game
import "../../Profile.js" as Profile
import "../../Physics.js" as Physics
import "Driver.js" as Driver

Item {
    id: scene
    width: 1280
    height: 800
    Game.GameView {
        id: game
        anchors.fill: parent
        shown: false
        audioAllowed: false
    }
    TestCase {
        name: "GameFlow"
        when: windowShown
        function init() {
            failOnWarning(/.?/);
            game.home();
            game.loadProfile(Profile.fresh());
            game.setting("sound", false);
            game.gameMode = "campaign";
        }
        function resolveTurn() {
            var guard = 0;
            while ((game.status === "flying" || game.status === "incoming") && guard++ < 15000)
                game.tick(1 / 60);
            verify(guard < 15000, "turn must settle");
        }
        function clearBattle() {
            game.beginAiming();
            var guard = 0;
            while (!game.turnOver && guard++ < 40) {
                var pick = Driver.pick(game.world, Physics);
                verify(pick !== null, "there is ammunition for another shot");
                game.angle = pick.angle;
                game.power = pick.power;
                game.selectWeapon(pick.kind);
                verify(game.fire());
                resolveTurn();
            }
            compare(game.status, "cleared", "the battle must be playable through normal firing");
        }
        function test_briefing_and_notebook() {
            verify(game.start(0, 42));
            verify(game.briefing);
            verify(!game.fire(), "cannot fire through the briefing");
            game.keyDown(Qt.Key_Return, 0);
            verify(!game.briefing);
            for (var n = 0; n < 4; n++) {
                game.angle = 80 + n;
                game.power = 5 + n;
                verify(game.fire());
                resolveTurn();
            }
            compare(game.shotHistory.length, 3);
            compare(game.shotHistory[0].number, 4);
            verify(game.shotHistory[0].traces[0].length > 1);
            // [ walks down the page towards the oldest shot, ] back up towards
            // the newest, and neither runs off its end into the other.
            compare(game.historySelection, 0, "the newest shot is selected after a turn");
            game.keyDown(Qt.Key_BracketRight, 0);
            compare(game.historySelection, 0, "newer than the newest stays put");
            for (var step = 0; step < 5; step++)
                game.keyDown(Qt.Key_BracketLeft, 0);
            compare(game.historySelection, 2, "older than the oldest stays put");
            game.keyDown(Qt.Key_BracketRight, 0);
            compare(game.historySelection, 1, "and steps back one at a time");
            game.selectHistory(2);
            game.recallShot();
            compare(game.angle, 81);
            compare(game.power, 6);
            game.retry();
            compare(game.shotHistory.length, 0);
            compare(game.turnKills, 0);
        }
        function test_campaign_records() {
            game.start(0, 42);
            clearBattle();
            verify(game.profile.levels[0].stars > 0);
            verify(game.unlocked(1));
            compare(game.shotHistory[0].kills, 1);
        }
        function test_terrain_combo_uses_ordinary_firing() {
            var profile = Profile.fresh();
            for (var n = 0; n < 5; n++)
                profile.levels[String(n)] = {
                    score: 100,
                    stars: 1
                };
            game.loadProfile(profile);
            game.start(5, 42);
            game.beginAiming();
            game.selectWeapon("digger");
            game.angle = 20;
            game.power = 94;
            verify(game.fire());
            resolveTurn();
            verify(game.collapseCount > 0, "the mesa can be undermined through normal play");
            compare(game.world.targets[0].hp, 0);
            compare(game.world.targets[0].direct, false);
        }
        function test_overlay_clicks_do_not_fire() {
            game.start(0, 42);
            game.beginAiming();
            game.setting("mouse", true);
            game.notebookOpen = true;
            wait(30);
            mouseClick(game, 40, 175);
            compare(game.status, "aiming");
            mouseClick(game, 1100, 195);
            compare(game.status, "aiming");
            mouseClick(game, 450, 300);
            compare(game.status, "flying");
        }
        function test_daily_records_and_replay() {
            verify(game.startDaily("BAT1-20260913"));
            compare(game.gameMode, "daily");
            compare(game.shotsLeft, 12);
            clearBattle();
            verify(game.dailyNewBest);
            verify(game.profile.daily["BAT1-20260913:manual"].score > 0);
            compare(Object.keys(game.profile.levels).length, 0);
            var seed = game.levelSeed;
            game.retry();
            compare(game.levelSeed, seed);
            compare(game.shotsLeft, 12);
            game.setting("assist", true);
            game.setting("assist", false);
            clearBattle();
            verify(game.profile.daily["BAT1-20260913:assist"].score > 0);
            game.advance();
            compare(game.page, "daily");
        }
        function test_operation_lifecycle_and_persistence() {
            game.newOperation(42);
            compare(game.page, "operations");
            for (var stage = 0; stage < 4; stage++) {
                game.chooseRoute("depot");
                compare(game.gameMode, "operation");
                compare(game.world.battle, stage + 1);
                var rack = JSON.stringify(game.rack), seed = game.levelSeed;
                game.home();
                game.loadProfile(JSON.parse(JSON.stringify(game.profile)));
                game.resumeOperation();
                compare(game.levelSeed, seed);
                compare(JSON.stringify(game.rack), rack);
                clearBattle();
                compare(game.operation.stage, stage + 1);
                game.advance();
                compare(game.page, "operations");
                if (stage < 3) {
                    compare(game.operation.state, "supply");
                    while (game.operation.hp < game.operation.maxHp && game.operation.credits >= 2)
                        verify(game.buySupply("repair"));
                    if (game.operation.credits >= 2)
                        verify(game.buySupply("he"));
                    verify(game.departOperation());
                }
            }
            compare(game.operation.state, "complete");
            compare(game.profile.operationsCompleted, 1);
            verify(game.profile.bestOperation > 0);
            compare(Object.keys(game.profile.levels).length, 0);
        }
        function test_keyboard_menus_and_invalid_challenge() {
            game.openDaily();
            wait(30);
            verify(game.menuButtons().some(function (b) {
                return b.text === "EDIT CODE";
            }));
            verify(!game.startDaily("BAT2-20260913"));
            verify(game.dailyMessage.length > 0);
            game.openOperations();
            game.newOperation(7);
            wait(30);
            game.keyDown(Qt.Key_Return, 0);
            compare(game.page, "game");
            verify(game.briefing);
            game.keyDown(Qt.Key_Return, 0);
            verify(!game.briefing);
        }
        // Level 7 ("Hardened") fields an engineer. Killing everything else and
        // then holding fire should end the battle without spending the shell.
        function test_engineer_surrenders_to_a_held_fire() {
            var unlocked = Profile.fresh();
            for (var lv = 0; lv < 7; lv++)
                unlocked.levels[String(lv)] = {
                    "score": 1,
                    "stars": 3
                };
            game.loadProfile(unlocked);
            verify(game.start(6, 11));
            game.beginAiming();
            // Kill every position that is not the engineer, by hand.
            var engineer = -1;
            for (var i = 0; i < game.world.targets.length; i++) {
                if (game.world.targets[i].role === "engineer")
                    engineer = i;
                else
                    game.world.targets[i].hp = 0;
            }
            verify(engineer >= 0, "level 7 fields an engineer");
            game.refresh();
            verify(game.engineersOnly);
            compare(game.status, "aiming");
            var shellsBefore = game.world.shotsLeft;
            // Nothing happens for the first few seconds.
            for (var early = 0; early < 120; early++)
                game.tick(1 / 60);
            compare(game.status, "aiming");
            verify(!game.ceasefire);
            // Keep holding, and they give it up.
            for (var late = 0; late < 1200 && game.status === "aiming"; late++)
                game.tick(1 / 60);
            verify(game.ceasefire, "the engineer must stand down");
            verify(game.ceasefireRaise >= 1, "the flag of truce must be all the way up");
            // The flag is drawn over the position that gave up, and it is up
            // before the result card covers that part of the field.
            var flag = game.parleyFlag();
            verify(flag !== null, "there must be a flag to draw");
            compare(flag.x, game.world.targets[engineer].x);
            compare(flag.raise, 1);
            compare(game.status, "cleared");
            compare(game.world.shotsLeft, shellsBefore, "surrender costs no ammunition");
            verify(game.world.targets[engineer].hp > 0, "the engineer is spared, not destroyed");
            verify(game.profile.medals.indexOf("Ceasefire") >= 0);
            // Firing again resets the clock, so a gunner who keeps shooting
            // never trips it by accident.
            verify(game.start(6, 11));
            game.beginAiming();
            for (var k = 0; k < game.world.targets.length; k++)
                if (game.world.targets[k].role !== "engineer")
                    game.world.targets[k].hp = 0;
            game.refresh();
            for (var hold = 0; hold < 300; hold++) {
                game.tick(1 / 60);
                if (hold % 100 === 0) {
                    game.angle = 20;
                    game.power = 20;
                    game.fire();
                    var guard = 0;
                    while ((game.status === "flying" || game.status === "incoming") && guard++ < 15000)
                        game.tick(1 / 60);
                }
            }
            verify(!game.ceasefire, "a gunner who keeps firing never trips it");
        }
        // Shooting the windsock costs you the instrument: the wind keeps
        // blowing, but there is nothing left to read it off.
        function test_the_windsock_is_the_wind_instrument() {
            // Level 1 is dead calm, so this solution is exact every run.
            verify(game.start(0, 7));
            game.beginAiming();
            verify(!game.sockDown);
            game.angle = 60;
            game.power = 60;
            verify(game.fire());
            resolveTurn();
            verify(game.shotHistory[0].wind !== null, "a reading was available");
            game.angle = 48;
            game.power = 100;
            verify(game.fire());
            resolveTurn();
            verify(game.sockDown, "48 degrees at full power reaches the sock");
            compare(game.world.sock.hp, 0);
            // That shell was fired while the sock was still flying, so its own
            // entry keeps the reading the gunner could see at the time.
            verify(game.shotHistory[0].wind !== null, "the shot that took it down still had a reading");
            compare(game.shotHistory[0].kills, 0, "the sock is not a kill");
            compare(game.status, "aiming", "and shooting it ends nothing");
            // Everything fired afterwards is logged blind.
            game.angle = 55;
            game.power = 50;
            verify(game.fire());
            resolveTurn();
            verify(game.shotHistory[0].wind === null, "no sock, no reading to log");
            verify(game.shotHistory[2].wind !== null, "older entries keep theirs");
            game.retry();
            verify(!game.sockDown, "a retry issues a new sock");
        }
        function test_a_sock_shot_off_stops_the_wind_being_read() {
            var unlocked = Profile.fresh();
            for (var lv = 0; lv < 8; lv++)
                unlocked.levels[String(lv)] = {
                    "score": 1,
                    "stars": 3
                };
            game.loadProfile(unlocked);
            verify(game.start(7, 3), "level 8 must be reachable");
            game.beginAiming();
            verify(game.world.gust > 0, "level 8 gusts, so the readout is live");
            verify(game.weatherMoving, "a gusting field repaints for the sock");
            var before = game.windNow;
            game.world.sock.hp = 0;
            game.refresh();
            verify(game.sockDown);
            // The wind itself is untouched, and still moves.
            verify(game.world.gust > 0);
            var moved = false;
            for (var i = 0; i < 900 && !moved; i++) {
                game.tick(1 / 60);
                if (Math.abs(game.windNow - before) > 1)
                    moved = true;
            }
            verify(moved, "the wind must keep blowing without its sock");
            verify(!game.weatherMoving, "but nothing reads it, so nothing repaints for it");
        }
        // Each secret is tested for its own behaviour above; this one checks
        // the last link, that the flags a battle collects actually reach
        // Profile.record when the battle ends, and survive being reloaded.
        function test_every_secret_reaches_the_record() {
            var unlocked = Profile.fresh();
            for (var lv = 0; lv < 10; lv++)
                unlocked.levels[String(lv)] = {
                    "score": 1,
                    "stars": 3
                };
            game.loadProfile(unlocked);
            compare(game.profile.medals.indexOf("Windsock Down"), -1);

            // 1 and 2: the windsock and one of our own, then clear the level so
            // the run is recorded. Level 1 is dead calm: six shells, two marks.
            verify(game.start(0, 7));
            game.beginAiming();
            game.angle = 48;
            game.power = 100;
            verify(game.fire());
            resolveTurn();
            verify(game.sockDown, "the windsock must come down");
            game.angle = 81;
            game.power = 20;
            verify(game.fire());
            resolveTurn();
            verify(game.selfHit, "a shell of our own must land on our own position");
            clearBattle();
            verify(game.profile.medals.indexOf("Windsock Down") >= 0, "Windsock Down must be recorded");
            verify(game.profile.medals.indexOf("Danger Close") >= 0, "Danger Close must be recorded");

            // 3: the scorched battery, played to a clear.
            game.home();
            verify(game.startDaily("BAT1-SCORCHED"));
            clearBattle();
            verify(game.profile.medals.indexOf("Scorched Earth") >= 0, "Scorched Earth must be recorded");

            // 4: the gun drill.
            game.home();
            verify(game.startDaily("BAT0-GUNDRILL"));
            clearBattle();
            verify(game.profile.medals.indexOf("Gun Drill") >= 0, "Gun Drill must be recorded");

            // 5: the engineer's ceasefire.
            game.home();
            verify(game.start(6, 11));
            game.beginAiming();
            for (var i = 0; i < game.world.targets.length; i++)
                if (game.world.targets[i].role !== "engineer")
                    game.world.targets[i].hp = 0;
            game.refresh();
            for (var t = 0; t < 1200 && game.status === "aiming"; t++)
                game.tick(1 / 60);
            verify(game.profile.medals.indexOf("Ceasefire") >= 0, "Ceasefire must be recorded");

            // All five, and none of them lost to a reload of the stored profile.
            var stored = Profile.clean(JSON.parse(JSON.stringify(game.profile)));
            for (var m = 0; m < Profile.SECRET_MEDALS.length; m++)
                verify(stored.medals.indexOf(Profile.SECRET_MEDALS[m]) >= 0,
                       Profile.SECRET_MEDALS[m] + " must survive being stored and read back");
        }
        // The ceasefire test above drives tick() by hand, which would still
        // pass if the frame loop never ran. This one touches nothing and lets
        // the real FrameAnimation do the counting, so a regression in the
        // animating binding cannot hide the hold-fire clock.
        function test_the_ceasefire_clock_runs_on_the_real_frame_loop() {
            var unlocked = Profile.fresh();
            for (var lv = 0; lv < 7; lv++)
                unlocked.levels[String(lv)] = {
                    "score": 1,
                    "stars": 3
                };
            game.loadProfile(unlocked);
            game.shown = true;
            verify(game.start(6, 11));
            game.beginAiming();
            for (var i = 0; i < game.world.targets.length; i++)
                if (game.world.targets[i].role !== "engineer")
                    game.world.targets[i].hp = 0;
            game.refresh();
            verify(game.engineersOnly);
            verify(game.animating, "an offered ceasefire has to keep the frame loop awake");
            compare(game.holdFire, 0);
            // No tick() here: if the clock advances, the frame loop is running.
            tryVerify(function () {
                return game.holdFire > 0.5;
            }, 4000, "the hold-fire clock must advance on its own");
            // And it runs all the way to the surrender.
            tryVerify(function () {
                return game.status === "cleared";
            }, 25000, "the engineer must stand down without being ticked by hand");
            verify(game.ceasefire);
            verify(game.profile.medals.indexOf("Ceasefire") >= 0);
            game.shown = false;
        }
        function test_secret_codes_play_and_pay_a_medal() {
            game.openDaily();
            verify(game.startDaily("BAT0-GUNDRILL"));
            compare(game.world.name, "Old Gun Drill");
            compare(game.gameMode, "daily");
            verify(game.dailyBest.indexOf("NO LEADERBOARD") === 0);
            clearBattle();
            verify(game.profile.medals.indexOf("Gun Drill") >= 0);
            verify(game.profile.medals.indexOf("Daily Gunner") < 0, "a secret is not a daily");
            // It keeps no leaderboard and leaves the campaign alone.
            compare(Object.keys(game.profile.daily).length, 0);
            compare(Object.keys(game.profile.levels).length, 0);
            game.home();
            verify(game.startDaily("BAT1-SCORCHED"));
            compare(game.world.name, "The Scorched Battery");
            // A code that is neither a date nor a secret is still refused.
            game.openDaily();
            verify(!game.startDaily("BAT0-20260913"));
            verify(game.dailyMessage.length > 0);
        }
    }
}
