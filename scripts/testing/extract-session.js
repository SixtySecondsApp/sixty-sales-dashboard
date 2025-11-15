// Session Extractor Script
// Run this in the browser console while on sales.sixtyseconds.video
// Method 1: Check localStorage
let foundSession = false;

for (let key in localStorage) {
    if (key.includes('supabase') || key.includes('sb-')) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            if (value && value.access_token) {
                // Check expiration
                if (value.expires_at) {
                    const expiresAt = new Date(value.expires_at * 1000);
                    const now = new Date();
                    if (expiresAt > now) {
                    } else {
                    }
                }
                
                foundSession = true;
                
                // Create a copy button in console
            }
        } catch (e) {
            // Not JSON or doesn't have what we need
        }
    }
}

// Method 2: Check sessionStorage
for (let key in sessionStorage) {
    if (key.includes('supabase') || key.includes('sb-')) {
        try {
            const value = JSON.parse(sessionStorage.getItem(key));
            if (value && value.access_token) {
                foundSession = true;
            }
        } catch (e) {
            // Not JSON
        }
    }
}

// Method 3: Check if Supabase client exists on window
if (window.supabase) {
    try {
        window.supabase.auth.getSession().then(({data}) => {
            if (data.session) {
            }
        });
    } catch (e) {
    }
}

if (!foundSession) {
}