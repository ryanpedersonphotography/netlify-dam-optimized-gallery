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
  console.log('Usage: node rename-with-exif.js <source-dir> <year>');
  console.log('Example: node rename-with-exif.js "/path/to/photos" 2022');
  process.exit(1);
}

const sourceDir = args[0];
const year = args[1];
const dryRun = args.includes('--dry-run');

if (!fs.existsSync(sourceDir)) {
  console.error(`Directory not found: ${sourceDir}`);
  process.exit(1);
}

// Create output directory
const outputDir = path.join(sourceDir, `renamed-${year}`);
if (!dryRun && !fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`\n📸 Renaming photos from ${sourceDir}`);
console.log(`📅 Year: ${year}`);
console.log(`📁 Output: ${outputDir}`);
console.log(`🔍 Mode: ${dryRun ? 'DRY RUN' : 'ACTUAL RENAME'}\n`);

// Get all image files
const files = fs.readdirSync(sourceDir)
  .filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.jpg', '.jpeg', '.png'].includes(ext) && fs.statSync(path.join(sourceDir, f)).isFile();
  })
  .sort();

console.log(`Found ${files.length} image files\n`);

let successCount = 0;
let errorCount = 0;
const errors = [];
const renamedFiles = [];

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const filePath = path.join(sourceDir, file);
  
  try {
    // Get EXIF data using exiftool
    let exifOutput;
    try {
      exifOutput = execSync(`exiftool -DateTimeOriginal -CreateDate -ModifyDate -FileModifyDate -s -s -s "${filePath}"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (e) {
      // If exiftool fails, try to get file modification date
      const stats = fs.statSync(filePath);
      const date = stats.mtime;
      exifOutput = formatDate(date);
    }
    
    // Parse the date from EXIF output
    const lines = exifOutput.trim().split('\n').filter(l => l);
    let dateStr = null;
    
    // Try to find a valid date from EXIF
    for (const line of lines) {
      if (line && line.match(/\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}/)) {
        dateStr = line;
        break;
      }
    }
    
    // If no EXIF date, use file modification date
    if (!dateStr) {
      const stats = fs.statSync(filePath);
      dateStr = formatDate(stats.mtime);
    }
    
    // Convert date to our format: YYYYMMDDHHMMSS
    const dateParts = dateStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    let timestamp;
    
    if (dateParts) {
      const [_, y, mo, d, h, mi, s] = dateParts;
      timestamp = `${y}${mo}${d}${h}${mi}${s}`;
    } else {
      // Fallback: use current timestamp with incrementing seconds
      const now = new Date();
      timestamp = `${year}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(i).padStart(2, '0')}`;
    }
    
    // Create new filename
    const newFilename = `${year}FRED_${timestamp}_UNPICKED.jpg`;
    const newPath = path.join(outputDir, newFilename);
    
    // Check if file already exists and add suffix if needed
    let finalFilename = newFilename;
    let finalPath = newPath;
    let suffix = 1;
    
    while (!dryRun && fs.existsSync(finalPath)) {
      finalFilename = `${year}FRED_${timestamp}_${suffix}_UNPICKED.jpg`;
      finalPath = path.join(outputDir, finalFilename);
      suffix++;
    }
    
    if (dryRun) {
      console.log(`✅ Would rename: ${file} → ${finalFilename}`);
    } else {
      // Copy file with new name
      fs.copyFileSync(filePath, finalPath);
      console.log(`✅ Renamed: ${file} → ${finalFilename}`);
    }
    
    renamedFiles.push({
      original: file,
      renamed: finalFilename,
      timestamp: timestamp
    });
    
    successCount++;
    
  } catch (error) {
    errorCount++;
    errors.push({ file, error: error.message });
    console.log(`❌ Error processing ${file}: ${error.message}`);
  }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Rename Summary');
console.log('='.repeat(50));
console.log(`✅ Successfully processed: ${successCount} files`);
console.log(`❌ Errors: ${errorCount} files`);

if (!dryRun) {
  console.log(`📁 Renamed files saved to: ${outputDir}`);
  
  // Save mapping file
  const mappingFile = path.join(outputDir, 'rename-mapping.json');
  fs.writeFileSync(mappingFile, JSON.stringify(renamedFiles, null, 2));
  console.log(`📝 Mapping saved to: ${mappingFile}`);
}

if (errors.length > 0) {
  console.log('\n❌ Errors:');
  errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
}

if (dryRun) {
  console.log('\n💡 This was a dry run. Use without --dry-run to actually rename files.');
}

function formatDate(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}:${mo}:${d} ${h}:${mi}:${s}`;
}