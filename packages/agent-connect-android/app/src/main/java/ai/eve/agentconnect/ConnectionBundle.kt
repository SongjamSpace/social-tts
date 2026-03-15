package ai.eve.agentconnect

import org.json.JSONObject
import java.io.InputStream
import java.nio.charset.StandardCharsets

/**
 * Same format as desktop Agent Connect .droplet bundle.
 * See packages/agent-connect/src/bundle.ts
 */
data class ConnectionBundle(
    val version: Int,
    val host: String,
    val port: Int,
    val user: String,
    val privateKeyPem: String,
    val mint: String? = null,
    val label: String? = null
) {
    companion object {
        fun parse(json: String): ConnectionBundle {
            val o = JSONObject(json)
            if (o.optInt("version", 0) != 1 ||
                !o.has("host") ||
                !o.has("privateKeyPem")
            ) {
                throw IllegalArgumentException("Invalid connection bundle")
            }
            return ConnectionBundle(
                version = 1,
                host = o.getString("host"),
                port = o.optInt("port", 22),
                user = o.optString("user", "root"),
                privateKeyPem = o.getString("privateKeyPem"),
                mint = o.optString("mint").takeIf { it.isNotEmpty() },
                label = o.optString("label").takeIf { it.isNotEmpty() }
            )
        }

        fun parseFromStream(input: InputStream): ConnectionBundle {
            val json = input.bufferedReader(StandardCharsets.UTF_8).readText()
            return parse(json)
        }
    }
}
