# XLeratorAI-Marketing
Company web site and marketing


## Hosting

The site is hosted on **Cloudflare Pages** (project `xleratorai-marketing`), deployed from the `main` branch. Push to `main` and it goes live; there is nothing else to run.

- The pages are plain HTML files in the repo root. `build.js` copies the public files into `dist/` (it skips `api/`, `functions/`, package files and dot-files, so a new page or image is picked up automatically).
- The contact form posts to `/api/contact`, which is the Pages Function in `functions/api/contact.js`. It uses Cloudflare Turnstile for the spam check and Resend to send the two emails. Its secrets (`RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`) live in the Pages project settings, not in the repo.
- Cloudflare serves `contact.html` at `/contact` (and redirects the old `.html` address).
- Do not add a `build` script to `package.json`.

## New Client Application (`/new-client`)

An unlisted, `noindex` page (`new-client.html`) where a prospective client applies in seven steps: about you, company, name and web address, the idea, care and rules, help wanted, review. It is not linked from the navigation yet; give people the address directly.

- **Web address check.** The page calls `/api/domain-check` (`functions/api/domain-check.js`, logic in `functions/lib/domain.js`). It uses free public lookups (RDAP through rdap.org, plus DNS over HTTPS at Cloudflare), so it needs no key or account. It says whether a name looks available or is registered (registrar, expiry, whether the name servers are at Cloudflare). The answer is information only: price and availability are confirmed at registration. rdap.org returns 403 without a User-Agent, so the code sends one, and it rate-limits heavy use (429), in which case the DNS check alone answers and the result is marked "not confirmed".
- **Submit.** `/api/application` (`functions/api/application.js`, rules and email in `functions/lib/application.js`) re-checks every field on the server, verifies Turnstile (fails closed), re-runs the domain checks, stores a record if a KV namespace is bound, and emails **newclient@xleratorai.com**. **It sends nothing to the applicant**: they are shown a reference number (`NC-YYYYMMDD-XXXXXXXX`) on screen and we contact them ourselves. A hidden trap field catches bots (it answers "success" and does nothing).
- **Settings.** Uses the same Pages secrets as the contact form (`RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`). Optional: bind a KV namespace named `APPLICATIONS` (Pages > Settings > Bindings) to keep a record of each application; without it the team email is the only record. Keys are `application:<reference>`.
- **Mail setup.** `newclient@xleratorai.com` is a Google Group. For the emails to arrive, the group must accept posts from outside (the sender is noreply@xleratorai.com through Resend), the same as `info@`.
- **Sensitive answers.** Ticking health, money, children, other people's accounts or ID numbers puts `[SENSITIVE]` in the subject and a red banner in the email. Those applications are reviewed first.
- **Draft saving.** The page keeps unsent answers in the browser's local storage (never the security check or passwords) and clears them on submit.
- Before linking the page publicly: write the privacy notice the page refers to, and have a lawyer read the "Before you start" notes.
