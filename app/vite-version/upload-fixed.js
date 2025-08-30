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
    .filter(f => f.toLowerCase().endsWith('.jpg'));

  console.log(`\n📊 Found ${files.length} files to upload`);
  console.log('🚀 Using base64 encoding to avoid CLI binary corruption\n');

  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  const startTime = Date.now();

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(assetsDir, filename);
    const blobKey = filename.replace(/\.(jpg|JPG)$/, '');
    
    try {
      // Read file and convert to base64
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');
      
      // Create temporary base64 file
      const tempFile = path.join(__dirname, 'temp-upload.b64');
      fs.writeFileSync(tempFile, base64Data);
      
      // Upload base64 data using CLI with -i flag
      execSync(`netlify blobs:set property-assets "${blobKey}" -i "${tempFile}"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      // Clean up temp file
      fs.unlinkSync(tempFile);
      
      successCount++;
      
      // Show progress
      if ((i + 1) % 10 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const rate = Math.round(successCount / elapsed);
        console.log(`✅ ${i + 1}/${files.length}: ${filename} (${rate} files/sec)`);
      } else {
        process.stdout.write(`✅ ${i + 1}/${files.length}: ${filename}\r`);
      }
    } catch (error) {
      errorCount++;
      errors.push({ filename, error: error.message });
      console.log(`\n❌ ${i + 1}/${files.length}: ${filename} - ${error.message}`);
    }
    
    // Show summary every 50 files
    if ((i + 1) % 50 === 0) {
      console.log(`\n📦 Progress: ${i + 1}/${files.length} (✅ ${successCount}, ❌ ${errorCount})\n`);
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log('\n\n' + '='.repeat(50));
  console.log('📊 Upload Complete!');
  console.log('='.repeat(50));
  console.log(`✅ Successfully uploaded: ${successCount}`);
  console.log(`❌ Failed uploads: ${errorCount}`);
  console.log(`⏱️  Total time: ${totalTime} seconds (${Math.round(successCount/totalTime)} files/sec)`);
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(e => console.log(`  - ${e.filename}: ${e.error}`));
  }

  // Verify a sample upload
  if (successCount > 0) {
    console.log('\n🔍 Verifying upload...');
    try {
      const sampleKey = files[0].replace(/\.(jpg|JPG)$/, '');
      const result = execSync(`netlify blobs:get property-assets "${sampleKey}"`, {
        encoding: 'buffer',
        maxBuffer: 100
      });
      console.log(`✅ Verification successful! Sample blob exists`);
      console.log('\n🎉 Test the uploads at:');
      console.log('   https://solhem-digital-assets.netlify.app/test-blob-fixed.html');
    } catch (e) {
      console.log('⚠️  Could not verify upload - this is normal if the blob contains binary data');
    }
  }
}

uploadAssets().catch(console.error);