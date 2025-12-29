/* ============================================
   Apple Calendar (CalDAV) Integration
   ============================================ */

/**
 * Apple Calendar uses CalDAV protocol.
 * Due to CORS restrictions, direct browser access to iCloud CalDAV is not possible.
 * 
 * This module provides two approaches:
 * 1. Local Mode: Import/Export .ics files manually
 * 2. Server Mode: Use a proxy server (for advanced setup)
 * 
 * For the prototype, we'll use the Local Mode with ICS file support.
 */

const AppleCalendar = {
    connected: false,
    events: [],

    /**
     * Connect to Apple Calendar
     * In local mode, this just sets up the connection state
     */
    async connect() {
        // Show instructions modal for Apple Calendar setup
        return new Promise((resolve, reject) => {
            const useLocal = confirm(
                'Apple Calendar Integration\n\n' +
                'Due to browser security restrictions, direct iCloud access requires a server.\n\n' +
                'For now, you can:\n' +
                '1. Export events from Apple Calendar as .ics files\n' +
                '2. Import them using the "Import ICS" feature\n\n' +
                'Click OK to enable Apple Calendar local mode.'
            );

            if (useLocal) {
                this.connected = true;
                this.setupFileImport();
                resolve(true);
            } else {
                reject(new Error('User cancelled Apple Calendar setup'));
            }
        });
    },

    /**
     * Setup file input for ICS import
     */
    setupFileImport() {
        // Create hidden file input if not exists
        let fileInput = document.getElementById('icsFileInput');
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'icsFileInput';
            fileInput.accept = '.ics';
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', (e) => this.handleIcsImport(e));
            document.body.appendChild(fileInput);
        }

        // Add import button to sidebar
        const appleCalItem = document.getElementById('appleCalStatus');
        if (appleCalItem && !document.getElementById('importIcsBtn')) {
            const importBtn = document.createElement('button');
            importBtn.id = 'importIcsBtn';
            importBtn.className = 'connect-btn';
            importBtn.textContent = 'Import .ics';
            importBtn.style.marginLeft = '8px';
            importBtn.addEventListener('click', () => fileInput.click());
            appleCalItem.appendChild(importBtn);
        }
    },

    /**
     * Handle ICS file import
     */
    async handleIcsImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const events = this.parseIcs(text);
            this.events = events;
            
            // Merge with main app events
            if (typeof mergeExternalEvents === 'function') {
                mergeExternalEvents(events, 'apple');
            }

            showToast(`Imported ${events.length} events from Apple Calendar`, 'success');
        } catch (err) {
            console.error('Error importing ICS file:', err);
            showToast('Failed to import ICS file', 'error');
        }

        // Reset file input
        event.target.value = '';
    },

    /**
     * Parse ICS (iCalendar) format
     */
    parseIcs(icsText) {
        const events = [];
        const lines = icsText.split(/\r\n|\n|\r/);
        
        let currentEvent = null;
        let inEvent = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Handle line continuations (lines starting with space or tab)
            while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
                i++;
                line += lines[i].substring(1);
            }

            if (line.startsWith('BEGIN:VEVENT')) {
                inEvent = true;
                currentEvent = {
                    id: null,
                    title: 'Untitled',
                    startDate: null,
                    endDate: null,
                    description: ''
                };
            } else if (line.startsWith('END:VEVENT') && currentEvent) {
                inEvent = false;
                if (currentEvent.startDate) {
                    events.push(currentEvent);
                }
                currentEvent = null;
            } else if (inEvent && currentEvent) {
                if (line.startsWith('UID:')) {
                    currentEvent.id = line.substring(4);
                } else if (line.startsWith('SUMMARY:')) {
                    currentEvent.title = this.unescapeIcs(line.substring(8));
                } else if (line.startsWith('DESCRIPTION:')) {
                    currentEvent.description = this.unescapeIcs(line.substring(12));
                } else if (line.startsWith('DTSTART')) {
                    currentEvent.startDate = this.parseIcsDate(line);
                } else if (line.startsWith('DTEND')) {
                    currentEvent.endDate = this.parseIcsDate(line);
                }
            }
        }

        return events;
    },

    /**
     * Parse ICS date format
     */
    parseIcsDate(line) {
        // Handle both DTSTART:20250115 and DTSTART;VALUE=DATE:20250115 formats
        const parts = line.split(':');
        if (parts.length < 2) return null;
        
        const dateStr = parts[parts.length - 1];
        
        // Format: YYYYMMDD or YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
        if (dateStr.length >= 8) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            return `${year}-${month}-${day}`;
        }
        
        return null;
    },

    /**
     * Unescape ICS special characters
     */
    unescapeIcs(text) {
        return text
            .replace(/\\n/g, '\n')
            .replace(/\\,/g, ',')
            .replace(/\\;/g, ';')
            .replace(/\\\\/g, '\\');
    },

    /**
     * Fetch events (returns cached events from ICS import)
     */
    async fetchEvents(year) {
        // Filter events for the requested year
        return this.events.filter(event => {
            if (!event.startDate) return false;
            const eventYear = parseInt(event.startDate.substring(0, 4));
            return eventYear === year;
        });
    },

    /**
     * Create event - generates ICS download
     */
    async createEvent(eventData) {
        const icsContent = this.generateIcs([eventData]);
        this.downloadIcs(icsContent, `${eventData.title.replace(/\s+/g, '_')}.ics`);
        
        showToast('Event exported as .ics file. Import it into Apple Calendar.', 'info');
        return eventData;
    },

    /**
     * Generate ICS format content
     */
    generateIcs(events) {
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Year Planner//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        events.forEach(event => {
            const uid = event.id || Date.now().toString();
            const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            const dtstart = event.startDate.replace(/-/g, '');
            const dtend = (event.endDate || event.startDate).replace(/-/g, '');

            lines.push(
                'BEGIN:VEVENT',
                `UID:${uid}@yearplanner`,
                `DTSTAMP:${dtstamp}`,
                `DTSTART;VALUE=DATE:${dtstart}`,
                `DTEND;VALUE=DATE:${dtend}`,
                `SUMMARY:${this.escapeIcs(event.title)}`,
                event.notes ? `DESCRIPTION:${this.escapeIcs(event.notes)}` : '',
                'END:VEVENT'
            );
        });

        lines.push('END:VCALENDAR');
        
        return lines.filter(l => l).join('\r\n');
    },

    /**
     * Escape special characters for ICS format
     */
    escapeIcs(text) {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n');
    },

    /**
     * Download ICS file
     */
    downloadIcs(content, filename) {
        const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    },

    /**
     * Export all events as ICS
     */
    exportAllEvents(events) {
        const icsContent = this.generateIcs(events);
        this.downloadIcs(icsContent, `year_planner_export_${new Date().getFullYear()}.ics`);
    },

    /**
     * Disconnect
     */
    disconnect() {
        this.connected = false;
        this.events = [];
    }
};

// Add export button functionality when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // We could add an "Export All" button here if needed
});

