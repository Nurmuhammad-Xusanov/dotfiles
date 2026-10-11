import QtQuick
import "Palette.js" as Palette

// The card that covers the field when a level ends or the player pauses.
Rectangle {
    id: root
    property var theme: Palette.create()
    property var view: null
    readonly property string status: view ? (view.paused ? "paused" : view.status) : "paused"
    readonly property string mode: view ? view.gameMode : "campaign"
    readonly property bool cleared: status === "cleared"
    // A ceasefire is a clear with the last position left standing: nothing was
    // destroyed, so the card should not say it was.
    readonly property bool parley: !!view && view.ceasefire

    width: 560
    height: body.height + 60
    radius: 10
    color: theme.surface
    border.width: 1
    border.color: cleared ? theme.accent : (status === "failed" || status === "destroyed" ? theme.urgent : theme.border)

    Column {
        id: body
        x: 30
        y: 30
        width: parent.width - 60
        spacing: 14

        Text {
            text: root.cleared ? (root.parley ? "THEY HAVE SURRENDERED" : "POSITION DESTROYED") : (root.status
                                                                                                   === "failed"
                                                                                                   ? "OUT OF SHELLS" :
                                                                                                     root.status
                                                                                                     === "destroyed"
                                                                                                     ? "GUN DESTROYED" :
                                                                                                       "PAUSED")
            font.family: "monospace"
            font.pixelSize: 24
            font.bold: true
            font.letterSpacing: 2.5
            color: root.cleared ? root.theme.accent : (root.status === "failed" ? root.theme.urgent :
                                                                                  root.theme.foreground)
        }
        Text {
            visible: root.status !== "paused"
            text: root.view && root.view.world ? (root.cleared ? (root.parley ? "The engineer stood down with "
                                                                                + root.view.shotsLeft + " of "
                                                                                + root.view.world.shots
                                                                                + " shells still in the rack. You did not need the last one." :
                                                                                "Cleared with " + root.view.shotsLeft
                                                                                + " of " + root.view.world.shots
                                                                                + " shells still in the rack.") :
                                                                 "The battery is still standing. "
                                                                 + root.view.targetsLeft + (root.view.targetsLeft === 1
                                                                                            ? " emplacement left." :
                                                                                              " emplacements left.")) :
                                                 ""
            width: parent.width
            wrapMode: Text.WordWrap
            font.family: "sans-serif"
            font.pixelSize: 13
            color: root.theme.muted
        }
        Text {
            visible: root.cleared && root.mode !== "operation"
            text: {
                var count = root.view ? root.view.levelStars : 0;
                return "★★★".slice(0, count) + "☆☆☆".slice(0, 3 - count);
            }
            font.family: "monospace"
            font.pixelSize: 30
            color: root.theme.warning
        }
        Row {
            visible: root.status !== "paused"
            spacing: 26
            Gauge {
                theme: root.theme
                width: 150
                height: 54
                caption: "SCORE"
                value: root.view ? String(root.view.score) : "0"
                fraction: -1
                ink: root.theme.accent
            }
            Gauge {
                theme: root.theme
                width: 150
                height: 54
                caption: "DIRECT HITS"
                value: root.view ? String(root.view.directHits) : "0"
                fraction: -1
                ink: root.theme.foreground
            }
        }
        Text {
            visible: !!(root.view && root.view.earned)
            width: parent.width
            wrapMode: Text.WordWrap
            text: root.view ? "MEDAL · " + root.view.earned : ""
            font.family: "monospace"
            font.pixelSize: 12
            color: root.theme.warning
        }
        Text {
            visible: root.status !== "paused" && root.mode !== "campaign"
            width: parent.width
            text: root.mode === "daily" ? (root.view.dailyNewBest ? "NEW PERSONAL BEST · " : "") + root.view.dailyChallenge.code
                                          + (root.view.usedAssist ? " · ASSISTED" : " · UNASSISTED") : root.view
                                          && root.view.operation ? "OPERATION " + root.view.operation.stage
                                                                   + "/4 · TOTAL " + root.view.operation.score
                                                                   + " · SUPPLY " + root.view.operation.credits : ""
            wrapMode: Text.WordWrap
            font.family: "monospace"
            font.pixelSize: 12
            color: root.theme.accent
        }
        Row {
            spacing: 10
            GunButton {
                theme: root.theme
                width: 168
                primary: true
                visible: root.status !== "paused"
                text: root.cleared ? (root.mode === "daily" ? "DAILY MENU  ⏎" : root.mode === "operation"
                                                              ? "OPERATIONS  ⏎" : "NEXT LEVEL  ⏎") : root.mode
                                     === "operation" ? "NEW OPERATION" : "TRY AGAIN  ⏎"
                onClicked: root.cleared ? root.view.advance() : root.view.retry()
            }
            GunButton {
                theme: root.theme
                width: 168
                primary: true
                visible: root.status === "paused"
                text: "RESUME  ⏎"
                onClicked: root.view.paused = false
            }
            GunButton {
                theme: root.theme
                width: 140
                visible: root.mode === "campaign" || root.status === "paused" || (root.mode === "daily" && root.cleared)
                text: root.cleared ? "REPLAY  R" : root.mode === "operation" ? "RESTART BATTLE" : root.mode === "daily"
                                                                               ? "RESTART" : "NEW GROUND"
                onClicked: root.cleared ? root.view.retry() : root.view.reroll()
            }
            GunButton {
                theme: root.theme
                width: 120
                text: "MENU  ESC"
                onClicked: root.view.home()
            }
        }
    }
}
