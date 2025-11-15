// Quick fix for API testing proxy issue
// Run this in the browser console to fix the backend connection error
// Override the fetch function to redirect /api calls to Supabase Edge Functions
const originalFetch = window.fetch;
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL_HERE';

window.fetch = function(input, init = {}) {
  // Convert /api requests to Supabase Edge Functions
  if (typeof input === 'string' && input.startsWith('/api/v1/')) {
    const entity = input.replace('/api/v1/', '').split('/')[0];
    const id = input.split('/')[2] || '';
    const newUrl = `${SUPABASE_URL}/functions/v1/api-v1-${entity}${id ? `/${id}` : ''}`;
    return originalFetch(newUrl, init);
  }
  
  // For all other requests, use original fetch
  return originalFetch(input, init);
};
// Also store the working API key if not already set
if (!localStorage.getItem('selectedApiKey')) {
  const workingKey = 'sk_8b61b8892eec45fcb56908b7209a3985';
  localStorage.setItem('selectedApiKey', workingKey);
}

return 'API proxy fix complete!';