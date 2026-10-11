import QtQuick
import Quickshell
import qs.Commons
import qs.Ui

//
// Hover flyout holding settings widgets / tools.
//
// Config (per instance, inline in shell.json):
//   icon  - bar button glyph (default: cog \uf013)
//   items - array of entries:
//     { "id": "<widget-id>",          "label": "..." }      -> embeds that widget
//     { "id": ..., "settings": {...} }                       -> optional per-widget overrides
//     { "type": "command", "icon": "\uf054",
//       "command": "...", "label": "..." }                   -> runs a shell command
//
// Embedded widgets are instantiated via Qt.createComponent so their `bar` /
// `moduleName` / `settings` are present from construction (required-property
// friendly), mirroring the host loader. They get our plugin facade as `bar`,
// so their popout/lifecycle calls are routed through the same coordinator.
// Widgets stay functional: clicking their icon opens the real panel overlay
// near the flyout.
//
BarWidget {
  id: root
  moduleName: "nismo.settings"

  readonly property string omarchyPath: Quickshell.env("OMARCHY_PATH") || "/usr/share/omarchy"
  readonly property string homeDir: Quickshell.env("HOME") || ""
  readonly property string iconGlyph: String(setting("icon", "\uf013") || "\uf013")
  readonly property var items: settings.items instanceof Array ? settings.items : []
  readonly property var sourceOverride: settings.sources instanceof Object ? settings.sources : {}

  property bool buttonHovered: false
  property bool flyoutArmed: false
  property bool childOpen: false
  property bool retired: false

  // Plain JS array of embedded widget objects whose `opened` state keeps the
  // flyout mounted while their panels are open.
  readonly property var openLocked: []

  function isCommandItem(item) {
    return !!item && String(item.type || "") === "command"
  }

  function sourceFor(item) {
    if (isCommandItem(item)) return ""
    var id = String(item.id || "")
    switch (id) {
    case "omarchy.audio": return omarchyPath + "/shell/plugins/panels/audio/Panel.qml"
    case "omarchy.bluetooth": return omarchyPath + "/shell/plugins/panels/bluetooth/Panel.qml"
    case "omarchy.monitor": return homeDir + "/.config/omarchy/plugins/nismo.monitor/Panel.qml"
    case "omarchy.weather": return omarchyPath + "/shell/plugins/panels/weather/BarWidget.qml"
    case "omarchy.tray": return omarchyPath + "/shell/plugins/bar/widgets/Tray.qml"
    case "omarchy.agents": return omarchyPath + "/shell/plugins/agents/Panel.qml"
    case "io.github.saiaungminkhant.nothing-buds":
      return homeDir + "/.config/omarchy/plugins/io.github.saiaungminkhant.nothing-buds/Panel.qml"
    default:
      var override = sourceOverride[id]
      return override ? String(override) : ""
    }
  }

  function lockOpen(target) {
    if (!target || target.opened === undefined || target.opened === null) return
    if (openLocked.indexOf(target) === -1) openLocked.push(target)
    if (target.openedChanged) target.openedChanged.connect(recomputeOpen)
    recomputeOpen()
  }

  function recomputeOpen() {
    root.childOpen = false
    for (var i = 0; i < openLocked.length; i++) {
      if (openLocked[i].opened === true) {
        root.childOpen = true
        break
      }
    }
  }

  readonly property bool flyoutHovering: root.buttonHovered || flyoutPopup.containsMouse
  readonly property bool flyoutOpen: !root.retired && ((root.flyoutArmed && root.flyoutHovering) || root.childOpen)

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  Timer { id: armTimer; interval: 140; onTriggered: root.flyoutArmed = true }
  Timer { id: disarmTimer; interval: 300; onTriggered: root.flyoutArmed = false }

  function resyncHover() {
    var hovering = root.buttonHovered || flyoutPopup.containsMouse
    if (hovering) {
      disarmTimer.stop()
      armTimer.restart()
    } else {
      armTimer.stop()
      disarmTimer.restart()
    }
  }

  // Popout coordinator identity: switching to another popup (e.g. battery,
  // network) retires this flyout, letting hover state drive it again later.
  function closeForPopoutSwitch() { root.retired = true }
  function close() { root.retired = true }
  readonly property bool popoutSwitchClosing: false

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.iconGlyph
    horizontalMargin: 7.5
    verticalPadding: 6
    tooltipText: String(root.setting("name", ""))

    HoverHandler {
      id: buttonHover
      onHoveredChanged: {
        root.buttonHovered = hovered
        root.resyncHover()
      }
    }
  }

  // A local clone of PopupCard. PopupCard re-declares `contentItem` as a list
  // alias for its content holder; embedded KeyboardPanel owners resolve that
  // holder as their anchor window's contentItem (a QQmlListReference, not a
  // QQuickItem), which breaks the panel's position math with a type error.
  // This flyout keeps contentItem real so embedded panels position correctly.
  FlyoutPopup {
    id: flyoutPopup
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.flyoutOpen
    padding: Style.space(8)

    contentWidth: fittedContentWidth(Math.max(Style.space(64), cardRow.implicitWidth), Style.space(560))
    contentHeight: fittedContentHeight(cardRow.implicitHeight, Style.space(240))

    Row {
      id: cardRow
      anchors.fill: parent
      spacing: Style.space(3)

      HoverHandler {
        onHoveredChanged: root.resyncHover()
      }

      Repeater {
        model: root.items
        delegate: SettingsRow {
          required property var modelData
          item: modelData
        }
      }
    }
  }

  component FlyoutPopup: PopupWindow {
    id: flyRoot

    required property Item anchorItem
    required property QtObject bar
    property var owner: null
    property int margin: Style.gapsOut
    property int padding: Style.spacing.popupPadding
    property int contentWidth: Style.space(280)
    property int contentHeight: Style.space(200)
    property color borderColor: Color.popups.border
    property var borderSpec: Border.localOrSurfaceSpec("popups", "border", borderColor, Color.popups.border, Math.max(1, Style.space(2)))
    property bool open: false

    readonly property var coordinatorKey: owner || root
    readonly property var anchorWindow: anchorItem ? anchorItem.QsWindow.window : null
    readonly property bool containsMouse: cardHover.hovered

    readonly property real screenW: anchorWindow ? anchorWindow.screen.width : 0
    readonly property real screenH: anchorWindow ? anchorWindow.screen.height : 0
    readonly property real barW: anchorWindow ? anchorWindow.width : 0
    readonly property real barH: anchorWindow ? anchorWindow.height : 0
    readonly property real availableCardWidth: screenW > 0
      ? Math.max(120, screenW - ((bar.position === "left" || bar.position === "right") ? barW : 0) - root.margin * 2)
      : 0
    readonly property real availableCardHeight: screenH > 0
      ? Math.max(120, screenH - ((bar.position === "top" || bar.position === "bottom") ? barH : 0) - root.margin * 2)
      : 0
    readonly property real verticalContentInset: padding * 2 + Border.top(borderSpec) + Border.bottom(borderSpec)

    function fittedContentWidth(width, cap) {
      var desired = Math.max(1, Number(width) || 1)
      var maxWidth = flyRoot.availableCardWidth > 0 ? flyRoot.availableCardWidth : desired
      if (cap !== undefined && Number(cap) > 0) maxWidth = Math.min(maxWidth, Number(cap))
      return Math.round(Math.min(desired, maxWidth))
    }

    function fittedContentHeight(implicitHeight, cap) {
      var desired = Math.max(flyRoot.verticalContentInset, (Number(implicitHeight) || 0) + flyRoot.verticalContentInset)
      var maxHeight = flyRoot.availableCardHeight > 0 ? flyRoot.availableCardHeight : desired
      if (cap !== undefined && Number(cap) > 0) maxHeight = Math.min(maxHeight, Number(cap))
      return Math.round(Math.min(desired, maxHeight))
    }

    function close() {
      if (owner && "close" in owner) owner.close()
      else flyRoot.open = false
    }

    visible: open || card.opacity > 0
    color: "transparent"
    implicitWidth: contentWidth
    implicitHeight: contentHeight

    onOpenChanged: {
      if (!bar) return
      if (open) bar.requestPopout(coordinatorKey)
      else if (bar.activePopout === coordinatorKey) bar.releasePopout(coordinatorKey)
    }

    anchor {
      id: popupAnchor
      window: anchorItem ? anchorItem.QsWindow.window : null
      adjustment: PopupAdjustment.Slide
      edges: Edges.Top | Edges.Left
      gravity: Edges.Bottom | Edges.Right
      rect.width: 1
      rect.height: 1

      onAnchoring: {
        if (!flyRoot.anchorItem || !flyRoot.bar) return

        var target = flyRoot.anchorItem
        var popupWidth = flyRoot.implicitWidth
        var popupHeight = flyRoot.implicitHeight
        var localX = target.width / 2 - popupWidth / 2
        var localY = target.height + flyRoot.margin

        if (flyRoot.bar.position === "bottom") {
          localY = -popupHeight - flyRoot.margin
        } else if (flyRoot.bar.position === "left") {
          localX = target.width + flyRoot.margin
          localY = target.height / 2 - popupHeight / 2
        } else if (flyRoot.bar.position === "right") {
          localX = -popupWidth - flyRoot.margin
          localY = target.height / 2 - popupHeight / 2
        }

        var window = target.QsWindow.window
        if (!window) return

        var point = window.contentItem.mapFromItem(target, localX, localY)

        if (flyRoot.bar.position === "top" || flyRoot.bar.position === "bottom") {
          point.x = Math.max(flyRoot.margin, Math.min(point.x, window.width - popupWidth - flyRoot.margin))
        } else {
          point.y = Math.max(flyRoot.margin, Math.min(point.y, window.height - popupHeight - flyRoot.margin))
        }

        popupAnchor.rect.x = Math.round(point.x)
        popupAnchor.rect.y = Math.round(point.y)
      }
    }

    BorderSurface {
      id: card
      anchors.fill: parent
      color: Color.popups.background
      borderSpec: flyRoot.borderSpec
      padding: flyRoot.padding
      radius: Style.cornerRadius
      opacity: flyRoot.open ? 1.0 : 0

      Behavior on opacity {
        NumberAnimation { duration: 140; easing.type: Easing.OutCubic }
      }

      Item {
        id: contentHolder
        anchors.fill: parent
        anchors.topMargin: card.contentTopInset
        anchors.rightMargin: card.contentRightInset
        anchors.bottomMargin: card.contentBottomInset
        anchors.leftMargin: card.contentLeftInset
      }

      HoverHandler {
        id: cardHover
      }
    }
  }

  component SettingsRow: Item {
    id: rowRoot
    required property var item

    readonly property bool isCommand: root.isCommandItem(item)
    readonly property bool hasLabel: rowRoot.label !== ""
    readonly property string label: String(item.label || "")
    readonly property string command: String(item.command || "")
    readonly property string icon: String(item.icon || "\uf054")
    readonly property string widgetSource: root.sourceFor(item)

    property Item widgetObj: null

    readonly property real widgetW: rowRoot.isCommand ? cmdButton.implicitWidth : (rowRoot.widgetObj ? rowRoot.widgetObj.implicitWidth : 0)
    readonly property real widgetH: rowRoot.isCommand ? cmdButton.implicitHeight : (rowRoot.widgetObj ? rowRoot.widgetObj.implicitHeight : 0)

    implicitWidth: Math.max(rowRoot.widgetW, labelText.implicitWidth)
    implicitHeight: rowRoot.widgetH + (rowRoot.hasLabel ? Style.space(4) + labelText.implicitHeight : 0)

    Component.onCompleted: {
      if (!rowRoot.isCommand) {
        rowRoot.createWidget()
      }
    }

    function createWidget() {
      var source = rowRoot.widgetSource
      if (!source) return
      var comp = Qt.createComponent(Qt.resolvedUrl(source), rowRoot)
      if (comp.status === Component.Error) {
        console.warn("nismo.settings: cannot load widget source", source, "—", comp.errorString())
        return
      }
      var props = {
        bar: root.bar,
        moduleName: rowRoot.item.id,
        settings: rowRoot.item.settings || {}
      }
      var obj = comp.createObject(rowRoot, props)
      if (!obj) {
        console.warn("nismo.settings: widget failed to instantiate", source)
        comp.destroy()
        return
      }
      rowRoot.widgetObj = obj
      if ("anchorItem" in obj) obj.anchorItem = root.button
      obj.anchors.top = rowRoot.top
      obj.anchors.horizontalCenter = rowRoot.horizontalCenter
      root.lockOpen(obj)
      Qt.callLater(function() { root.recomputeOpen() })
      Qt.callLater(function() {
        try {
          var btns = typeof obj.button !== "undefined" ? [obj.button] : []
          var got = typeof obj.anchorItem !== "undefined" && obj.anchorItem ? [obj.anchorItem] : []
          var kp = btns.concat(got)
          for (var kk = 0; kk < kp.length; kk++) {
            var an = kp[kk]
            var w = an && an.QsWindow ? an.QsWindow.window : null
            console.log("nismo.settings DBG " + rowRoot.item.id + " anchorIsWindow=" + (w != null)
              + " contentItemType=" + (w ? w.contentItem.toString() : "none"))
          }
        } catch (e) { console.log("nismo.settings DBG err " + e) }
      })
    }

    WidgetButton {
      id: cmdButton
      visible: rowRoot.isCommand
      anchors.top: parent.top
      anchors.horizontalCenter: parent.horizontalCenter
      bar: root.bar
      text: rowRoot.icon
      horizontalMargin: 0
      verticalPadding: 6
      fixedWidth: Style.space(32)
      fixedHeight: root.barSize

      onPressed: function(b) {
        if (b !== Qt.LeftButton) return
        if (root.bar && rowRoot.command) Qt.callLater(function() { root.bar.run(rowRoot.command) })
      }
    }

    Text {
      id: labelText
      anchors.bottom: parent.bottom
      anchors.horizontalCenter: parent.horizontalCenter
      text: rowRoot.label
      color: root.bar ? root.bar.foreground : Color.foreground
      font.family: root.bar ? root.bar.fontFamily : Style.font.family
      font.pixelSize: Style.font.caption
      visible: rowRoot.hasLabel
    }
  }
}