package ai.eve.agentconnect

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import java.io.InputStream

class MainActivity : AppCompatActivity() {

    private val openDocument = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        uri ?: return@registerForActivityResult
        openDropletUri(uri)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Handle intent when app is opened with a .droplet file
        intent?.data?.let { uri ->
            if (uri.toString().contains(".droplet") || uri.path?.contains(".droplet") == true) {
                openDropletUri(uri)
                intent = null
                return@onCreate
            }
        }

        findViewById<Button>(R.id.btn_open_file).setOnClickListener {
            openDocument.launch(arrayOf("*/*"))
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        this.intent = intent
        intent?.data?.let { uri ->
            if (uri.toString().contains(".droplet") || uri.path?.contains(".droplet") == true) {
                openDropletUri(uri)
                this.intent = null
            }
        }
    }

    private fun openDropletUri(uri: Uri) {
        try {
            contentResolver.openInputStream(uri)?.use { input ->
                val bundle = ConnectionBundle.parseFromStream(input)
                startTerminal(bundle)
            } ?: run {
                // Try file path for file:// URIs
                uri.path?.let { path ->
                    java.io.File(path).inputStream().use { input ->
                        val bundle = ConnectionBundle.parseFromStream(input)
                        startTerminal(bundle)
                    }
                } ?: showError(getString(R.string.error_invalid_bundle))
            }
        } catch (e: Exception) {
            showError(e.message ?: getString(R.string.error_invalid_bundle))
        }
    }

    private fun startTerminal(bundle: ConnectionBundle) {
        val intent = Intent(this, TerminalActivity::class.java).apply {
            putExtra(TerminalActivity.EXTRA_BUNDLE_JSON, bundle.toJson())
        }
        startActivity(intent)
    }

    private fun showError(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
}

private fun ConnectionBundle.toJson(): String {
    return org.json.JSONObject().apply {
        put("version", version)
        put("host", host)
        put("port", port)
        put("user", user)
        put("privateKeyPem", privateKeyPem)
        mint?.let { put("mint", it) }
        label?.let { put("label", it) }
    }.toString()
}
