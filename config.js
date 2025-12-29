/* ============================================
   Year Planner - Configuration
   ============================================ */

/**
 * Configuration for calendar integrations
 * 
 * SETUP INSTRUCTIONS:
 * 
 * 1. GOOGLE CALENDAR:
 *    - Go to https://console.cloud.google.com/
 *    - Create a new project or select existing
 *    - Enable the Google Calendar API
 *    - Go to Credentials > Create OAuth 2.0 Client ID
 *    - Add authorized JavaScript origins (e.g., http://localhost:8080)
 *    - Copy the Client ID below
 * 
 * 2. APPLE CALENDAR (CalDAV):
 *    - Apple Calendar uses CalDAV protocol
 *    - You'll need to create an app-specific password
 *    - Go to https://appleid.apple.com/
 *    - Security > App-Specific Passwords > Generate
 *    - Use your iCloud email and this password
 */

const CONFIG = {
    // Google Calendar API Configuration
    google: {
        clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
        apiKey: 'YOUR_GOOGLE_API_KEY',
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        scopes: 'https://www.googleapis.com/auth/calendar'
    },
    
    // Apple Calendar (CalDAV) Configuration
    apple: {
        // CalDAV server URL for iCloud
        caldavUrl: 'https://caldav.icloud.com',
        // Note: For security, these should be entered at runtime, not stored here
        username: '', // Your iCloud email
        password: ''  // App-specific password
    },
    
    // Application Settings
    app: {
        name: 'Year Planner',
        version: '1.0.0',
        defaultYear: 2026,
        autoSyncInterval: 5 * 60 * 1000 // 5 minutes in milliseconds
    }
};

// Freeze config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.google);
Object.freeze(CONFIG.apple);
Object.freeze(CONFIG.app);

