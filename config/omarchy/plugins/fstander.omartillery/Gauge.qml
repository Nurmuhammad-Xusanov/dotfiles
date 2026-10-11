import QtQuick
import "Palette.js" as Palette

// One labelled readout in the fire-control strip: a caption, a big value, and
// an optional fill bar showing where the value sits in its range.
Item {
    id: root
    property var theme: Palette.create()
    property string caption: ""
    property string value: ""
    property real fraction: -1 // negative hides the bar
    property color ink: theme.foreground
    implicitWidth: 150
    implicitHeight: 62

    Text {
        id: captionText
        text: root.caption
        font.family: "monospace"
        font.pixelSize: 10
        font.letterSpacing: 1.4
        color: root.theme.muted
    }
    Text {
        y: captionText.height + 4
        text: root.value
        font.family: "monospace"
        font.pixelSize: 22
        font.bold: true
        color: root.ink
        Accessible.role: Accessible.StaticText
        Accessible.name: root.caption + " " + root.value
    }
    Rectangle {
        visible: root.fraction >= 0
        y: root.height - 6
        width: root.width - 16
        height: 4
        radius: 2
        color: root.theme.raised
        border.width: 1
        border.color: root.theme.border
        Rectangle {
            width: Math.max(0, Math.min(1, root.fraction)) * (parent.width - 2)
            height: parent.height - 2
            x: 1
            y: 1
            radius: 1
            color: root.ink
        }
    }
}
