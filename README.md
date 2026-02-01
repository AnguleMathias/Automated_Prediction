# ⚽ Football Betting Assistant

A professional Node.js/TypeScript backend system that provides AI-powered weekend football betting recommendations using statistical analysis, team form, injuries, and market insights.

---

## 📚 Documentation

- **[🚀 Quick Start Guide](QUICKSTART.md)** - Get running in 10 minutes
- **[📖 Complete Setup Guide](SETUP.md)** - Detailed installation instructions
- **[🔌 API Documentation](API.md)** - Complete API reference
- **[📝 Interactive API Docs](http://localhost:3000/api-docs)** - Swagger UI (when server running)
- **[🏗️ Architecture Guide](ARCHITECTURE.md)** - System design & implementation
- **[📝 API Examples](EXAMPLES.md)** - Real-world response examples
- **[📊 Project Summary](PROJECT_SUMMARY.md)** - High-level overview
- **[⚠️ Responsible Gambling](RESPONSIBLE_GAMBLING.md)** - **READ THIS FIRST**

---

## ⚠️ DISCLAIMER

**This system is for informational and educational purposes only.**

- Betting involves risk and you can lose money
- No system can guarantee profits
- Always gamble responsibly and within your means
- Seek help if gambling becomes a problem
- Past performance does not indicate future results
- Only bet what you can afford to lose

**This is not financial advice. Use at your own risk.**

---

## 🎯 Features

### Core Capabilities

- **Live Data Collection**: Pulls real-time data from **Sportmonks Football API** for Premier League fixtures
- **Today's Matches Only**: Focuses on today's scheduled matches for accurate predictions
- **No Mock Data**: 100% real data from official API sources
- **Statistical Analysis**: Multi-factor prediction model weighing:
  - Recent form (30% weight)
  - Home/away performance (25% weight)
  - Head-to-head history (20% weight)
  - Injury impact (15% weight)
  - League motivation (10% weight)
- **Confidence Scoring**: 0-100% confidence score for each prediction
- **Bet Classification**: Categorizes bets as Safe, Value, or Risky
- **Smart Caching**: Redis-powered caching to minimize API calls
- **RESTful API**: Clean, documented API endpoints with Swagger UI

### Bet Categories

- **Safe Bets**: High probability (>75%), low odds (<2.0)
- **Value Bets**: Medium confidence (60-75%), favorable odds
- **Risky Bets**: Lower confidence but high potential returns
- **Avoid**: Matches flagged as too unpredictable

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Express)                     │
│  /api/predictions/weekend  |  /api/matches  |  /health       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │  Ingestion      │  │  Prediction     │  │  Scheduler   ││
│  │  Service        │  │  Engine         │  │  (Cron)      ││
│  └─────────────────┘  └─────────────────┘  └──────────────┘│
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Clients                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │  SofaScore      │  │  Odds API       │  │  Redis       ││
│  │  Client         │  │  Client         │  │  Cache       ││
│  └─────────────────┘  └─────────────────┘  └──────────────┘│
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                Database (PostgreSQL + Prisma)                │
│  Teams | Matches | Predictions | Injuries | Leagues          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
football-betting-assistant/
├── prisma/
│   └── schema.prisma              # Database schema
├── src/
│   ├── api/
│   │   ├── sofascore.client.ts   # SofaScore API integration
│   │   └── odds.client.ts         # Odds API integration
│   ├── config/
│   │   └── index.ts               # Configuration management
│   ├── db/
│   │   └── client.ts              # Prisma client
│   ├── routes/
│   │   └── api.routes.ts          # API endpoints
│   ├── scheduler/
│   │   └── index.ts               # Cron jobs
│   ├── services/
│   │   ├── ingestion.service.ts  # Data fetching & normalization
│   │   └── prediction.service.ts # Prediction algorithm
│   ├── utils/
│   │   ├── cache.ts               # Redis caching
│   │   └── logger.ts              # Logging utility
│   └── index.ts                   # Application entry point
├── .env                           # Environment variables
├── .env.example                   # Environment template
├── .gitignore                     # Git ignore rules
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
└── README.md                      # This file
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 14
- **Redis** (optional, for caching)
- **npm** or **yarn**

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd football-betting-assistant
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:

   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/football_betting"
   REDIS_HOST=localhost
   PORT=3000
   ```

4. **Set up the database**

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

   The server will start at `http://localhost:3000`

   **View interactive API documentation:** http://localhost:3000/api-docs

