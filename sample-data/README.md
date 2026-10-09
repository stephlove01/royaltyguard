# RoyaltyGuard — Sample Data

Fictional demo assets for local development and capstone demos (see `PRD.md`).

## Purpose

Simulated streaming-platform royalty statement CSVs. All artists, tracks, amounts, and rates are **non-official** demonstration data — not real platform payouts.

Supported demo platforms:

| File | Canonical platform name |
|---|---|
| `spotify_statement.csv` | Spotify |
| `apple_music_statement.csv` | Apple Music |
| `youtube_music_statement.csv` | YouTube Music |
| `amazon_music_statement.csv` | Amazon Music |
| `audiomack_statement.csv` | Audiomack (existing fixture, still supported) |

Schema for every CSV:

`track_name,plays,territory,tier,actual_payout`
