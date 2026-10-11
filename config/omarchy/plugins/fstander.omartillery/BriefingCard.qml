pragma ComponentBehavior: Bound
import QtQuick
import "Palette.js" as Palette
import "Physics.js" as Physics

Rectangle {
    id: root
    property var theme: Palette.create()
    property var view: null
    width: 748
    height: body.height + 56
    radius: 10
    color: theme.surface
    border.color: theme.accent
    function lessons() {
        if (!view || !view.world)
            return [];
        var out = [], seen = {};
        for (var i = 0; i < view.targetIntel.length; i++) {
            var enemy = view.targetIntel[i];
            if (enemy.name === "GUN" || seen[enemy.name])
                continue;
            seen[enemy.name] = true;
            out.push(enemy.name + " · " + enemy.hint);
        }
        for (var k = 1; k < Physics.WEAPON_ORDER.length; k++) {
            var kind = Physics.WEAPON_ORDER[k];
            if (view.rack[kind] > 0)
                out.push(Physics.weapon(kind).name + " · " + Physics.weapon(kind).caption);
        }
        if (view.world.props.length)
            out.push("MAGAZINES · Hit an ammo depot to set off a wide explosion. Nearby depots and supply trucks can chain together.");
        return out;
    }
    Column {
        id: body
        x: 28
        y: 28
        width: parent.width - 56
        spacing: 13
        Text {
            text: "MISSION BRIEF  /  " + (root.view && root.view.world ? root.view.world.biome.toUpperCase() : "")
            color: root.theme.accent
            font.family: "monospace"
            font.pixelSize: 11
            font.letterSpacing: 2
        }
        Text {
            text: root.view && root.view.world ? root.view.world.name : ""
            color: root.theme.foreground
            font.pixelSize: 26
            font.bold: true
        }
        Text {
            width: parent.width
            text: root.view && root.view.world ? root.view.world.brief : ""
            wrapMode: Text.WordWrap
            font.pixelSize: 14
            lineHeight: 1.25
            color: root.theme.foreground
        }
        Rectangle {
            width: parent.width
            height: 1
            color: root.theme.border
        }
        Repeater {
            model: root.lessons()
            Text {
                required property string modelData
                width: body.width
                text: modelData
                wrapMode: Text.WordWrap
                font.pixelSize: 12
                lineHeight: 1.2
                color: root.theme.muted
            }
        }
        Text {
            width: parent.width
            text: root.view && root.view.levelIndex === 0 && root.view.gameMode === "campaign" ? "YOUR FIRST SHOT\n↑ / ↓ set elevation. ← / → set power. Space fires. Read SHORT or OVER, then adjust power while keeping your angle. Hold Shift for fine control. Your last three shots stay in the notebook." :
                                                                                                 "↑ / ↓ ANGLE   ← / → POWER   SHIFT FINE   1–4 SHELL   SPACE FIRE\nB notebook · [ and ] step back and forward through your last three shots · C recall its dials · G still-air preview"

            wrapMode: Text.WordWrap
            color: root.theme.foreground
            font.pixelSize: 12
            lineHeight: 1.3
        }
        GunButton {
            width: parent.width
            theme: root.theme
            primary: true
            text: "TAKE AIM  ⏎"
            onClicked: root.view.beginAiming()
        }
    }
}
