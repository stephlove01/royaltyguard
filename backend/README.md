# RoyaltyGuard — Backend

Node.js + Express + TypeScript API (see `TECHNICAL_SPECIFICATION.md` and `API_SPECIFICATION.md`).

## Purpose

REST API, validation, authentication, MySQL access, local statement file storage, and **deterministic** royalty audit calculations. n8n and AI integrate via documented endpoints; they do not own authoritative financial math.

## Status

The authenticated `POST /api/statements/upload` endpoint stores one CSV or PDF
file (up to 10 MB) under `UPLOAD_DIR` (default: `uploads`). Files use generated
UUID names and are placed in a directory scoped to the authenticated user. This
upload step does not yet create a statement database record or parse the file.
