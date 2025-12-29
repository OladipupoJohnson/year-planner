
/* ============================================
   Year Planner - Main Application
   ============================================ */

// Default Categories
const DEFAULT_CATEGORIES = [
    { id: 'family-trips', name: 'Family Trips', emoji: '🏖️', color: '#00d9ff' },
    { id: 'weddings', name: 'Weddings', emoji: '💒', color: '#ff6b9d' },
    { id: 'refresh-days', name: 'Refresh Days', emoji: '🧘', color: '#7cff6b' },
    { id: 'music-launch', name: 'Music Launch Days', emoji: '🎵', color: '#ffb347' },
    { id: 'ball-days', name: 'Ball Days', emoji: '⚽', color: '#a78bfa' }
];

// Application State
const state = {
    currentYear: new Date().getFullYear(),
    events: [],
    goals: [],
    categories: [...DEFAULT_CATEGORIES],
    visibleCategories: new Set(['family-trips', 'weddings', 'refresh-days', 'music-launch', 'ball-days']),
    googleConnected: false,
    appleConnected: false,
    editingEventId: null
};

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
                
                // Add click handler for valid days - shows dropdown menu
                dayCell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleDayCellClick(year, monthIndex, day, dayCell);
                });
            }
            
            monthRow.appendChild(dayCell);
        }
        
        grid.appendChild(monthRow);
    });
    
    // Render events on grid
    renderEventsOnGrid();
}

function renderEventsOnGrid() {
    // Clear existing event indicators
    document.querySelectorAll('.day-cell').forEach(cell => {
        cell.classList.remove('has-event', 'event-start', 'event-middle', 'event-end');
        cell.classList.remove('family-trips-bg', 'weddings-bg', 'refresh-days-bg', 'music-launch-bg', 'ball-days-bg');
        cell.removeAttribute('data-tooltip');
        
        // Remove event dots
        const dots = cell.querySelectorAll('.event-dot, .multi-event');
        dots.forEach(dot => dot.remove());
    });
    
    // Group events by date
    const eventsByDate = {};
    
    state.events.forEach(event => {
        if (!state.visibleCategories.has(event.category)) return;
        
        const startDate = new Date(event.startDate);
        const endDate = event.endDate ? new Date(event.endDate) : startDate;
        
        // Only process events in current year
        if (startDate.getFullYear() !== state.currentYear && 
            endDate.getFullYear() !== state.currentYear) return;
        
        // Iterate through each day of the event
        const current = new Date(startDate);
        while (current <= endDate) {
            if (current.getFullYear() === state.currentYear) {
                const dateKey = current.toISOString().split('T')[0];
                if (!eventsByDate[dateKey]) {
                    eventsByDate[dateKey] = [];
                }
                eventsByDate[dateKey].push({
                    ...event,
                    isStart: current.getTime() === startDate.getTime(),
                    isEnd: current.getTime() === endDate.getTime()
                });
            }
            current.setDate(current.getDate() + 1);
        }
    });
    
    // Render events on cells
    Object.entries(eventsByDate).forEach(([dateKey, events]) => {
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
        if (events.some(e => e.isStart && !e.isEnd)) {
            cell.classList.add('event-start');
        }
        if (events.some(e => e.isEnd && !e.isStart)) {
            cell.classList.add('event-end');
        }
        if (events.some(e => !e.isStart && !e.isEnd)) {
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
}

/* ============================================
   Event Dropdown Menu
   ============================================ */

function getEventsForDate(dateStr) {
    return state.events.filter(event => {
        if (!state.visibleCategories.has(event.category)) return false;
        
        const startDate = new Date(event.startDate);
        const endDate = event.endDate ? new Date(event.endDate) : startDate;
        const checkDate = new Date(dateStr);
        
        // Set all dates to midnight for comparison
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        checkDate.setHours(0, 0, 0, 0);
        
        return checkDate >= startDate && checkDate <= endDate;
    });
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
        saveToLocalStorage();
        renderEventsOnGrid();
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
}

function closeEventModal() {
    document.getElementById('eventModal').classList.remove('active');
    state.editingEventId = null;
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
    renderEventsOnGrid();
    closeEventModal();
}

function deleteEvent() {
    if (!state.editingEventId) return;
    
    if (confirm('Are you sure you want to delete this event?')) {
        state.events = state.events.filter(e => e.id !== state.editingEventId);
        saveToLocalStorage();
        renderEventsOnGrid();
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
}

function closeGoalModal() {
    document.getElementById('goalModal').classList.remove('active');
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
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('active');
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
    renderEventsOnGrid();
    
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
            renderEventsOnGrid();
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
        
        renderEventsOnGrid();
        showToast('Calendars synced successfully!', 'success');
    } catch (err) {
        console.error('Sync error:', err);
        showToast('Failed to sync some calendars', 'error');
    }
}

function mergeExternalEvents(externalEvents, source) {
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
        } else {
            // Update existing
            state.events[existingIndex] = {
                ...state.events[existingIndex],
                title: extEvent.title,
                startDate: extEvent.startDate,
                endDate: extEvent.endDate,
                notes: extEvent.description || ''
            };
        }
    });
    
    saveToLocalStorage();
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
   Event Listeners Setup
   ============================================ */

function setupEventListeners() {
    // Year navigation
    document.getElementById('prevYear').addEventListener('click', () => {
        state.currentYear--;
        renderYearGrid();
    });
    
    document.getElementById('nextYear').addEventListener('click', () => {
        state.currentYear++;
        renderYearGrid();
    });
    
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
        }
    });
}

/* ============================================
   Initialize App
   ============================================ */

function init() {
    loadFromLocalStorage();
    renderCategories();  // Render categories first (creates dynamic styles)
    renderYearGrid();
    renderGoals();
    setupEventListeners();
    updateStats();
    
    // Add some sample events for demo if empty
    if (state.events.length === 0) {
        addSampleData();
    }
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
    renderEventsOnGrid();
    renderGoals();
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);



