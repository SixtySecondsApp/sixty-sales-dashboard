// Session Extractor Script
// Run this in the browser console while on sales.sixtyseconds.video

console.log('🔍 Searching for Supabase session...\n');

// Method 1: Check localStorage
console.log('📦 Checking localStorage...');
let foundSession = false;

for (let key in localStorage) {
    if (key.includes('supabase') || key.includes('sb-')) {
        console.log(`Found key: ${key}`);
        try {
            const value = JSON.parse(localStorage.getItem(key));
            if (value && value.access_token) {
                console.log('✅ Found session with access token!');
                console.log('\n🔑 ACCESS TOKEN:');
                console.log(value.access_token);
                console.log('\n📋 To use this token, copy it and use in API calls');
                console.log('\n👤 User Info:');
                console.log('Email:', value.user?.email);
                console.log('User ID:', value.user?.id);
                
                // Check expiration
                if (value.expires_at) {
                    const expiresAt = new Date(value.expires_at * 1000);
                    const now = new Date();
                    if (expiresAt > now) {
                        console.log('✅ Token is valid until:', expiresAt.toLocaleString());
                    } else {
                        console.log('⚠️ Token is expired! Expired at:', expiresAt.toLocaleString());
                    }
                }
                
                foundSession = true;
                
                // Create a copy button in console
                console.log('\n📋 Quick copy command - run this:');
                console.log(`copy("${value.access_token}")`);
            }
        } catch (e) {
            // Not JSON or doesn't have what we need
        }
    }
}

// Method 2: Check sessionStorage
console.log('\n📦 Checking sessionStorage...');
for (let key in sessionStorage) {
    if (key.includes('supabase') || key.includes('sb-')) {
        console.log(`Found key: ${key}`);
        try {
            const value = JSON.parse(sessionStorage.getItem(key));
            if (value && value.access_token) {
                console.log('✅ Found session in sessionStorage!');
                console.log('Access Token:', value.access_token);
                foundSession = true;
            }
        } catch (e) {
            // Not JSON
        }
    }
}

// Method 3: Check if Supabase client exists on window
if (window.supabase) {
    console.log('\n🔧 Found Supabase client on window object');
    try {
        window.supabase.auth.getSession().then(({data}) => {
            if (data.session) {
                console.log('✅ Got session from Supabase client!');
                console.log('Access Token:', data.session.access_token);
            }
        });
    } catch (e) {
        console.log('Could not get session from client:', e.message);
    }
}

if (!foundSession) {
    console.log('\n❌ No session found. Possible reasons:');
    console.log('1. You might need to refresh the page');
    console.log('2. The session might be stored differently');
    console.log('3. You might need to log in again');
    
    console.log('\n💡 Try this:');
    console.log('1. Open Developer Tools Network tab');
    console.log('2. Refresh the page');
    console.log('3. Look for requests with "Authorization: Bearer" headers');
    console.log('4. Copy the token from there');
}

console.log('\n✨ Session extraction complete!');