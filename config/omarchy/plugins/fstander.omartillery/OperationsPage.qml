pragma ComponentBehavior: Bound
import QtQuick
import "Palette.js" as Palette
import "Operations.js" as Operations

Item {
    id: root
    property var theme: Palette.create()
    property var view: null
    readonly property var run: view ? view.operation : null
    readonly property string operationState: run ? run.state : "new"
    Column {
        id: body
        anchors.centerIn: parent
        width: 920
        spacing: 18
        Text {
            text: "FIELD OPERATIONS"
            color: root.theme.accent
            font.family: "monospace"
            font.pixelSize: 28
            font.bold: true
            font.letterSpacing: 3
        }
        Text {
            width: parent.width
            text: root.operationState === "new"
                  ? "Four battles. One gun. Choose your route, carry your ammunition, and spend supplies between engagements." :
                    root.operationState === "complete"
                    ? "OPERATION COMPLETE · Your gun made it through all four battles." : root.operationState
                      === "failed" ? "OPERATION LOST · A new operation starts with a fresh gun and ammunition rack." :
                                     root.operationState === "supply"
                                     ? "FIELD SUPPLY · Repair, rearm, or upgrade before choosing the next route." :
                                       root.operationState === "battle"
                                       ? "BATTLE IN PROGRESS · Resume from the loadout saved at the start of this battle." :
                                         "BATTLE " + (root.run.stage + 1) + " / " + Operations.LENGTH
                                         + " · CHOOSE YOUR APPROACH"

            wrapMode: Text.WordWrap
            font.pixelSize: 15
            color: root.theme.foreground
        }
        Rectangle {
            visible: !!root.run
            width: parent.width
            height: 70
            radius: 6
            color: root.theme.raised
            Text {
                x: 18
                y: 12
                text: root.run ? "GUN " + root.run.hp + "/" + root.run.maxHp + "     SUPPLY " + root.run.credits
                                 + "     SCORE " + root.run.score + (root.run.payload ? "     HE PAYLOAD +8" : "") : ""
                font.family: "monospace"
                font.pixelSize: 14
                color: root.theme.accent
            }
            Text {
                x: 18
                y: 40
                text: root.run ? "HE ×" + root.run.rack.he + "     CLUSTER ×" + root.run.rack.cluster + "     DIGGER ×"
                                 + root.run.rack.digger + "     ROLLER ×" + root.run.rack.roller : ""
                font.family: "monospace"
                font.pixelSize: 12
                color: root.theme.foreground
            }
        }
        Row {
            spacing: 16
            visible: root.operationState === "route"
            Repeater {
                model: root.run ? Operations.routes(root.run) : []
                GunButton {
                    required property var modelData
                    width: 452
                    height: 116
                    theme: root.theme
                    text: modelData.name
                    subtitle: modelData.hint
                    wrapSubtitle: true
                    onClicked: root.view.chooseRoute(modelData.id)
                }
            }
        }
        Grid {
            columns: 2
            rowSpacing: 10
            columnSpacing: 16
            visible: root.operationState === "supply"
            Repeater {
                model: Operations.ITEMS
                GunButton {
                    required property var modelData
                    width: 452
                    height: 66
                    theme: root.theme
                    text: modelData.name + " · " + modelData.cost + " SUPPLY"
                    subtitle: modelData.hint
                    enabled: !!root.run && Operations.available(root.run, modelData)
                    onClicked: root.view.buySupply(modelData.id)
                }
            }
        }
        Text {
            visible: root.operationState === "new"
            width: parent.width
            text: "Start with 3 health, 16 HE, 4 clusters, 3 diggers, 3 rollers and 2 supply. Depot routes earn more supplies; ridge routes face fewer enemies in stronger wind. Your current battle’s starting loadout is saved automatically."
            wrapMode: Text.WordWrap
            color: root.theme.muted
            font.pixelSize: 14
            lineHeight: 1.4
        }
        Row {
            spacing: 12
            GunButton {
                width: 300
                theme: root.theme
                primary: true
                visible: root.operationState !== "route"
                enabled: root.operationState !== "supply" || (root.run.rack.he + root.run.rack.cluster
                                                              + root.run.rack.digger + root.run.rack.roller > 0)
                text: root.operationState === "battle" ? "RESUME BATTLE  ⏎" : root.operationState === "supply"
                                                         ? "CHOOSE NEXT ROUTE  ⏎" : "START OPERATION  ⏎"
                onClicked: {
                    if (root.operationState === "battle")
                        root.view.resumeOperation();
                    else if (root.operationState === "supply")
                        root.view.departOperation();
                    else
                        root.view.newOperation();
                }
            }
            GunButton {
                visible: root.operationState === "battle" || root.operationState === "route" || root.operationState
                         === "supply"
                width: 220
                theme: root.theme
                text: "START A NEW OPERATION"
                onClicked: root.view.newOperation()
            }
            GunButton {
                width: 150
                theme: root.theme
                text: "MENU  ESC"
                onClicked: root.view.home()
            }
        }
        Text {
            text: "OPERATIONS WON " + (root.view ? root.view.profile.operationsCompleted : 0) + "   ·   BEST " + (
                      root.view ? root.view.profile.bestOperation : 0)
            font.family: "monospace"
            font.pixelSize: 11
            color: root.theme.muted
        }
    }
}
