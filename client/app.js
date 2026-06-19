/**
 * PostRaceAnalysis client application
 */

class App {
    constructor() {
        this.container = document.getElementById('app');
        this.apiBase = window.REACT_APP_API_BASE || 'http://localhost:5000';
        this.init();
    }

    async init() {
        try {
            const response = await fetch(`${this.apiBase}/api/health`);
            const data = await response.json();
            console.log('Server status:', data);
            this.render();
        } catch (error) {
            console.error('Failed to connect to server:', error);
            this.renderError(error.message);
        }
    }

    render() {
        if (this.container) {
            this.container.innerHTML = '<p>Ready to analyze races</p>';
        }
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
