# Vidyutrenz - Backend for UI

This project adds a simple Express backend to serve event data and accept registrations for the existing UI in `src/index.html`.

Quick start:

1. Install dependencies:

```bash
npm install
```

2. Run server:

```bash
npm start
```

3. Open http://localhost:3000 in your browser. The UI will fetch event details from `/api/events/:id` and submit contact/registration to `/api/register`.

Files added:
- `server.js` - Express server and API endpoints
- `data/events.json` - event data used by the API
- `data/registrations.json` - stored registrations (appends on POST)
 - `data/app.db` - SQLite database created automatically; stores `registrations` table
- `src/js/frontend.js` - client-side API wrapper and wiring
- `package.json` - npm scripts and deps

Notes:
- This is a minimal backend suitable for local demos. For production, add validation, authentication, and persistent DB.
Note on database:
- On first run the server will create `data/app.db` and migrate any entries found in `data/registrations.json` into the `registrations` table. After migration the JSON file is cleared to avoid duplicates.

To list registrations (admin):

```bash
# GET http://localhost:3000/api/registrations
```

The DB file is `data/app.db` and can be opened with any SQLite client.

Email configuration (optional)
- To send confirmation emails when users register, set the following environment variables before starting the server:

```bash
export SMTP_HOST=smtp.example.com
export SMTP_PORT=587
export SMTP_SECURE=false   # true for port 465
export SMTP_USER=your_smtp_user
export SMTP_PASS=your_smtp_password
export EMAIL_FROM="Vidyutrenz <no-reply@example.com>"
```

On Windows PowerShell use `$env:SMTP_HOST='smtp.example.com'` etc. If these variables are not set, the server will skip sending emails but will still store registrations.

After configuring env vars, restart the server and registrations will trigger a confirmation email to the user's `email` field.

Admin dashboard
- Set an admin secret (optional but recommended):

```bash
export ADMIN_SECRET=your_secret_here
export EMAIL_ADMIN=admin@example.com
```

Open the admin dashboard at: http://localhost:3000/admin.html
Enter the `ADMIN_SECRET` in the Secret field and click Refresh to list registrations. Use the Resend button to resend confirmation emails.
