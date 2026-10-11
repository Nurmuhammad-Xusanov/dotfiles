pragma ComponentBehavior: Bound
import QtQuick
import "Palette.js" as Palette

Rectangle {
    id: root
    property var theme: Palette.create()
    property var view: null
    width: 346
    height: body.height + 24
    radius: 6
    color: theme.surface
    border.color: theme.border
    MouseArea {
        anchors.fill: parent
        hoverEnabled: true
        onClicked: if (root.view)
                       root.view.forceActiveFocus()
    }
    Column {
        id: body
        x: 12
        y: 12
        width: parent.width - 24
        spacing: 8
        Text {
            text: "GUNNER’S NOTEBOOK                    B HIDE"
            color: root.theme.muted
            font.family: "monospace"
            font.pixelSize: 10
        }
        Text {
            visible: !root.view || root.view.shotHistory.length === 0
            width: parent.width
            text: "Fire a ranging shot. Its settings and landing will appear here. Change one dial at a time to walk onto the target."
            wrapMode: Text.WordWrap
            color: root.theme.foreground
            font.pixelSize: 12
            lineHeight: 1.3
        }
        Repeater {
            model: root.view ? root.view.shotHistory : []
            GunButton {
                required property var modelData
                required property int index
                width: body.width
                height: 48
                theme: root.theme
                navigable: false
                selected: root.view.historySelection === index
                text: "#" + modelData.number + "  " + modelData.weapon.toUpperCase() + "  " + modelData.angle.toFixed(
                          1) + "°  P" + modelData.power.toFixed(1)
                subtitle: "WIND " + (modelData.wind === null ? "···" : (modelData.wind < 0 ? "◀" : "▶") + Math.round(
                                                                   Math.abs(modelData.wind) / 5)) + "  LAND " + (
                              modelData.landing === null ? "LOST" : modelData.landing) + "  KILLS " + modelData.kills
                onClicked: {
                    root.view.selectHistory(index);
                    root.view.forceActiveFocus();
                }
            }
        }
        GunButton {
            visible: !!root.view && root.view.shotHistory.length > 0
            width: parent.width
            height: 28
            text: "C RECALL DIALS    [ OLDER    ] NEWER"
            theme: root.theme
            navigable: false
            enabled: !!root.view && root.view.status === "aiming"
            onClicked: root.view.recallShot()
        }
    }
}
