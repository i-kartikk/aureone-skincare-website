# Customer accounts and order history

For durable customer accounts and order tracking on Vercel:

1. Add a Vercel Postgres database through the Neon integration for this project.
2. Make sure the database connection string is available to the deployment as `POSTGRES_URL` in every environment where checkout is enabled.
3. Deploy the application. The API creates the customer, order, and order-number sequence tables on first use.

Customer account credentials (hashed with Node.js scrypt), orders, and order statuses are stored in Postgres. Account sign-in is optional at checkout; guest orders are also stored, remain visible to admins, and are not included in any customer's private order history. Signed-in customers can see the status of orders placed under their account. The admin order list, dashboard totals, and status updates use the same persistent order records. If `POSTGRES_URL` is missing on Vercel, account and order endpoints return an explicit service error rather than silently storing data in temporary files. Local development without `POSTGRES_URL` continues to use the existing JSON database.

Existing JSON-file orders and customer records are not automatically imported into Postgres.
