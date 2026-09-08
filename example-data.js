const exampleData = {
    users: [
        {
            id: 'user-001',
            name: 'João Silva',
            email: 'joao@pbt.com',
            password: '123456'
        },
        {
            id: 'user-002',
            name: 'Maria Santos',
            email: 'maria@pbt.com',
            password: '123456'
        }
    ],
    players: [
        { id: 'player-001', name: 'Carlos Oliveira', email: 'carlos@email.com', phone: '(11) 99999-1111' },
        { id: 'player-002', name: 'Pedro Souza', email: 'pedro@email.com', phone: '(11) 99999-2222' },
        { id: 'player-003', name: 'Lucas Pereira', email: 'lucas@email.com', phone: '(11) 99999-3333' },
        { id: 'player-004', name: 'Ana Costa', email: 'ana@email.com', phone: '(11) 99999-4444' },
        { id: 'player-005', name: 'Juliana Lima', email: 'juliana@email.com', phone: '(11) 99999-5555' },
        { id: 'player-006', name: 'Fernando Almeida', email: 'fernando@email.com', phone: '(11) 99999-6666' },
        { id: 'player-007', name: 'Patricia Rocha', email: 'patricia@email.com', phone: '(11) 99999-7777' },
        { id: 'player-008', name: 'Ricardo Martins', email: 'ricardo@email.com', phone: '(11) 99999-8888' },
        { id: 'player-009', name: 'Mariana Silva', email: 'mariana@email.com', phone: '(11) 99999-9999' },
        { id: 'player-010', name: 'Roberto Dias', email: 'roberto@email.com', phone: '(11) 98888-1111' }
    ],
    groups: [
        {
            id: 'group-001',
            name: 'PBT Futebol Amigo',
            players: ['player-001', 'player-002', 'player-003', 'player-004', 'player-005'],
            admin: 'player-001',
            user_id: 'user-001'
        },
        {
            id: 'group-002',
            name: 'Quinta do PBT',
            players: ['player-001', 'player-006', 'player-007', 'player-008'],
            admin: 'player-001',
            user_id: 'user-001'
        },
        {
            id: 'group-003',
            name: 'Sábado Esportivo',
            players: ['player-001', 'player-009', 'player-010'],
            admin: 'player-001',
            user_id: 'user-001'
        },
        {
            id: 'group-004',
            name: 'Amigos da Esquina',
            players: ['player-002', 'player-003', 'player-004'],
            admin: 'player-002',
            user_id: 'user-002'
        }
    ],
    games: [
        {
            id: 'game-001',
            group_id: 'group-001',
            opponent: 'Time do Jardim',
            date: new Date(2026, 8, 6).toISOString(),
            location: 'Campo do Bairro',
            score: '3x1',
            teams: {
                'time-a': ['player-001', 'player-002', 'player-003'],
                'time-b': ['player-004', 'player-005']
            }
        },
        {
            id: 'game-002',
            group_id: 'group-001',
            opponent: 'Amigos do Parque',
            date: new Date(2026, 8, 13).toISOString(),
            location: 'Parque Ecológico',
            score: '2x2',
            teams: {
                'time-a': ['player-002', 'player-003', 'player-005'],
                'time-b': ['player-001', 'player-004']
            }
        },
        {
            id: 'game-003',
            group_id: 'group-002',
            opponent: 'Sexta Feliz',
            date: new Date(2026, 8, 5).toISOString(),
            location: 'Ginásio Esportivo',
            score: '4x0',
            teams: {
                'time-a': ['player-006', 'player-007'],
                'time-b': ['player-008']
            }
        }
    ]
};

if (!localStorage.getItem('pbtUserData')) {
    localStorage.setItem('pbtUserData', JSON.stringify(exampleData.users));
}

if (!localStorage.getItem('pbtPlayersData')) {
    localStorage.setItem('pbtPlayersData', JSON.stringify(exampleData.players));
}

if (!localStorage.getItem('pbtGroupsData')) {
    localStorage.setItem('pbtGroupsData', JSON.stringify(exampleData.groups));
}

if (!localStorage.getItem('pbtGamesData')) {
    localStorage.setItem('pbtGamesData', JSON.stringify(exampleData.games));
}

console.log('Dados de exemplo carregados:');
console.log('- Usuários:', exampleData.users.length);
console.log('- Jogadores:', exampleData.players.length);
console.log('- Grupos:', exampleData.groups.length);
console.log('- Jogos:', exampleData.games.length);
console.log('');
console.log('Credenciais de login:');
exampleData.users.forEach(user => {
    console.log(`  ${user.email} / ${user.password}`);
});
