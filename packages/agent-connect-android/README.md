# Agent Connect (Android)

Android app that lets users without a computer connect to their VPS via a `.droplet` connection file, run the OpenClaw installer over SSH, and interact with it: type or paste (e.g. API keys) and press Enter to drive the installer.

Same bundle format as the desktop Agent Connect app.

## Build

### Prerequisites

- Android SDK (API 34)
- JDK 17
- Gradle 8.2+ (wrapper included)

If the Gradle wrapper is not yet set up (e.g. `gradlew` or `gradle/wrapper/gradle-wrapper.jar` is missing), run from this directory:

```bash
gradle wrapper
```

(requires Gradle to be installed), or open the project in Android Studio and sync – then build from the IDE or run `./gradlew assembleRelease`.

### Assemble release APK

From this directory:

```bash
./gradlew assembleRelease
```

The APK is produced at `app/build/outputs/apk/release/app-release-unsigned.apk` (or `app-release.apk` if signing is configured).

### Signing the release APK (optional)

For distribution you should sign the APK:

1. Create a keystore (once):
   ```bash
   keytool -genkey -v -keystore release.keystore -alias agentconnect -keyalg RSA -keysize 2048 -validity 10000
   ```
2. In `app/build.gradle.kts`, add a `signingConfigs` block and set `signingConfig` for the release build type to use it, or pass store file/password/alias/key password via `gradle.properties` (do not commit passwords). See [Android signing documentation](https://developer.android.com/studio/publish/app-signing).

## Install the APK

- Copy the APK to the device (e.g. via email, cloud storage, or `adb install app/build/outputs/apk/release/app-release-unsigned.apk`).
- On the device, open the APK and allow installation from unknown sources if prompted.
- Install and open Agent Connect.

## Using the app

1. **Get a .droplet file**  
   From the spawn success page in the web app, tap **Download .droplet file** and save it (e.g. to Downloads).

2. **Open the .droplet file**  
   - Tap the downloaded `.droplet` file and choose **Open with Agent Connect**, or  
   - Open Agent Connect, tap **Import .droplet file**, and select the file.

3. **Connect**  
   The app connects over SSH and automatically runs the OpenClaw installer. You’ll see the installer output in the terminal.

4. **Interact**  
   - Type in the input field and press **Enter** (or the keyboard Send action) to send a line (e.g. API key, choices).  
   - Use **Paste and Send** to paste from the clipboard and send in one tap.  
   - Long-press in the input field and **Paste** for standard paste, then press Enter to send.

5. **Disconnect**  
   Tap **Disconnect** when done.

## Permissions

- **INTERNET** – SSH to the VPS.
- **READ_EXTERNAL_STORAGE** / **READ_MEDIA_*** – Only for opening `.droplet` files via the file picker or system “Open with”; the app does not access storage beyond the file you choose.

## Security

- The private key from the `.droplet` file is kept in memory only for the session and is not written to disk in plain text.
- If you add saved connections later, store keys in Android Keystore / EncryptedSharedPreferences.
