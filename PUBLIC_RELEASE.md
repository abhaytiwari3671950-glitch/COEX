# Public release status

This repository is public. The source includes the deployed chat interface and Python media utilities.

## Available in the deployed build

- Gemini chat, streaming and cancellation.
- Recent chats stored in the current browser, title search, copy controls.
- Edit and resend as a new message; the original remains in the conversation.
- PDF and PNG/JPEG/WebP upload controls connected to authenticated Python validation.
- PDF reading with pypdf and response export with ReportLab.

Python unit smoke checks passed for PDF roundtrip, image validation, malformed input and action-bound authentication. The production build is ready; end-to-end media upload verification remains pending after a browser automation timeout.

## Limits

- Uploads: 2 MB, PDFs up to 40 pages, images up to 12 megapixels.
- PDF export currently supports Latin-script text. Unsupported scripts return an explicit error.
- Image/video generation is not implemented or enabled.
- The live app still requires Vercel sign-in. Publishing this repository does not remove app authentication or deployment protection.

## Run your own instance

Requires Node.js 24, pnpm, Python 3.12 or newer and your own Google model API credentials.

1. Run `pnpm install --frozen-lockfile`. The lockfile includes the Google SDK.
2. Run `python -m pip install -r requirements.txt`.
3. Configure server-only environment variables: `GOOGLE_GENERATIVE_AI_API_KEY`, a random `BETTER_AUTH_SECRET`, and your own `VERCEL_APP_CLIENT_ID` / `VERCEL_APP_CLIENT_SECRET` for the existing OAuth login.
4. Run `pnpm dev` for the Next.js UI. Python `/api/media` is a separate Vercel Function; `next dev` alone does not serve it. Use a linked Vercel development/deployment environment for the complete application.
5. Follow the eve deployment guide in README.md and configure your own Vercel project. Never reuse another deployment's secrets.

Before opening the hosted app to anonymous traffic, add and verify per-user session authorization, persistent rate limits, and separation of administrative connections from public chat capabilities. Do not use a single shared anonymous identity.

Only source belongs in GitHub. Keep `.env` files, credentials, uploaded documents, chat records and build outputs out of commits. The hosted app still has its own sign-in requirements, independently of this public repository.

Media requests share a 60-second deadline across authorization and processing. Expired sessions, rate limits, oversized uploads, network failures and non-JSON server responses display actionable errors. These paths are covered by mocked HTTP tests; they do not replace live upload verification.
