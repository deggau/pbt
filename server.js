import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL || 'https://tjhflsdpfyjtgjrvbvgn.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

app.get('/', (req, res) => {
    res.json({ 
        message: 'PBT Game Registry API', 
        status: 'online',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/games', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('games')
            .select(`
                *,
                groups:group_id (id, name),
                created_by_users:name
            `)
            .order('date', { ascending: false });
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/games/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('games')
            .select(`
                *,
                groups:group_id (id, name),
                created_by_users:name
            `)
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        const { data: players, error: playersError } = await supabase
            .from('game_players')
            .select(`
                *,
                players:name,
                players:player_id (name)
            `)
            .eq('game_id', id);
        
        if (playersError) throw playersError;
        
        res.json({ success: true, data, players });
    } catch (error) {
        console.error('Error fetching game details:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/games', async (req, res) => {
    try {
        const { group_id, created_by, opponent, date, location, score } = req.body;
        
        const { data, error } = await supabase
            .from('games')
            .insert([{ group_id, created_by, opponent, date, location, score }])
            .select();
        
        if (error) throw error;
        res.status(201).json({ success: true, data: data[0] });
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/games/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const { data, error } = await supabase
            .from('games')
            .update(updates)
            .eq('id', id)
            .select();
        
        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (error) {
        console.error('Error updating game:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/games/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase.from('games').delete().eq('id', id);
        
        if (error) throw error;
        res.json({ success: true, message: 'Game deleted' });
    } catch (error) {
        console.error('Error deleting game:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/game_players', async (req, res) => {
    try {
        const { game_id, player_id, invited_player_name } = req.body;
        
        const { data, error } = await supabase
            .from('game_players')
            .insert([{ game_id, player_id, invited_player_name }])
            .select();
        
        if (error) throw error;
        res.status(201).json({ success: true, data: data[0] });
    } catch (error) {
        console.error('Error adding player to game:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/games/:id/players', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('game_players')
            .select(`
                *,
                players:name,
                players:player_id (name)
            `)
            .eq('game_id', id);
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching game players:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/game_players/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase.from('game_players').delete().eq('id', id);
        
        if (error) throw error;
        res.json({ success: true, message: 'Player removed from game' });
    } catch (error) {
        console.error('Error removing player from game:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/teams', async (req, res) => {
    try {
        const { game_id, name, color } = req.body;
        
        const { data, error } = await supabase
            .from('teams')
            .insert([{ game_id, name, color }])
            .select();
        
        if (error) throw error;
        
        await supabase
            .from('games')
            .update({ teams_count: supabase.raw('teams_count + 1') })
            .eq('id', game_id);
        
        res.status(201).json({ success: true, data: data[0] });
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/games/:id/teams', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('teams')
            .select('*')
            .eq('game_id', id)
            .order('created_at');
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/teams/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const { data, error } = await supabase
            .from('teams')
            .update(updates)
            .eq('id', id)
            .select();
        
        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (error) {
        console.error('Error updating team:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/teams/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase.from('teams').delete().eq('id', id);
        
        if (error) throw error;
        
        const { data, error: teamError } = await supabase
            .from('teams')
            .select('game_id')
            .eq('id', id)
            .single();
        
        if (!teamError && data) {
            await supabase
                .from('games')
                .update({ teams_count: supabase.raw('teams_count - 1') })
                .eq('id', data.game_id);
        }
        
        res.json({ success: true, message: 'Team deleted' });
    } catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/game_players/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('game_players')
            .select(`
                *,
                players:name,
                players:player_id (name),
                teams:name,
                teams:team_id (name, color)
            `)
            .eq('id', id)
            .single();
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching game player:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/game_players/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const { data, error } = await supabase
            .from('game_players')
            .update(updates)
            .eq('id', id)
            .select(`
                *,
                players:name,
                players:player_id (name),
                teams:name,
                teams:team_id (name, color)
            `);
        
        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (error) {
        console.error('Error updating game player:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
