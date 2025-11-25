# WildCat Radio APK Host

This is a simple static site to host the WildCat Radio mobile app APK for QR code downloads.

## Setup

1. **Deploy to Vercel:**
   ```bash
   vercel
   ```

2. **Get your URL:**
   After deployment, you'll get a URL like: `https://wildcat-radio-apk.vercel.app`

3. **APK Download URL:**
   Your APK will be available at: `https://your-project.vercel.app/app-release.apk`

## Adding APK

1. Build APK using EAS Build
2. Download the APK from Expo dashboard
3. Place it in `public/app-release.apk`
4. Deploy:
   ```bash
   vercel --prod
   ```

## QR Code

Generate a QR code pointing to:
```
https://your-project.vercel.app/app-release.apk
```

Users can scan the QR code to download and install the app directly on their Android devices.