6. **Build for production**
   ```bash
   npm run build
   npm start
   ```

---

## 📡 API Endpoints

### Interactive Documentation

**Visit:** http://localhost:3000/api-docs

The Swagger UI provides:

- Complete API reference
- Interactive endpoint testing
- Request/response schemas
- Example payloads
- Try-it-out functionality

### Base URL

```
http://localhost:3000/api
```

### 1. Get Weekend Predictions

**GET** `/predictions/weekend`

Returns all betting predictions for the upcoming weekend.

**Query Parameters:**

- `minConfidence` (optional): Minimum confidence score (0-100), default 60
- `category` (optional): Filter by category (`SAFE_BET`, `VALUE_BET`, `RISKY_BET`)

**Example Request:**

```bash
curl http://localhost:3000/api/predictions/weekend?minConfidence=70&category=VALUE_BET
```

**Example Response:**

```json
{
  "success": true,
  "count": 12,
  "data": [
    {
      "id": 1,
      "match": {
        "id": 123,
        "homeTeam": "Manchester City",
        "awayTeam": "Chelsea",
        "league": "Premier League",
        "startTime": "2026-02-07T15:00:00Z",
        "odds": {
          "home": 1.65,
          "draw": 3.8,
          "away": 5.2
        }
      },
      "recommendation": {
        "team": "Manchester City",
        "betType": "HOME_WIN",
        "confidenceScore": 78.5,
        "category": "SAFE_BET"
      },
      "analysis": {
        "formScore": 82.3,
        "homeAwayScore": 75.8,
        "h2hScore": 68.5,
        "injuryImpact": 65.2,
        "leagueMotivation": 90.0,
        "oddsValue": 12.5
      },
      "reasoning": "Manchester City has superior recent form. Strong home advantage for Manchester City. Favorable head-to-head record.",
      "keyFactors": ["Excellent Form", "Home Advantage", "H2H Dominance"],
      "generatedAt": "2026-02-05T09:00:00Z"
    }
  ],
  "disclaimer": "This is for informational purposes only. Always gamble responsibly..."
}
```

### 2. Get Specific Match Prediction

**GET** `/predictions/:matchId`

Get detailed prediction analysis for a specific match.

**Example Request:**

```bash
curl http://localhost:3000/api/predictions/123
```

### 3. Get Upcoming Matches

**GET** `/matches/upcoming`

Returns all upcoming scheduled matches.

**Example Request:**

```bash
curl http://localhost:3000/api/matches/upcoming
```

### 4. Refresh Data

**POST** `/data/refresh`

Manually trigger data refresh and prediction generation.

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/data/refresh
```

### 5. Get Statistics Summary

**GET** `/stats/summary`

Get summary statistics about predictions.

**Example Request:**

```bash
curl http://localhost:3000/api/stats/summary
```

### 6. Health Check

**GET** `/health`

Check if the API is running.

**Example Request:**

```bash
curl http://localhost:3000/health
```

---

## ⚙️ Configuration

### Environment Variables

| Variable                   | Description                   | Default                    |
| -------------------------- | ----------------------------- | -------------------------- |
| `NODE_ENV`                 | Environment                   | `development`              |
| `PORT`                     | Server port                   | `3000`                     |
| `DATABASE_URL`             | PostgreSQL connection string  | Required                   |
| `REDIS_HOST`               | Redis hostname                | `localhost`                |
| `REDIS_PORT`               | Redis port                    | `6379`                     |
| `DATA_FETCH_CRON`          | Cron schedule for data fetch  | `0 9 * * 5` (Fridays 9 AM) |
| `MIN_CONFIDENCE_THRESHOLD` | Minimum prediction confidence | `60`                       |
| `FORM_WEIGHT`              | Weight for form analysis      | `0.30`                     |
| `HOME_AWAY_WEIGHT`         | Weight for home/away stats    | `0.25`                     |
| `HEAD_TO_HEAD_WEIGHT`      | Weight for H2H history        | `0.20`                     |
| `INJURY_WEIGHT`            | Weight for injury impact      | `0.15`                     |
| `LEAGUE_POSITION_WEIGHT`   | Weight for league position    | `0.10`                     |

### Cron Jobs

The system runs three automated jobs:

1. **Main Data Fetch** (Friday 9 AM)
   - Fetches upcoming weekend matches
   - Updates team statistics
   - Generates predictions

2. **Daily Injury Update** (Every day 8 AM)
   - Updates injury lists for all teams

3. **Odds Refresh** (Every 6 hours on Fri/Sat/Sun)
   - Refreshes betting odds during the weekend

---

## 🧠 Prediction Algorithm

### Scoring Components

The prediction engine analyzes each match using multiple factors:

#### 1. Form Score (30% weight)

- Analyzes last 5-10 matches
- Considers wins, draws, losses
- Weights recent games more heavily

#### 2. Home/Away Score (25% weight)

- Home team win rate at home
- Away team performance on the road
- Historical venue advantage

#### 3. Head-to-Head Score (20% weight)

- Previous encounters between teams
- Goal difference in past meetings
- Recent H2H trends

#### 4. Injury Impact (15% weight)

- Number and severity of injuries
- Player importance (position-based)
- Expected return dates

#### 5. League Motivation (10% weight)

- Title race implications
- European qualification chances
- Relegation battle urgency

### Confidence Calculation

```typescript
confidenceScore =
  (formScore × 0.30) +
  (homeAwayScore × 0.25) +
  (h2hScore × 0.20) +
  (injuryImpact × 0.15) +
  (leagueMotivation × 0.10)
