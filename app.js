
/* ============================================
   Year Planner - Main Application
   ============================================ */

// Default Categories
const DEFAULT_CATEGORIES = [
    { id: 'family-trips', name: 'Family Trips', emoji: '🏖️', color: '#00d9ff' },
    { id: 'weddings', name: 'Weddings', emoji: '💒', color: '#ff6b9d' },
    { id: 'refresh-days', name: 'Refresh Days', emoji: '🧘', color: '#7cff6b' },
    { id: 'music-launch', name: 'Music Launch Days', emoji: '🎵', color: '#ffb347' },
    { id: 'ball-days', name: 'Ball Days', emoji: '⚽', color: '#a78bfa' },
    { id: 'doctor-visits', name: 'Doctor Visits', emoji: '🏥', color: '#ff6b6b' }
];

// Application State
const state = {
    currentYear: 2026, // Default to 2026
    currentMonth: new Date().getMonth(), // For mobile month view
    events: [],
    goals: [],
    categories: [...DEFAULT_CATEGORIES],
    visibleCategories: new Set(['family-trips', 'weddings', 'refresh-days', 'music-launch', 'ball-days', 'doctor-visits']),
    googleConnected: false,
    appleConnected: false,
    editingEventId: null,
    sidebarOpen: false
};

// Performance: Cache DOM references
const domCache = {
    mobileMonthGrid: null,
    mobileMonthEvents: null,
    mobileMonthTitle: null,
    yearGrid: null,
    currentYearEl: null,
    sidebar: null,
    sidebarOverlay: null
};

// Performance: Pre-computed event maps for fast lookups
let eventsByDateCache = null;
let eventsByMonthCache = null;
let cacheInvalidated = true;

// Performance: Debounce/throttle utilities
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Initialize DOM cache
function initDOMCache() {
    domCache.mobileMonthGrid = document.getElementById('mobileMonthGrid');
    domCache.mobileMonthEvents = document.getElementById('mobileMonthEvents');
    domCache.mobileMonthTitle = document.getElementById('mobileMonthTitle');
    domCache.yearGrid = document.getElementById('yearGrid');
    domCache.currentYearEl = document.getElementById('currentYear');
    domCache.sidebar = document.getElementById('sidebar');
    domCache.sidebarOverlay = document.getElementById('sidebarOverlay');
}

// Invalidate event cache when events change
function invalidateEventCache() {
    cacheInvalidated = true;
    eventsByDateCache = null;
    eventsByMonthCache = null;
}

// Pre-compute events by date for fast lookups
function buildEventsByDateCache() {
    if (!cacheInvalidated && eventsByDateCache) return eventsByDateCache;
    
    eventsByDateCache = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    state.events.forEach(event => {
        if (!state.visibleCategories.has(event.category)) return;
        
        const startDate = new Date(event.startDate);
        const endDate = event.endDate ? new Date(event.endDate) : startDate;
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        
        const current = new Date(startDate);
        while (current <= endDate) {
            const dateKey = current.toISOString().split('T')[0];
            if (!eventsByDateCache[dateKey]) {
                eventsByDateCache[dateKey] = [];
            }
            eventsByDateCache[dateKey].push(event);
            current.setDate(current.getDate() + 1);
        }
    });
    
    cacheInvalidated = false;
    return eventsByDateCache;
}

// Pre-compute events by month for mobile view
function buildEventsByMonthCache() {
    if (!cacheInvalidated && eventsByMonthCache) return eventsByMonthCache;
    
    eventsByMonthCache = {};
    
    state.events.forEach(event => {
        if (!state.visibleCategories.has(event.category)) return;
        
        const eventDate = new Date(event.startDate);
        const year = eventDate.getFullYear();
        const month = eventDate.getMonth();
        const key = `${year}-${month}`;
        
        if (!eventsByMonthCache[key]) {
            eventsByMonthCache[key] = [];
        }
        eventsByMonthCache[key].push(event);
    });
    
    // Sort each month's events
    Object.keys(eventsByMonthCache).forEach(key => {
        eventsByMonthCache[key].sort((a, b) => {
            return new Date(a.startDate) - new Date(b.startDate);
        });
    });
    
    return eventsByMonthCache;
}

// Month names
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Short month names for grid
const MONTHS_SHORT = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
];

// Days in each month (will be calculated for leap years)
function getDaysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate();
}

// Check if a date is valid
function isValidDate(day, month, year) {
    const daysInMonth = getDaysInMonth(month, year);
    return day <= daysInMonth;
}

// Check if year is leap year
function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/* ============================================
   Grid Rendering
   ============================================ */

function renderYearGrid() {
    const grid = document.getElementById('yearGrid');
    const year = state.currentYear;
    
    // Update year display
    document.getElementById('currentYear').textContent = year;
    
    // Clear existing grid
    grid.innerHTML = '';
    
    // Create header row with day numbers
    const headerRow = document.createElement('div');
    headerRow.className = 'grid-header';
    
    // Corner cell
    const corner = document.createElement('div');
    corner.className = 'grid-cell header-corner';
    headerRow.appendChild(corner);
    
    // Day headers 1-31
    for (let day = 1; day <= 31; day++) {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'grid-cell day-header';
        dayHeader.textContent = day;
        headerRow.appendChild(dayHeader);
    }
    
    grid.appendChild(headerRow);
    
    // Create month rows
    MONTHS_SHORT.forEach((monthName, monthIndex) => {
        const monthRow = document.createElement('div');
        monthRow.className = 'month-row';
        
        // Month label
        const monthLabel = document.createElement('div');
        monthLabel.className = 'month-label';
        monthLabel.textContent = monthName;
        monthRow.appendChild(monthLabel);
        
        // Day cells
        const daysInMonth = getDaysInMonth(monthIndex, year);
        
        for (let day = 1; day <= 31; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'grid-cell day-cell';
            dayCell.dataset.month = monthIndex;
            dayCell.dataset.day = day;
            dayCell.dataset.date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            // Check if day is valid for this month
            if (day > daysInMonth) {
                dayCell.classList.add('unavailable');
            } else {
                // Check if today
                const today = new Date();
                if (today.getFullYear() === year && 
                    today.getMonth() === monthIndex && 
                    today.getDate() === day) {
                    dayCell.classList.add('today');
                }
                
                // Add day of week letter
                const cellDate = new Date(year, monthIndex, day);
                const dayOfWeek = cellDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
                const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                const dayLetter = dayLetters[dayOfWeek].toUpperCase();
                
                const dayLetterEl = document.createElement('div');
                dayLetterEl.className = 'day-letter';
                dayLetterEl.textContent = dayLetter;
                dayCell.appendChild(dayLetterEl);
                
                // Click handler removed - now using event delegation in setupEventDelegation()
            }
            
            monthRow.appendChild(dayCell);
        }
        
        grid.appendChild(monthRow);
    });
    
    // Render events on grid
    renderEventsOnGrid();
    
    // Also update mobile view if needed
    if (isMobileView()) {
        renderMobileMonthView();
    }
}

