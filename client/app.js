/**
 * PostRaceAnalysis client application
 */

class App {
    constructor() {
        this.container = document.getElementById('app');
        this.apiBase = window.REACT_APP_API_BASE || 'http://localhost:5000';
        this.events = [];
        this.selectedEventId = null;
        this.searchQuery = '';
        this.searchDate = '';
        this.init();
    }

    async init() {
        try {
            await this.checkHealth();
            await this.loadEvents();
            this.render();
        } catch (error) {
            this.renderError(error.message);
        }
    }

    async checkHealth() {
        const response = await fetch(`${this.apiBase}/api/health`);
        if (!response.ok) throw new Error('Server unavailable');
        await response.json();
    }

    async loadEvents() {
        const params = new URLSearchParams();
        if (this.searchQuery) params.set('q', this.searchQuery);
        if (this.searchDate) params.set('date', this.searchDate);
        const url = `${this.apiBase}/events${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Unable to load races');
        const data = await response.json();
        this.events = data.events || [];
    }

    async createEvent(event) {
        event.preventDefault();
        const title = this.titleInput.value.trim();
        const date = this.dateInput.value;
        if (!title) {
            alert('Race name is required');
            return;
        }
        const body = { title };
        if (date) body.start_time = new Date(date).toISOString();
        const response = await fetch(`${this.apiBase}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Failed to create race');
        }
        const newEvent = await response.json();
        this.events.unshift(newEvent);
        this.selectedEventId = newEvent.id;
        this.titleInput.value = '';
        this.dateInput.value = '';
        this.render();
    }

    async searchEvents() {
        this.searchQuery = this.searchInput.value.trim();
        this.searchDate = this.dateInputFilter.value;
        await this.loadEvents();
        this.render();
    }

    selectEvent(eventId) {
        this.selectedEventId = eventId;
        this.render();
    }

    formatEventDate(event) {
        if (!event.start_time) return 'No date set';
        const date = new Date(event.start_time);
        return date.toLocaleString();
    }

    render() {
        if (!this.container) return;
        const selectedEvent = this.events.find(ev => ev.id === this.selectedEventId);
        this.container.innerHTML = `
            <div class="panel">
                <div class="panel-card">
                    <h2>Create a new race</h2>
                    <form id="create-event-form">
                        <label>Race name</label>
                        <input id="race-title" type="text" placeholder="Enter race name" required />
                        <label>Race date</label>
                        <input id="race-date" type="datetime-local" />
                        <button type="submit">Create race</button>
                    </form>
                </div>
                <div class="panel-card">
                    <h2>Search races</h2>
                    <label>Search by name</label>
                    <input id="search-query" type="text" placeholder="Search races" value="${this.searchQuery}" />
                    <label>Filter by date</label>
                    <input id="search-date" type="date" value="${this.searchDate}" />
                    <button id="search-button">Search</button>
                </div>
            </div>
            <div class="panel">
                <div class="panel-card list-card">
                    <h2>Race list</h2>
                    ${this.events.length === 0 ? '<p>No races yet.</p>' : ''}
                    <ul class="event-list">
                        ${this.events.map(ev => `
                            <li class="event-item ${ev.id === this.selectedEventId ? 'selected' : ''}">
                                <button class="event-select" data-id="${ev.id}">${ev.title}</button>
                                <div class="event-meta">${this.formatEventDate(ev)}</div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                <div class="panel-card detail-card">
                    <h2>Selected race</h2>
                    ${selectedEvent ? `
                        <h3>${selectedEvent.title}</h3>
                        <p><strong>Date:</strong> ${this.formatEventDate(selectedEvent)}</p>
                        <p><strong>Description:</strong> ${selectedEvent.description || 'No description'}</p>
                        <p><strong>ID:</strong> ${selectedEvent.id}</p>
                        <p>Use this race ID to upload video and GPS in the next step.</p>
                    ` : '<p>Select a race from the list to view details.</p>'}
                </div>
            </div>
        `;

        this.titleInput = this.container.querySelector('#race-title');
        this.dateInput = this.container.querySelector('#race-date');
        this.searchInput = this.container.querySelector('#search-query');
        this.dateInputFilter = this.container.querySelector('#search-date');

        this.container.querySelector('#create-event-form').addEventListener('submit', e => this.createEvent(e));
        this.container.querySelector('#search-button').addEventListener('click', () => this.searchEvents());
        this.container.querySelectorAll('.event-select').forEach(button => {
            button.addEventListener('click', () => this.selectEvent(button.dataset.id));
        });
    }

    renderError(message) {
        if (this.container) {
            this.container.innerHTML = `<p style="color: red;">Error: ${message}</p>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
