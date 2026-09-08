class GameRegistry {
    constructor() {
        this.games = JSON.parse(localStorage.getItem('pbtGames')) || [];
        this.groups = JSON.parse(localStorage.getItem('pbtGroups')) || [];
        this.players = JSON.parse(localStorage.getItem('pbtPlayers')) || [];
        this.form = document.getElementById('gameForm');
        this.gamesContainer = document.getElementById('gamesContainer');
        this.groupsList = document.getElementById('groupsList');
        this.currentUserId = this.getCurrentUser();
        this.currentGroupId = null;
        this.API_URL = 'http://localhost:3000';
    }

    getCurrentUser() {
        return localStorage.getItem('pbtCurrentUserId');
    }

    async fetchGroups() {
        try {
            const response = await fetch(`${this.API_URL}/api/groups`);
            const data = await response.json();
            if (data.success) {
                this.groups = data.data;
                localStorage.setItem('pbtGroups', JSON.stringify(this.groups));
                this.renderGroups();
            }
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
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
        
        this.setupEventListeners();
        this.fetchGroups();
    }

    setupEventListeners() {
        const groupForm = document.getElementById('groupForm');
        if (groupForm) {
            groupForm.addEventListener('submit', (e) => this.handleCreateGroup(e));
        }
        
        const addPlayerForm = document.getElementById('addPlayerForm');
        if (addPlayerForm) {
            addPlayerForm.addEventListener('submit', (e) => this.handleAddPlayer(e));
        }
        
        const createGroupBtn = document.getElementById('createGroupBtn');
        if (createGroupBtn) {
            createGroupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showCreateGroupModal();
            });
        }
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

    async handleCreateGroup(e) {
        e.preventDefault();
        
        const name = document.getElementById('groupName').value.trim();
        const userId = this.getCurrentUser();
        
        if (!name || !userId) {
            alert('Por favor, preencha o nome do grupo e faça login.');
            return;
        }
        
        try {
            const response = await fetch(`${this.API_URL}/api/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, user_id: userId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.groups.push(data.data);
                localStorage.setItem('pbtGroups', JSON.stringify(this.groups));
                this.renderGroups();
                this.closeCreateGroupModal();
                alert('Grupo criado com sucesso!');
            } else {
                alert(`Erro: ${data.error}`);
            }
        } catch (error) {
            console.error('Error creating group:', error);
            alert('Erro ao criar grupo. Verifique sua conexão.');
        }
    }

    showCreateGroupModal() {
        document.getElementById('createGroupModal').classList.remove('hidden');
        document.getElementById('modalOverlay').classList.remove('hidden');
        document.getElementById('groupName').value = '';
        document.getElementById('groupName').focus();
    }

    closeCreateGroupModal() {
        document.getElementById('createGroupModal').classList.add('hidden');
        document.getElementById('modalOverlay').classList.add('hidden');
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

    showManageGroupModal(groupId) {
        this.currentGroupId = groupId;
        const group = this.groups.find(g => g.id === groupId);
        
        if (group) {
            document.getElementById('manageGroupTitle').innerText = `Gerenciar: ${group.name}`;
            document.getElementById('groupIdDisplay').innerText = groupId;
            document.getElementById('groupNameDisplay').innerText = group.name;
            
            this.fetchGroupPlayers(groupId);
            
            document.getElementById('manageGroupModal').classList.remove('hidden');
            document.getElementById('modalOverlay').classList.remove('hidden');
        }
    }

    closeManageGroupModal() {
        document.getElementById('manageGroupModal').classList.add('hidden');
        document.getElementById('modalOverlay').classList.add('hidden');
        this.currentGroupId = null;
    }

    async fetchGroupPlayers(groupId) {
        try {
            const response = await fetch(`${this.API_URL}/api/groups/${groupId}`);
            const data = await response.json();
            
            if (data.success && data.data.group_players) {
                document.getElementById('groupPlayers').innerHTML = data.data.group_players.map(player => `
                    <div class="player-item">
                        <div class="player-info">
                            <div class="player-name">${player.players ? player.players.name : 'Jogador'}</div>
                            <div class="player-contact">
                                ${player.players ? player.players.email : ''} | 
                                ${player.players ? player.players.phone : ''}
                            </div>
                        </div>
                        <button class="remove-player-btn" onclick="removePlayerFromGroup('${groupId}', '${player.player_id}')">
                            Remover
                        </button>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error fetching group players:', error);
        }
    }

    showAddPlayerModal() {
        document.getElementById('addPlayerModal').classList.remove('hidden');
        document.getElementById('modalOverlay').classList.remove('hidden');
        document.getElementById('playerName').value = '';
        document.getElementById('playerEmail').value = '';
        document.getElementById('playerPhone').value = '';
        document.getElementById('playerName').focus();
    }

    closeAddPlayerModal() {
        document.getElementById('addPlayerModal').classList.add('hidden');
        document.getElementById('modalOverlay').classList.add('hidden');
    }

    async handleAddPlayer(e) {
        e.preventDefault();
        
        if (!this.currentGroupId) {
            alert('Erro: Nenhum grupo selecionado.');
            return;
        }

        const name = document.getElementById('playerName').value.trim();
        const email = document.getElementById('playerEmail').value.trim();
        const phone = document.getElementById('playerPhone').value.trim();

        if (!name || !email || !phone) {
            alert('Por favor, preencha todos os campos.');
            return;
        }

        try {
            const response = await fetch(`${this.API_URL}/api/players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone })
            });

            const playerData = await response.json();

            if (playerData.success) {
                const player = playerData.data;

                const groupResponse = await fetch(`${this.API_URL}/api/groups/${this.currentGroupId}/add-player`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ player_id: player.id })
                });

                const groupData = await groupResponse.json();

                if (groupData.success) {
                    this.fetchGroups();
                    this.closeAddPlayerModal();
                    alert('Jogador adicionado com sucesso!');
                } else {
                    alert(`Erro ao adicionar ao grupo: ${groupData.error}`);
                }
            } else {
                alert(`Erro ao criar jogador: ${playerData.error}`);
            }
        } catch (error) {
            console.error('Error adding player:', error);
            alert('Erro ao adicionar jogador. Verifique sua conexão.');
        }
    }

    async shareGroupLink() {
        try {
            const response = await fetch(`${this.API_URL}/api/groups/${this.currentGroupId}/share`);
            const data = await response.json();

            if (data.success) {
                navigator.clipboard.writeText(data.shareUrl).then(() => {
                    alert(`Link copiado: ${data.shareUrl}\n\nEnvie este link para convidar jogadores.`);
                }).catch(() => {
                    alert(`Copie este link para convidar jogadores:\n\n${data.shareUrl}`);
                });
            } else {
                alert(`Erro: ${data.error}`);
            }
        } catch (error) {
            console.error('Error sharing group link:', error);
            alert('Erro ao gerar link de convite.');
        }
    }

    async removePlayerFromGroup(groupId, playerId) {
        try {
            const response = await fetch(`${this.API_URL}/api/groups/${groupId}/remove-player/${playerId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                this.fetchGroupPlayers(groupId);
                alert('Jogador removido com sucesso!');
            } else {
                alert(`Erro: ${data.error}`);
            }
        } catch (error) {
            console.error('Error removing player:', error);
            alert('Erro ao remover jogador.');
        }
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
        
        window.showManageGroupModal(groupId);
    }
}

function showCreateGroupModal() {
    if (window.gameRegistry) {
        window.gameRegistry.showCreateGroupModal();
    }
}

function closeCreateGroupModal() {
    if (window.gameRegistry) {
        window.gameRegistry.closeCreateGroupModal();
    }
}

function showManageGroupModal(groupId) {
    if (window.gameRegistry) {
        window.gameRegistry.showManageGroupModal(groupId);
    }
}

function closeManageGroupModal() {
    if (window.gameRegistry) {
        window.gameRegistry.closeManageGroupModal();
    }
}

function showAddPlayerModal() {
    if (window.gameRegistry) {
        window.gameRegistry.showAddPlayerModal();
    }
}

function closeAddPlayerModal() {
    if (window.gameRegistry) {
        window.gameRegistry.closeAddPlayerModal();
    }
}

function handleAddPlayer(e) {
    e.preventDefault();
    if (window.gameRegistry && window.gameRegistry.currentGroupId) {
        window.gameRegistry.handleAddPlayer(e);
    }
}

function shareGroupLink() {
    if (window.gameRegistry && window.gameRegistry.currentGroupId) {
        window.gameRegistry.shareGroupLink();
    }
}

window.selectGroup = selectGroup;
window.showCreateGroupModal = showCreateGroupModal;
window.closeCreateGroupModal = closeCreateGroupModal;
window.showManageGroupModal = showManageGroupModal;
window.closeManageGroupModal = closeManageGroupModal;
window.showAddPlayerModal = showAddPlayerModal;
window.closeAddPlayerModal = closeAddPlayerModal;
window.shareGroupLink = shareGroupLink;
window.handleAddPlayer = handleAddPlayer;

window.gameRegistry = new GameRegistry();

function removePlayerFromGroup(groupId, playerId) {
    if (window.gameRegistry) {
        window.gameRegistry.removePlayerFromGroup(groupId, playerId);
    }
}

window.removePlayerFromGroup = removePlayerFromGroup;

function handleAddPlayer(e) {
    e.preventDefault();
    if (window.gameRegistry && window.gameRegistry.currentGroupId) {
        window.gameRegistry.handleAddPlayer(e);
    }
}

function shareGroupLink() {
    if (window.gameRegistry && window.gameRegistry.currentGroupId) {
        window.gameRegistry.shareGroupLink();
    }
}