```

### Bet Category Logic

- **SAFE_BET**: Confidence ≥ 75%, Odds ≤ 2.0
- **VALUE_BET**: Confidence 60-75%, Positive expected value
- **RISKY_BET**: Confidence 60-70%, Odds > 3.0
- **AVOID**: Confidence < 60%

---

## 🛠️ Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Database Management

```bash
# Generate Prisma Client
npm run prisma:generate

# Create migration
npm run prisma:migrate

# Open Prisma Studio (GUI)
npm run prisma:studio
```

### Debug Mode

Set `LOG_LEVEL=debug` in `.env` for detailed logging.

---

## 📊 Database Schema

### Main Tables

- **League**: Football leagues and competitions
- **Team**: Team information and statistics
- **Match**: Match fixtures and results
- **Injury**: Player injuries and suspensions
- **Prediction**: Generated betting predictions
- **WeekendSnapshot**: Historical prediction performance

See [prisma/schema.prisma](prisma/schema.prisma) for full schema.

---

## 🔌 External APIs

### SofaScore API

**Note**: This uses unofficial/public endpoints. SofaScore may block excessive requests.

- Fixtures and schedules
- Team standings
- Team form and statistics
- Head-to-head data
- Injuries and suspensions

**Rate Limiting**: 2 seconds between requests (configurable)

### Odds API (Optional)

The system supports integration with odds APIs like:

- The Odds API
- OddsPortal
- BetExplorer

Configure `ODDS_API_KEY` in `.env` to enable.

---

## 📈 Performance & Optimization

### Caching Strategy

- **Match data**: 30 minutes cache
- **Team stats**: 1 hour cache
- **H2H data**: 2 hours cache
- **Injuries**: 1 hour cache

### Rate Limiting

API endpoints are rate-limited to prevent abuse:

- 100 requests per 15 minutes per IP

### Database Optimization

- Indexed fields for fast queries
- Composite indexes on frequently queried combinations
- Efficient date range queries

---

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U user -d football_betting
```

### Redis Not Available

The system works without Redis but caching will be disabled. Check logs for warnings.

### API Rate Limits

If you hit SofaScore rate limits, increase `SOFASCORE_RATE_LIMIT_DELAY` in `.env`.

### TypeScript Errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Regenerate Prisma Client
npm run prisma:generate
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure code passes linting
5. Submit a pull request

---

## 📜 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- Data sourced from SofaScore
- Inspired by statistical football analysis methodologies
- Built with modern TypeScript and Node.js best practices

---

## 📞 Support

For issues, questions, or feature requests:

- Open an issue on GitHub
- Check existing issues for solutions
- Refer to the troubleshooting section

---

## 🔮 Future Enhancements

Potential features for future versions:

- [ ] Machine learning models (TensorFlow.js)
- [ ] Live match odds tracking
- [ ] Telegram/Discord bot integration
- [ ] Historical prediction accuracy tracking
- [ ] Multi-league support expansion
- [ ] Advanced metrics (xG, xA, pressing stats)
- [ ] User accounts and favorites
- [ ] Betting bank management features
- [ ] Mobile app companion

---

**Remember: Bet responsibly. This is a tool, not a guarantee.**
