import QtQuick
import "Palette.js" as Palette

Rectangle {
    id: root
    property string text: ""
    property string subtitle: ""
    property bool wrapSubtitle: false
    property string trailingText: ""
    property bool primary: false
    property bool selected: false
    // Keyboard navigation walks every visible, enabled GunButton on the stage.
    // `navigable: false` keeps a button mouse-only — the header's, which have
    // keys of their own. Focus lands on the primary button of each screen.
    readonly property bool isGunButton: true
    property bool navigable: true
    property real horizontalPadding: width < 140 ? 10 : 16
    property var theme: Palette.create()
    signal clicked

    implicitWidth: 180
    implicitHeight: subtitle ? 62 : 40
    radius: 5
    color: primary ? (mouse.containsMouse ? theme.accentHover : theme.accent) : (mouse.containsMouse || selected
                                                                                 ? theme.hover : theme.raised)
    border.width: 1
    border.color: primary || selected ? theme.accent : (mouse.containsMouse ? theme.strongBorder : theme.border)
    opacity: enabled ? 1 : 0.38
    Accessible.role: Accessible.Button
    Accessible.focusable: enabled && navigable
    Accessible.name: text + (subtitle ? ". " + subtitle : "")
    Accessible.onPressAction: if (enabled)
                                  clicked()

    // The focus ring: drawn outside the border so the button's own colours
    // (primary, selected) stay readable underneath it.
    Rectangle {
        anchors.fill: parent
        anchors.margins: -4
        radius: root.radius + 3
        color: "transparent"
        border.width: 2
        border.color: root.theme.accent
        visible: root.activeFocus && root.navigable
    }

    Column {
        id: labels
        anchors.verticalCenter: parent.verticalCenter
        x: root.horizontalPadding
        width: root.width - root.horizontalPadding * 2 - (root.trailingText ? 30 : 0)
        spacing: 5
        Text {
            objectName: "buttonLabel"
            width: parent.width
            elide: Text.ElideRight
            text: root.text
            color: root.primary ? root.theme.onAccent : root.theme.buttonText
            font.family: "monospace"
            font.pixelSize: 12
            font.bold: true
        }
        Text {
            width: parent.width
            elide: root.wrapSubtitle ? Text.ElideNone : Text.ElideRight
            wrapMode: root.wrapSubtitle ? Text.WordWrap : Text.NoWrap
            visible: !!root.subtitle
            text: root.subtitle
            color: root.primary ? root.theme.onAccent : root.theme.buttonMuted
            font.family: "monospace"
            font.pixelSize: 10
        }
    }
    Text {
        y: labels.y
        anchors.right: parent.right
        anchors.rightMargin: root.horizontalPadding
        text: root.trailingText
        font.family: "monospace"
        font.pixelSize: 12
        color: root.primary ? root.theme.onAccent : root.theme.accent
    }
    MouseArea {
        id: mouse
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.clicked()
    }
}
