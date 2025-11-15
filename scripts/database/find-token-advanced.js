// Advanced Token Finder
// Run this on sales.sixtyseconds.video
// Check all possible storage locations
const storageTypes = ['localStorage', 'sessionStorage'];
const patterns = ['supabase', 'sb-', 'auth', 'token', 'session', 'jwt', 'access'];
storageTypes.forEach(storageType => {
    const storage = window[storageType];
    
    Object.keys(storage).forEach(key => {
        // Check if key matches any pattern
        if (patterns.some(pattern => key.toLowerCase().includes(pattern))) {
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
                }
            }
        }
    });
});

// Check cookies
document.cookie.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (patterns.some(pattern => name.toLowerCase().includes(pattern))) {
        if (value && value.startsWith('eyJ')) {
        }
    }
});

// Check IndexedDB
if ('indexedDB' in window) {
    indexedDB.databases().then(databases => {
        databases.forEach(db => {
        });
    });
}

// Check window object for Supabase client
for (let prop in window) {
    if (prop.toLowerCase().includes('supabase') || prop.toLowerCase().includes('auth')) {
        try {
            if (window[prop] && typeof window[prop] === 'object') {
                // Try to get auth from it
                if (window[prop].auth && window[prop].auth.getSession) {
                    window[prop].auth.getSession().then(result => {
                        if (result.data && result.data.session) {
                        }
                    });
                }
            }
        } catch (e) {}
    }
}

// Intercept fetch to catch tokens
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const [url, config] = args;
    if (config && config.headers) {
        const authHeader = config.headers['Authorization'] || config.headers['authorization'];
        if (authHeader && authHeader.includes('Bearer')) {
        }
    }
    return originalFetch.apply(this, args);
};
// Try React DevTools
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
}