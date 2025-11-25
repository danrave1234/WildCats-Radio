#!/usr/bin/env node

/**
 * Script to copy APK from EAS build to qr-installer folder
 * 
 * Usage:
 *   node scripts/copy-apk-to-host.js <path-to-apk>
 * 
 * Example:
 *   node scripts/copy-apk-to-host.js ~/Downloads/app-release.apk
 */

const fs = require('fs');
const path = require('path');

const APK_SOURCE = process.argv[2];
const QR_INSTALLER_DIR = path.join(__dirname, '../../qr-installer/public');
const APK_DEST = path.join(QR_INSTALLER_DIR, 'app-release.apk');

if (!APK_SOURCE) {
  console.error('❌ Error: Please provide the path to the APK file');
  console.log('\nUsage: node scripts/copy-apk-to-host.js <path-to-apk>');
  console.log('\nExample:');
  console.log('  node scripts/copy-apk-to-host.js ~/Downloads/app-release.apk');
  process.exit(1);
}

if (!fs.existsSync(APK_SOURCE)) {
  console.error(`❌ Error: APK file not found at: ${APK_SOURCE}`);
  process.exit(1);
}

// Ensure qr-installer/public directory exists
if (!fs.existsSync(QR_INSTALLER_DIR)) {
  console.log('📁 Creating qr-installer/public directory...');
  fs.mkdirSync(QR_INSTALLER_DIR, { recursive: true });
}

try {
  console.log('📦 Copying APK to qr-installer...');
  fs.copyFileSync(APK_SOURCE, APK_DEST);
  
  const stats = fs.statSync(APK_DEST);
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  
  console.log('✅ APK copied successfully!');
  console.log(`   Location: ${APK_DEST}`);
  console.log(`   Size: ${sizeInMB} MB`);
  console.log('\n📤 Next steps:');
  console.log('   1. cd ../../qr-installer');
  console.log('   2. vercel --prod');
  console.log('   3. Generate QR code for: https://your-project.vercel.app/app-release.apk');
} catch (error) {
  console.error('❌ Error copying APK:', error.message);
  process.exit(1);
}

