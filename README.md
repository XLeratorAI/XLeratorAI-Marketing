# XLeratorAI-Marketing
Company web site and marketing


## Hosting

The site is hosted on **Cloudflare Pages** (project `xleratorai-marketing`), deployed from the `main` branch. Push to `main` and it goes live; there is nothing else to run.

- The pages are plain HTML files in the repo root. `build.js` copies the public files into `dist/` (it skips `api/`, `functions/`, package files and dot-files, so a new page or image is picked up automatically).
- The contact form posts to `/api/contact`, which is the Pages Function in `functions/api/contact.js`. It uses Cloudflare Turnstile for the spam check and Resend to send the two emails. Its secrets (`RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`) live in the Pages project settings, not in the repo.
- Cloudflare serves `contact.html` at `/contact` (and redirects the old `.html` address).
- Do not add a `build` script to `package.json`.
- `api/` is the old Vercel version of the form and is kept only until Vercel is retired.
