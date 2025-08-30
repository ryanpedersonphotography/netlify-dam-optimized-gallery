#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node upload-to-blobs.js <source-dir> <year>');
  console.log('Example: node upload-to-blobs.js "/path/to/photos" 2022');
  process.exit(1);
}

const sourceDir = args[0];
const year = args[1];

if (!fs.existsSync(sourceDir)) {
  console.error(`Directory not found: ${sourceDir}`);
  process.exit(1);
}

console.log(`\n📤 Uploading photos from ${sourceDir}`);
console.log(`📅 Year: ${year}`);
console.log(`🎯 Uploading to: parties/${year}/the-archive/\n`);

// Get all image files
const files = fs.readdirSync(sourceDir)
  .filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.jpg', '.jpeg'].includes(ext) && fs.statSync(path.join(sourceDir, f)).isFile();
  })
  .sort();

console.log(`Found ${files.length} files to upload\n`);

let successCount = 0;
let errorCount = 0;
const errors = [];
const startTime = Date.now();

for (let i = 0; i < files.length; i++) {
  const filename = files[i];
  const filePath = path.join(sourceDir, filename);
  
  // Remove extension to get blob key
  const baseKey = filename.replace(/\.(jpg|JPG|jpeg|JPEG)$/, '');
  const blobKey = `parties/${year}/the-archive/${baseKey}`;
  
  try {
    // Read file and convert to base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    
    // Create temporary base64 file
    const tempFile = path.join(__dirname, 'temp-upload.b64');
    fs.writeFileSync(tempFile, base64Data);
    
    // Upload base64 data using CLI
    execSync(`netlify blobs:set property-assets "${blobKey}" -i "${tempFile}"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    successCount++;
    
    // Show progress
    if ((i + 1) % 10 === 0 || i === files.length - 1) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const rate = elapsed > 0 ? Math.round(successCount / elapsed) : 0;
      console.log(`✅ Progress: ${i + 1}/${files.length} - ${filename} (${rate} files/sec)`);
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
console.log(`✅ Successfully uploaded: ${successCount} files`);
console.log(`❌ Failed uploads: ${errorCount} files`);
console.log(`⏱️  Total time: ${totalTime} seconds (${totalTime > 0 ? Math.round(successCount/totalTime) : 0} files/sec)`);
console.log(`🌐 Gallery URL: http://localhost:4200/event/the-archive/${year}`);

if (errors.length > 0) {
  console.log('\n❌ Errors:');
  errors.slice(0, 10).forEach(e => console.log(`  - ${e.filename}: ${e.error}`));
  if (errors.length > 10) {
    console.log(`  ... and ${errors.length - 10} more errors`);
  }
}