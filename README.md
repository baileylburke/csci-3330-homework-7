# CSCI-3330 Homework 7

Express dashboard backed by PostgreSQL. The ten required SELECT queries are in `server.js`. EJS renders the database records, and `public/` contains the CSS and jQuery code.

## Run

Requires Node.js 22.9 or newer and PostgreSQL. The browser loads jQuery and jQuery UI from their CDN.

1. Run `npm ci`.
2. Create an empty PostgreSQL database named `dashboard`.
3. Copy `.env.example` to `.env` and enter the local connection settings.
4. Run `npm run db:setup` once. This runs the five supplied SQL scripts in order inside a transaction. The scripts use the `postgres` role; setup refuses a database with existing public tables.
5. Run `npm start` and open http://127.0.0.1:3000.

Use `npm run dev` to restart the server automatically when files change. Keep `.env` local.

## Dashboard

The supplied data produces $35,800.00 in revenue, 1,284 customers, 342 orders, 12 issues, and 3 notifications. Customers appear in pages of 20. Sales show product names, quantities, and revenue.

The Orders card uses the required `COUNT(quantity)` query. The handout's diagram says to sum quantities, but its query list specifies a count.

The customer form is a preview and does not save changes. The two unfinished panels remain from the starter.

## Tests

After loading the supplied data, run `npm test`. Tests use temporary copies of the five tables on a separate PostgreSQL connection. Changes are rolled back, and the saved dashboard data is preserved.

Checks cover all customer pages, totals, sales, alerts, database updates, escaped text, empty tables, static files, and connection failures. The connection-failure check intentionally logs one error.

Starter: https://github.com/jreyes-13/3330-homework-7
