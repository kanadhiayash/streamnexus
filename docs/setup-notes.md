# Setup Notes

These notes supplement the main README for local development and release preparation.

## Local Environment

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `MONGO_URI` to a local MongoDB instance or MongoDB Atlas connection string.
5. Set `SESSION_SECRET` to a long random value for local development.
6. Start the app with `npm run dev`.

## MongoDB Options

For a local database, use:

```text
MONGO_URI=mongodb://127.0.0.1:27017/streamnexus
```

For MongoDB Atlas, create a database user and network access rule, then place the Atlas connection string in `.env`. Do not commit the Atlas URI.

## Demo Data

Development mode seeds demo users and sample content unless `SEED_DEMO_DATA=false`.

Production mode skips demo data unless `SEED_DEMO_DATA=true`. If production demo seeding is enabled, replace the demo passwords with strong custom values.

## Release Checklist

- Confirm `.env` is ignored.
- Confirm `node_modules/`, `logs/`, generated uploads, and database dumps are ignored.
- Run `npm test`.
- Review README feature claims against the current code.
- Use GitHub Desktop to review the changed files before publishing.
