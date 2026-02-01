# Sportmonks API Integration

The Football Betting Assistant now uses **Sportmonks Football API** for fetching live Premier League match data.

## Setup

### 1. Get API Key

1. Visit [Sportmonks.com](https://www.sportmonks.com/)
2. Sign up for an account
3. Choose a plan (they offer free trials)
4. Get your API key from the dashboard

### 2. Configure .env

Add your Sportmonks API key to the `.env` file:

```env
SPORTMONKS_API_KEY=your_api_key_here
```

## Features

### Live Data for Today

The system automatically fetches:

- ✅ **Today's Premier League matches only**
- ✅ **Live match updates** (scheduled, in-play, finished)
- ✅ **Team statistics** from actual fixtures
- ✅ **Head-to-head records**
- ✅ **League standings**
- ✅ **Team form** (last 10 matches)

### No Mock Data

All dummy/mock data has been removed. The system now relies entirely on real data from Sportmonks API.

## API Endpoints Used

### Fixtures

```
GET /football/fixtures
- Filters: fixtureLeagues:8 (Premier League)
- date: today
- Includes: participants, league, state
```

### Standings

```
GET /football/standings/seasons/{seasonId}
- Filters: standingLeagues:8
- Includes: participant, details.type
```

### Team Form

```
GET /football/fixtures
- Filters: fixtureParticipants:{teamId}
- per_page: 10
- order: starting_at:desc
```

### Head-to-Head

```
GET /football/fixtures/head-to-head/{homeTeamId}/{awayTeamId}
- Includes: participants, state
```

## Usage

### Fetch Today's Matches

```bash
curl -X POST http://localhost:3000/api/data/refresh
```

This will:

1. Fetch all Premier League matches scheduled for today
2. Store teams and leagues in the database
3. Fetch team statistics and form
4. Generate predictions based on real data

### View Matches

```bash
curl http://localhost:3000/api/matches/upcoming
```

### Get Predictions

```bash
curl http://localhost:3000/api/predictions/weekend
```

## Rate Limiting

- Default: 2000ms delay between requests
- Configurable via `SPORTMONKS_RATE_LIMIT_DELAY` in `.env`
- Sportmonks has plan-specific rate limits

## Caching

All API responses are cached using Redis:

- Fixtures: 30 minutes
- Standings: 1 hour
- Team details: 2 hours
- Head-to-head: 2 hours
- Current season: 24 hours

## Error Handling

The system handles:

- ❌ Missing API key
- ❌ Invalid API key (401)
- ❌ Rate limit exceeded (429)
- ❌ Network errors
- ✅ Graceful fallbacks

## Premier League ID

- **League ID: 8** (Sportmonks identifier for English Premier League)

## Data Structure

### Match Status Mapping

| Sportmonks           | Internal  |
| -------------------- | --------- |
| notstarted, ns       | SCHEDULED |
| inplay, live, ht     | LIVE      |
| finished, ft         | FINISHED  |
| postponed, cancelled | POSTPONED |

### Participants

Sportmonks uses a `participants` array with `meta.location`:

- `location: "home"` = Home team
- `location: "away"` = Away team

## Troubleshooting

### No matches found

```bash
# Check if there are Premier League matches today
# The API only fetches matches for the current date
```

### API key errors

```bash
# Verify your API key in .env
cat .env | grep SPORTMONKS_API_KEY

# Test API key manually
curl -H "Authorization: YOUR_KEY" https://api.sportmonks.com/v3/football/fixtures
```

### Rate limit

```bash
# Increase delay in .env
SPORTMONKS_RATE_LIMIT_DELAY=3000
```

## Benefits Over SofaScore

✅ Official API with documentation  
✅ Stable endpoints  
✅ Better data reliability  
✅ Commercial support  
✅ More comprehensive data  
✅ Better rate limiting control

## Cost

- Free trial available
- Paid plans start from ~$15/month
- Different tiers based on features and rate limits

## Resources

- [Sportmonks Documentation](https://docs.sportmonks.com/)
- [API Explorer](https://docs.sportmonks.com/football/endpoints-and-entities/endpoints)
- [Support](https://www.sportmonks.com/support)
