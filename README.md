# PBT Game Registry - Backend

## Environment Setup

1. Copy `.env.example` to `.env`
2. Update the database credentials in `.env`
3. Run `npm install`
4. Start the server with `npm start`

## Git Setup

Git is configured in the project to use the SourceTree Git installation:

```
%LocalAppData%\Atlassian\SourceTree\git_local\bin\git.exe
```

To add this to your system PATH for command-line access, run:

```
[Environment]::SetEnvironmentVariable("Path", "$env:Path;%LocalAppData%\Atlassian\SourceTree\git_local\bin", "User")
```

Or manually add `%LocalAppData%\Atlassian\SourceTree\git_local\bin` to your user PATH environment variable.

## Task Management

After completing a task, move the task file from `tasks/` to `tasks/completed/` folder with a descriptive commit message.

## API Endpoints

- `GET /` - Health check
- `GET /api/groups` - Get all groups
- `POST /api/groups` - Create a new group
- `GET /api/groups/:id` - Get group details with players
- `POST /api/groups/:id/add-player` - Add player to group
- `DELETE /api/groups/:id/remove-player/:playerId` - Remove player from group
- `POST /api/groups/:id/share` - Get shareable link for group
- `POST /api/players` - Create a new player
- `GET /api/players/:id` - Get player details
- `GET /api/players` - Get all players

## Database Tables

Run the SQL scripts from the `database/` folder to create the required tables.
