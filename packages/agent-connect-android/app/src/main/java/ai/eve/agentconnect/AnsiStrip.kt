package ai.eve.agentconnect

/**
 * Statefully strips ANSI escape sequences from a stream of string chunks so that
 * output can be shown in a plain TextView. Handles chunk boundaries (incomplete
 * sequences at end of a chunk are buffered and processed with the next chunk).
 */
class AnsiStrip {
    private val pending = StringBuilder()
    private var state = State.NORMAL
    private var sequenceStart = 0

    /**
     * Process a chunk from the SSH stream. Returns the cleaned text to display.
     * Any incomplete escape at the end of this chunk is buffered for the next call.
     */
    fun process(chunk: String): String {
        val input = pending.toString() + chunk
        pending.clear()
        val out = StringBuilder()
        var i = 0
        while (i < input.length) {
            val c = input[i]
            when (state) {
                State.NORMAL -> {
                    when {
                        c == '\u001B' -> { sequenceStart = i; state = State.ESC_SEEN; i++ }
                        c == '\u009B' -> { sequenceStart = i; state = State.CSI; i++ }
                        else -> { out.append(c); i++ }
                    }
                }
                State.ESC_SEEN -> {
                    when (c) {
                        '[' -> { state = State.CSI; i++ }
                        ']' -> { state = State.OSC; i++ }
                        else -> { state = State.NORMAL; i++ }
                    }
                }
                State.CSI -> {
                    if (c.code in 0x40..0x7E) state = State.NORMAL
                    i++
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
        return out.toString()
    }

    private enum class State { NORMAL, ESC_SEEN, CSI, OSC }
}
