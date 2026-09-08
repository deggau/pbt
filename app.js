class GameRegistry {
    constructor() {
        this.games = JSON.parse(localStorage.getItem('pbtGames')) || [];
        this.groups = JSON.parse(localStorage.getItem('pbtGroups')) || [];
        this.players = JSON.parse(localStorage.getItem('pbtPlayers')) || [];
        this.form = document.getElementById('gameForm');
        this.gamesContainer = document.getElementById('gamesContainer');
        this.groupsList = document.getElementById('groupsList');
        this.currentUserId = this.getCurrentUser();
    }

    getCurrentUser() {
        return localStorage.getItem('pbtCurrentUserId');
    }

    getCurrentUserGroups() {
        if (!this.currentUserId) return [];
        
        const user = this.groups.find(u => u.id === this.currentUserId);
        if (!user) return [];
        
        return this.groups.filter(g => 
            g.user_id === this.currentUserId || 
            (g.players && g.players.some(p => p.user_id === this.currentUserId))
        );
    }

    init() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }
        this.renderGroups();
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

    renderGroups() {
        const userGroups = this.getCurrentUserGroups();
        this.groupsList.innerHTML = userGroups.map(group => `
            <div class="group-item" onclick="selectGroup('${group.id}')">
                <span class="group-name">${group.name}</span>
                <span class="group-count">${group.players ? group.players.length : 0} jogadores</span>
            </div>
        `).join('');
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

function selectGroup(groupId) {
    console.log('Selecionado grupo:', groupId);
    
    const groups = JSON.parse(localStorage.getItem('pbtGroups')) || [];
    const group = groups.find(g => g.id === groupId);
    
    if (group) {
        const activeGroup = document.querySelector('.group-item.active');
        if (activeGroup) activeGroup.classList.remove('active');
        
        const selected = document.querySelector(`[onclick="selectGroup('${groupId}')"]`);
        if (selected) selected.classList.add('active');
    }
}

function showCreateGroupModal() {
    alert('Modal de criar grupo - Implementar interface');
}

window.selectGroup = selectGroup;
window.showCreateGroupModal = showCreateGroupModal;

document.addEventListener('DOMContentLoaded', () => {
    new GameRegistry().init();
});
