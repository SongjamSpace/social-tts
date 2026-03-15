package ai.eve.agentconnect

import net.schmizz.sshj.SSHClient
import net.schmizz.sshj.transport.verification.PromiscuousVerifier
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

private val OPENCLAW_INSTALL =
    "curl -fsSL https://openclaw.ai/install.sh | bash\n".toByteArray(Charsets.UTF_8)

/**
 * Same logic as Electron: config, CLI, PATH (login shell), workspace, or Gateway on :18789.
 */
private val OPENCLAW_INSTALLED_PROBE =
    "bash --login -c 'test -f \"\$HOME/.openclaw/openclaw.json\" || test -x \"\$HOME/.openclaw/bin/openclaw\" || command -v openclaw >/dev/null 2>&1 || test -d \"\$HOME/.openclaw/workspace\" || curl -sf -m 4 http://127.0.0.1:18789/ -o /dev/null || curl -sf -m 4 http://127.0.0.1:18789 -o /dev/null'"

/**
 * Holds SSH connection and shell; runs I/O on a background executor.
 * Probes for existing OpenClaw install before starting shell; skips installer if present.
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

                val alreadyInstalled = probeInstalled(ssh)

                val session = ssh.startSession()
                session.allocateDefaultPTY()
                shell = session.startShell()
                val sh = shell!!
                Thread { copyStream(sh.inputStream, onOutput) }.start()
                Thread { copyStream(sh.errorStream) { onOutput(it) } }.start()
                if (!alreadyInstalled) {
                    sh.outputStream.write(OPENCLAW_INSTALL)
                    sh.outputStream.flush()
                } else {
                    Thread {
                        try {
                            Thread.sleep(3500)
                            sh.outputStream.write("openclaw\n".toByteArray(Charsets.UTF_8))
                            sh.outputStream.flush()
                        } catch (_: Exception) { }
                    }.start()
                }
            } catch (e: Exception) {
                if (!closed.get()) onError(e.message ?: "Connection failed")
                close()
            }
        }
    }

    private fun probeInstalled(ssh: SSHClient): Boolean {
        var probeSession: net.schmizz.sshj.connection.channel.direct.Session? = null
        return try {
            probeSession = ssh.startSession()
            val cmd = probeSession.exec(OPENCLAW_INSTALLED_PROBE)
            drainQuietly(cmd.inputStream)
            drainQuietly(cmd.errorStream)
            cmd.join(25, TimeUnit.SECONDS)
            cmd.close()
            val exit = cmd.exitStatus
            exit != null && exit == 0
        } catch (_: Exception) {
            false
        } finally {
            try {
                probeSession?.close()
            } catch (_: Exception) {
            }
        }
    }

    private fun drainQuietly(input: InputStream) {
        try {
            val buf = ByteArray(4096)
            while (input.read(buf) != -1) { }
        } catch (_: Exception) { }
    }

    private fun copyStream(input: InputStream, onChunk: (String) -> Unit) {
        val ansiStrip = AnsiStrip()
        try {
            val buf = ByteArray(4096)
            var n: Int
            while (input.read(buf).also { n = it } != -1 && !closed.get()) {
                val s = String(buf, 0, n, Charsets.UTF_8)
                val cleaned = ansiStrip.process(s)
                if (cleaned.isNotEmpty()) onChunk(cleaned)
            }
        } catch (_: Exception) { }
        if (!closed.get()) onClosed()
    }

    fun sendLine(line: String) {
        val out = shell?.outputStream ?: return
        executor.execute {
            try {
                out.write((line + "\r").toByteArray(Charsets.UTF_8))
                out.flush()
            } catch (_: Exception) { }
        }
    }

    /** Sends raw bytes to the shell (e.g. ANSI arrow sequences) without appending \\r. */
    fun sendRaw(data: String) {
        val out = shell?.outputStream ?: return
        executor.execute {
            try {
                out.write(data.toByteArray(Charsets.UTF_8))
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
