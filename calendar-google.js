/* ============================================
   Google Calendar Integration
   ============================================ */

const GoogleCalendar = {
    tokenClient: null,
    gapiInited: false,
    gisInited: false,

    /**
     * Initialize the Google API client
     */
    async init() {
        return new Promise((resolve) => {
            // Load GAPI
            gapi.load('client', async () => {
                await gapi.client.init({
                    apiKey: CONFIG.google.apiKey,
                    discoveryDocs: CONFIG.google.discoveryDocs,
                });
                this.gapiInited = true;
                this.maybeResolve(resolve);
            });

            // Initialize Google Identity Services
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.google.clientId,
                scope: CONFIG.google.scopes,
                callback: '', // Will be set during connect
            });
            this.gisInited = true;
            this.maybeResolve(resolve);
        });
    },

    maybeResolve(resolve) {
        if (this.gapiInited && this.gisInited) {
            resolve();
        }
    },

    /**
     * Connect to Google Calendar (OAuth flow)
     */
    async connect() {
        // Check if already initialized
        if (!this.gapiInited || !this.gisInited) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            // Check for existing token
            const token = gapi.client.getToken();
            
            if (token === null) {
                // Request new token
                this.tokenClient.callback = async (resp) => {
                    if (resp.error !== undefined) {
                        reject(resp);
                        return;
                    }
                    resolve(true);
                };
                
                this.tokenClient.requestAccessToken({ prompt: 'consent' });
            } else {
                // Already have valid token
                resolve(true);
            }
        });
    },

    /**
     * Disconnect from Google Calendar
     */
    disconnect() {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
        }
    },

    /**
     * Fetch events for a specific year
     */
    async fetchEvents(year) {
        const timeMin = new Date(year, 0, 1).toISOString();
        const timeMax = new Date(year, 11, 31, 23, 59, 59).toISOString();

        try {
            const response = await gapi.client.calendar.events.list({
                calendarId: 'primary',
                timeMin: timeMin,
                timeMax: timeMax,
                showDeleted: false,
                singleEvents: true,
                orderBy: 'startTime',
                maxResults: 500
            });

            const events = response.result.items || [];
            
            return events.map(event => ({
                id: event.id,
                title: event.summary || 'Untitled Event',
                startDate: this.parseGoogleDate(event.start),
                endDate: event.end ? this.parseGoogleDate(event.end) : null,
                description: event.description || '',
                location: event.location || '',
                source: 'google'
            }));
        } catch (err) {
            console.error('Error fetching Google Calendar events:', err);
            throw err;
        }
    },

    /**
     * Parse Google Calendar date format
     */
    parseGoogleDate(googleDate) {
        if (googleDate.date) {
            // All-day event
            return googleDate.date;
        } else if (googleDate.dateTime) {
            // Timed event - extract just the date part
            return googleDate.dateTime.split('T')[0];
        }
        return null;
    },

    /**
     * Create a new event in Google Calendar
     */
    async createEvent(eventData) {
        const event = {
            summary: eventData.title,
            description: eventData.notes || '',
            start: this.formatGoogleDate(eventData.startDate),
            end: this.formatGoogleDate(eventData.endDate || eventData.startDate, true)
        };

        try {
            const response = await gapi.client.calendar.events.insert({
                calendarId: 'primary',
                resource: event
            });
            
            return {
                id: response.result.id,
                ...eventData
            };
        } catch (err) {
            console.error('Error creating Google Calendar event:', err);
            throw err;
        }
    },

    /**
     * Update an existing event
     */
    async updateEvent(eventId, eventData) {
        const event = {
            summary: eventData.title,
            description: eventData.notes || '',
            start: this.formatGoogleDate(eventData.startDate),
            end: this.formatGoogleDate(eventData.endDate || eventData.startDate, true)
        };

        try {
            await gapi.client.calendar.events.update({
                calendarId: 'primary',
                eventId: eventId,
                resource: event
            });
            
            return true;
        } catch (err) {
            console.error('Error updating Google Calendar event:', err);
            throw err;
        }
    },

    /**
     * Delete an event
     */
    async deleteEvent(eventId) {
        try {
            await gapi.client.calendar.events.delete({
                calendarId: 'primary',
                eventId: eventId
            });
            
            return true;
        } catch (err) {
            console.error('Error deleting Google Calendar event:', err);
            throw err;
        }
    },

    /**
     * Format date for Google Calendar API
     */
    formatGoogleDate(dateStr, isEnd = false) {
        // For all-day events, Google expects just the date
        // For end dates of all-day events, it needs the day AFTER
        if (isEnd) {
            const date = new Date(dateStr);
            date.setDate(date.getDate() + 1);
            return {
                date: date.toISOString().split('T')[0]
            };
        }
        
        return {
            date: dateStr
        };
    },

    /**
     * Get list of available calendars
     */
    async getCalendarList() {
        try {
            const response = await gapi.client.calendar.calendarList.list();
            return response.result.items || [];
        } catch (err) {
            console.error('Error fetching calendar list:', err);
            throw err;
        }
    }
};

