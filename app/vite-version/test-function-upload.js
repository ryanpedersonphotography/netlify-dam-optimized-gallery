#!/usr/bin/env node

import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

const testFile = 'fred-format-2025/2025FRED_20250807181414_PICKED.jpg'; // Different file for testing
const blobKey = 'parties/2025/the-archive/all/2025FRED_20250807181414_PICKED.jpg';
const filename = '2025FRED_20250807181414_PICKED.jpg';

console.log('🧪 Testing single file upload via Function API...\n');

async function testUpload() {
  try {
    const stats = fs.statSync(testFile);
    console.log(`📁 File: ${testFile}`);
    console.log(`📏 Size: ${(stats.size / (1024 * 1024)).toFixed(2)}MB`);
    console.log(`🔑 Blob Key: ${blobKey}`);
    console.log(`🌐 Uploading to production function...\n`);

    const formData = new FormData();
    formData.append('asset', fs.createReadStream(testFile), {
      filename: filename,
      contentType: 'image/jpeg'
    });
    formData.append('blobKey', blobKey);
    formData.append('filename', filename);

    const response = await fetch('https://solhem-digital-assets.netlify.app/api/asset-handler/upload', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    console.log('Response status:', response.status, response.statusText);
    
    const result = await response.text();
    console.log('Response body:', result);

    if (response.ok) {
      console.log('\n✅ Upload successful!');
      console.log('\n🖼️ View image at:');
      const viewUrl = `https://solhem-digital-assets.netlify.app/api/asset-handler/serve?key=${encodeURIComponent(blobKey)}`;
      console.log(viewUrl);
      console.log('\n📝 Test page URL:');
      console.log(`file://${process.cwd()}/test-blob-image.html`);
      
      // Update the test page with new image
      const testPagePath = 'test-blob-image.html';
      let testPageContent = fs.readFileSync(testPagePath, 'utf8');
      testPageContent = testPageContent.replace(
        /2025FRED_20250807180510_UNPICKED\.jpg/g,
        '2025FRED_20250807181414_PICKED.jpg'
      );
      fs.writeFileSync(testPagePath, testPageContent);
      console.log('\n✏️ Updated test page with new image');
      
    } else {
      console.log('❌ Upload failed');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testUpload();