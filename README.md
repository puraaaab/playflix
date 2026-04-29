# PlayFlix

PlayFlix is a secure Netflix-style full-stack web app built with Next.js App Router, Tailwind CSS, Express, and MySQL.

## Stack

- Frontend: Next.js, Tailwind CSS, Axios interceptors
- Backend: Node.js, Express, MySQL, Razorpay test mode
- Security: JWT access and refresh cookies, AES-GCM payload encryption, request signatures, bcrypt password hashing, rate limiting, validation, CSP, CSRF protection, suspicious-activity logging

## Project Layout

- `backend`: HTTPS-ready Express API with MySQL schema and security middleware
- `frontend`: Next.js App Router client with browse, login, plans, watch, and admin screens

## Environment

Copy the example env files and set the values for your local setup.

- `backend/.env.example`
- `frontend/.env.example`

## Notes

- Auth cookies are configured as `HttpOnly`, `Secure`, and `SameSite=Strict`.
- The backend expects MySQL and should be served over HTTPS in production.
- Razorpay secret keys stay on the backend only; the frontend uses the public test key id.
- AES request encryption and HMAC signing are used for sensitive routes to make traffic inspection realistic during pentesting.

## Local Development

1. Start MySQL and apply `backend/database/schema.sql`.
2. Populate `backend/.env` from the example file.
3. Populate `frontend/.env.local` from the example file.
4. Run the backend and frontend from separate terminals.

