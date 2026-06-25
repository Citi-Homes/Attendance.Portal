# Citi Homes Attendance — Android App (APK)

The Android app wraps the same portal as GitHub Pages. It connects to **Supabase** for data and uses **native GPS** with location permissions.

## What the app includes

- Employee punch in/out, admin login (same as web)
- Cloud sync via Supabase
- **Android location permissions** (Fine + Coarse GPS)
- High-accuracy GPS on punch (`enableHighAccuracy`)

## Prerequisites

1. **Node.js** — https://nodejs.org  
2. **Android Studio** — https://developer.android.com/studio  
   - During setup, install **Android SDK** and **JDK 17+**

## Build the APK (Windows)

### Option A — One-click script

```bat
BUILD-APK.bat
```

Output: `android\app\build\outputs\apk\debug\app-debug.apk`

### Option B — Android Studio (recommended for release)

```bat
npm install
npm run cap:sync
npm run cap:open
```

In Android Studio:

1. Wait for Gradle sync to finish  
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**  
3. APK path shown in the notification  

## Install on staff phones

1. Copy `app-debug.apk` to the phone (email, USB, Teams, etc.)  
2. Open the file and allow **Install from unknown sources** if prompted  
3. Open **Citi Homes Attendance**  
4. Sign in as employee  
5. When asked, tap **Allow** for **Location** (required for attendance GPS)

## Update the app after code changes

```bat
npm run cap:sync
```

Then rebuild the APK in Android Studio or run `BUILD-APK.bat` again.

## Release APK (Play Store / production)

In Android Studio: **Build → Generate Signed Bundle / APK**

You need a keystore (create once, keep safe).

## App ID

`ae.citihomes.attendance`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Location shows Denied | Phone Settings → Apps → Citi Homes Attendance → Permissions → Location → Allow |
| Location Unavailable | Enable GPS on phone, go outdoors briefly, retry punch |
| Login fails | Same credentials as web; hard refresh if using old APK |
| Build fails | Open `android` in Android Studio and sync Gradle |

## Technical notes

- Web files are bundled in `www/` via `npm run build:android:www`
- Capacitor loads `@capacitor/geolocation` for native GPS
- Data still stored in Supabase — not on the phone
