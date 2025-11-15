// Fix API Key Selection - Run this in browser console
// This will manually set an API key for testing if the UI buttons aren't working
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
    }
  });
  
  if (foundKey) {
    // Try to trigger the key selection
    // Store in localStorage as backup
    localStorage.setItem('selectedApiKey', foundKey);
    return foundKey;
  } else {
    return null;
  }
} catch (error) {
  return null;
}