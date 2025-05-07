# WildCats Radio Mobile App

This is the mobile application for WildCats Radio built using React Native with Expo.

## Prerequisites

- Node.js (v14 or newer)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your mobile device
- EAS CLI (`npm install -g eas-cli`) for building app binaries

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

2. Start the development server:
   ```bash
   npx expo start
   ```

## Building the App for Production

### Setup EAS Build

1. Install the EAS CLI if you haven't already:
   ```bash
   npm install -g eas-cli
   ```

2. Log in to your Expo account:
   ```bash
   eas login
   ```

3. Configure your project (Run this once to set up your project):
   ```bash
   eas build:configure
   ```

### Build for Android

To create an APK for testing (easier to share directly):
```bash
eas build --platform android --profile preview
```

To create an AAB for Google Play Store:
```bash
eas build --platform android --profile production
```

### Build for iOS

To create a build for TestFlight:
```bash
eas build --platform ios --profile preview
```

To create a build for App Store:
```bash
eas build --platform ios --profile production
```

### Installing on Your Device

#### Android
- For development: Use Expo Go by scanning the QR code
- For testing: Download the APK from the EAS build URL and install it directly
- For production: Download from Google Play Store when published

#### iOS
- For development: Use Expo Go by scanning the QR code
- For testing: Use TestFlight with an invitation
- For production: Download from App Store when published

## EAS Build Profiles

The build profiles are defined in the `eas.json` file at the root of your project.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
