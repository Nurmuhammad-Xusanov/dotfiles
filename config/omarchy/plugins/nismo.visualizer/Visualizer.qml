// Compact audio spectrum bars for the Omarchy bar.
//
// Spectrum data comes from cava running in "raw" output mode, which emits one
// byte per bar per frame with no line breaks. Quickshell.Io only offers
// StdioCollector (buffered, fires at EOF) and SplitParser (line-oriented), and
// this Quickshell build has no DataStreamParser - using one aborts the whole
// widget load with "base class DataStreamParser not found".
//
// So cava's bytes are piped through `od -An -tu1 -v`, which prints
// space-separated values one per line position, 16 to a line. NOTE: od's line
// width is fixed at 16 and has nothing to do with the `bars` setting, so a line
// is NOT a frame - frame() reassembles frames from the value stream. Measured
// ~60fps at bars=24.
//
// Two other decisions worth keeping:
//
//  1. We capture the MONITOR of the real playback sink rather than creating a
//     null sink. Both were measured on this machine (1688 vs 1704 non-zero
//     bytes on a test tone, i.e. equivalent), but the null sink route requires
//     making it the default sink and looping it back to the speakers. Getting
//     that wrong silences all audio, so monitoring the real sink is strictly
//     safer and needs no routing changes.
//
//  2. Everything is resolved at runtime and degrades to empty bars if cava or
//     pactl is missing, so a broken setup can never take the bar down.

import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "nismo.visualizer"

  // MUST match `bars` in ~/.config/cava/nismo-bar.conf. Each line of cava output
  // is split into exactly this many values.
  readonly property int barCount: 24
  readonly property real gap: 1

  // Latest frame of spectrum data, one value 0-255 per bar.
  property var levels: []

  // Smoothed values actually drawn, so bars fall gently instead of flickering
  // between frames.
  property var drawn: []

  // Held as a single scalar so each incoming frame triggers exactly one QML
  // property change. Assigning `drawn` instead would rebind every Repeater
  // delegate at once on every frame.
  property int generation: 0

  readonly property string configPath: root.setting("configPath",
    Quickshell.env("HOME") + "/.config/cava/nismo-bar.conf")

  // Resolved once at startup: the monitor source of the current default sink.
  property string monitorSource: ""

  property Process resolveProc: Process {
    // The awk program needs a literal "$2 == <sink>.monitor". Running that
    // inside an inline `bash -c "..."` breaks, because bash and awk both
    // consume the $ signs. Using `awk -v` with a bash variable keeps it intact.
    command: ["bash", "-c",
      "sink=$(pactl get-default-sink) && pactl list short sources | awk -v m=\"$sink.monitor\" '$2 == m { print $2; exit }'"]

    stdout: StdioCollector {
      onStreamFinished: {
        var out = (this.text || "").trim().split("\n")[0].trim()
        if (out.length > 0) root.monitorSource = out
      }
    }
  }

  function reset() {
    root.drawn = []
    root.pending = []
    root.generation++
  }

  // `od` wraps its output at a fixed 16 values per line REGARDLESS of the `bars`
  // setting - measured at bars=16, 20, 24 and 32, every line was 16 wide. So an
  // od line is NOT a frame unless barCount happens to divide 16 evenly.
  //
  // The original bars=16 config only worked by coincidence. With bars=24 frames
  // straddle line boundaries, so values are accumulated here and a frame is
  // emitted only once barCount values are in hand. Without this, bars are drawn
  // from the wrong offsets and the display is scrambled.
  property var pending: []

  function frame(line) {
    var parts = line.trim().split(/\s+/)
    var values = root.pending

    for (var i = 0; i < parts.length; i++) {
      var n = parseInt(parts[i], 10)
      values.push(isNaN(n) ? 0 : n)
    }

    while (values.length >= root.barCount) {
      var take = values.slice(0, root.barCount)
      values = values.slice(root.barCount)

      var smoothed = []
      for (var b = 0; b < root.barCount; b++) {
        var v = take[b] / 255
        var prev = root.drawn[b] || 0
        // Rise fast, fall slow, so bars don't strobe between frames.
        smoothed.push(v > prev ? v : prev * 0.75 + v * 0.25)
      }
      root.drawn = smoothed
      // Bump last: every delegate binds `level` off `generation`, so this single
      // write is what drives the repaint.
      root.generation++
    }

    root.pending = values
  }

  Process {
    id: cavaProc
    running: root.monitorSource !== "" && root.visible
    // od turns the byte stream into one line of numbers per frame (see header).
    //
    // stdbuf -oL is REQUIRED, not optional. With a piped stdout, od uses block
    // buffering, so frames arrive in bursts: measured on this machine, median
    // gap 0ms but worst-case 541ms, which shows up as a visualizer that looks
    // frozen and then jumps. With -oL the worst-case gap drops to 17ms, i.e.
    // a genuine 60fps. Do not remove it.
    command: ["bash", "-c", "cava -p \"$1\" | stdbuf -oL od -An -tu1 -v", "viz", root.configPath]

    stdout: SplitParser {
      onRead: function(line) { root.frame(line) }
    }
    stderr: StdioCollector {
      onStreamFinished: root.reset()
    }
    onExited: function() { root.reset() }
  }

  readonly property real trailingGap: root.vertical ? 0 : Style.spaceReal(1.5)

  // Width scales with bar count: 2px bar + gap, so N bars need N*2 + (N-1)*gap.
  implicitWidth: root.vertical ? root.barSize : (root.barCount * 2) + ((root.barCount - 1) * root.gap) + root.trailingGap
  implicitHeight: root.vertical ? (root.barCount * 2) : root.barSize

  Component.onCompleted: resolveProc.running = true

  Row {
    id: row
    anchors.fill: parent
    anchors.rightMargin: root.trailingGap
    spacing: root.gap

    Repeater {
      model: root.barCount

      Rectangle {
        required property int index

        // `level` deliberately reads root.generation so this binding re-evaluates
        // once per incoming frame. Reading root.drawn directly makes the binding
        // depend on a whole JS array, which is markedly slower to re-evaluate.
        readonly property real level: {
          var g = root.generation
          var d = root.drawn
          var v = d !== undefined && d[index] !== undefined ? d[index] : 0
          return g >= 0 ? v : 0
        }

        // Smallest visible nub so an idle bar still reads as "present".
        readonly property real minHeight: 2

        width: root.vertical ? root.barSize : 2
        height: Math.max(minHeight, level * row.height)

        // Bars must grow UP from the baseline. A Row only lays children out
        // horizontally, so y would otherwise default to 0 and every bar would
        // hang downwards from the top of the bar - i.e. upside down. Pinning
        // y to the bottom edge is what makes this read as a spectrum.
        y: root.vertical ? 0 : row.height - height

        color: level > 0.02 ? Color.accent : Color.muted
        opacity: level > 0.02 ? 1 : 0.4
        radius: 1
      }
    }
  }
}