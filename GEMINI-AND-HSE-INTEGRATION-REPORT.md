# Gemini and HSE Integration Report

## Gemini
- API key is server-side only.
- AI routes require bearer authentication and an authorized `roomId`.
- Model is configurable through `GEMINI_MODEL` and defaults to `gemini-2.5-flash`.
- Responses label their source as `GEMINI_API` or `FALLBACK`.
- Actual Gemini account/model availability and consent workflow were not verified: **BLOCKED/NOT_TESTED**.

## HSE
- HSE routes are bearer-protected and scoped to the authenticated company and meeting.
- No external HSE production service was connected; real NCR/Incident/CAPA existence and idempotent adapter behavior remain **NOT_TESTED**.
- No Safety Board Production data was modified.
