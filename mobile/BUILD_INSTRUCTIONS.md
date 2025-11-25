# Building WildCat Radio Mobile App

## Prerequisites

1. **Install EAS CLI** (Expo Application Services)
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**
   ```bash
   eas login
   ```

3. **Configure EAS** (if not already done)
   ```bash
   eas build:configure
   ```

## Building APK for Android

### Option 1: Build APK using EAS Build (Recommended - Cloud Build)

This builds the APK in the cloud. No local Android SDK needed.

```bash
# Build preview APK (for testing)
npm run build:android

# Build production APK
npm run build:android:prod
```

The build will:
- Upload your code to Expo's servers
- Build the APK in the cloud
- Provide a download link when complete

**Download the APK:**
- After build completes, you'll get a URL to download the APK
- Or run: `eas build:list` to see all builds and download links

### Option 2: Build APK Locally (Requires Android Studio)

If you have Android Studio installed:

```bash
# Install dependencies
npm install

# Prebuild native code
npx expo prebuild --platform android

# Build APK
cd android
./gradlew assembleRelease

# APK will be at: android/app/build/outputs/apk/release/app-release.apk
```

## Building for iOS

```bash
# Build iOS app (requires Apple Developer account)
npm run build:ios
```

## Environment Variables

Make sure your environment variables are set in:
- `mobile/config/environment.ts` - For API URLs and configuration

## Build Profiles

The `eas.json` file defines three build profiles:

1. **development** - For development builds with Expo Go
2. **preview** - For internal testing (APK)
3. **production** - For production releases (APK/AAB)

## Troubleshooting

### Build Fails
- Check that all dependencies are installed: `npm install`
- Verify `app.json` has correct package name and version
- Check EAS status: `eas build:list`

### APK Too Large
- The APK includes all assets and dependencies
- Production builds are optimized automatically
- Consider using AAB format for Google Play Store

### Missing Permissions
- Check `app.json` → `android.permissions` array
- Add any missing permissions your app needs

## Distribution

### QR Code Installation (Recommended)

After building the APK, host it for easy QR code downloads:

1. **Download APK from Expo:**
   - Go to [expo.dev](https://expo.dev) → Your project → Builds
   - Download the completed APK

2. **Copy to QR Installer:**
   ```bash
   # From mobile directory
   node scripts/copy-apk-to-host.js <path-to-downloaded-apk>
   ```

3. **Deploy to Vercel:**
   ```bash
   cd ../qr-installer
   vercel --prod
   ```

4. **Generate QR Code:**
   - URL: `https://your-project.vercel.app/app-release.apk`
   - Use any QR code generator
   - Users scan to download directly

### Direct Download
- Share the Vercel URL: `https://your-project.vercel.app/app-release.apk`
- Users can download directly from browser

### Internal Testing
- Share the APK download link directly
- Install via: `adb install app.apk`

### Google Play Store
- Build AAB format: `eas build --platform android --profile production`
- Upload to Google Play Console

## Notes

- **APK Size**: First build may be large (~50-100MB) due to bundled assets
- **Build Time**: Cloud builds take 10-20 minutes
- **Free Tier**: EAS Build has a free tier with limited builds per month

