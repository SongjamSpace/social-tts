package ai.eve.agentconnect

import net.schmizz.sshj.SSHClient
import net.schmizz.sshj.transport.verification.PromiscuousVerifier
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Holds SSH connection and shell; runs I/O on a background executor.
 * Call connect() from a background thread; then read/write shell streams.
 */
class SshSession(
    private val bundle: ConnectionBundle,
    private val onOutput: (String) -> Unit,
    private val onError: (String) -> Unit,
    private val onClosed: () -> Unit
) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val closed = AtomicBoolean(false)
    private var client: SSHClient? = null
    private var shell: net.schmizz.sshj.connection.channel.direct.Session.Shell? = null

    val stdin: OutputStream?
        get() = shell?.outputStream

    fun connect() {
        executor.execute {
            try {
                val ssh = SSHClient()
                client = ssh
                ssh.addHostKeyVerifier(PromiscuousVerifier())
                ssh.connect(bundle.host, bundle.port)
                val pem = bundle.privateKeyPem.replace("\\n", "\n").trim()
                val keyFile = File.createTempFile("droplet_key_", ".pem").apply {
                    deleteOnExit()
                    writeText(pem)
                }
                try {
                    val keyProvider = ssh.loadKeys(keyFile.absolutePath)
                    ssh.authPublickey(bundle.user, keyProvider)
                } finally {
                    keyFile.delete()
                }
                val session = ssh.startSession()
                shell = session.startShell()
                val sh = shell!!
                // Read stdout/stderr on separate threads (copyStream blocks)
                Thread { copyStream(sh.inputStream, onOutput) }.start()
                Thread { copyStream(sh.errorStream) { onOutput(it) } }.start()
                // Send install command
                sh.outputStream.write("curl -fsSL https://openclaw.ai/install.sh | bash\n".toByteArray(Charsets.UTF_8))
                sh.outputStream.flush()
            } catch (e: Exception) {
                if (!closed.get()) onError(e.message ?: "Connection failed")
                close()
            }
        }
    }

    private fun copyStream(input: InputStream, onChunk: (String) -> Unit) {
        try {
            val buf = ByteArray(4096)
            var n: Int
            while (input.read(buf).also { n = it } != -1 && !closed.get()) {
                val s = String(buf, 0, n, Charsets.UTF_8)
                onChunk(s)
            }
        } catch (_: Exception) { }
        if (!closed.get()) onClosed()
    }

    fun sendLine(line: String) {
        val out = shell?.outputStream ?: return
        executor.execute {
            try {
                out.write((line + "\n").toByteArray(Charsets.UTF_8))
                out.flush()
            } catch (_: Exception) { }
        }
    }

    fun close() {
        if (!closed.compareAndSet(false, true)) return
        try {
            shell?.close()
            client?.disconnect()
        } catch (_: Exception) { }
        shell = null
        client = null
        executor.shutdownNow()
    }
}
