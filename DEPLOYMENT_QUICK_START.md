# Quick Start: Build APK & Deploy to Vercel

## 🚀 Step 1: Build Mobile App APK

### Install EAS CLI
```bash
npm install -g eas-cli
```

### Login to Expo
```bash
eas login
```

### Build APK
```bash
cd mobile
npm install
npm run build:android
```

**Wait for build to complete** (10-20 minutes). You'll get a download link for the APK.

---

## 📱 Step 2: Host APK for QR Code Downloads

### Setup QR Installer (First Time Only)

1. **Create QR Installer Project:**
   ```bash
   cd ..
   mkdir qr-installer
   cd qr-installer
   mkdir public
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel
   ```
   - Follow the prompts
   - Note your deployment URL (e.g., `https://wildcat-radio-apk.vercel.app`)

### Deploy APK After Each Build

1. **Download APK from Expo:**
   - Go to [expo.dev](https://expo.dev) → Your project → Builds
   - Download the APK file

2. **Copy APK to QR Installer:**
   ```bash
   # Option A: Use the script (recommended)
   cd mobile
   node scripts/copy-apk-to-host.js ~/Downloads/app-release.apk
   
   # Option B: Manual copy
   # Copy the downloaded APK to: qr-installer/public/app-release.apk
   ```

3. **Deploy to Vercel:**
   ```bash
   cd ../qr-installer
   vercel --prod
   ```

4. **Your APK Download URL:**
   ```
   https://your-project.vercel.app/app-release.apk
   ```

5. **Generate QR Code:**
   - Use any QR code generator
   - Point it to: `https://your-project.vercel.app/app-release.apk`
   - Users can scan to download directly to their Android device

---

## 🌐 Step 2: Deploy Frontend to Vercel

### Option A: Deploy via Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your Git repository
4. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click "Deploy"

### Option B: Deploy via Vercel CLI

```bash
npm install -g vercel
cd frontend
vercel
```

Follow the prompts to deploy.

---

## ✅ Verification

### Mobile APK
- [ ] APK downloaded from EAS Build
- [ ] APK copied to `qr-installer/public/app-release.apk`
- [ ] QR installer deployed to Vercel
- [ ] APK accessible at `https://your-project.vercel.app/app-release.apk`
- [ ] QR code generated and tested
- [ ] APK tested on Android device
- [ ] App connects to backend API

### Frontend (Vercel)
- [ ] Site accessible at `your-project.vercel.app`
- [ ] All routes working (SPA routing)
- [ ] API connections working
- [ ] Environment variables set (if needed)

---

## 📝 Important Notes

1. **Mobile APK ≠ Vercel**: APKs are for Android devices, Vercel is for web apps
2. **Backend**: Must be deployed separately (Heroku, GCP, etc.)
3. **Environment Variables**: Set in Vercel dashboard if your frontend needs them
4. **Custom Domain**: Can be configured in Vercel dashboard after deployment

---

## 🔧 Troubleshooting

### APK Build Fails
- Check `mobile/app.json` has correct package name
- Verify all dependencies installed: `npm install`
- Check EAS status: `eas build:list`

### Vercel Deployment Fails
- Verify `frontend/vercel.json` exists
- Check build command: `npm run build`
- Verify output directory: `dist`
- Check Vercel build logs for errors

### Frontend Can't Connect to Backend
- Set environment variables in Vercel dashboard
- Verify backend CORS allows Vercel domain
- Check backend is deployed and accessible

