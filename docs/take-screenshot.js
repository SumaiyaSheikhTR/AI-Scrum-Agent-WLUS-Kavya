const puppeteer = require('puppeteer');
const path = require('path');

/**
 * Script to take a screenshot of the AI Scrum Agent application
 * This can be used to generate a screenshot for the README.md file
 * 
 * Usage: node take-screenshot.js
 */

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
      width: 1280,
      height: 800
    }
  });

  try {
    const page = await browser.newPage();
    
    console.log('Navigating to application...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Wait for the application to load
    console.log('Waiting for application to load...');
    await page.waitForSelector('.MuiContainer-root', { timeout: 10000 });
    
    // Wait a bit more for any animations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take screenshot
    console.log('Taking screenshot...');
    const screenshotPath = path.join(__dirname, 'screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    
    console.log(`Screenshot saved to: ${screenshotPath}`);
  } catch (error) {
    console.error('Error taking screenshot:', error);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
