-- Task 04: Add teams and players functionality
-- Migration: Add teams table and update related tables

-- Add teams_count column to games table
ALTER TABLE games ADD COLUMN teams_count INTEGER DEFAULT 2;
ALTER TABLE games ADD CONSTRAINT teams_count_min CHECK (teams_count >= 2);

-- Create teams table
CREATE TABLE teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id UUID REFERENCES games(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add team_id column to game_players table
ALTER TABLE game_players ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE game_players ALTER COLUMN player_id DROP NOT NULL;

-- Create indexes
CREATE INDEX idx_teams_game_id ON teams(game_id);
CREATE INDEX idx_game_players_team_id ON game_players(team_id);
