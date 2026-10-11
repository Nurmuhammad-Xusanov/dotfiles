import QtQuick

// Collapsible quick-settings group for the bar.
//
// Shows a single chevron; hovering it slides the whole group out of the edge
// as one unit. Right-to-left reveal order is the list order below reversed, so
// the system panels sit next to the chevron and come out first, then the
// third-party widgets, then the tray apps.
//
// Add or remove widgets by editing the two lists below. An id hosted here must
// NOT also sit in the shell.json bar layout (that would double the widget and
// collide on its IPC target).
Item {
  id: root

  property var bar
  property string moduleName
  property var settings

  // Left-to-right in the opened menu. The last entry ends up beside the
  // chevron and is revealed first.
  readonly property var widgetIds: [
    "omarchy.tray",
    "omarchy.agents",
    "io.github.saiaungminkhant.nothing-buds",
    "omarchy.bluetooth",
    "omarchy.audio",
    "omarchy.monitor",
    "omarchy.network",
    "omarchy.power"
  ]
  readonly property var widgetSources: [
    "/usr/share/omarchy/shell/plugins/bar/widgets/Tray.qml",
    "/usr/share/omarchy/shell/plugins/agents/Panel.qml",
    "/home/nismo/.config/omarchy/plugins/io.github.saiaungminkhant.nothing-buds/BarWidget.qml",
    "/usr/share/omarchy/shell/plugins/panels/bluetooth/Panel.qml",
    "/usr/share/omarchy/shell/plugins/panels/audio/Panel.qml",
    "/usr/share/omarchy/shell/plugins/panels/monitor/Panel.qml",
    "/usr/share/omarchy/shell/plugins/panels/network/Panel.qml",
    "/usr/share/omarchy/shell/plugins/panels/power/Panel.qml"
  ]

  property bool revealed: false
  readonly property bool barReady: bar !== null && bar !== undefined

  // 0 = collapsed, 1 = fully open. Animated so the group slides out smoothly.
  property real revealProgress: revealed ? 1 : 0
  Behavior on revealProgress {
    NumberAnimation { duration: 220; easing.type: Easing.OutCubic }
  }

  readonly property int barSize: bar ? bar.barSize : 26
  readonly property color fgc: bar ? bar.foreground : "white"
  readonly property string family: bar ? bar.fontFamily : "monospace"

  implicitHeight: barSize
  implicitWidth: chevron.width + strip.implicitWidth * root.revealProgress

  // Recursively find the tray's own expand chevron (\uf053) so it can be
  // removed - the whole group is the expander, so the tray must not draw a
  // second arrow inside the opened menu.
  function neutraliseTrayChevron(obj) {
    var kids = obj.children || []
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i]
      if (c && c.text === "\uf053") {
        c.text = ""
        c.visible = false
        c.width = 0
        c.implicitWidth = 0
        return true
      }
      if (c && neutraliseTrayChevron(c)) return true
    }
    if (obj.item && neutraliseTrayChevron(obj.item)) return true
    return false
  }

  // The strip keeps its full width and is revealed by the clipping mask, so the
  // icons slide out from beside the chevron instead of snapping in place.
  Item {
    id: mask
    anchors.right: chevron.left
    anchors.verticalCenter: parent.verticalCenter
    height: parent.height
    width: strip.implicitWidth * root.revealProgress
    clip: true

    Row {
      id: strip
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      height: parent.height
      spacing: 0

      Repeater {
        model: root.widgetSources.length

        Item {
          id: host
          required property int index
          height: strip.height
          width: (widget && widget.visible) ? widget.implicitWidth : 0
          property var widget: null

          function build() {
            if (widget || !root.barReady) return
            var comp = Qt.createComponent(root.widgetSources[index])
            if (comp.status !== Component.Ready) {
              console.warn("nismo.quick: cannot load", root.widgetSources[index])
              return
            }
            var obj = comp.createObject(host, {
              bar: root.bar,
              moduleName: root.widgetIds[index],
              settings: ({})
            })
            if (!obj) return
            obj.anchors.fill = host
            if (root.widgetIds[index] === "omarchy.tray") {
              // Fold the tray's apps into this single hover menu: keep the
              // drawer permanently open and neutralise its own hover toggle so
              // there is no second, nested expand, and drop its inner chevron.
              try {
                obj.expanded = true
                obj.expandedChanged.connect(function() { if (!obj.expanded) obj.expanded = true })
                Qt.callLater(function() { root.neutraliseTrayChevron(obj) })
              } catch (e) {}
            }
            widget = obj
          }

          Component.onCompleted: build()

          Connections {
            target: root
            function onBarChanged() { host.build() }
          }
        }
      }
    }
  }

  Text {
    id: chevron
    anchors.right: parent.right
    anchors.verticalCenter: parent.verticalCenter
    width: 14
    horizontalAlignment: Text.AlignHCenter
    text: root.revealed ? "\u203a" : "\u2039"
    color: root.fgc
    font.family: root.family
    font.pixelSize: 13
  }

  HoverHandler {
    id: hover
    onHoveredChanged: root.revealed = hovered
  }
}
