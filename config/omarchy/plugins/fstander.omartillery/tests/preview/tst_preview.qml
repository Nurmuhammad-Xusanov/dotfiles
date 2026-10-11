// Renders the listing preview from the real game on an offscreen surface, so
// the image is the plugin's own UI rather than a desktop screenshot — the
// shell's window opacity would otherwise let the desktop bleed through it.
//
//   QT_QPA_PLATFORM=offscreen QT_QUICK_BACKEND=software \
//     qmltestrunner -input tests/preview -import .
//
// Not part of scripts/check.sh: the preview only changes when the art does.
//
// The frame: Twin Keeps on seed 46, an HE shell at 44.0° and power 73 into the
// ammunition depot under the far keep. It was chosen over the alternatives
// because everything that matters is inside the field and legible when the
// image is scaled down to README width — one unbroken arc across the whole
// span, the chain reaction and its shockwave clear of both edges, the charging
// heavy gun on the keep it is about to answer from, and a full rack on the HUD.
import QtQuick
import QtTest
import "../.." as Game
import "../../Profile.js" as Profile

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
        name: "Preview"
        when: windowShown
        function test_grab() {
            var unlocked = Profile.fresh();
            for (var lv = 0; lv < Profile.LEVEL_COUNT; lv++)
                unlocked.levels[String(lv)] = {
                    "score": 1,
                    "stars": 3
                };
            game.loadProfile(unlocked);
            // audioAllowed is already false, so the sound setting is left at
            // its default and the HUD legend reads as a new player sees it.
            verify(game.start(8, 46));
            game.beginAiming();
            // The notebook is open at the start of a battle and would cover the
            // rising half of the arc.
            game.notebookOpen = false;
            game.angle = 44;
            game.power = 73;
            verify(game.fire());
            for (var i = 0; i < 3000 && game.status === "flying"; i++)
                game.tick(1 / 60);
            // A few frames into the blast: the shockwave has opened out but the
            // scoring callouts are still up.
            for (var k = 0; k < 7; k++)
                game.tick(1 / 60);
            wait(120);
            var done = false;
            scene.grabToImage(function (result) {
                result.saveToFile(Qt.resolvedUrl("../../preview.png").toString().replace("file://", ""));
                done = true;
            });
            tryVerify(function () { return done; }, 5000);
        }
    }
}
