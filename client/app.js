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
        this.statusMessage = '';
        this.uploadStatus = '';
        this.init();
    }

    async init() {
        await this.refreshEvents();
        this.render();
    }

    async refreshEvents() {
        const url = `${this.apiBase}/api/events`;
        try {
            const response = await fetch(url);
            this.events = await response.json();
            this.events.sort((a, b) => b.date.localeCompare(a.date));
        } catch (error) {
            console.error('Could not load events', error);
            this.statusMessage = `Unable to load races at this time. (${error.message})`;
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
            this.statusMessage = `Created race "${created.name}".`;
            this.selectedEvent = created;
            await this.refreshEvents();
            await this.fetchUploads(created.id);
            this.render();
        } catch (error) {
            console.error('Create event failed', error);
            this.statusMessage = `Could not create race: ${error.message}`;
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
            this.uploadStatus = `Upload failed: ${error.message}`;
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

        const eventOptions = this.events
            .map((item) => {
                const isSelected = this.selectedEvent && this.selectedEvent.id === item.id;
                return `<option value="${item.id}" ${isSelected ? 'selected' : ''}>${item.date} — ${item.name}</option>`;
            })
            .join('') || '<option value="">No races found</option>';

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
                    <h2>Select race</h2>
                    <label for="event-select">Choose a race</label>
                    <select id="event-select">
                        <option value="">Select a race</option>
                        ${eventOptions}
                    </select>
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

        const eventSelect = this.container.querySelector('#event-select');
        if (eventSelect) {
            eventSelect.addEventListener('change', async (evt) => {
                const eventId = Number(evt.target.value);
                if (eventId) {
                    await this.selectEvent(eventId);
                }
            });
        }

        const uploadForm = this.container.querySelector('#upload-form');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (evt) => this.uploadFile(evt));
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
