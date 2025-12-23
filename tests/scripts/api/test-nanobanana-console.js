// Paste this into browser console on http://localhost:5175/workflows or test page
// This will test the API and show the raw response

(async () => {
  try {
    console.log('🧪 Testing Nano Banana Pro API...');
    
    // Import the service
    const { nanoBananaService } = await import('/src/lib/services/nanoBananaService.ts');
    
    // Make the API call
    const result = await nanoBananaService.generateImage({
      prompt: 'a beautiful sunset over mountains',
      aspect_ratio: 'square'
    });
    
    console.log('✅ Success!', result);
    
    // Also check the stored response
    if (window.__nanobanana_last_response) {
      console.log('📋 Raw Response:', window.__nanobanana_last_response);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    // Show the stored response if available
    if (window.__nanobanana_last_response) {
      console.log('📋 Raw Response (for debugging):', window.__nanobanana_last_response);
      console.log('📋 Response as JSON:', JSON.stringify(window.__nanobanana_last_response, null, 2));
    }
  }
})();




































