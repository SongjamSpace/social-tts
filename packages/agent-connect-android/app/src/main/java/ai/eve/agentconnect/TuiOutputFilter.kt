package ai.eve.agentconnect

/**
 * Splits TUI output into content (main terminal) and status (single status bar).
 * Status lines are never appended to the main output, so they don't clutter the
 * log or split agent responses.
 */
class TuiOutputFilter {

    private val lineBuffer = StringBuilder()

    private val statusPattern = Regex(
        "^(?:[.:]?\\s*)(?:running|streaming|sending|idle|twiddling|conjuring[^\\n]*)[^\\n]*" +
            "|.*agent main \\| session main.*" +
            "|^tokens\\s+[\\d.k]+/.*" +
            "|^(?:connected|idle)\\s*$" +
            "|^\\d+s \\| connected\\s*$" +
            "|^0s \\| connected\\s*$" +
            "|^[.:]?\\s*.*\\|\\s*connected" +
            "|.*\\|\\s*(?:connected|idle)\\s*$" +
            "|^session agent:" +
            "|^gateway connected" +
            "|^connecting \\|"
    )

    private fun isStatusLine(line: String): Boolean {
        val t = line.trim()
        if (t.isEmpty()) return false
        if (t.startsWith("[Session closed]") || t.startsWith("[Error]")) return false
        return statusPattern.containsMatchIn(t) ||
            t.startsWith(".: ") || t.startsWith(":. ") || t.startsWith(": ") ||
            t.contains("agent main | session main") ||
            t.contains(" | connected") || t.contains(" | idle") ||
            t.matches(Regex("^\\d+s \\| .*")) ||
            t.startsWith("session agent:") || t.startsWith("gateway connected") ||
            t.startsWith("connecting |") ||
            (t.contains("•") && t.contains("connected")) ||
            t == "connected" || t == "idle"
    }

    /**
     * Process a chunk of cleaned (ANSI-stripped) output. Status lines go to
     * onStatus only; all other lines go to onContent. Caller should run UI
     * updates on the main thread.
     */
    fun process(
        chunk: String,
        onContent: (String) -> Unit,
        onStatus: (String) -> Unit
    ) {
        lineBuffer.append(chunk)
        val full = lineBuffer.toString()
            .replace("\r\n", "\n")
            .replace('\r', '\n')
        val parts = full.split('\n')
        lineBuffer.clear()
        val completeLines = if (parts.isNotEmpty() && !full.endsWith('\n')) {
            lineBuffer.append(parts.last())
            parts.dropLast(1)
        } else {
            parts.dropLast(1)
        }
        for (line in completeLines) {
            if (isStatusLine(line)) {
                onStatus(line.trim())
                continue
            }
            if (!line.isBlank()) {
                onContent(line.replace("\r", "") + "\n")
            }
        }
    }

    /**
     * Flush any remaining buffer by sending it as content.
     */
    fun flush(onContent: (String) -> Unit) {
        if (lineBuffer.isNotEmpty()) {
            onContent(lineBuffer.toString().replace("\r", ""))
            lineBuffer.clear()
        }
    }
}
