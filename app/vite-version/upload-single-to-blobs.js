#!/usr/bin/env node

import fs from 'fs';
import { execSync } from 'child_process';

const testFile = 'fred-format-2025/2025FRED_20250807180510_UNPICKED.jpg';
const blobKey = 'parties/2025/the-archive/all/2025FRED_20250807180510_UNPICKED.jpg';

// Get file size for metadata
const stats = fs.statSync(testFile);
const fileSize = stats.size;

// Create metadata JSON
const metadata = {
  filename: '2025FRED_20250807180510_UNPICKED.jpg',
  size: fileSize,
  contentType: 'image/jpeg',
  uploadedAt: new Date().toISOString()
};

console.log('📤 Uploading test file with metadata...');
console.log(`File: ${testFile}`);
console.log(`Size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
console.log(`Key: ${blobKey}`);

// Upload using netlify CLI with metadata
try {
  // First delete if exists
  execSync(`netlify blobs:delete property-assets "${blobKey}" 2>/dev/null`, { stdio: 'ignore' });
} catch (e) {
  // Ignore if doesn't exist
}

// Upload with netlify CLI (note: CLI doesn't support metadata directly)
const result = execSync(`netlify blobs:set property-assets "${blobKey}" --input "${testFile}"`, { encoding: 'utf8' });
console.log(result);

console.log('✅ Upload complete!');
console.log(`\nTest URL: https://solhem-digital-assets.netlify.app/api/asset-handler/serve?key=${encodeURIComponent(blobKey)}`);