// Optimized: Only update visible view
function updateAllViews() {
    if (isMobileView()) {
        invalidateEventCache();
        renderMobileMonthView();
    } else {
        renderEventsOnGrid();
    }
}

// Optimized: Use cached event map and batch DOM updates
function renderEventsOnGrid() {
    if (isMobileView()) return; // Skip if mobile view is active
    
    // Build cache if needed
    buildEventsByDateCache();
    
    // Batch DOM updates using requestAnimationFrame
    requestAnimationFrame(() => {
        // Clear existing event indicators (only for desktop view)
        const dayCells = document.querySelectorAll('.day-cell');
        dayCells.forEach(cell => {
            cell.classList.remove('has-event', 'event-start', 'event-middle', 'event-end');
            // Remove all category background classes dynamically
            state.categories.forEach(cat => {
                cell.classList.remove(`${cat.id}-bg`);
            });
            cell.removeAttribute('data-tooltip');
            
            // Remove event dots
            const dots = cell.querySelectorAll('.event-dot, .multi-event');
            dots.forEach(dot => dot.remove());
        });
    
        // Use pre-computed cache instead of rebuilding
        const eventsByDate = eventsByDateCache;
        
        // Render events on cells (only for current year)
        Object.entries(eventsByDate).forEach(([dateKey, events]) => {
            // Filter to current year only
            if (!dateKey.startsWith(state.currentYear.toString())) return;
            
            const cell = document.querySelector(`.day-cell[data-date="${dateKey}"]`);
            if (!cell || cell.classList.contains('unavailable')) return;
            
            cell.classList.add('has-event');
            
            // Set tooltip
            const tooltipText = events.map(e => e.title).join(', ');
            cell.setAttribute('data-tooltip', tooltipText);
            
            // Add background color for first event (or range)
            const primaryEvent = events[0];
            cell.classList.add(`${primaryEvent.category}-bg`);
            
            // Position indicators for ranges
            const startDate = new Date(events[0].startDate);
            const endDate = events[0].endDate ? new Date(events[0].endDate) : startDate;
            const checkDate = new Date(dateKey);
            
            if (checkDate.getTime() === startDate.getTime() && checkDate.getTime() !== endDate.getTime()) {
                cell.classList.add('event-start');
            }
            if (checkDate.getTime() === endDate.getTime() && checkDate.getTime() !== startDate.getTime()) {
                cell.classList.add('event-end');
            }
            if (checkDate.getTime() > startDate.getTime() && checkDate.getTime() < endDate.getTime()) {
                cell.classList.add('event-middle');
            }
            
            // Add event dot(s)
            if (events.length === 1) {
                const dot = document.createElement('div');
                dot.className = `event-dot ${events[0].category}`;
                cell.appendChild(dot);
            } else {
                // Multiple events
                const multiContainer = document.createElement('div');
                multiContainer.className = 'multi-event';
                events.slice(0, 3).forEach(event => {
                    const dot = document.createElement('div');
                    dot.className = `event-dot ${event.category}`;
                    multiContainer.appendChild(dot);
                });
                cell.appendChild(multiContainer);
            }
        });
        
        // Update stats
        updateStats();
    });
}

/* ============================================
   Event Dropdown Menu
   ============================================ */

// Optimized: Use cached event map for fast lookups
function getEventsForDate(dateStr) {
    buildEventsByDateCache();
    return eventsByDateCache[dateStr] || [];
}

function showEventDropdown(year, month, day, cellElement) {
    // Remove any existing dropdown
    closeEventDropdown();
    
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const eventsOnDate = getEventsForDate(dateStr);
    
    // Create dropdown element
    const dropdown = document.createElement('div');
    dropdown.className = 'event-dropdown';
    dropdown.id = 'eventDropdown';
    
    // Format date for display
    const displayDate = new Date(dateStr).toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    });
    
    dropdown.innerHTML = `
        <div class="event-dropdown-header">
            <span class="event-dropdown-title">${displayDate}</span>
            <button class="event-dropdown-close" onclick="closeEventDropdown()">×</button>
        </div>
        <div class="event-dropdown-list">
            ${eventsOnDate.length === 0 ? 
                '<div class="event-dropdown-empty">No events on this day</div>' :
                eventsOnDate.map(event => `
                    <div class="event-dropdown-item" data-event-id="${event.id}">
                        <div class="event-dropdown-color ${event.category}"></div>
                        <div class="event-dropdown-info">
                            <div class="event-dropdown-name">${event.title}</div>
                            <div class="event-dropdown-dates">${formatEventDateRange(event)}</div>
                        </div>
                        <div class="event-dropdown-actions">
                            <button class="event-dropdown-btn edit" onclick="editEventFromDropdown('${event.id}')" title="Edit">✎</button>
                            <button class="event-dropdown-btn delete" onclick="deleteEventFromDropdown('${event.id}')" title="Delete">🗑</button>
                        </div>
                    </div>
                `).join('')
            }
        </div>
        <button class="event-dropdown-add" onclick="addEventFromDropdown(${year}, ${month}, ${day})">
            <span class="event-dropdown-add-icon">+</span>
            Add New Event
        </button>
    `;
    
    document.body.appendChild(dropdown);
    
    // Position dropdown near the cell
    const cellRect = cellElement.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();
    
    let left = cellRect.left + cellRect.width / 2 - dropdownRect.width / 2;
    let top = cellRect.bottom + 8;
    
    // Adjust if off-screen horizontally
    if (left < 10) left = 10;
    if (left + dropdownRect.width > window.innerWidth - 10) {
        left = window.innerWidth - dropdownRect.width - 10;
    }
    
    // Adjust if off-screen vertically (show above cell instead)
    if (top + dropdownRect.height > window.innerHeight - 10) {
        top = cellRect.top - dropdownRect.height - 8;
    }
    
    dropdown.style.left = `${left}px`;
    dropdown.style.top = `${top}px`;
    
    // Close dropdown when clicking outside
    setTimeout(() => {
        document.addEventListener('click', handleDropdownOutsideClick);
    }, 0);
}

