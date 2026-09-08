function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        alert('Por favor, preencha todos os campos.');
        return;
    }
    
    const users = JSON.parse(localStorage.getItem('pbtUserData') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        document.getElementById('authContainer').classList.add('hidden');
        document.getElementById('appContainer').classList.remove('hidden');
        document.body.classList.remove('auth-mode');
        document.getElementById('pageTitle').innerText = `Bem-vindo, ${user.name}!`;
        
        setTimeout(() => {
            new GameRegistry();
        }, 100);
    } else {
        alert('E-mail ou senha incorretos.');
    }
}

function showCreateGroupModal() {
    alert('Modal de criar grupo não implementado ainda.');
}
