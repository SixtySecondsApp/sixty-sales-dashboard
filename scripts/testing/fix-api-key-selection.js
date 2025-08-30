// Fix API Key Selection - Run this in browser console
// This will manually set an API key for testing if the UI buttons aren't working

console.log('🔧 Fixing API Key Selection...');

// Try to find the API testing page component and set an API key
try {
  // Get all available API keys from the page
  const apiKeyElements = document.querySelectorAll('[class*="font-mono"]');
  let foundKey = null;
  
  // Look for API keys starting with 'sk_'
  apiKeyElements.forEach(element => {
    const text = element.textContent;
    if (text && text.startsWith('sk_')) {
      foundKey = text;
      console.log('Found API key:', foundKey);
    }
  });
  
  if (foundKey) {
    // Try to trigger the key selection
    console.log('✅ Found API key to use:', foundKey);
    console.log('Now go to the Test Suite tab - it should work!');
    
    // Store in localStorage as backup
    localStorage.setItem('selectedApiKey', foundKey);
    console.log('💾 Stored API key in localStorage for backup');
    
    return foundKey;
  } else {
    console.log('❌ No API keys found on page');
    return null;
  }
} catch (error) {
  console.error('Error finding API keys:', error);
  return null;
}