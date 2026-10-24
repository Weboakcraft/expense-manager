# Oakcraft Expense — Android App (Capacitor)

This wraps the exact same web app (`/web`) into a native Android app and
produces an installable **APK**. One codebase → website + Android app.

There are two ways to ship Android. Pick one.

---

## Option A — PWA (no build tools, works today)

The website is already an installable app. On an Android phone:

1. Deploy the website (see `docs/DEPLOYMENT.md`) so it has an `https://` URL.
2. Open that URL in **Chrome** on the phone.
3. Menu (⋮) → **Add to Home screen** / **Install app**.

It installs with the Oakcraft icon, opens full-screen, works offline, and
updates automatically whenever you redeploy. For most teams this is all you need.

---

## Option B — Build a real signed APK with Capacitor

Use this if you need an actual `.apk` file to sideload or distribute.

### Prerequisites (one-time, on your computer — not in the cloud)
- **Node.js 18+** and npm
- **Android Studio** (includes the Android SDK + Gradle + a JDK)
- Set `ANDROID_HOME` / `JAVA_HOME` (Android Studio does this for you)

### Build steps
```bash
cd android
npm install                 # installs Capacitor
npx cap add android         # generates the native android/ project (first time only)
npx cap sync                # copies /web into the native project
npx cap open android        # opens Android Studio
```
Then in Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**.

Or fully from the command line:
```bash
npx cap sync
cd android
./gradlew assembleDebug     # -> android/app/build/outputs/apk/debug/app-debug.apk
```
`app-debug.apk` installs on any phone with "Install unknown apps" enabled.

### Signed release APK (for real distribution)
```bash
# 1) create a keystore once (keep the .jks + passwords safe)
keytool -genkey -v -keystore oakcraft.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias oakcraft

# 2) tell Gradle about it — add to android/app/build.gradle (signingConfigs)
#    then:
cd android
./gradlew assembleRelease   # -> app/build/outputs/apk/release/app-release.apk
```

### Point the app at your backend
The app loads the bundled `/web`. Before building, set your live backend in
`web/js/config.js` (`API_URL` = your Apps Script `/exec` URL). Rebuild to pick
up changes, or use Option A (PWA) which updates without any rebuild.

> **Why isn't a prebuilt APK included?** A signed APK must be compiled with the
> Android SDK/Gradle and signed with *your* private keystore (which should never
> leave your machine). The project here produces that APK in ~2 commands.
