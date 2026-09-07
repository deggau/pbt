-- Create players table
CREATE TABLE players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    create_at TIMESTAMPTZ DEFAULT NOW(),
    update_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create groups table
CREATE TABLE groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    create_at TIMESTAMPTZ DEFAULT NOW(),
    update_at TIMESTAMPTZ DEFAULT NOW(),
    player_id UUID REFERENCES players(id) NOT NULL
);

-- Create group_players table
CREATE TABLE group_players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES groups(id) NOT NULL,
    player_id UUID REFERENCES players(id) NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    create_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_groups_player_id ON groups(player_id);
CREATE INDEX idx_group_players_group_id ON group_players(group_id);
CREATE INDEX idx_group_players_player_id ON group_players(player_id);

-- Create users table
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create games table
CREATE TABLE games (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES groups(id) NOT NULL,
    created_by UUID REFERENCES users(id) NOT NULL,
    opponent VARCHAR(255) NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    location VARCHAR(255) NOT NULL,
    score VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create game_players table
CREATE TABLE game_players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id UUID REFERENCES games(id) NOT NULL,
    player_id UUID REFERENCES players(id),
    invited_player_name VARCHAR(255),
    goals INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for new tables
CREATE INDEX idx_games_group_id ON games(group_id);
CREATE INDEX idx_games_created_by ON games(created_by);
CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_game_players_player_id ON game_players(player_id);
