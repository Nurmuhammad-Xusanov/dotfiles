pragma ComponentBehavior: Bound
import QtQuick
import "Palette.js" as Palette
import "Challenges.js" as Challenges

Item {
    id: root
    property var theme: Palette.create()
    property var view: null
    property string copied: ""
    function recentCodes() {
        if (!view)
            return [];
        var seen = {}, out = [];
        Object.keys(view.profile.daily).sort().reverse().forEach(function (key) {
            var code = key.split(":")[0];
            if (!seen[code]) {
                seen[code] = true;
                out.push(code);
            }
        });
        return out.slice(0, 5);
    }
    TextEdit {
        id: clipboard
        visible: false
    }
    Column {
        id: body
        width: 780
        anchors.centerIn: parent
        spacing: 20
        Text {
            text: "THE DAILY BATTERY"
            font.family: "monospace"
            font.pixelSize: 32
            font.bold: true
            font.letterSpacing: 3
            color: root.theme.accent
        }
        Text {
            width: parent.width
            text: "One battlefield for everyone, every UTC day. The challenge code fixes the ground, enemy force, weather seed, and ammunition. Watch the gusts and choose your moment."
            wrapMode: Text.WordWrap
            font.pixelSize: 15
            lineHeight: 1.3
            color: root.theme.foreground
        }
        Text {
            text: "ISSUED RACK    HE ×6    CLUSTER ×2    DIGGER ×2    ROLLER ×2"
            font.family: "monospace"
            font.pixelSize: 13
            color: root.theme.muted
        }
        Rectangle {
            width: parent.width
            height: 56
            radius: 5
            color: root.theme.raised
            border.color: challengeInput.activeFocus ? root.theme.accent : root.theme.border
            TextInput {
                id: challengeInput
                objectName: "challengeInput"
                anchors.fill: parent
                anchors.margins: 15
                text: root.view ? root.view.dailyChallenge.code : ""
                color: root.theme.foreground
                selectionColor: root.theme.accent
                selectedTextColor: root.theme.onAccent
                font.family: "monospace"
                font.pixelSize: 20
                selectByMouse: true
                maximumLength: 24
                Accessible.name: "Daily challenge code"
                onTextEdited: {
                    var challenge = Challenges.parse(text);
                    if (challenge)
                        root.view.dailyChallenge = challenge;
                    root.copied = "";
                }
                onAccepted: root.view.startDaily(text)
                Keys.onPressed: function (event) {
                    if (event.key === Qt.Key_Escape || event.key === Qt.Key_Tab) {
                        root.view.resetFocus();
                        event.accepted = true;
                    }
                }
            }
        }
        Row {
            spacing: 12
            GunButton {
                width: 248
                theme: root.theme
                primary: true
                text: "PLAY CHALLENGE  ⏎"
                onClicked: root.view.startDaily(challengeInput.text)
            }
            GunButton {
                width: 160
                theme: root.theme
                text: "EDIT CODE"
                onClicked: {
                    challengeInput.forceActiveFocus();
                    challengeInput.selectAll();
                }
            }
            GunButton {
                width: 160
                theme: root.theme
                text: "COPY CODE"
                onClicked: {
                    clipboard.text = challengeInput.text.trim().toUpperCase();
                    clipboard.selectAll();
                    clipboard.copy();
                    clipboard.deselect();
                    root.copied = "CODE COPIED";
                }
            }
            GunButton {
                width: 120
                theme: root.theme
                text: "TODAY"
                onClicked: {
                    root.view.openDaily();
                    challengeInput.text = Challenges.today().code;
                    root.copied = "";
                }
            }
        }
        Text {
            width: parent.width
            text: root.view && root.view.dailyMessage ? root.view.dailyMessage : root.copied
                                                        || "Paste a friend’s BAT1-YYYYMMDD code to play the same challenge."

            wrapMode: Text.WordWrap
            font.pixelSize: 12
            color: root.view && root.view.dailyMessage ? root.theme.urgent : root.theme.muted
        }
        Text {
            width: parent.width
            text: root.view ? root.view.dailyBest : ""
            wrapMode: Text.WordWrap
            font.family: "monospace"
            font.pixelSize: 12
            color: root.theme.accent
        }
        Text {
            width: parent.width
            wrapMode: Text.WordWrap
            // Earned the campaign outright? Then you are the sort of player who
            // will try codes that are not dates. This is the only nudge the
            // game gives; what the codes are is not written down anywhere it
            // can be read by accident.
            text: root.view && root.view.profile.medals.indexOf("Full Battery") >= 0 ? "Personal bests are kept locally. Using aim assist records an assisted result.   ·   Not every code that answers is a date. The range notes in the field manual are worth a second read." :
                                                                                       "Personal bests are kept locally. Using aim assist records an assisted result."
            color: root.theme.muted
            font.pixelSize: 12
        }
        Flow {
            width: parent.width
            spacing: 8
            Repeater {
                model: root.recentCodes()
                GunButton {
                    required property string modelData
                    width: 190
                    height: 32
                    text: modelData
                    theme: root.theme
                    onClicked: {
                        challengeInput.text = modelData;
                        root.view.dailyChallenge = Challenges.parse(modelData);
                    }
                }
            }
        }
    }
}
