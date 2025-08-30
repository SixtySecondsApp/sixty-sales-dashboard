// Paste this in your browser console on the API Testing page
// This will manually set the API key and trigger the test suite

// Set the API key in localStorage
localStorage.setItem('selectedApiKey', 'sk_test_api_key_for_suite_12345');

// Dispatch the event that the page is listening for
window.dispatchEvent(new CustomEvent('apiKeySelected', {
  detail: { apiKey: 'sk_test_api_key_for_suite_12345' }
}));

// Reload the page to pick up the new API key
window.location.reload();