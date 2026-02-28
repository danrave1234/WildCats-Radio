# WildCats Radio Mobile App

This is the mobile application for WildCats Radio built with Expo and React Native.

## Quick Start

### Development

1. Install dependencies
   ```bash
   npm install
   ```

2. Start the development server
   ```bash
   npm start
   ```

3. Open the app
   - Press `a` for Android emulator
   - Press `i` for iOS simulator
   - Scan QR code with Expo Go app on your device

## Building APK

To build an APK file for Android:

1. **Install EAS CLI** (if not already installed)
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**
   ```bash
   eas login
   ```

3. **Build APK**
   ```bash
   npm run build:android
   ```

4. **Download and install** the APK from the Expo dashboard

📖 **For detailed build instructions, see [BUILD_APK_GUIDE.md](./BUILD_APK_GUIDE.md)**

## Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Start with Android emulator
- `npm run ios` - Start with iOS simulator
- `npm run web` - Start web version
- `npm run lint` - Run ESLint
- `npm run build:android` - Build preview APK
- `npm run build:android:prod` - Build production APK
- `npm run build:android:dev` - Build development APK

## Project Structure

```
mobile_app/
├── app/              # App screens and routes (Expo Router)
├── components/       # Reusable React components
├── services/         # API services and business logic
├── context/         # React Context providers
├── hooks/           # Custom React hooks
├── config.ts        # App configuration
├── assets/          # Images, fonts, and other assets
└── app.json         # Expo app configuration
```

## Configuration

App configuration is in `config.ts`. It automatically switches between:
- **Development**: Local backend (when `isDevelopment = true`)
- **Production**: Deployed backend at `https://api.wildcat-radio.live`

## Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