function handleDropdownOutsideClick(e) {
    const dropdown = document.getElementById('eventDropdown');
    if (dropdown && !dropdown.contains(e.target) && !e.target.closest('.day-cell')) {
        closeEventDropdown();
    }
}

function closeEventDropdown() {
    const dropdown = document.getElementById('eventDropdown');
    if (dropdown) {
        dropdown.remove();
    }
    document.removeEventListener('click', handleDropdownOutsideClick);
}

function formatEventDateRange(event) {
    const start = new Date(event.startDate);
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    if (!event.endDate || event.endDate === event.startDate) {
        return startStr;
    }
    
    const end = new Date(event.endDate);
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startStr} → ${endStr}`;
}

function editEventFromDropdown(eventId) {
    closeEventDropdown();
    const event = state.events.find(e => e.id === eventId);
    if (event) {
        const startDate = new Date(event.startDate);
        openEventModal(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), eventId);
    }
}

function deleteEventFromDropdown(eventId) {
    const event = state.events.find(e => e.id === eventId);
    if (!event) return;
    
    if (confirm(`Delete "${event.title}"?`)) {
        state.events = state.events.filter(e => e.id !== eventId);
        invalidateEventCache();
        saveToLocalStorage();
        updateAllViews();
        closeEventDropdown();
        showToast('Event deleted', 'info');
    }
}

function addEventFromDropdown(year, month, day) {
    closeEventDropdown();
    openEventModal(year, month, day);
}

function handleDayCellClick(year, month, day, cellElement) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const eventsOnDate = getEventsForDate(dateStr);
    
    // Always show dropdown (even for empty days - allows adding new events)
    showEventDropdown(year, month, day, cellElement);
}

/* ============================================
   Event Management
   ============================================ */

function openEventModal(year, month, day, eventId = null) {
    const modal = document.getElementById('eventModal');
    const form = document.getElementById('eventForm');
    const titleEl = document.getElementById('modalTitle');
    const deleteBtn = document.getElementById('deleteEvent');
    
    // Reset form
    form.reset();
    state.editingEventId = eventId;
    
    // Set date
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    document.getElementById('eventDate').value = dateStr;
    
    if (eventId) {
        // Editing existing event
        const event = state.events.find(e => e.id === eventId);
        if (event) {
            titleEl.textContent = 'Edit Event';
            document.getElementById('eventTitle').value = event.title;
            document.getElementById('eventDate').value = event.startDate;
            document.getElementById('eventEndDate').value = event.endDate || '';
            document.getElementById('eventCategory').value = event.category;
            document.getElementById('eventNotes').value = event.notes || '';
            document.getElementById('syncToGoogle').checked = event.syncGoogle || false;
            document.getElementById('syncToApple').checked = event.syncApple || false;
            deleteBtn.style.display = 'block';
        }
    } else {
        titleEl.textContent = 'Add Event';
        deleteBtn.style.display = 'none';
    }
    
    modal.classList.add('active');
    closeMobileSidebar(); // Close sidebar on mobile when opening modal
}

function closeEventModal() {
    document.getElementById('eventModal').classList.remove('active');
    state.editingEventId = null;
    closeMobileSidebar(); // Close sidebar on mobile when modal closes
}

async function saveEvent(e) {
    e.preventDefault();
    
    const eventData = {
        id: state.editingEventId || generateId(),
        title: document.getElementById('eventTitle').value,
        startDate: document.getElementById('eventDate').value,
        endDate: document.getElementById('eventEndDate').value || null,
        category: document.getElementById('eventCategory').value,
        notes: document.getElementById('eventNotes').value,
        syncGoogle: document.getElementById('syncToGoogle').checked,
        syncApple: document.getElementById('syncToApple').checked,
        createdAt: new Date().toISOString()
    };
    
    if (state.editingEventId) {
        // Update existing
        const index = state.events.findIndex(e => e.id === state.editingEventId);
        if (index !== -1) {
            state.events[index] = { ...state.events[index], ...eventData };
        }
        showToast('Event updated successfully', 'success');
    } else {
        // Add new
        state.events.push(eventData);
        invalidateEventCache();
        showToast('Event created successfully', 'success');
    }
    
    // Sync to calendars if requested
    if (eventData.syncGoogle && state.googleConnected) {
        try {
            await GoogleCalendar.createEvent(eventData);
        } catch (err) {
            showToast('Failed to sync with Google Calendar', 'error');
        }
    }
    
    if (eventData.syncApple && state.appleConnected) {
        try {
            await AppleCalendar.createEvent(eventData);
        } catch (err) {
            showToast('Failed to sync with Apple Calendar', 'error');
        }
    }
    
    saveToLocalStorage();
    updateAllViews();
    closeEventModal();
}

function deleteEvent() {
    if (!state.editingEventId) return;
    
    if (confirm('Are you sure you want to delete this event?')) {
        state.events = state.events.filter(e => e.id !== state.editingEventId);
        invalidateEventCache();
        saveToLocalStorage();
        updateAllViews();
        closeEventModal();
        showToast('Event deleted', 'info');
    }
}

/* ============================================
   Goals Management
   ============================================ */

function renderGoals() {
    const container = document.getElementById('goalsList');
    container.innerHTML = '';
    
    if (state.goals.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px;">No goals yet. Add one!</p>';
        return;
    }
    
    state.goals.forEach(goal => {
        const goalEl = document.createElement('div');
        goalEl.className = `goal-item ${goal.completed ? 'completed' : ''}`;
        goalEl.dataset.category = goal.category;
        
        // Get category color
        const category = state.categories.find(c => c.id === goal.category);
        const categoryColor = category ? category.color : '#00d9ff';
        goalEl.style.borderLeftColor = categoryColor;
        
        goalEl.innerHTML = `
            <input type="checkbox" class="goal-checkbox" ${goal.completed ? 'checked' : ''} data-id="${goal.id}">
            <div class="goal-content">
                <div class="goal-title">${goal.title}</div>
                ${goal.deadline ? `<div class="goal-deadline">📅 ${formatDate(goal.deadline)}</div>` : ''}
            </div>
            <button class="goal-delete" data-id="${goal.id}">×</button>
        `;
        
        container.appendChild(goalEl);
    });
    
    // Add event listeners
    container.querySelectorAll('.goal-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => toggleGoalComplete(e.target.dataset.id));
    });
    
    container.querySelectorAll('.goal-delete').forEach(btn => {
        btn.addEventListener('click', (e) => deleteGoal(e.target.dataset.id));
    });
    
    updateStats();
}

function openGoalModal() {
    const modal = document.getElementById('goalModal');
    document.getElementById('goalForm').reset();
    modal.classList.add('active');
    closeMobileSidebar(); // Close sidebar on mobile when opening modal
}

function closeGoalModal() {
    document.getElementById('goalModal').classList.remove('active');
    closeMobileSidebar(); // Close sidebar on mobile when modal closes
}

function saveGoal(e) {
    e.preventDefault();
    
    const goal = {
        id: generateId(),
        title: document.getElementById('goalTitle').value,
        deadline: document.getElementById('goalDeadline').value || null,
        category: document.getElementById('goalCategory').value,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    state.goals.push(goal);
    saveToLocalStorage();
    renderGoals();
    closeGoalModal();
    showToast('Goal added!', 'success');
}

function toggleGoalComplete(goalId) {
    const goal = state.goals.find(g => g.id === goalId);
    if (goal) {
        goal.completed = !goal.completed;
        saveToLocalStorage();
        renderGoals();
    }
}

function deleteGoal(goalId) {
    state.goals = state.goals.filter(g => g.id !== goalId);
    saveToLocalStorage();
    renderGoals();
    showToast('Goal removed', 'info');
}

/* ============================================
   Category Management
   ============================================ */

function renderCategories() {
    const container = document.getElementById('categoriesList');
    container.innerHTML = '';
    
    state.categories.forEach(category => {
        const isVisible = state.visibleCategories.has(category.id);
        
        const categoryEl = document.createElement('label');
        categoryEl.className = 'category-item';
        categoryEl.innerHTML = `
            <input type="checkbox" ${isVisible ? 'checked' : ''} data-category="${category.id}">
            <span class="category-color" style="background: ${category.color};"></span>
            <span class="category-name">${category.emoji} ${category.name}</span>
        `;
        
        container.appendChild(categoryEl);
    });
    
    // Re-attach filter listeners
    setupCategoryFilters();
    
    // Update all category dropdowns
    updateCategoryDropdowns();
    
    // Inject dynamic CSS for category colors
    injectCategoryStyles();
}

function updateCategoryDropdowns() {
    const eventSelect = document.getElementById('eventCategory');
    const goalSelect = document.getElementById('goalCategory');
    
    const options = state.categories.map(cat => 
        `<option value="${cat.id}">${cat.emoji} ${cat.name}</option>`
    ).join('');
    
    if (eventSelect) eventSelect.innerHTML = options;
    if (goalSelect) goalSelect.innerHTML = options;
}

function injectCategoryStyles() {
    // Remove existing dynamic styles
    const existingStyle = document.getElementById('dynamic-category-styles');
    if (existingStyle) existingStyle.remove();
    
    // Create new style element
    const style = document.createElement('style');
    style.id = 'dynamic-category-styles';
    
    let css = '';
    state.categories.forEach(cat => {
        const bgColor = hexToRgba(cat.color, 0.15);
        css += `
            .category-color.${cat.id} { background: ${cat.color}; }
            .event-dot.${cat.id} { background: ${cat.color}; }
            .mobile-event-dot.${cat.id} { background: ${cat.color}; }
            .day-cell.${cat.id}-bg { background: ${bgColor}; }
            .event-dropdown-color.${cat.id} { background: ${cat.color}; }
        `;
    });
    
    style.textContent = css;
    document.head.appendChild(style);
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function openCategoryModal() {
    const modal = document.getElementById('categoryModal');
    renderCategoryManageList();
    modal.classList.add('active');
    closeMobileSidebar(); // Close sidebar on mobile when opening modal
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('active');
    closeMobileSidebar(); // Close sidebar on mobile when modal closes
}

function renderCategoryManageList() {
    const container = document.getElementById('categoryManageList');
    container.innerHTML = '';
    
    state.categories.forEach(category => {
        const eventCount = state.events.filter(e => e.category === category.id).length;
        const goalCount = state.goals.filter(g => g.category === category.id).length;
        const totalUsage = eventCount + goalCount;
        
        const itemEl = document.createElement('div');
        itemEl.className = 'category-manage-item';
        itemEl.innerHTML = `
            <div class="category-manage-color" style="background: ${category.color};"></div>
            <span class="category-manage-emoji">${category.emoji}</span>
            <span class="category-manage-name">${category.name}</span>
            <span class="category-manage-count">${totalUsage} items</span>
            <div class="category-manage-actions">
                <button class="category-manage-btn delete" 
                        onclick="deleteCategory('${category.id}')" 
                        title="Delete category"
                        ${totalUsage > 0 ? 'disabled' : ''}>
                    🗑
                </button>
            </div>
        `;
        
        container.appendChild(itemEl);
    });
    
    if (state.categories.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No categories yet.</p>';
    }
}

function addCategory() {
    const nameInput = document.getElementById('newCategoryName');
    const emojiInput = document.getElementById('newCategoryEmoji');
    const colorInput = document.getElementById('newCategoryColor');
    
    const name = nameInput.value.trim();
    const emoji = emojiInput.value.trim() || '📌';
    const color = colorInput.value;
    
    if (!name) {
        showToast('Please enter a category name', 'error');
        nameInput.focus();
        return;
    }
    
    // Generate ID from name
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Check for duplicate
    if (state.categories.some(c => c.id === id)) {
        showToast('A category with this name already exists', 'error');
        return;
    }
    
    // Add category
    const newCategory = { id, name, emoji, color };
    state.categories.push(newCategory);
    state.visibleCategories.add(id);
    
    // Clear form
    nameInput.value = '';
    emojiInput.value = '';
    colorInput.value = '#00d9ff';
    
    // Save and update UI
    saveToLocalStorage();
    renderCategories();
    renderCategoryManageList();
    updateAllViews();
    
    showToast(`Category "${name}" added!`, 'success');
}

function deleteCategory(categoryId) {
    const category = state.categories.find(c => c.id === categoryId);
    if (!category) return;
    
    // Check if category is in use
    const eventCount = state.events.filter(e => e.category === categoryId).length;
    const goalCount = state.goals.filter(g => g.category === categoryId).length;
    
    if (eventCount > 0 || goalCount > 0) {
        showToast('Cannot delete: category is in use by events or goals', 'error');
        return;
    }
    
    if (!confirm(`Delete category "${category.name}"?`)) {
        return;
    }
    
    // Remove category
    state.categories = state.categories.filter(c => c.id !== categoryId);
    state.visibleCategories.delete(categoryId);
    
    // Save and update UI
    saveToLocalStorage();
    renderCategories();
    renderCategoryManageList();
    
    showToast(`Category "${category.name}" deleted`, 'info');
}

function setupCategoryFilters() {
    document.querySelectorAll('#categoriesList .category-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const category = e.target.dataset.category;
            if (e.target.checked) {
                state.visibleCategories.add(category);
            } else {
                state.visibleCategories.delete(category);
            }
            updateAllViews();
        });
    });
}

/* ============================================
   Stats Update
   ============================================ */

function updateStats() {
    const totalEvents = state.events.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingEvents = state.events.filter(event => {
        const eventDate = new Date(event.startDate);
        return eventDate >= today;
    }).length;
    
    const goalsCompleted = state.goals.filter(g => g.completed).length;
    
    document.getElementById('totalEvents').textContent = totalEvents;
    document.getElementById('upcomingEvents').textContent = upcomingEvents;
    document.getElementById('goalsCompleted').textContent = `${goalsCompleted}/${state.goals.length}`;
}

/* ============================================
   Local Storage
   ============================================ */

function saveToLocalStorage() {
    localStorage.setItem('yearPlanner_events', JSON.stringify(state.events));
    localStorage.setItem('yearPlanner_goals', JSON.stringify(state.goals));
    localStorage.setItem('yearPlanner_categories', JSON.stringify(state.categories));
    localStorage.setItem('yearPlanner_visibleCategories', JSON.stringify([...state.visibleCategories]));
}

function loadFromLocalStorage() {
    const events = localStorage.getItem('yearPlanner_events');
    const goals = localStorage.getItem('yearPlanner_goals');
    const categories = localStorage.getItem('yearPlanner_categories');
    const visibleCategories = localStorage.getItem('yearPlanner_visibleCategories');
    
    if (events) {
        state.events = JSON.parse(events);
        invalidateEventCache();
    }
    if (goals) {
        state.goals = JSON.parse(goals);
    }
    if (categories) {
        state.categories = JSON.parse(categories);
    }
    if (visibleCategories) {
        state.visibleCategories = new Set(JSON.parse(visibleCategories));
    } else {
        // Default: all categories visible
        state.visibleCategories = new Set(state.categories.map(c => c.id));
    }
}

/* ============================================
   Calendar Sync
   ============================================ */

async function syncCalendars() {
    showToast('Syncing calendars...', 'info');
    
    try {
        if (state.googleConnected) {
            const googleEvents = await GoogleCalendar.fetchEvents(state.currentYear);
            mergeExternalEvents(googleEvents, 'google');
        }
        
        if (state.appleConnected) {
            const appleEvents = await AppleCalendar.fetchEvents(state.currentYear);
            mergeExternalEvents(appleEvents, 'apple');
        }
        
        updateAllViews();
        showToast('Calendars synced successfully!', 'success');
    } catch (err) {
        console.error('Sync error:', err);
        showToast('Failed to sync some calendars', 'error');
    }
}

function mergeExternalEvents(externalEvents, source) {
    let hasChanges = false;
    externalEvents.forEach(extEvent => {
        // Check if event already exists (by external ID)
        const existingIndex = state.events.findIndex(e => e.externalId === extEvent.id && e.source === source);
        
        if (existingIndex === -1) {
            // Add new event
            state.events.push({
                id: generateId(),
                externalId: extEvent.id,
                source: source,
                title: extEvent.title,
                startDate: extEvent.startDate,
                endDate: extEvent.endDate,
                category: categorizeExternalEvent(extEvent.title),
                notes: extEvent.description || '',
                syncGoogle: source === 'google',
                syncApple: source === 'apple'
            });
            hasChanges = true;
        } else {
            // Update existing
            const oldEvent = state.events[existingIndex];
            const newEvent = {
                ...oldEvent,
                title: extEvent.title,
                startDate: extEvent.startDate,
                endDate: extEvent.endDate,
                notes: extEvent.description || ''
            };
            // Check if anything actually changed
            if (oldEvent.title !== newEvent.title || 
                oldEvent.startDate !== newEvent.startDate ||
                oldEvent.endDate !== newEvent.endDate ||
                oldEvent.notes !== newEvent.notes) {
                state.events[existingIndex] = newEvent;
                hasChanges = true;
            }
        }
    });
    
    if (hasChanges) {
        invalidateEventCache();
        saveToLocalStorage();
    }
}

function categorizeExternalEvent(title) {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('trip') || titleLower.includes('vacation') || titleLower.includes('travel') || titleLower.includes('family')) {
        return 'family-trips';
    }
    if (titleLower.includes('wedding') || titleLower.includes('ceremony') || titleLower.includes('engagement')) {
        return 'weddings';
    }
    if (titleLower.includes('spa') || titleLower.includes('relax') || titleLower.includes('refresh') || titleLower.includes('wellness')) {
        return 'refresh-days';
    }
    if (titleLower.includes('music') || titleLower.includes('concert') || titleLower.includes('launch') || titleLower.includes('release')) {
        return 'music-launch';
    }
    if (titleLower.includes('ball') || titleLower.includes('game') || titleLower.includes('match') || titleLower.includes('sport')) {
        return 'ball-days';
    }
    
    // Default to family trips for uncategorized
    return 'family-trips';
}

/* ============================================
   Print Functionality
   ============================================ */

function printYearPlanner() {
    window.print();
}

/* ============================================
   Utility Functions
   ============================================ */

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
    
    // Manual close
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
}

/* ============================================
   Mobile Month View
   ============================================ */

// Optimized: Use DocumentFragment and event delegation
function renderMobileMonthView() {
    const container = domCache.mobileMonthGrid;
    const eventsContainer = domCache.mobileMonthEvents;
    const titleEl = domCache.mobileMonthTitle;
    
    if (!container) return; // Desktop view
    
    const year = state.currentYear;
    const month = state.currentMonth;
    const daysInMonth = getDaysInMonth(month, year);
    
    // Update title
    titleEl.textContent = `${MONTHS[month]} ${year}`;
    
    // Use DocumentFragment for batch DOM operations
    const fragment = document.createDocumentFragment();
    
    // Day headers (Sun, Mon, Tue, etc.)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(dayName => {
        const header = document.createElement('div');
        header.className = 'mobile-day-header';
        header.textContent = dayName;
        fragment.appendChild(header);
    });
    
    // Get first day of month (0 = Sunday, 1 = Monday, etc.)
    const firstDay = new Date(year, month, 1).getDay();
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'mobile-day-cell unavailable';
        fragment.appendChild(emptyCell);
    }
    
    // Pre-build event cache for this month
    buildEventsByDateCache();
    const today = new Date();
    
    // Add day cells using DocumentFragment
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'mobile-day-cell';
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dayCell.dataset.date = dateStr;
        dayCell.dataset.month = month;
        dayCell.dataset.day = day;
        
        // Check if today
        if (today.getFullYear() === year && 
            today.getMonth() === month && 
            today.getDate() === day) {
            dayCell.classList.add('today');
        }
        
        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'mobile-day-number';
        dayNumber.textContent = day;
        dayCell.appendChild(dayNumber);
        
        // Events for this day (use cached lookup)
        const dayEvents = eventsByDateCache[dateStr] || [];
        if (dayEvents.length > 0) {
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'mobile-day-events';
            dayEvents.slice(0, 3).forEach(event => {
                const dot = document.createElement('div');
                dot.className = `mobile-event-dot ${event.category}`;
                eventsContainer.appendChild(dot);
            });
            dayCell.appendChild(eventsContainer);
        }
        
        fragment.appendChild(dayCell);
    }
    
    // Single DOM update instead of multiple appends
    container.innerHTML = '';
    container.appendChild(fragment);
    
    // Render events list
    renderMobileMonthEvents(month, year);
}

// Optimized: Use cached month events and DocumentFragment
function renderMobileMonthEvents(month, year) {
    const container = domCache.mobileMonthEvents;
    if (!container) return;
    
    // Use cached month events
    buildEventsByMonthCache();
    const monthKey = `${year}-${month}`;
    const monthEvents = eventsByMonthCache[monthKey] || [];
    
    if (monthEvents.length === 0) {
        container.innerHTML = '<div class="mobile-empty-state">No events this month</div>';
        return;
    }
    
    // Use DocumentFragment for batch DOM operations
    const fragment = document.createDocumentFragment();
    
    monthEvents.forEach(event => {
        const eventEl = document.createElement('div');
        eventEl.className = 'mobile-event-item';
        eventEl.dataset.eventId = event.id;
        
        const category = state.categories.find(c => c.id === event.category);
        const categoryColor = category ? category.color : '#00d9ff';
        
        const startDate = new Date(event.startDate);
        const dateStr = startDate.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        
        eventEl.innerHTML = `
            <div class="mobile-event-header">
                <div class="mobile-event-color" style="background: ${categoryColor};"></div>
                <div class="mobile-event-title">${event.title}</div>
                <div class="mobile-event-date">${dateStr}</div>
            </div>
            ${event.notes ? `<div class="mobile-event-notes">${event.notes}</div>` : ''}
        `;
        
        // Click handler removed - now using event delegation in setupEventDelegation()
        
        fragment.appendChild(eventEl);
    });
    
    // Single DOM update
    container.innerHTML = '';
    container.appendChild(fragment);
}

function navigateMobileMonth(direction) {
    if (direction === 'next') {
        if (state.currentMonth === 11) {
            state.currentMonth = 0;
            state.currentYear++;
        } else {
            state.currentMonth++;
        }
    } else {
        if (state.currentMonth === 0) {
            state.currentMonth = 11;
            state.currentYear--;
        } else {
            state.currentMonth--;
        }
    }
    
    document.getElementById('currentYear').textContent = state.currentYear;
    renderMobileMonthView();
    if (!isMobileView()) {
        renderYearGrid(); // Update desktop view too
    }
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    state.sidebarOpen = !state.sidebarOpen;
    
    if (state.sidebarOpen) {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function closeMobileSidebar() {
    if (state.sidebarOpen) {
        toggleMobileSidebar();
    }
}

// Swipe gesture support for mobile
function initSwipeGestures() {
    const container = document.querySelector('.mobile-month-container');
    if (!container) return;
    
    let touchStartX = 0;
    let touchEndX = 0;
    
    container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    container.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe left - next month
                navigateMobileMonth('next');
            } else {
                // Swipe right - previous month
                navigateMobileMonth('prev');
            }
        }
    }
}

// Check if mobile view should be shown
function isMobileView() {
    return window.innerWidth <= 900;
}

// Handle window resize
function handleResize() {
    if (isMobileView()) {
        renderMobileMonthView();
    } else {
        renderYearGrid();
    }
}

/* ============================================
   Event Listeners Setup
   ============================================ */

function setupEventListeners() {
    // Year navigation
    document.getElementById('prevYear').addEventListener('click', () => {
        state.currentYear--;
        renderYearGrid();
        if (isMobileView()) {
            renderMobileMonthView();
        }
    });
    
    document.getElementById('nextYear').addEventListener('click', () => {
        state.currentYear++;
        renderYearGrid();
        if (isMobileView()) {
            renderMobileMonthView();
        }
    });
    
    // Mobile month navigation
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => navigateMobileMonth('prev'));
    }
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => navigateMobileMonth('next'));
    }
    
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
    }
    
    // Sidebar overlay close
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeMobileSidebar);
    }
    
    // Print
    document.getElementById('printBtn').addEventListener('click', printYearPlanner);
    
    // Sync calendars
    document.getElementById('syncCalendars').addEventListener('click', syncCalendars);
    
    // Event modal
    document.getElementById('closeModal').addEventListener('click', closeEventModal);
    document.getElementById('cancelEvent').addEventListener('click', closeEventModal);
    document.getElementById('eventForm').addEventListener('submit', saveEvent);
    document.getElementById('deleteEvent').addEventListener('click', deleteEvent);
    
    // Goal modal
    document.getElementById('addGoal').addEventListener('click', openGoalModal);
    document.getElementById('closeGoalModal').addEventListener('click', closeGoalModal);
    document.getElementById('cancelGoal').addEventListener('click', closeGoalModal);
    document.getElementById('goalForm').addEventListener('submit', saveGoal);
    
    // Category modal
    document.getElementById('manageCategories').addEventListener('click', openCategoryModal);
    document.getElementById('closeCategoryModal').addEventListener('click', closeCategoryModal);
    document.getElementById('closeCategoryModalBtn').addEventListener('click', closeCategoryModal);
    document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
    
    // Color presets
    document.querySelectorAll('.color-preset').forEach(preset => {
        preset.addEventListener('click', () => {
            const color = preset.dataset.color;
            document.getElementById('newCategoryColor').value = color;
            // Visual feedback
            document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('selected'));
            preset.classList.add('selected');
        });
    });
    
    // Calendar connections
    document.getElementById('connectGoogle').addEventListener('click', async () => {
        try {
            await GoogleCalendar.connect();
            state.googleConnected = true;
            document.getElementById('connectGoogle').textContent = 'Connected';
            document.getElementById('connectGoogle').classList.add('connected');
            showToast('Google Calendar connected!', 'success');
            syncCalendars();
        } catch (err) {
            showToast('Failed to connect Google Calendar', 'error');
        }
    });
    
    document.getElementById('connectApple').addEventListener('click', async () => {
        try {
            await AppleCalendar.connect();
            state.appleConnected = true;
            document.getElementById('connectApple').textContent = 'Connected';
            document.getElementById('connectApple').classList.add('connected');
            showToast('Apple Calendar connected!', 'success');
            syncCalendars();
        } catch (err) {
            showToast('Failed to connect Apple Calendar', 'error');
        }
    });
    
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEventDropdown();
            closeEventModal();
            closeGoalModal();
            closeCategoryModal();
            closeMobileSidebar();
        }
    });
    
    // Window resize handler (already debounced)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 250);
    });
    
    // Initialize swipe gestures
    initSwipeGestures();
}

/* ============================================
   Event Delegation for Performance
   ============================================ */

// Use event delegation instead of individual listeners for better performance
function setupEventDelegation() {
    // Desktop year grid - delegate clicks to day cells
    const yearGrid = domCache.yearGrid;
    if (yearGrid) {
        yearGrid.addEventListener('click', (e) => {
            const dayCell = e.target.closest('.day-cell:not(.unavailable)');
            if (dayCell) {
                e.stopPropagation();
                const year = state.currentYear;
                const month = parseInt(dayCell.dataset.month);
                const day = parseInt(dayCell.dataset.day);
                handleDayCellClick(year, month, day, dayCell);
            }
        });
    }
    
    // Mobile month grid - delegate clicks to day cells
    const mobileMonthGrid = domCache.mobileMonthGrid;
    if (mobileMonthGrid) {
        mobileMonthGrid.addEventListener('click', (e) => {
            const dayCell = e.target.closest('.mobile-day-cell:not(.unavailable)');
            if (dayCell) {
                e.stopPropagation();
                const year = state.currentYear;
                const month = parseInt(dayCell.dataset.month);
                const day = parseInt(dayCell.dataset.day);
                handleDayCellClick(year, month, day, dayCell);
            }
        });
    }
    
    // Mobile events list - delegate clicks to event items
    const mobileMonthEvents = domCache.mobileMonthEvents;
    if (mobileMonthEvents) {
        mobileMonthEvents.addEventListener('click', (e) => {
            const eventItem = e.target.closest('.mobile-event-item');
            if (eventItem) {
                const eventId = eventItem.dataset.eventId;
                if (eventId) {
                    editEventFromDropdown(eventId);
                }
            }
        });
    }
}

/* ============================================
   Initialize App
   ============================================ */

function init() {
    // Initialize DOM cache first
    initDOMCache();
    
    loadFromLocalStorage();
    renderCategories();  // Render categories first (creates dynamic styles)
    
    // Render appropriate view based on screen size
    if (isMobileView()) {
        renderMobileMonthView();
    } else {
        renderYearGrid();
    }
    
    renderGoals();
    setupEventListeners();
    setupEventDelegation(); // Add event delegation for performance
    updateStats();
    
    // Add some sample events for demo if empty
    if (state.events.length === 0) {
        addSampleData();
    }
    
    // Add balanced time off plan for the year
    addBalancedTimeOffPlan();
    
    // Add balanced time off plan for the year
    addBalancedTimeOffPlan();
}

function addSampleData() {
    const year = state.currentYear;
    
    state.events = [
        {
            id: generateId(),
            title: 'Family Trip to Beach',
            startDate: `${year}-07-15`,
            endDate: `${year}-07-22`,
            category: 'family-trips',
            notes: 'Annual beach vacation',
            syncGoogle: false,
            syncApple: false
        },
        {
            id: generateId(),
            title: "Sarah's Wedding",
            startDate: `${year}-09-20`,
            endDate: null,
            category: 'weddings',
            notes: 'Best friend wedding',
            syncGoogle: false,
            syncApple: false
        },
        {
            id: generateId(),
            title: 'Spa Day',
            startDate: `${year}-03-08`,
            endDate: null,
            category: 'refresh-days',
            notes: 'Self care day',
            syncGoogle: false,
            syncApple: false
        },
        {
            id: generateId(),
            title: 'Album Launch',
            startDate: `${year}-05-01`,
            endDate: null,
            category: 'music-launch',
            notes: 'New album release party',
            syncGoogle: false,
            syncApple: false
        },
        {
            id: generateId(),
            title: 'Charity Ball',
            startDate: `${year}-12-15`,
            endDate: null,
            category: 'ball-days',
            notes: 'Annual charity gala',
            syncGoogle: false,
            syncApple: false
        }
    ];
    
    state.goals = [
        {
            id: generateId(),
            title: 'Plan summer vacation',
            deadline: `${year}-05-01`,
            category: 'family-trips',
            completed: false
        },
        {
            id: generateId(),
            title: 'Complete wedding gift list',
            deadline: `${year}-09-01`,
            category: 'weddings',
            completed: false
        }
    ];
    
    saveToLocalStorage();
    updateAllViews();
    renderGoals();
}

/* ============================================
   Balanced Time Off Plan
   ============================================ */

function addBalancedTimeOffPlan() {
    const year = state.currentYear;
    
    // Add US Public Holidays
    addUSPublicHolidays(year);
    
    // Add last 2 weeks of December
    addYearEndHolidays(year);
    
    // Add 2 refresh days per quarter (8 total)
    addQuarterlyRefreshDays(year);
    
    // Add 3 doctor visits throughout the year
    addDoctorVisits(year);
    
    // Add 25 vacation days (time off)
    addVacationDays(year);
    
    // Invalidate cache and update views
    invalidateEventCache();
    saveToLocalStorage();
    updateAllViews();
}

function addUSPublicHolidays(year) {
    const holidays = [
        { name: "New Year's Day", month: 0, day: 1 },
        { name: "Martin Luther King Jr. Day", month: 0, day: getMLKDay(year) },
        { name: "Presidents' Day", month: 1, day: getPresidentsDay(year) },
        { name: "Memorial Day", month: 4, day: getMemorialDay(year) },
        { name: "Independence Day", month: 6, day: 4 },
        { name: "Labor Day", month: 8, day: getLaborDay(year) },
        { name: "Columbus Day", month: 9, day: getColumbusDay(year) },
        { name: "Veterans Day", month: 10, day: 11 },
        { name: "Thanksgiving", month: 10, day: getThanksgiving(year) },
        { name: "Christmas", month: 11, day: 25 }
    ];
    
    holidays.forEach(holiday => {
        const dateStr = `${year}-${String(holiday.month + 1).padStart(2, '0')}-${String(holiday.day).padStart(2, '0')}`;
        
        // Check if holiday already exists
        if (!state.events.some(e => e.startDate === dateStr && e.title === holiday.name)) {
            state.events.push({
                id: generateId(),
                title: holiday.name,
                startDate: dateStr,
                endDate: null,
                category: 'refresh-days', // Using refresh-days for holidays
                notes: 'US Public Holiday',
                syncGoogle: false,
                syncApple: false
            });
        }
    });
}

// Helper functions for calculating floating holidays
function getMLKDay(year) {
    // Third Monday of January
    const jan1 = new Date(year, 0, 1);
    const firstMonday = 1 + (8 - jan1.getDay()) % 7;
    return firstMonday + 14; // Third Monday
}

function getPresidentsDay(year) {
    // Third Monday of February
    const feb1 = new Date(year, 1, 1);
    const firstMonday = 1 + (8 - feb1.getDay()) % 7;
    return firstMonday + 14; // Third Monday
}

function getMemorialDay(year) {
    // Last Monday of May
    const may31 = new Date(year, 4, 31);
    const lastMonday = 31 - ((may31.getDay() + 1) % 7);
    return lastMonday;
}

function getLaborDay(year) {
    // First Monday of September
    const sep1 = new Date(year, 8, 1);
    const firstMonday = 1 + (8 - sep1.getDay()) % 7;
    return firstMonday;
}

function getColumbusDay(year) {
    // Second Monday of October
    const oct1 = new Date(year, 9, 1);
    const firstMonday = 1 + (8 - oct1.getDay()) % 7;
    return firstMonday + 7; // Second Monday
}

function getThanksgiving(year) {
    // Fourth Thursday of November
    const nov1 = new Date(year, 10, 1);
    const firstThursday = 1 + (11 - nov1.getDay()) % 7;
    return firstThursday + 21; // Fourth Thursday
}

function addYearEndHolidays(year) {
    // Last 2 weeks of December (Dec 18-31)
    for (let day = 18; day <= 31; day++) {
        const dateStr = `${year}-12-${String(day).padStart(2, '0')}`;
        
        if (!state.events.some(e => e.startDate === dateStr && e.title === 'Year End Holiday')) {
            state.events.push({
                id: generateId(),
                title: 'Year End Holiday',
                startDate: dateStr,
                endDate: null,
                category: 'refresh-days',
                notes: 'Year end time off',
                syncGoogle: false,
                syncApple: false
            });
        }
    }
}

function addQuarterlyRefreshDays(year) {
    // 2 refresh days per quarter (8 total)
    const quarters = [
        { month: 2, days: [15, 28] },  // Q1: March
        { month: 5, days: [10, 25] },  // Q2: June
        { month: 8, days: [12, 27] },  // Q3: September
        { month: 11, days: [5, 20] }   // Q4: December (before year end holidays)
    ];
    
    quarters.forEach(quarter => {
        quarter.days.forEach(day => {
            const dateStr = `${year}-${String(quarter.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            // Skip if it's in the year end holiday period
            if (quarter.month === 11 && day >= 18) return;
            
            if (!state.events.some(e => e.startDate === dateStr && e.title === 'Refresh Day')) {
                state.events.push({
                    id: generateId(),
                    title: 'Refresh Day',
                    startDate: dateStr,
                    endDate: null,
                    category: 'refresh-days',
                    notes: 'Quarterly refresh day',
                    syncGoogle: false,
                    syncApple: false
                });
            }
        });
    });
}

