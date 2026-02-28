# Building APK for WildCats Radio Mobile App

This guide will walk you through building an APK file for your Expo React Native app.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** or **yarn**
3. **Expo CLI** (will be installed automatically)
4. **EAS CLI** (Expo Application Services)
5. **Expo Account** (free account works)

## Step 1: Install Dependencies

```bash
cd mobile_app
npm install
```

## Step 2: Install EAS CLI

```bash
npm install -g eas-cli
```

## Step 3: Login to Expo

```bash
eas login
```

If you don't have an Expo account, create one at [expo.dev](https://expo.dev)

## Step 4: Configure Your Project

The project is already configured with:
- `eas.json` - Build configuration
- `app.json` - App metadata with Android package name

### Update App Information (Optional)

Edit `app.json` to customize:
- **App Name**: Change `"name"` field
- **Package Name**: Change `android.package` (currently `com.wildcatsradio.mobileapp`)
- **Version**: Update `version` and `android.versionCode`

## Step 5: Build APK

### Option A: Preview/Internal Build (Recommended for Testing)

```bash
npm run build:android
```

This creates an APK that can be installed directly on Android devices.

### Option B: Production Build

```bash
npm run build:android:prod
```

### Option C: Development Build

```bash
npm run build:android:dev
```

## Step 6: Download Your APK

After the build completes:

1. EAS will provide a URL to download your APK
2. You can also find it in your Expo dashboard: [expo.dev/accounts/[your-username]/projects/mobile_app/builds](https://expo.dev)

## Step 7: Install APK on Android Device

### Method 1: Direct Download
1. Download the APK from the Expo dashboard
2. Transfer to your Android device
3. Enable "Install from Unknown Sources" in Android settings
4. Tap the APK file to install

### Method 2: QR Code
1. Scan the QR code provided after build completion
2. Download and install directly on your device

## Build Profiles Explained

### Development Profile
- Includes development client
- Debug build
- For testing during development

### Preview Profile
- APK format (installable)
- Internal distribution
- Best for testing before release

### Production Profile
- Optimized build
- Ready for Play Store (if configured)
- Can build AAB (Android App Bundle) or APK

## Troubleshooting

### Build Fails
1. Check your `app.json` configuration
2. Ensure all required assets exist in `assets/images/`
3. Verify your Expo account is logged in: `eas whoami`

### APK Won't Install
1. Enable "Install from Unknown Sources" in Android settings
2. Check Android version compatibility
3. Ensure sufficient storage space

### Network Issues
- Check your internet connection
- EAS builds run on Expo's servers, so you need internet access

## Local Build (Advanced)

If you want to build locally without EAS:

1. Install Android Studio and Android SDK
2. Configure environment variables
3. Run: `npx expo run:android --variant release`

**Note**: Local builds are more complex and require Android development setup.

## Updating Your App

To build a new version:

1. Update `version` in `app.json` (e.g., "1.0.1")
2. Increment `android.versionCode` (e.g., 2)
3. Run build command again

## Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Expo Android Configuration](https://docs.expo.dev/workflow/configuration/)
- [Expo Dashboard](https://expo.dev)

## Quick Commands Reference

```bash
# Login to Expo
eas login

# Check login status
eas whoami

# Build preview APK
npm run build:android

# Build production APK
npm run build:android:prod

# View build status
eas build:list

# Download latest build
eas build:download
```

## Notes

- First build may take 10-15 minutes
- Subsequent builds are faster (5-10 minutes)
- Free Expo accounts have build limits (check current limits at expo.dev)
- APK files are typically 20-50MB depending on dependencies


