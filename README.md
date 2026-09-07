# PBT Game Registry - Backend

## Environment Setup

1. Copy `.env.example` to `.env`
2. Update the database credentials in `.env`
3. Run `npm install`
4. Start the server with `npm start`

## API Endpoints

- `GET /` - Health check
- `GET /api/games` - Get all games
- `POST /api/games` - Create a new game
- `PUT /api/games/:id` - Update a game
- `DELETE /api/games/:id` - Delete a game

## Database Tables

Run the SQL scripts from the `database/` folder to create the required tables.
