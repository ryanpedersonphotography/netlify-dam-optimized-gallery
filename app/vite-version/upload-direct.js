import { getStore } from '@netlify/blobs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Your site ID from the debug info
const SITE_ID = '29376d4d-bc69-4953-8e64-bc64ece6e2fc';
const TOKEN = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_BLOB_TOKEN;

if (!TOKEN) {
  console.error('❌ Please set NETLIFY_AUTH_TOKEN or NETLIFY_BLOB_TOKEN environment variable');
  console.log('\n1. Go to: https://app.netlify.com/user/applications#personal-access-tokens');
  console.log('2. Click "New access token"');
  console.log('3. Give it a name like "Blob Upload"');
  console.log('4. Copy the token');
  console.log('5. Run: export NETLIFY_AUTH_TOKEN="your-token-here"');
  process.exit(1);
}

async function uploadAssets() {
  // Connect directly to the blob store
  const store = getStore({
    name: 'property-assets',
    siteID: SITE_ID,
    token: TOKEN
  });

  const assetsDir = path.join(__dirname, 'fred-format-2025');
  const files = fs.readdirSync(assetsDir)
    .filter(f => f.toLowerCase().endsWith('.jpg'));

  console.log(`📊 Found ${files.length} files to upload`);
  console.log('🚀 Using direct API to avoid CLI corruption bug\n');

  // First, let's test with the same file that failed
  console.log('🧪 Testing with the file that failed via CLI...');
  const testFile = '2025FRED_20250807180510_UNPICKED.jpg';
  const testPath = path.join(assetsDir, testFile);
  const testKey = 'test-api-upload';
  
  try {
    // Read file as buffer (binary)
    const buffer = fs.readFileSync(testPath);
    console.log(`📁 Original file size: ${buffer.length} bytes`);
    
    // Upload as binary
    await store.set(testKey, buffer);
    console.log('📤 Uploaded via API');
    
    // Verify by downloading
    const downloaded = await store.get(testKey, { type: 'arrayBuffer' });
    const downloadedBuffer = Buffer.from(downloaded);
    
    console.log(`📥 Downloaded size: ${downloadedBuffer.length} bytes`);
    
    // Save to test file
    fs.writeFileSync('test-api-download.jpg', downloadedBuffer);
    console.log('💾 Saved as test-api-download.jpg');
    console.log('🔍 Run: file test-api-download.jpg');
    console.log('   If it says "JPEG image data", we\'re good!\n');
    
    const proceed = true; // You can change this after checking the test file
    
    if (!proceed) {
      console.log('⏸️  Stopping for manual verification. Check test-api-download.jpg');
      return;
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
    return;
  }

  // Now upload all files
  console.log('📦 Starting full upload...\n');
  
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  const startTime = Date.now();

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(assetsDir, filename);
    const blobKey = filename.replace(/\.(jpg|JPG)$/, '');
    
    try {
      // Read file as binary buffer
      const buffer = fs.readFileSync(filePath);
      
      // Upload to blob store with metadata
      await store.set(blobKey, buffer, {
        metadata: {
          filename: filename,
          contentType: 'image/jpeg',
          size: buffer.length,
          uploadedAt: new Date().toISOString()
        }
      });
      
      successCount++;
      
      // Show progress
      if ((i + 1) % 25 === 0 || i === files.length - 1) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const rate = Math.round(successCount / elapsed * 60);
        console.log(`✅ Progress: ${i + 1}/${files.length} (${Math.round((i+1)/files.length*100)}%) - ${rate} files/min`);
      }
    } catch (error) {
      errorCount++;
      errors.push({ filename, error: error.message });
      console.log(`❌ Failed: ${filename} - ${error.message}`);
      
      // If we get too many errors, stop
      if (errorCount > 10) {
        console.log('\n⛔ Too many errors, stopping upload');
        break;
      }
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log('\n' + '='.repeat(50));
  console.log('📊 Upload Complete!');
  console.log('='.repeat(50));
  console.log(`✅ Successfully uploaded: ${successCount} files`);
  console.log(`❌ Failed uploads: ${errorCount} files`);
  console.log(`⏱️  Total time: ${totalTime} seconds`);
  
  if (errors.length > 0) {
    console.log('\n❌ Failed files:');
    errors.forEach(e => console.log(`  - ${e.filename}: ${e.error}`));
  }

  // Final verification
  if (successCount > 0) {
    console.log('\n🔍 Final verification...');
    const randomIndex = Math.floor(Math.random() * successCount);
    const randomFile = files[randomIndex];
    const randomKey = randomFile.replace(/\.(jpg|JPG)$/, '');
    
    try {
      const blob = await store.get(randomKey, { type: 'arrayBuffer' });
      console.log(`✅ Random check passed! Blob "${randomKey}" size: ${blob.byteLength} bytes`);
      console.log('\n🎉 Your images should now be accessible at:');
      console.log(`   https://solhem-digital-assets.netlify.app/api/asset-handler/serve?key=${randomKey}`);
    } catch (e) {
      console.log('⚠️ Could not verify random upload:', e.message);
    }
  }
}

// Run it!
uploadAssets().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});