# Instagram Insights Viewer

## Final Year Academic Project

**Context:** Academic Project for Studying Data Visualization & Analytics

This project is built strictly for academic purposes as part of my final year curriculum focused on advanced web development, high-performance databases, and modern data visualization techniques. It demonstrates how to interact with third-party APIs asynchronously, process complex datasets, and display them in a user-friendly, responsive interface.

### Disclaimer & Academic Safety

> **⚠️ IMPORTANT:** This application is strictly an educational tool designed for studying API responses, database connection pooling, and UI/UX design. The platform uses read-only, authorized data accessible via the RapidAPI platform for academic study. It does not perform unauthorized data extraction, modify any external service states, or violate Terms of Service. This repository is intended solely for grading and peer review.

### Technologies
- Frontend: React, Vite, Tailwind CSS, Shadcn UI
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL, Drizzle ORM
- Deployment: Railway

### Setup Instructions & Deployment Info

This project is configured for cloud deployment (e.g., Railway). 
When setting up, ensure the following Environment Variables are configured in your hosting service:

*   `DATABASE_URL`: Your PostgreSQL connection string. (Railway will provide this automatically if you add a Database to your project).
*   `RAPIDAPI_KEY`: Your key from the RapidAPI "Instagram Scraper" service.
*   `TELEGRAM_BOT_TOKEN`: The bot token obtained from BotFather on Telegram.
*   `TELEGRAM_ADMIN_CHAT_ID`: Your personal Telegram Chat ID (to restrict `/gen` command access to you only).

#### How to Subscribe & Set Up RapidAPI (Tomorrow's Step)
1. Go to [RapidAPI](https://rapidapi.com/) and register/login.
2. Search for the specific Instagram Data Scraper used in this app.
3. Choose a Monthly Subscription tier (ensure it has enough API calls per month for your traffic).
4. Go to your Dashboard -> Apps -> Security and copy your `X-RapidAPI-Key`.
5. Paste this key into the `RAPIDAPI_KEY` environment variable in your Railway dashboard.

#### Telegram Bot Operations
The Telegram Bot acts as the private admin panel. Since it's secured, **only the owner (Chat ID match)** can execute commands.
*   **Generate Key Command (`/gen`)**: The ONLY active command.
    *   **Usage**: `/gen <instagram_username> <validity_in_days>`
    *   **Example**: `/gen virat.kohli 30` (Generates a secure login token for `virat.kohli` that expires in 30 days).
    *   **Output**: The bot will reply with a secure link & the Key. Send this Key to your users for them to log into the UI.

#### Local Development
1. `npm install`
2. Create a `.env` file referencing the variables above.
3. Run `npm run db:push` to generate DB tables. 
4. `npm run dev` to start locally.
