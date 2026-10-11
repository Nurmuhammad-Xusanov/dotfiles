pragma ComponentBehavior: Bound
import QtQuick
import "Palette.js" as Palette

Column {
    id: root
    property var theme: Palette.create()
    property var intel: []
    width: 246
    spacing: 5
    Text {
        text: "ENEMY INTENT"
        color: root.theme.muted
        font.family: "monospace"
        font.pixelSize: 10
        bottomPadding: 4
    }
    Repeater {
        model: root.intel
        Rectangle {
            id: entry
            required property var modelData
            width: root.width
            height: 44
            radius: 4
            color: root.theme.surface
            border.color: modelData.urgent ? root.theme.hostile : root.theme.border
            MouseArea {
                anchors.fill: parent
                hoverEnabled: true
            }
            Text {
                x: 10
                y: 6
                text: entry.modelData.id + "  " + entry.modelData.name
                font.family: "monospace"
                font.pixelSize: 11
                font.bold: true
                color: entry.modelData.urgent ? root.theme.hostile : root.theme.foreground
            }
            Text {
                anchors.right: parent.right
                anchors.rightMargin: 10
                y: 6
                text: "◆".repeat(entry.modelData.hp) + "◇".repeat(entry.modelData.maxHp - entry.modelData.hp)
                color: root.theme.accent
                font.pixelSize: 10
            }
            Text {
                x: 10
                y: 25
                text: entry.modelData.unstable ? "UNSTABLE · " + entry.modelData.intent : entry.modelData.intent
                font.family: "monospace"
                font.pixelSize: 9
                color: root.theme.muted
            }
        }
    }
}
