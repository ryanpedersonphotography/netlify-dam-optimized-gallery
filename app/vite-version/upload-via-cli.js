#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.join(__dirname, 'fred-format-2025');

async function uploadAssets() {
  const files = fs.readdirSync(assetsDir)
    .filter(f => f.endsWith('.jpg') || f.endsWith('.JPG'));

  console.log(`\n📊 Found ${files.length} files to upload`);
  console.log('📍 Using Netlify CLI to upload to blob store\n');

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(assetsDir, filename);
    const blobKey = filename.replace('.jpg', '').replace('.JPG', '');
    
    try {
      // Upload using Netlify CLI with -i flag to upload binary content
      execSync(`netlify blobs:set property-assets "${blobKey}" -i "${filePath}"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      successCount++;
      process.stdout.write(`✅ ${i + 1}/${files.length}: ${filename}\r`);
    } catch (error) {
      errorCount++;
      errors.push({ filename, error: error.message });
      process.stdout.write(`❌ ${i + 1}/${files.length}: ${filename}\r`);
    }
    
    // Show progress every 50 files
    if ((i + 1) % 50 === 0 || i === files.length - 1) {
      console.log(`\n📦 Progress: ${i + 1}/${files.length} (✅ ${successCount}, ❌ ${errorCount})`);
    }
  }

  console.log('\n\n📊 Upload Complete:');
  console.log(`✅ Successfully uploaded: ${successCount}`);
  console.log(`❌ Failed uploads: ${errorCount}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(e => console.log(`  - ${e.filename}: ${e.error}`));
  }
}

uploadAssets().catch(console.error);