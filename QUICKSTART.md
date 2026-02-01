# ⚡ Quick Start Guide

Get the Football Betting Assistant running in under 10 minutes!

---

## Prerequisites Check

Before starting, ensure you have:

- ✅ Node.js v18+ installed
- ✅ PostgreSQL installed and running
- ✅ 10 minutes of time

---

## 1. Install Node.js (if needed)

```bash
# Check if installed
node --version

# If not installed, download from:
# https://nodejs.org/
```

---

## 2. Install PostgreSQL (if needed)

### macOS

```bash
brew install postgresql@14
brew services start postgresql@14
```

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Windows

Download from: https://www.postgresql.org/download/windows/

---

## 3. Clone & Install

```bash
# Clone repository
git clone <repo-url> football-betting-assistant
cd football-betting-assistant

# Install dependencies
npm install
```

---

## 4. Configure Database

```bash
# Create database
createdb football_betting

# Or using psql:
psql postgres -c "CREATE DATABASE football_betting;"
```

---

## 5. Setup Environment

```bash
# Copy environment file
cp .env.example .env

# Edit .env and set your DATABASE_URL
# For example:
# DATABASE_URL="postgresql://youruser:yourpassword@localhost:5432/football_betting"
```

**Minimal .env file:**

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://localhost:5432/football_betting"
```

---

## 6. Initialize Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

When prompted for migration name, enter: `init`

---

## 7. Start the Server

```bash
npm run dev
```

You should see:

```
╔═══════════════════════════════════════════╗
║   ⚽ Football Betting Assistant API       ║
║   Server running on: http://localhost:3000║
╚═══════════════════════════════════════════╝
```

---

## 8. Test the API

### View Interactive API Documentation

Open your browser and visit:

```
http://localhost:3000/api-docs
```

This opens **Swagger UI** - an interactive API documentation where you can:

- Browse all available endpoints
- View request/response schemas
- Test API calls directly from your browser
- See example responses

### Health Check

```bash
curl http://localhost:3000/health
```

Expected:

```json
{
  "status": "healthy",
  "timestamp": "...",
  "uptime": 10
}
```

### Fetch Data

```bash
curl -X POST http://localhost:3000/api/data/refresh
```

Wait 1-2 minutes for data fetching to complete.

### Get Predictions

```bash
curl http://localhost:3000/api/predictions/weekend
```

---

## 9. View Database (Optional)

```bash
npm run prisma:studio
```

Opens Prisma Studio at http://localhost:5555

---

## 🎉 You're Done!

The system is now running and ready to use!

---

## Next Steps

### 1. Explore the API

**Visit the interactive documentation:** http://localhost:3000/api-docs

Or try these endpoints:

```bash
# Get all predictions
curl http://localhost:3000/api/predictions/weekend

# Get high-confidence predictions
curl "http://localhost:3000/api/predictions/weekend?minConfidence=75"

# Get safe bets only
curl "http://localhost:3000/api/predictions/weekend?category=SAFE_BET"

# Get upcoming matches
curl http://localhost:3000/api/matches/upcoming

# Get statistics
curl http://localhost:3000/api/stats/summary
```

### 2. Read the Documentation

- [README.md](README.md) - Full documentation
- [API.md](API.md) - API reference
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [EXAMPLES.md](EXAMPLES.md) - Example responses

### 3. Customize Configuration

Edit `.env` to adjust:

- Prediction weights
- Confidence thresholds
- Cron schedules
- API rate limits

### 4. Set Up Automation

The system automatically fetches data every Friday at 9 AM by default.

To change the schedule, edit `DATA_FETCH_CRON` in `.env`:

```env
# Run every day at 8 AM
DATA_FETCH_CRON=0 8 * * *

# Run every Friday at 9 AM (default)
DATA_FETCH_CRON=0 9 * * 5

# Run every 6 hours
DATA_FETCH_CRON=0 */6 * * *
```

---

## Common Issues

### "Port 3000 already in use"

Change the port in `.env`:

```env
PORT=3001
```

### "Cannot connect to database"

1. Check PostgreSQL is running:

   ```bash
   pg_isready
   ```

2. Verify DATABASE_URL in `.env`

3. Test connection:
   ```bash
   psql -d football_betting
   ```

### "Module not found"

Reinstall dependencies:

```bash
rm -rf node_modules package-lock.json
npm install
```

### "Prisma Client not generated"

```bash
npm run prisma:generate
```

---

## Development Workflow

### Making Changes

1. Edit code in `src/`
2. Server auto-reloads (tsx watch)
3. Test your changes
4. Commit and push

### Viewing Logs

Server logs appear in the terminal where you ran `npm run dev`.

Set `LOG_LEVEL=debug` in `.env` for detailed logs.

### Stopping the Server

Press `Ctrl+C` in the terminal.

---

## Production Deployment

For production use:

```bash
# Build
npm run build

# Start production server
npm start
```

Or use PM2:

```bash
npm install -g pm2
pm2 start dist/index.js --name football-assistant
```

---

## Getting Help

- Check [SETUP.md](SETUP.md) for detailed setup instructions
- Review [README.md](README.md) for full documentation
- Look for error messages in the console
- Verify all prerequisites are installed

---

## Important Reminders

⚠️ **Before betting:**

- Read [RESPONSIBLE_GAMBLING.md](RESPONSIBLE_GAMBLING.md)
- Understand the risks
- Only bet what you can afford to lose
- Use predictions as guidance, not guarantees

---

## Commands Cheat Sheet

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Start production server

# Database
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open database GUI

# Maintenance
npm install              # Install dependencies
npm run lint             # Run linter
npm test                 # Run tests (if configured)
```

---

## API Endpoints Quick Reference

**Interactive Documentation:** http://localhost:3000/api-docs

```bash
GET  /health                      # Health check
GET  /api-docs                    # Swagger UI (interactive)
GET  /api-docs.json               # OpenAPI specification
GET  /api/predictions/weekend     # Get predictions
GET  /api/predictions/:matchId    # Get match details
GET  /api/matches/upcoming        # Get upcoming matches
POST /api/data/refresh            # Manual data refresh
GET  /api/stats/summary           # Get statistics
```

---

## Configuration Quick Reference

**Key .env variables:**

```env
PORT=3000                          # Server port
DATABASE_URL="postgresql://..."   # Database connection
MIN_CONFIDENCE_THRESHOLD=60       # Minimum prediction confidence
FORM_WEIGHT=0.30                  # Form importance (30%)
HOME_AWAY_WEIGHT=0.25             # Home/away importance (25%)
DATA_FETCH_CRON=0 9 * * 5         # Auto-fetch schedule
LOG_LEVEL=info                    # Logging level
```

---

**You're all set! Start making data-driven football predictions! ⚽📊**

For questions or issues, check the full documentation or create an issue on GitHub.
