# Vercel Deployment Guide

## Frontend Web App Deployment

The frontend web application is already configured for Vercel deployment.

### Quick Deploy

1. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your Git repository
   - Set root directory to `frontend`

2. **Environment Variables** (if needed)
   Add these in Vercel dashboard → Settings → Environment Variables:
   ```
   VITE_API_BASE_URL=https://your-backend-url.com
   VITE_WS_BASE_URL=wss://your-backend-url.com
   VITE_SOCKJS_BASE_URL=https://your-backend-url.com
   ```

3. **Build Settings**
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Deploy**
   - Click "Deploy"
   - Vercel will automatically build and deploy

### Manual Deployment

```bash
cd frontend
npm install
npm run build
# Upload the 'dist' folder to Vercel
```

### Configuration Files

- `frontend/vercel.json` - Already configured for SPA routing
- `frontend/vite.config.js` - Build configuration
- `frontend/package.json` - Dependencies and scripts

## Mobile App (APK) - NOT for Vercel

**Important**: Mobile apps (APK/IPA) cannot be deployed to Vercel. Vercel is for web applications only.

For mobile app distribution:
- **APK**: Build using EAS Build (see `mobile/BUILD_INSTRUCTIONS.md`)
- **Distribution**: Share APK directly or upload to Google Play Store

## Project Structure

```
WildCats-Radio/
├── frontend/          # Web app (deploy to Vercel)
│   ├── vercel.json   # Vercel configuration
│   ├── package.json
│   └── dist/         # Build output
│
├── mobile/           # Mobile app (build APK, NOT for Vercel)
│   ├── eas.json      # EAS Build configuration
│   └── BUILD_INSTRUCTIONS.md
│
└── backend/          # Backend API (deploy separately)
```

## Deployment Checklist

### Frontend (Vercel)
- [x] `vercel.json` configured
- [x] Build command: `npm run build`
- [x] Output directory: `dist`
- [ ] Environment variables set (if needed)
- [ ] Custom domain configured (optional)

### Mobile (APK)
- [x] `eas.json` configured
- [x] `app.json` configured with package name
- [ ] EAS CLI installed and logged in
- [ ] APK built using `npm run build:android`
- [ ] APK tested on device

### Backend
- [ ] Deployed to Heroku/GCP/other hosting
- [ ] Environment variables configured
- [ ] Database connected
- [ ] CORS configured for frontend domain

## Notes

- **Frontend**: Automatically detects environment (local vs deployed)
- **Mobile**: Requires separate build process (not web-based)
- **Backend**: Must be deployed separately (not on Vercel)

