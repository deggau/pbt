const API_URL = 'http://localhost:3000';

async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        alert('Por favor, preencha todos os campos.');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('authContainer').classList.add('hidden');
            document.getElementById('appContainer').classList.remove('hidden');
            document.body.classList.remove('auth-mode');
            document.getElementById('pageTitle').innerText = `Bem-vindo, ${data.user.name}!`;
            
            localStorage.setItem('pbtCurrentUserId', data.user.id);
            
            setTimeout(() => {
                new GameRegistry();
            }, 100);
        } else {
            alert(`Erro: ${data.error}`);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Erro ao fazer login. Verifique sua conexão.');
    }
}

function showCreateGroupModal() {
    if (window.gameRegistry) {
        window.gameRegistry.showCreateGroupModal();
    }
}

window.handleLogin = handleLogin;
window.showCreateGroupModal = showCreateGroupModal;