function addDoctorVisits(year) {
    // 3 doctor visits throughout the year (spread out)
    const visits = [
        { month: 2, day: 8 },   // March
        { month: 6, day: 15 },  // July
        { month: 10, day: 22 }  // November
    ];
    
    visits.forEach(visit => {
        const dateStr = `${year}-${String(visit.month + 1).padStart(2, '0')}-${String(visit.day).padStart(2, '0')}`;
        
        if (!state.events.some(e => e.startDate === dateStr && e.title === 'Doctor Visit')) {
            state.events.push({
                id: generateId(),
                title: 'Doctor Visit',
                startDate: dateStr,
                endDate: null,
                category: 'doctor-visits',
                notes: 'Annual checkup',
                syncGoogle: false,
                syncApple: false
            });
        }
    });
}

function addVacationDays(year) {
    // 25 vacation days spread throughout the year
    // Avoiding holidays and year-end period
    const vacationPeriods = [
        { start: { month: 1, day: 20 }, end: { month: 1, day: 24 } },  // 5 days in February
        { start: { month: 3, day: 1 }, end: { month: 3, day: 5 } },   // 5 days in April
        { start: { month: 5, day: 15 }, end: { month: 5, day: 19 } }, // 5 days in June
        { start: { month: 7, day: 1 }, end: { month: 7, day: 5 } },  // 5 days in August
        { start: { month: 9, day: 10 }, end: { month: 9, day: 14 } }  // 5 days in October
    ];
    
    vacationPeriods.forEach(period => {
        const startDate = new Date(year, period.start.month, period.start.day);
        const endDate = new Date(year, period.end.month, period.end.day);
        
        const current = new Date(startDate);
        while (current <= endDate) {
            const dateStr = `${year}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
            
            // Skip if it's a weekend
            const dayOfWeek = current.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                // Check if it's not already a holiday or year-end period
                const isHoliday = state.events.some(e => e.startDate === dateStr && 
                    (e.category === 'refresh-days' || e.title.includes('Holiday')));
                
                if (!isHoliday && !state.events.some(e => e.startDate === dateStr && e.title === 'Vacation Day')) {
                    state.events.push({
                        id: generateId(),
                        title: 'Vacation Day',
                        startDate: dateStr,
                        endDate: null,
                        category: 'family-trips', // Using family-trips for vacation
                        notes: 'Time off',
                        syncGoogle: false,
                        syncApple: false
                    });
                }
            }
            
            current.setDate(current.getDate() + 1);
        }
    });
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);



