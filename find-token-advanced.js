// Advanced Token Finder
// Run this on sales.sixtyseconds.video

console.log('🔍 Advanced Session Search...\n');

// Check all possible storage locations
const storageTypes = ['localStorage', 'sessionStorage'];
const patterns = ['supabase', 'sb-', 'auth', 'token', 'session', 'jwt', 'access'];

console.log('Searching all storage...\n');

storageTypes.forEach(storageType => {
    console.log(`\n📦 ${storageType}:`);
    const storage = window[storageType];
    
    Object.keys(storage).forEach(key => {
        // Check if key matches any pattern
        if (patterns.some(pattern => key.toLowerCase().includes(pattern))) {
            console.log(`  Found key: ${key}`);
            const value = storage.getItem(key);
            
            // Try to parse and find tokens
            try {
                const parsed = JSON.parse(value);
                
                // Look for access_token in any nested structure
                function findToken(obj, path = '') {
                    for (let prop in obj) {
                        const currentPath = path ? `${path}.${prop}` : prop;
                        
                        if (prop.includes('token') || prop.includes('access')) {
                            if (typeof obj[prop] === 'string' && obj[prop].startsWith('eyJ')) {
                                console.log(`    ✅ Token found at ${currentPath}:`);
                                console.log(`    ${obj[prop].substring(0, 50)}...`);
                                console.log(`\n    Full token: ${obj[prop]}`);
                                return true;
                            }
                        }
                        
                        if (typeof obj[prop] === 'object' && obj[prop] !== null) {
                            findToken(obj[prop], currentPath);
                        }
                    }
                }
                
                findToken(parsed);
            } catch (e) {
                // Not JSON, check if it's a token directly
                if (value.startsWith('eyJ')) {
                    console.log(`    ✅ Direct token: ${value.substring(0, 50)}...`);
                }
            }
        }
    });
});

// Check cookies
console.log('\n🍪 Checking cookies:');
document.cookie.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (patterns.some(pattern => name.toLowerCase().includes(pattern))) {
        console.log(`  Found cookie: ${name}`);
        if (value && value.startsWith('eyJ')) {
            console.log(`    ✅ Token in cookie: ${value.substring(0, 50)}...`);
        }
    }
});

// Check IndexedDB
console.log('\n💾 Checking IndexedDB:');
if ('indexedDB' in window) {
    indexedDB.databases().then(databases => {
        databases.forEach(db => {
            console.log(`  Database: ${db.name}`);
        });
    });
}

// Check window object for Supabase client
console.log('\n🪟 Checking window object:');
for (let prop in window) {
    if (prop.toLowerCase().includes('supabase') || prop.toLowerCase().includes('auth')) {
        console.log(`  Found property: ${prop}`);
        try {
            if (window[prop] && typeof window[prop] === 'object') {
                // Try to get auth from it
                if (window[prop].auth && window[prop].auth.getSession) {
                    window[prop].auth.getSession().then(result => {
                        if (result.data && result.data.session) {
                            console.log('    ✅ Got session from Supabase client!');
                            console.log('    Token:', result.data.session.access_token);
                            console.log('\n📋 Copy this token:');
                            console.log(result.data.session.access_token);
                        }
                    });
                }
            }
        } catch (e) {}
    }
}

// Intercept fetch to catch tokens
console.log('\n🎣 Setting up fetch interceptor...');
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const [url, config] = args;
    if (config && config.headers) {
        const authHeader = config.headers['Authorization'] || config.headers['authorization'];
        if (authHeader && authHeader.includes('Bearer')) {
            console.log('🎯 Caught token in fetch request!');
            console.log('Token:', authHeader.replace('Bearer ', ''));
            console.log('\n📋 Quick copy:');
            console.log(authHeader.replace('Bearer ', ''));
        }
    }
    return originalFetch.apply(this, args);
};

console.log('\n✅ Interceptor set! Now do any action in the app (click a button, navigate, etc.) to catch the token.');
console.log('The token will appear above when caught.\n');

// Try React DevTools
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('⚛️ React DevTools detected - checking for auth in React state...');
}

console.log('\n✨ Search complete! If no token found:');
console.log('1. Perform any action in the app (click buttons, navigate)');
console.log('2. Check Network tab for Authorization headers');
console.log('3. You may need to log out and log back in');