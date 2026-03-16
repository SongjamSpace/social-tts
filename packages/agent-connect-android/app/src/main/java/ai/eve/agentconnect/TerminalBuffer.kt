package ai.eve.agentconnect

/**
 * Minimal terminal screen buffer that interprets ANSI CSI sequences (cursor move,
 * erase line, erase display) so TUI redraws update in place instead of appending.
 * Used with a TextView: feed raw SSH output via process(), display via getDisplayText().
 */
class TerminalBuffer(
    private val width: Int = 120,
    private val maxLines: Int = 500
) {
    private val primaryLines = mutableListOf<StringBuilder>().also { it.add(StringBuilder()) }
    private val alternateLines = mutableListOf<StringBuilder>()
    private var lines: MutableList<StringBuilder> = primaryLines
    private var cursorRow = 0
    private var cursorCol = 0

    private var reverseVideo = false
    private val reverseLines = mutableSetOf<Int>()

    private val pending = StringBuilder()
    private var state = State.NORMAL
    private var sequenceStart = 0
    private val csiParams = mutableListOf<Int>()
    private var csiPrivate = false

    private val lock = Any()

    private enum class State { NORMAL, ESC_SEEN, CSI, OSC }

    init {
        // primaryLines already has one line from .also { it.add(StringBuilder()) }
    }

    /** Process a chunk of raw terminal output (including ANSI). Call from any thread; internally synchronized. */
    fun process(chunk: String) {
        synchronized(lock) {
            processLocked(chunk)
        }
    }

    private fun processLocked(chunk: String) {
        val input = pending.toString() + chunk
        pending.clear()
        var i = 0
        while (i < input.length) {
            val c = input[i]
            when (state) {
                State.NORMAL -> {
                    when {
                        c == '\u001B' -> { sequenceStart = i; state = State.ESC_SEEN; i++ }
                        c == '\u009B' -> { sequenceStart = i; state = State.CSI; csiParams.clear(); csiPrivate = false; i++ }
                        c == '\n' -> { newline(); i++ }
                        c == '\r' -> { cursorCol = 0; i++ }
                        c == '\t' -> { writeChar(' '); repeat(7) { writeChar(' ') }; i++ }
                        c.code in 0x20..0x7E || c.code >= 0xA0 -> { writeChar(c); i++ }
                        else -> i++
                    }
                }
                State.ESC_SEEN -> {
                    when (c) {
                        '[' -> { state = State.CSI; csiParams.clear(); csiPrivate = false; i++ }
                        ']' -> { state = State.OSC; i++ }
                        else -> { state = State.NORMAL; i++ }
                    }
                }
                State.CSI -> {
                    when {
                        c in '0'..'9' -> {
                            var n = c.digitToInt()
                            i++
                            while (i < input.length && input[i] in '0'..'9') {
                                n = n * 10 + input[i].digitToInt()
                                i++
                            }
                            csiParams.add(n)
                        }
                        c == ';' -> { i++ }
                        c == '?' -> { csiPrivate = true; i++ }
                        c.code in 0x40..0x7E -> {
                            applyCsi(c, csiPrivate)
                            state = State.NORMAL
                            csiPrivate = false
                            i++
                        }
                        c.code in 0x20..0x3F -> { i++ }
                        else -> { state = State.NORMAL; i++ }
                    }
                }
                State.OSC -> {
                    when {
                        c == '\u0007' -> { state = State.NORMAL; i++ }
                        c == '\u001B' && i + 1 < input.length && input[i + 1] == '\\' -> {
                            state = State.NORMAL
                            i += 2
                        }
                        else -> i++
                    }
                }
            }
        }
        if (state != State.NORMAL) {
            pending.append(input.substring(sequenceStart, input.length))
            state = State.NORMAL
        }
    }

    private fun applyCsi(final: Char, privateMode: Boolean = false) {
        val p1 = csiParams.getOrElse(0) { 1 }
        val p2 = csiParams.getOrElse(1) { 1 }
        when (final) {
            'A' -> cursorRow = (cursorRow - p1).coerceAtLeast(0)
            'B' -> {
                cursorRow = (cursorRow + p1).coerceAtMost(lines.size)
                ensureLine(cursorRow)
            }
            'C' -> cursorCol = (cursorCol + p1).coerceAtMost(width - 1)
            'D' -> cursorCol = (cursorCol - p1).coerceAtLeast(0)
            'H', 'f' -> {
                cursorRow = (p1 - 1).coerceAtLeast(0)
                cursorCol = (p2 - 1).coerceAtLeast(0).coerceAtMost(width - 1)
                ensureLine(cursorRow)
            }
            'K' -> {
                ensureLine(cursorRow)
                val line = lines[cursorRow]
                if (cursorCol < line.length) {
                    line.setLength(cursorCol)
                }
            }
            'J' -> {
                ensureLine(cursorRow)
                val p1Ed = csiParams.getOrElse(0) { 0 }
                when (p1Ed) {
                    0 -> {
                        lines[cursorRow].setLength(cursorCol)
                        while (lines.size > cursorRow + 1) lines.removeAt(lines.size - 1)
                    }
                    1 -> {
                        for (i in 0 until cursorRow) lines[i].setLength(0)
                        val line = lines[cursorRow]
                        while (line.length < cursorCol + 1) line.append(' ')
                        for (j in 0..cursorCol) line.setCharAt(j, ' ')
                        reverseLines.removeAll { it < cursorRow }
                        lines[cursorRow].setLength(cursorCol)
                        while (lines.size > cursorRow + 1) lines.removeAt(lines.size - 1)
                        reverseLines.removeAll { it > cursorRow }
                    }
                    2 -> {
                        lines.clear()
                        lines.add(StringBuilder())
                        cursorRow = 0
                        cursorCol = 0
                        reverseLines.clear()
                    }
                    else -> { }
                }
            }
            'L' -> {
                ensureLine(cursorRow)
                lines.add(cursorRow, StringBuilder())
                trimLinesFromTop()
            }
            'M' -> {
                if (cursorRow < lines.size) {
                    lines.removeAt(cursorRow)
                    cursorRow = cursorRow.coerceAtMost(lines.size - 1).coerceAtLeast(0)
                }
            }
            'm' -> {
                if (csiParams.isEmpty()) applySgr(0)
                else for (p in csiParams) applySgr(p)
            }
            'h', 'l' -> {
                if (privateMode && p1 == 1049) {
                    reverseLines.clear()
                    if (final == 'h') {
                        alternateLines.clear()
                        lines = alternateLines
                        cursorRow = 0
                        cursorCol = 0
                        ensureLine(0)
                    } else {
                        lines = primaryLines
                    }
                }
            }
            else -> { }
        }
    }

    private fun ensureLine(row: Int) {
        while (lines.size <= row) {
            if (lines.size >= maxLines) {
                lines.removeAt(0)
                cursorRow = (cursorRow - 1).coerceAtLeast(0)
            }
            lines.add(StringBuilder())
        }
    }

    private fun newline() {
        cursorRow++
        cursorCol = 0
        ensureLine(cursorRow)
    }

    private fun writeChar(c: Char) {
        ensureLine(cursorRow)
        if (reverseVideo) reverseLines.add(cursorRow)
        val line = lines[cursorRow]
        while (line.length < cursorCol) line.append(' ')
        if (cursorCol < line.length) {
            line.setCharAt(cursorCol, c)
        } else {
            line.append(c)
        }
        cursorCol++
        if (cursorCol >= width) {
            cursorCol = 0
            lines.add(cursorRow + 1, StringBuilder())
            cursorRow++
            trimLinesFromTop()
        }
    }

    /** Current cursor row (0-based). Use when rendering to highlight the focused line. */
    fun getCursorRow(): Int = synchronized(lock) { cursorRow }

    /** Current buffer as text for the TextView. Call from main thread after process(). */
    fun getDisplayText(): CharSequence = synchronized(lock) {
        if (lines.isEmpty()) return ""
        lines.joinToString("\n")
    }

    private fun applySgr(p: Int) {
        when (p) {
            0 -> { reverseVideo = false; reverseLines.clear() }
            7 -> reverseVideo = true
            27 -> { reverseVideo = false; reverseLines.clear() }
            else -> { }
        }
    }

    /** Row indices (0-based) that have SGR reverse video. Use for focus highlight when non-empty. */
    fun getReverseLines(): Set<Int> = synchronized(lock) { reverseLines.toSet() }

    private fun trimLinesFromTop() {
        while (lines.size > maxLines) {
            lines.removeAt(0)
            cursorRow = (cursorRow - 1).coerceAtLeast(0)
            val newReverse = reverseLines.filter { it > 0 }.map { it - 1 }.toMutableSet()
            reverseLines.clear()
            reverseLines.addAll(newReverse)
        }
    }
}
