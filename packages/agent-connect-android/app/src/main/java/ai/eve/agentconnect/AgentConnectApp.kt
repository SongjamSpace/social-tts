package ai.eve.agentconnect

import android.app.Application
import org.bouncycastle.jce.provider.BouncyCastleProvider
import java.security.Security

/**
 * Registers Bouncy Castle so X25519/Ed25519 (used by modern OpenSSH keys) is available.
 * Without this, SSHJ fails with "no such algorithm: X25519 for provider BC" on Android.
 */
class AgentConnectApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Android ships a stripped-down "BC" provider that doesn't include X25519.
        // Remove it and add our full Bouncy Castle so SSHJ can use Ed25519/X25519 keys.
        try {
            Security.removeProvider(BouncyCastleProvider.PROVIDER_NAME)
        } catch (_: Exception) { /* ignore if not present */ }
        Security.addProvider(BouncyCastleProvider())
    }
}
