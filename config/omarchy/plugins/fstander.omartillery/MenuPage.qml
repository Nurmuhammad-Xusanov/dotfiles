pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls as Controls
import "Palette.js" as Palette
import "Levels.js" as Levels
import "Profile.js" as Profile

// Every out-of-game screen. `view` is the GameView that owns the state; this
// file only reads it and calls back into it, so the game logic stays in one
// place.
Item {
    id: root
    property var theme: Palette.create()
    property var view: null
    readonly property string page: view ? view.page : "home"
    readonly property var profile: view ? view.profile : Profile.fresh()

    function stars(index) {
        var record = profile.levels[String(index)];
        var count = record ? record.stars : 0;
        return "★★★".slice(0, count) + "☆☆☆".slice(0, 3 - count);
    }

    // ---- home --------------------------------------------------------------
    Item {
        anchors.fill: parent
        visible: root.page === "home"
        Column {
            anchors.centerIn: parent
            width: 560
            spacing: 14
            Text {
                text: "OMARTILLERY"
                font.family: "monospace"
                font.pixelSize: 52
                font.bold: true
                font.letterSpacing: 8
                color: root.theme.accent
                anchors.horizontalCenter: parent.horizontalCenter
            }
            Text {
                text: "SET THE ANGLE · SET THE POWER · WALK THEM ON"
                font.family: "monospace"
                font.pixelSize: 12
                font.letterSpacing: 2.4
                color: root.theme.muted
                anchors.horizontalCenter: parent.horizontalCenter
                bottomPadding: 20
            }
            GunButton {
                theme: root.theme
                width: parent.width
                primary: true
                // nextLevel() is the first level still unbeaten, so the label
                // follows the campaign rather than the level under the cursor.
                text: {
                    var done = Profile.progress(root.profile).cleared;
                    return done === 0 ? "TAKE THE GUN" : done >= Profile.LEVEL_COUNT ? "PLAY AGAIN" : "CONTINUE";
                }
                subtitle: root.view ? ("LEVEL " + (root.view.nextLevel() + 1) + " · " + Levels.spec(root.view.nextLevel(
                                                                                                        )).name) : ""
                onClicked: root.view.start(root.view.nextLevel(), undefined)
            }
            GunButton {
                theme: root.theme
                width: parent.width
                text: "FIELD OPERATIONS"
                subtitle: "Four battles · branching routes · carry your gun and ammunition"
                onClicked: root.view.openOperations()
            }
            GunButton {
                theme: root.theme
                width: parent.width
                text: "THE DAILY BATTERY"
                subtitle: "A shared battlefield every day · challenge codes · personal bests"
                onClicked: root.view.openDaily()
            }
            GunButton {
                theme: root.theme
                width: parent.width
                text: "LEVELS"
                trailingText: root.profile ? (Profile.progress(root.profile).cleared + "/" + Profile.LEVEL_COUNT) : ""
                onClicked: root.view.setPage("levels")
            }
            GunButton {
                theme: root.theme
                width: parent.width
                text: "RECORDS"
                trailingText: Profile.progress(root.profile).stars + "★"
                onClicked: root.view.setPage("records")
            }
            GunButton {
                theme: root.theme
                width: parent.width
                text: "SETTINGS"
                onClicked: root.view.setPage("settings")
            }
            GunButton {
                theme: root.theme
                width: parent.width
                text: "QUIT"
                onClicked: root.view.closeRequested()
            }
        }
    }

    // ---- level select ------------------------------------------------------
    Item {
        anchors.fill: parent
        visible: root.page === "levels"
        Text {
            x: 60
            y: 42
            text: "SELECT A LEVEL"
            font.family: "monospace"
            font.pixelSize: 20
            font.bold: true
            font.letterSpacing: 3
            color: root.theme.foreground
        }
        Grid {
            anchors.centerIn: parent
            columns: 2
            rowSpacing: 10
            columnSpacing: 14
            Repeater {
                model: Profile.LEVEL_COUNT
                GunButton {
                    required property int index
                    readonly property bool open: root.view ? root.view.unlocked(index) : index === 0
                    theme: root.theme
                    width: 480
                    enabled: open
                    text: open ? (String(index + 1).padStart(2, "0") + "  " + Levels.spec(index).name) : (String(index
                                                                                                                 + 1).padStart(
                                                                                                              2, "0") + "  LOCKED")
                    // Levels are numbered from 1 on screen, so the 0-based
                    // index of this level is the displayed number of the one
                    // before it — which is the level that unlocks it.
                    subtitle: open ? Levels.spec(index).brief : "Clear level " + index + " to unlock"
                    trailingText: open ? root.stars(index) : "···"
                    onClicked: root.view.start(index, undefined)
                }
            }
        }
    }

    // ---- settings ----------------------------------------------------------
    Item {
        anchors.fill: parent
        visible: root.page === "settings"
        Text {
            x: 60
            y: 42
            text: "SETTINGS"
            font.family: "monospace"
            font.pixelSize: 20
            font.bold: true
            font.letterSpacing: 3
            color: root.theme.foreground
        }
        Column {
            anchors.centerIn: parent
            width: 560
            spacing: 10
            Repeater {
                model: [
                    {
                        "key": "sound",
                        "label": "SOUND",
                        "hint": "Gun report, impacts and fanfares · M in battle"
                    },
                    {
                        "key": "effects",
                        "label": "EFFECTS",
                        "hint": "Debris, drifting ridges and blinking emplacements"
                    },
                    {
                        "key": "tracer",
                        "label": "TRACER",
                        "hint": "Keep the last shell's path on the field · T in battle"
                    },
                    {
                        "key": "assist",
                        "label": "AIM ASSIST",
                        "hint": "Preview the arc, ignoring wind. Training wheels · G in battle"
                    },
                    {
                        "key": "mouse",
                        "label": "MOUSE CONTROL",
                        "hint": "Aim with the pointer, wheel for power, click to fire. Off means keyboard only."
                    }
                ]
                GunButton {
                    required property var modelData
                    readonly property bool on: root.view ? !!root.view.config[modelData.key] : false
                    theme: root.theme
                    width: parent.width
                    text: modelData.label
                    subtitle: modelData.hint
                    selected: on
                    trailingText: on ? "ON" : "OFF"
                    onClicked: root.view.setting(modelData.key, !on)
                }
            }
        }
    }

    // ---- records -----------------------------------------------------------
    Item {
        anchors.fill: parent
        visible: root.page === "records"
        Text {
            x: 60
            y: 42
            text: "RECORDS"
            font.family: "monospace"
            font.pixelSize: 20
            font.bold: true
            font.letterSpacing: 3
            color: root.theme.foreground
        }
        Column {
            anchors.centerIn: parent
            width: 620
            spacing: 18
            Grid {
                columns: 3
                rowSpacing: 16
                columnSpacing: 30
                Repeater {
                    model: [
                        {
                            "caption": "STARS",
                            "value": Profile.progress(root.profile).stars + "/" + Profile.progress(root.profile).total
                        },
                        {
                            "caption": "LEVELS CLEARED",
                            "value": Profile.progress(root.profile).cleared + "/" + Profile.LEVEL_COUNT
                        },
                        {
                            "caption": "BEST LEVEL SCORE",
                            "value": String(root.profile.bestRun)
                        },
                        {
                            "caption": "SHELLS FIRED",
                            "value": String(root.profile.shotsFired)
                        },
                        {
                            "caption": "TARGETS DESTROYED",
                            "value": String(root.profile.targetsDestroyed)
                        },
                        {
                            "caption": "DIRECT HITS",
                            "value": String(root.profile.directHits)
                        }
                    ]
                    Gauge {
                        required property var modelData
                        theme: root.theme
                        width: 186
                        height: 56
                        caption: modelData.caption
                        value: modelData.value
                        fraction: -1
                        ink: root.theme.accent
                    }
                }
            }
            Text {
                text: "ACCURACY  " + (Profile.accuracy(root.profile) * 100).toFixed(0) + "%   ·   TARGETS PER SHELL"
                font.family: "monospace"
                font.pixelSize: 11
                font.letterSpacing: 1.2
                color: root.theme.muted
            }
            Column {
                spacing: 6
                Text {
                    text: {
                        var found = 0;
                        for (var i = 0; i < Profile.SECRET_MEDALS.length; i++)
                            if (root.profile.medals.indexOf(Profile.SECRET_MEDALS[i]) >= 0)
                                found++;
                        return "MEDALS  ·  HOVER TO INSPECT  ·  " + found + "/" + Profile.SECRET_MEDALS.length
                                + " SECRETS FOUND";
                    }
                    font.family: "monospace"
                    font.pixelSize: 11
                    font.letterSpacing: 2
                    color: root.theme.muted
                }
                Flow {
                    width: 620
                    spacing: 8
                    Repeater {
                        model: Profile.MEDALS
                        Rectangle {
                            id: medal
                            required property var modelData
                            readonly property bool won: root.profile.medals.indexOf(modelData) >= 0
                            // A secret medal keeps its place in the row but not
                            // its name: a collector can see how many are left
                            // to find without being told what any of them is.
                            readonly property bool hidden: !won && Profile.isSecret(modelData)
                            readonly property string caption: hidden ? "···" : modelData
                            readonly property string description: hidden
                                                                  ? "Nothing about this one is written down. Find it." :
                                                                    Profile.medalDescription(modelData)
                            radius: 4
                            height: 26
                            width: label.width + 22
                            color: medal.won ? root.theme.raised : "transparent"
                            border.width: 1
                            border.color: medal.won || medalHover.hovered ? root.theme.accent : root.theme.border
                            opacity: medal.won || medalHover.hovered ? 1 : 0.4
                            Accessible.role: Accessible.StaticText
                            Accessible.name: medal.hidden ? "An undiscovered secret medal." : modelData + (won
                                                                                                           ? ". Earned." :
                                                                                                             ". Not yet earned.")
                            Accessible.description: description
                            Text {
                                id: label
                                anchors.centerIn: parent
                                text: medal.caption
                                font.family: "monospace"
                                font.pixelSize: 11
                                color: medal.won ? root.theme.accent : root.theme.muted
                            }
                            HoverHandler {
                                id: medalHover
                                cursorShape: Qt.WhatsThisCursor
                            }
                            Controls.ToolTip {
                                id: medalTip
                                visible: medal.visible && medalHover.hovered
                                delay: 250
                                timeout: -1
                                width: 330
                                // Popups live in the window overlay, outside the scaled game stage.
                                scale: root.parent ? root.parent.scale : 1
                                transformOrigin: Item.TopLeft
                                x: (medal.width - width) / 2
                                y: -height - 8
                                padding: 16
                                margins: 12
                                text: medal.description
                                contentItem: Column {
                                    spacing: 8
                                    Text {
                                        width: parent.width
                                        text: medal.won ? "★  EARNED" : medal.hidden ? "·  UNDISCOVERED" :
                                                                                       "☆  NOT YET EARNED"
                                        font.family: "monospace"
                                        font.pixelSize: 10
                                        font.letterSpacing: 1.2
                                        color: medal.won ? root.theme.accent : root.theme.muted
                                    }
                                    Text {
                                        width: parent.width
                                        text: medal.caption
                                        font.family: "monospace"
                                        font.pixelSize: 14
                                        font.bold: true
                                        wrapMode: Text.WordWrap
                                        color: root.theme.foreground
                                    }
                                    Text {
                                        width: parent.width
                                        text: medalTip.text
                                        font.family: "monospace"
                                        font.pixelSize: 12
                                        wrapMode: Text.WordWrap
                                        lineHeight: 1.3
                                        color: root.theme.foreground
                                    }
                                }
                                background: Rectangle {
                                    radius: 6
                                    color: root.theme.raised
                                    border.width: 1
                                    border.color: root.theme.strongBorder
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    OperationsPage {
        anchors.fill: parent
        view: root.view
        theme: root.theme
        visible: root.page === "operations"
    }
    DailyPage {
        anchors.fill: parent
        view: root.view
        theme: root.theme
        visible: root.page === "daily"
    }
}
