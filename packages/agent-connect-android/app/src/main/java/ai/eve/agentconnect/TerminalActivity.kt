package ai.eve.agentconnect

import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class TerminalActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_BUNDLE_JSON = "bundle_json"
    }

    private var session: SshSession? = null
    private lateinit var outputView: TextView
    private lateinit var scrollView: ScrollView
    private lateinit var inputField: EditText
    private var statusBar: TextView? = null
    private val outputFilter = TuiOutputFilter()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_terminal)

        val bundleJson = intent?.getStringExtra(EXTRA_BUNDLE_JSON)
            ?: run {
                Toast.makeText(this, "No connection data", Toast.LENGTH_SHORT).show()
                finish()
                return
            }

        outputView = findViewById(R.id.terminal_output)
        scrollView = findViewById(R.id.scroll_output)
        inputField = findViewById(R.id.terminal_input)
        statusBar = findViewById(R.id.status_bar)

        val bundle = try {
            ConnectionBundle.parse(bundleJson)
        } catch (e: Exception) {
            Toast.makeText(this, getString(R.string.error_invalid_bundle), Toast.LENGTH_LONG).show()
            finish()
            return
        }

        outputView.text = getString(R.string.connecting)

        session = SshSession(
            bundle = bundle,
            onOutput = { text ->
                outputFilter.process(
                    chunk = text,
                    onContent = { segment ->
                        runOnUiThread {
                            if (outputView.text == getString(R.string.connecting)) {
                                outputView.text = ""
                            }
                            outputView.append(segment)
                            scrollView.post { scrollView.fullScroll(ScrollView.FOCUS_DOWN) }
                        }
                    },
                    onStatus = { line ->
                        runOnUiThread {
                            statusBar?.let { bar ->
                                bar.text = line
                                bar.visibility = View.VISIBLE
                            }
                        }
                    }
                )
            },
            onError = { msg ->
                runOnUiThread {
                    if (outputView.text == getString(R.string.connecting)) {
                        outputView.text = ""
                    }
                    outputView.append("\n[Error] $msg\n")
                    Toast.makeText(this, getString(R.string.error_connection_failed, msg), Toast.LENGTH_LONG).show()
                }
            },
            onClosed = {
                runOnUiThread {
                    outputView.append("\n[Session closed]\n")
                }
            }
        )

        Thread {
            try {
                session?.connect()
            } catch (_: Exception) { }
        }.start()

        inputField.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == android.view.inputmethod.EditorInfo.IME_ACTION_SEND) {
                sendInput()
                true
            } else false
        }

        inputField.setOnKeyListener { _, keyCode, event ->
            if (keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN) {
                sendInput()
                true
            } else false
        }

        findViewById<Button>(R.id.btn_paste_send).setOnClickListener {
            sendInput()
        }

        findViewById<Button>(R.id.btn_arrow_left).setOnClickListener {
            session?.sendRaw("\u001b[D")
        }
        findViewById<Button>(R.id.btn_arrow_up).setOnClickListener {
            session?.sendRaw("\u001b[A")
        }
        findViewById<Button>(R.id.btn_arrow_down).setOnClickListener {
            session?.sendRaw("\u001b[B")
        }
        findViewById<Button>(R.id.btn_arrow_right).setOnClickListener {
            session?.sendRaw("\u001b[C")
        }

        findViewById<Button>(R.id.btn_disconnect).setOnClickListener {
            session?.close()
            session = null
            finish()
        }
    }

    private fun sendInput() {
        val line = inputField.text.toString()
        inputField.text.clear()
        if (line.isNotEmpty()) {
            session?.sendLine(line)
        }
    }

    private fun pasteAndSend() {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        val text = clipboard?.primaryClip?.getItemAt(0)?.text?.toString() ?: return
        session?.sendLine(text)
        inputField.text.clear()
    }

    override fun onDestroy() {
        session?.close()
        session = null
        super.onDestroy()
    }
}
