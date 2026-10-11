import QtQuick
import qs.Ui

// Hidden bar-slot host for the Omartillery game panel.
//
// The panel kind is routed through the bar widget (the shell's
// isBarWidgetPanelPlugin path), so this widget must expose the standard
// open/close/opened shape for shell.summon/toggle to reach the game. The bar
// slot is kept alive but rendered at zero width:
//   - the plugin's own shell.json entry stays in the layout, which is where
//     gunnery records are persisted (see Panel.qml loadRecords/flush), and
//   - quick menus can toggle the game with `omarchy-shell shell toggle
//     fstander.omartillery '{}'`.
BarWidget {
    id: root
    moduleName: "fstander.omartillery"
    // The host injects a Bar object; the base widget types it only as QtObject.
    readonly property var host: bar

    implicitWidth: 0
    implicitHeight: 0

    readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false

    function open() {
        if (root.opened) return
        root.openPanel()
    }

    function close() {
        if (!root.opened) return
        if (panelLoader.item && panelLoader.item.close) panelLoader.item.close()
    }

    function closeForPopoutSwitch() {
        root.close()
    }

    function togglePanel() {
        if (root.opened) root.close()
        else root.openPanel()
    }

    function openPanel() {
        if (panelLoader.item && panelLoader.item.open) {
            panelLoader.item.open("")
            return
        }
        // Panel not instantiated yet; open once the loader reports ready.
        root.pendingOpen = true
    }

    property bool pendingOpen: false

    Loader {
        id: panelLoader
        active: true
        source: Qt.resolvedUrl("Panel.qml")
        visible: false
        onLoaded: {
            var t = panelLoader.item
            if (!t) return
            // The game panel reads barConfig / updateEntryInline off the shell
            // facade; hand it the plugin-scoped api already provided by the host.
            if ("shell" in t) t.shell = root.host ? root.host.shell : null
            Qt.callLater(function() {
                if (!panelLoader.item) return
                if (panelLoader.item.loadRecords) panelLoader.item.loadRecords()
                if (root.pendingOpen) {
                    root.pendingOpen = false
                    root.openPanel()
                }
            })
        }
    }

    WidgetButton {
        id: button
        visible: false
        anchors.fill: parent
        bar: root.bar
        text: "◥"
        tooltipText: "Omartillery · angle, power, fire"
        onPressed: function (code) {
            if (code === Qt.LeftButton) root.togglePanel()
        }
    }
}