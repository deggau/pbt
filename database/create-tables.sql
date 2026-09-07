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
