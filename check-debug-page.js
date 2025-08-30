const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting Puppeteer check...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (text.includes('[DEBUG]')) {
        console.log(`Browser ${type}: ${text}`);
      }
    });
    
    // Log network requests
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`Network Request: ${request.method()} ${request.url()}`);
      }
    });
    
    // Log network responses
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`Network Response: ${response.status()} ${response.url()}`);
      }
    });
    
    // Log any page errors
    page.on('error', err => {
      console.error('Page error:', err);
    });
    
    page.on('pageerror', err => {
      console.error('Page error:', err);
    });
    
    console.log('Navigating to debug-test page...');
    await page.goto('https://solhem-digital-assets.netlify.app/debug-test', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('Page loaded, waiting for content...');
    await page.waitForTimeout(3000); // Wait for async operations
    
    // Get page info
    const pageInfo = await page.evaluate(() => {
      const debugLogs = document.querySelector('.font-mono.text-xs');
      const images = document.querySelectorAll('img');
      const h1 = document.querySelector('h1');
      
      // Get image sources and load status
      const imageData = Array.from(images).map(img => ({
        src: img.src,
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        loaded: img.naturalWidth > 0
      }));
      
      // Get debug log text
      const debugText = debugLogs ? debugLogs.innerText : 'No debug logs found';
      
      return {
        title: h1 ? h1.innerText : 'No title',
        imageCount: images.length,
        images: imageData,
        debugLogExists: !!debugLogs,
        debugPreview: debugText.substring(0, 500)
      };
    });
    
    console.log('\n=== PAGE ANALYSIS ===');
    console.log('Title:', pageInfo.title);
    console.log('Total images found:', pageInfo.imageCount);
    console.log('Debug log present:', pageInfo.debugLogExists);
    
    console.log('\n=== IMAGE STATUS ===');
    pageInfo.images.forEach((img, index) => {
      console.log(`Image ${index + 1}:`);
      console.log(`  URL: ${img.src}`);
      console.log(`  Alt: ${img.alt}`);
      console.log(`  Loaded: ${img.loaded ? 'YES' : 'NO'}`);
      console.log(`  Dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
    });
    
    // Check for specific elements
    const checks = await page.evaluate(() => {
      const apiListUrl = Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent?.includes('/api/asset-handler/list')
      );
      const apiServeUrl = Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent?.includes('/api/asset-handler/serve')
      );
      const errorMessage = document.querySelector('.text-red-600');
      
      return {
        hasApiListReference: !!apiListUrl,
        hasApiServeReference: !!apiServeUrl,
        hasError: !!errorMessage,
        errorText: errorMessage?.textContent || null
      };
    });
    
    console.log('\n=== ELEMENT CHECKS ===');
    console.log('Has API list reference:', checks.hasApiListReference);
    console.log('Has API serve reference:', checks.hasApiServeReference);
    console.log('Has error message:', checks.hasError);
    if (checks.errorText) {
      console.log('Error text:', checks.errorText);
    }
    
    console.log('\n=== DEBUG LOG PREVIEW ===');
    console.log(pageInfo.debugPreview);
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'debug-test-screenshot.png',
      fullPage: true 
    });
    console.log('\nScreenshot saved as debug-test-screenshot.png');
    
  } catch (error) {
    console.error('Error during check:', error);
  } finally {
    await browser.close();
    console.log('\nPuppeteer check complete.');
  }
})();