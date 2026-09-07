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
        const { data, error } = await supabase.from('games').select('*').order('date', { ascending: false });
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/games', async (req, res) => {
    try {
        const { opponent, date, location, score } = req.body;
        
        const { data, error } = await supabase
            .from('games')
            .insert([{ opponent, date, location, score }])
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
