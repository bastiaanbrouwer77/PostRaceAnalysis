/**
 * PostRaceAnalysis client application
 */

class App {
    constructor() {
        this.container = document.getElementById('app');
        this.apiBase = window.REACT_APP_API_BASE || window.location.origin;
        this.events = [];
        this.selectedEvent = null;
        this.uploads = [];
        this.searchQuery = '';
        this.statusMessage = '';
        this.uploadStatus = '';
        this.init();
    }

    async init() {
        await this.refreshEvents();
        this.render();
    }

    async refreshEvents() {
        const query = encodeURIComponent(this.searchQuery || '');
        const url = `${this.apiBase}/api/events${query ? `?query=${query}` : ''}`;
        try {
            const response = await fetch(url);
            this.events = await response.json();
        } catch (error) {
            console.error('Could not load events', error);
            this.statusMessage = 'Unable to load races at this time.';
        }
    }

    async fetchUploads(eventId) {
        if (!eventId) {
            this.uploads = [];
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/api/events/${eventId}/uploads`);
            this.uploads = await response.json();
        } catch (error) {
            console.error('Could not load uploads', error);
            this.uploads = [];
        }
    }

    async createEvent(event) {
        event.preventDefault();
        const name = this.container.querySelector('#event-name').value.trim();
        const date = this.container.querySelector('#event-date').value;

        if (!name || !date) {
            this.statusMessage = 'Please provide both a race name and a date.';
            this.render();
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/api/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, date }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to create race');
            }

            const created = await response.json();
            this.statusMessage = `Created race "${created.name}."`;
            this.searchQuery = '';
            this.selectedEvent = created;
            await this.refreshEvents();
            await this.fetchUploads(created.id);
            this.render();
        } catch (error) {
            console.error('Create event failed', error);
            this.statusMessage = 'Could not create race. Check the name and date.';
            this.render();
        }
    }

    async uploadFile(event) {
        event.preventDefault();
        if (!this.selectedEvent) {
            this.uploadStatus = 'Select a race before uploading files.';
            this.render();
            return;
        }

        const fileInput = this.container.querySelector('#media-file');
        const typeSelect = this.container.querySelector('#media-type');
        const file = fileInput.files[0];
        const mediaType = typeSelect.value;

        if (!file) {
            this.uploadStatus = 'Choose a file to upload.';
            this.render();
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('media_type', mediaType);

        try {
            const response = await fetch(`${this.apiBase}/api/events/${this.selectedEvent.id}/uploads`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Upload failed');
            }

            const uploaded = await response.json();
            this.uploadStatus = `Uploaded ${uploaded.filename} as ${uploaded.media_type}.`;
            fileInput.value = '';
            await this.fetchUploads(this.selectedEvent.id);
            this.render();
        } catch (error) {
            console.error('Upload failed', error);
            this.uploadStatus = 'Upload failed. Try again.';
            this.render();
        }
    }

    async selectEvent(eventId) {
        this.selectedEvent = this.events.find((item) => item.id === eventId) || null;
        await this.fetchUploads(eventId);
        this.render();
    }

    render() {
        if (!this.container) {
            return;
        }

        const eventCards = this.events
            .map((item) => {
                const isSelected = this.selectedEvent && this.selectedEvent.id === item.id;
                return `
                    <li class="event-item ${isSelected ? 'selected' : ''}">
                        <button type="button" class="event-select" data-event-id="${item.id}">
                            ${item.name}
                        </button>
                        <div class="event-meta">
                            <strong>Date:</strong> ${item.date}<br>
                            <small>Created: ${new Date(item.created_at).toLocaleString()}</small>
                        </div>
                    </li>
                `;
            })
            .join('') || '<li>No races found.</li>';

        const uploadRows = this.uploads
            .map((upload) => `
                <li>
                    ${upload.filename} <strong>(${upload.media_type})</strong> — ${new Date(upload.uploaded_at).toLocaleString()}
                </li>
            `)
            .join('') || '<li>No uploaded files yet.</li>';

        this.container.innerHTML = `
            <div class="panel">
                <div class="panel-card">
                    <h2>Create a race</h2>
                    <form id="event-form">
                        <label for="event-name">Race name</label>
                        <input id="event-name" type="text" placeholder="Example: North Sea Sprint" required />
                        <label for="event-date">Race date</label>
                        <input id="event-date" type="date" required />
                        <button type="submit">Create race</button>
                    </form>
                    <p>${this.statusMessage || 'Create a race once and select it below.'}</p>
                </div>

                <div class="panel-card">
                    <h2>Search races</h2>
                    <label for="search-query">Search by name</label>
                    <input id="search-query" type="search" value="${this.searchQuery}" placeholder="Search races" />
                    <ul class="event-list">${eventCards}</ul>
                </div>

                <div class="panel-card detail-card">
                    <h2>Selected race</h2>
                    ${this.selectedEvent ? `
                        <p><strong>${this.selectedEvent.name}</strong><br>${this.selectedEvent.date}</p>
                        <form id="upload-form">
                            <label for="media-type">Upload type</label>
                            <select id="media-type">
                                <option value="video">Video</option>
                                <option value="photo">Photo</option>
                                <option value="gpx">GPS GPX</option>
                                <option value="fit">GPS FIT</option>
                            </select>
                            <label for="media-file">Choose file</label>
                            <input id="media-file" type="file" />
                            <button type="submit">Upload to race</button>
                        </form>
                        <div>
                            <h3>Uploaded files</h3>
                            <ul>${uploadRows}</ul>
                        </div>
                        <p>${this.uploadStatus || ''}</p>
                    ` : '<p>Select a race to upload media and see details.</p>'}
                </div>
            </div>
        `;

        this.container.querySelector('#event-form').addEventListener('submit', (evt) => this.createEvent(evt));
        this.container.querySelector('#search-query').addEventListener('input', async (evt) => {
            this.searchQuery = evt.target.value;
            await this.refreshEvents();
            this.render();
        });

        const uploadForm = this.container.querySelector('#upload-form');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (evt) => this.uploadFile(evt));
        }

        this.container.querySelectorAll('[data-event-id]').forEach((button) => {
            button.addEventListener('click', async () => await this.selectEvent(Number(button.dataset.eventId)));
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
