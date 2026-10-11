import QtQuick
import "Palette.js" as Palette

Item {
    id: root
    property var theme: Palette.create()
    property string title: ""
    property string detail: ""
    // Home has nowhere to go back to, and the cross beside it already closes
    // the window, so the arrow is hidden rather than duplicated.
    property bool canGoBack: true
    signal backRequested
    signal fullscreenRequested
    signal closeRequested

    height: 72

    Text {
        x: 28
        anchors.verticalCenter: parent.verticalCenter
        text: root.title
        font.family: "monospace"
        font.pixelSize: 17
        font.bold: true
        font.letterSpacing: 1.5
        color: root.theme.foreground
    }
    Text {
        anchors.centerIn: parent
        text: root.detail
        font.family: "monospace"
        font.pixelSize: 14
        color: root.theme.accent
        Accessible.role: Accessible.StaticText
        Accessible.name: root.detail
    }
    Row {
        anchors.right: parent.right
        anchors.rightMargin: 24
        anchors.verticalCenter: parent.verticalCenter
        spacing: 8
        GunButton {
            theme: root.theme
            width: 78
            height: 30
            text: "← BACK"
            horizontalPadding: 10
            navigable: false
            visible: root.canGoBack
            onClicked: root.backRequested()
        }
        GunButton {
            theme: root.theme
            width: 60
            height: 30
            text: "FULL"
            horizontalPadding: 10
            navigable: false
            onClicked: root.fullscreenRequested()
        }
        // Close is a drawn cross, not a glyph: the monospace face renders ✕
        // small and off-centre, and a square button suits the icon.
        GunButton {
            id: closeButton
            theme: root.theme
            width: 30
            height: 30
            navigable: false
            Accessible.name: "Close"
            onClicked: root.closeRequested()
            Item {
                anchors.centerIn: parent
                width: 12
                height: 12
                Rectangle {
                    anchors.centerIn: parent
                    width: 14
                    height: 1.6
                    radius: 1
                    rotation: 45
                    color: closeButton.theme.buttonText
                }
                Rectangle {
                    anchors.centerIn: parent
                    width: 14
                    height: 1.6
                    radius: 1
                    rotation: -45
                    color: closeButton.theme.buttonText
                }
            }
        }
    }
    Rectangle {
        y: parent.height - 1
        width: parent.width
        height: 1
        color: root.theme.border
    }
}
