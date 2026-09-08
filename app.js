class GameRegistry {
    constructor() {
        this.games = JSON.parse(localStorage.getItem('pbtGames')) || [];
        this.form = document.getElementById('gameForm');
        this.gamesContainer = document.getElementById('gamesContainer');
    }

    init() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }
        this.renderGames();
    }

    handleFormSubmit(e) {
        e.preventDefault();
        
        const opponent = document.getElementById('opponent').value;
        const date = document.getElementById('date').value;
        const location = document.getElementById('location').value;
        const score = document.getElementById('score').value;

        const game = {
            id: Date.now(),
            opponent,
            date,
            location,
            score
        };

        this.games.unshift(game);
        this.saveGames();
        this.renderGames();
        this.form.reset();
    }

    saveGames() {
        localStorage.setItem('pbtGames', JSON.stringify(this.games));
    }

    renderGames() {
        this.gamesContainer.innerHTML = this.games.map(game => `
            <div class="game-card">
                <h3>${game.opponent}</h3>
                <p><strong>Data:</strong> ${this.formatDate(game.date)}</p>
                <p><strong>Local:</strong> ${game.location}</p>
                ${game.score ? `<p><strong>Placar:</strong> ${game.score}</p>` : ''}
            </div>
        `).join('');
    }

    formatDate(dateString) {
        const options = { day: '2-digit', month: 'long', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('pt-BR', options);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GameRegistry();
});
