#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const FRED_DIR = path.join(__dirname, 'fred-format-2025');
const API_URL = 'https://solhem-digital-assets.netlify.app/api/asset-handler/upload';
const BATCH_SIZE = 5; // Upload 5 files at a time to avoid overwhelming

console.log('🚀 Starting asset upload to Netlify Blobs via Function API...\n');

async function uploadAsset(filePath, blobKey, filename) {
  try {
    const stats = fs.statSync(filePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    const formData = new FormData();
    formData.append('asset', fs.createReadStream(filePath), {
      filename: filename,
      contentType: 'image/jpeg'
    });
    formData.append('blobKey', blobKey);
    formData.append('filename', filename);

    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log(`  ✅ ${filename} (${fileSizeMB}MB)`);
    return result;
  } catch (error) {
    console.error(`  ❌ ${filename}: ${error.message}`);
    return null;
  }
}

async function uploadBatch(files, startIdx, endIdx) {
  const batch = files.slice(startIdx, endIdx);
  const promises = batch.map(file => {
    const filePath = path.join(FRED_DIR, file);
    const blobKey = `parties/2025/the-archive/all/${file}`;
    return uploadAsset(filePath, blobKey, file);
  });
  
  return Promise.all(promises);
}

async function main() {
  // Get all JPEG files
  const files = fs.readdirSync(FRED_DIR)
    .filter(file => /\.jpg$/i.test(file))
    .sort();

  console.log(`📊 Found ${files.length} files to upload`);
  console.log(`📍 Destination: Netlify Blobs (property-assets store)`);
  console.log(`🌐 API Endpoint: ${API_URL}\n`);

  const totalFiles = files.length;
  let uploadedCount = 0;
  let failedCount = 0;

  // Process in batches
  for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, totalFiles);
    console.log(`\n📦 Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(totalFiles/BATCH_SIZE)} (files ${i+1}-${batchEnd}):`);
    
    const results = await uploadBatch(files, i, batchEnd);
    
    results.forEach(result => {
      if (result) uploadedCount++;
      else failedCount++;
    });
    
    // Small delay between batches
    if (batchEnd < totalFiles) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📈 Upload Summary:');
  console.log(`   ✅ Successfully uploaded: ${uploadedCount}/${totalFiles}`);
  if (failedCount > 0) {
    console.log(`   ❌ Failed: ${failedCount}`);
  }
  console.log('='.repeat(50));

  if (uploadedCount > 0) {
    console.log('\n🎉 Assets are now available at:');
    console.log(`   https://solhem-digital-assets.netlify.app/api/asset-handler/serve?key=parties/2025/the-archive/all/[filename]`);
    console.log('\nExample:');
    const exampleFile = files[0];
    console.log(`   https://solhem-digital-assets.netlify.app/api/asset-handler/serve?key=${encodeURIComponent(`parties/2025/the-archive/all/${exampleFile}`)}`);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}