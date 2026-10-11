pragma ComponentBehavior: Bound
import QtQuick
import "Palette.js" as Palette
import "Physics.js" as Physics

// The fire-control strip under the field. Text is real QML text rather than
// canvas drawing, so it stays crisp at every scale and is readable to
// assistive tooling.
Item {
    id: root
    property var theme: Palette.create()
    property real angle: 45
    property real power: 60
    property real wind: 0
    property real windLimit: 0
    property bool gusty: false
    property int shotsLeft: 0
    property int shotsTotal: 0
    property int targetsLeft: 0
    property int targetsTotal: 0
    property int gunHp: 3
    property int gunMaxHp: 3
    property bool underFire: false
    property var rack: ({})
    property string weapon: "he"
    property bool mouseControl: true
    property bool sound: true
    // The windsock is the instrument. Without it the wind still blows, but
    // there is nothing on the field to read it off.
    property bool windReadable: true
    signal weaponPicked(string kind)

    readonly property color lowAmmo: shotsLeft <= 1 ? theme.urgent : theme.foreground
    // Wind is shown in fifths of a px/s: a readable 0–60 scale rather than
    // three-digit air speeds.
    readonly property int windShown: Math.round(Math.abs(wind) / 5)

    Rectangle {
        anchors.fill: parent
        color: root.theme.surface
        Rectangle {
            width: parent.width
            height: 1
            color: root.theme.border
        }
    }

    Row {
        x: 28
        y: 8
        spacing: 22
        Gauge {
            theme: root.theme
            width: 118
            caption: "ANGLE"
            value: root.angle.toFixed(1) + "°"
            fraction: root.angle / 180
            ink: root.theme.foreground
        }
        Gauge {
            theme: root.theme
            width: 104
            caption: "POWER"
            value: root.power.toFixed(0)
            fraction: (root.power - Physics.MIN_POWER) / (Physics.MAX_POWER - Physics.MIN_POWER)
            ink: root.theme.accent
        }
        Gauge {
            theme: root.theme
            width: 132
            caption: !root.windReadable ? "WIND · NO SOCK" : root.gusty ? "WIND · GUSTING" : "WIND"
            value: !root.windReadable ? "···" : root.windShown === 0 ? "CALM" : (root.wind < 0 ? "◀ " : "▶ ")
                                                                       + root.windShown
            fraction: !root.windReadable || root.windLimit <= 0 ? -1 : Math.abs(root.wind) / root.windLimit
            ink: !root.windReadable ? root.theme.muted : Math.abs(root.wind) >= 170 ? root.theme.warning :
                                                                                      root.theme.foreground
        }
        Gauge {
            theme: root.theme
            width: 96
            caption: "SHELLS"
            value: root.shotsLeft + "/" + root.shotsTotal
            fraction: root.shotsTotal > 0 ? root.shotsLeft / root.shotsTotal : -1
            ink: root.lowAmmo
        }
        Gauge {
            theme: root.theme
            width: 96
            caption: "TARGETS"
            value: (root.targetsTotal - root.targetsLeft) + "/" + root.targetsTotal
            fraction: root.targetsTotal > 0 ? (root.targetsTotal - root.targetsLeft) / root.targetsTotal : -1
            ink: root.theme.accent
        }
        Gauge {
            theme: root.theme
            width: 96
            caption: "GUN"
            value: {
                var out = "";
                for (var i = 0; i < root.gunMaxHp; i++)
                    out += i < root.gunHp ? "◆" : "◇";
                return root.underFire ? out : "SAFE";
            }
            fraction: root.underFire ? root.gunHp / root.gunMaxHp : -1
            ink: root.gunHp <= 1 && root.underFire ? root.theme.urgent : root.theme.foreground
        }
    }

    // The rack. Each chip is one shell type: its key, its name, and how many
    // rounds are left. The selected one is what the next press of FIRE sends.
    Row {
        id: rackRow
        x: 28
        y: 74
        spacing: 8
        Repeater {
            model: Physics.WEAPON_ORDER
            Rectangle {
                id: chip
                required property int index
                required property string modelData
                readonly property bool stocked: root.rack.hasOwnProperty(modelData)
                readonly property int count: stocked ? root.rack[modelData] : 0
                readonly property bool selected: root.weapon === modelData
                visible: stocked
                width: 150
                height: 30
                radius: 4
                color: selected ? root.theme.hover : root.theme.raised
                border.width: 1
                border.color: selected ? root.theme.accent : root.theme.border
                opacity: count > 0 ? 1 : 0.38
                Text {
                    x: 10
                    anchors.verticalCenter: parent.verticalCenter
                    text: String(chip.index + 1)
                    font.family: "monospace"
                    font.pixelSize: 11
                    color: chip.selected ? root.theme.accent : root.theme.muted
                }
                Text {
                    x: 26
                    anchors.verticalCenter: parent.verticalCenter
                    text: Physics.weapon(chip.modelData).name
                    font.family: "monospace"
                    font.pixelSize: 12
                    font.bold: true
                    color: chip.selected ? root.theme.buttonText : root.theme.foreground
                }
                Text {
                    anchors.right: parent.right
                    anchors.rightMargin: 10
                    anchors.verticalCenter: parent.verticalCenter
                    text: "×" + chip.count
                    font.family: "monospace"
                    font.pixelSize: 12
                    color: chip.count > 0 ? root.theme.accent : root.theme.muted
                }
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.weaponPicked(chip.modelData)
                }
            }
        }
    }

    Text {
        x: 682
        y: 74
        width: root.width - x - 24
        height: 34
        text: Physics.weapon(root.weapon).name + " · " + Physics.weapon(root.weapon).caption
        wrapMode: Text.WordWrap
        color: root.theme.foreground
        font.pixelSize: 11
    }

    Text {
        x: 28
        y: root.height - 16
        width: root.width - 56
        elide: Text.ElideRight
        text: "↑/↓ ANGLE   ←/→ POWER   SHIFT FINE   1-4/TAB SHELL   SPACE FIRE   " + (root.mouseControl
                                                                                      ? "MOUSE AIM · WHEEL POWER · CLICK FIRE   " :
                                                                                        "") + "T TRACER   G ASSIST   M SOUND"
              + (root.sound ? "" : " OFF") + "   R RESTART   P PAUSE   ESC BACK"
        font.family: "monospace"
        font.pixelSize: 10
        font.letterSpacing: 0.6
        color: root.theme.muted
    }
}
