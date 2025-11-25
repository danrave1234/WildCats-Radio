# APK Hosting Setup for QR Code Downloads

## Overview

This setup allows users to download the WildCat Radio APK via QR code. The APK is hosted on Vercel as a static file.

## Project Structure

```
WildCats-Radio/
├── frontend/          # Web app (deploy to Vercel)
├── mobile/           # Mobile app source
└── qr-installer/      # APK hosting (separate Vercel project)
    └── public/
        ├── index.html          # Download page
        └── app-release.apk     # APK file (add after build)
```

## Initial Setup (One Time)

### 1. Create QR Installer Project

The `qr-installer/` folder is already created. If you need to recreate it:

```bash
mkdir qr-installer
mkdir qr-installer/public
```

### 2. Deploy to Vercel

```bash
cd qr-installer
vercel
```

Follow the prompts:
- **Set up and deploy?** Yes
- **Which scope?** Your account
- **Link to existing project?** No (first time)
- **Project name?** `wildcat-radio-apk` (or your choice)
- **Directory?** `./` (current directory)

**Save the deployment URL** - you'll need it for the QR code!

Example URL: `https://wildcat-radio-apk.vercel.app`

## Workflow: Build → Host → QR Code

### Step 1: Build APK

```bash
cd mobile
npm run build:android
```

Wait for build to complete (10-20 minutes).

### Step 2: Download APK

1. Go to [expo.dev](https://expo.dev)
2. Navigate to your project → Builds
3. Download the completed APK

### Step 3: Copy APK to QR Installer

**Option A: Use the script (recommended)**
```bash
cd mobile
node scripts/copy-apk-to-host.js <path-to-downloaded-apk>
```

**Option B: Manual copy**
```bash
# Copy the downloaded APK to:
# qr-installer/public/app-release.apk
```

### Step 4: Deploy to Vercel

```bash
cd ../qr-installer
vercel --prod
```

This updates the hosted APK with the new version.

### Step 5: Generate QR Code

**APK Download URL:**
```
https://your-project.vercel.app/app-release.apk
```

**QR Code Generators:**
- [QR Code Generator](https://www.qr-code-generator.com/)
- [QRCode Monkey](https://www.qrcode-monkey.com/)
- Any QR code generator

**QR Code should point to:**
```
https://your-project.vercel.app/app-release.apk
```

## Features

### Download Page
- Beautiful landing page at: `https://your-project.vercel.app/`
- Direct download button
- Installation instructions
- Mobile-friendly design

### Direct APK Link
- Direct download: `https://your-project.vercel.app/app-release.apk`
- Proper MIME type headers
- No caching (always fresh APK)

## Automation Script

The `mobile/scripts/copy-apk-to-host.js` script automates copying the APK:

```bash
# Usage
node scripts/copy-apk-to-host.js <path-to-apk>

# Example
node scripts/copy-apk-to-host.js ~/Downloads/app-release.apk
```

## Updating APK

Every time you build a new APK:

1. Build: `npm run build:android`
2. Download from Expo dashboard
3. Copy: `node scripts/copy-apk-to-host.js <path>`
4. Deploy: `cd ../qr-installer && vercel --prod`

The old APK is replaced with the new one.

## Testing

1. **Test Download Page:**
   - Visit: `https://your-project.vercel.app/`
   - Should show download page

2. **Test APK Download:**
   - Visit: `https://your-project.vercel.app/app-release.apk`
   - Should download the APK file

3. **Test QR Code:**
   - Generate QR code
   - Scan with Android device
   - Should open download page or download directly

## Troubleshooting

### APK Not Found (404)
- Verify APK is in `qr-installer/public/app-release.apk`
- Check file name is exactly `app-release.apk`
- Redeploy: `vercel --prod`

### Download Fails
- Check APK file size (should be ~50-100MB)
- Verify file isn't corrupted
- Check Vercel deployment logs

### QR Code Doesn't Work
- Verify URL is correct: `https://your-project.vercel.app/app-release.apk`
- Test URL in browser first
- Ensure QR code points to full URL (not shortened)

## Notes

- **Separate Vercel Project**: This is different from your frontend web app
- **No Build Process**: This is just static file hosting
- **Always Use --prod**: Use `vercel --prod` to update production
- **File Name**: Must be exactly `app-release.apk` in the public folder

