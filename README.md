# Cocktail Song Request

![Cocktail Song Request banner](docs/banner.svg)

QR song requests, YouTube playback, live display themes, store announcements, and small event games for cocktail bars, campus pubs, club parties, and private venues.

The app is built as a small Node.js server with plain HTML/CSS/JavaScript. No database is required for local operation.

## Highlights

- Guest QR page for song search, YouTube selection, request notes, and event participation
- Staff admin page for approving songs, controlling the queue, sending notices, and running games
- Projector display page with YouTube playback, current song, stories, QR code, and theme effects
- Campus-friendly themes for birthdays, clubs, departments, freshmen, exams, couples, farewell parties, and custom welcomes
- Scheduled kitchen-close notice with screen overlay and browser speech synthesis
- Event games: boss rock-paper-scissors, random draw, instant quiz, and table battle
- Local JSON state so a small venue can run it without external infrastructure

## Screens

| Guest request | Staff admin | Projector display |
| --- | --- | --- |
| Search YouTube and submit a song | Approve queue, notices, and games | Show current song, story, QR, event overlays |

## Quick Start

```bash
npm install
npm start
```

Open:

- Guest request page: `http://localhost:3000/request`
- Staff admin page: `http://localhost:3000/admin`
- Projector display page: `http://localhost:3000/display`

To use another port:

```bash
PORT=3001 npm start
```

## Typical Venue Setup

1. Open `/display` on the projector or TV.
2. Press "Start" once so the browser can play YouTube audio.
3. Put the QR code on tables, menus, or the screen.
4. Staff keeps `/admin` open on a laptop or tablet.
5. Guests open `/request`, search for a song, choose a theme, and submit a story.

## Event Games

- **Boss game**: guests choose rock, paper, or scissors; staff chooses the boss move and announces winners.
- **Random draw**: pick one participant from all entries.
- **Instant quiz**: staff sets a question and answer; matching answers win.
- **Table battle**: guests join by table/team; one table is selected as the winner.

## Operational Notices

Staff can send immediate screen notices from `/admin`. Kitchen close can be scheduled by time, including voice guidance on the display page after the display is unlocked.

## Data

Runtime state is stored in `data/state.json`. It is intentionally ignored by git so public repositories do not leak venue data, request history, or event participants.

## Validation

```bash
npm run check
npm audit
```

## Suggested GitHub Topics

`song-request`, `qr-code`, `youtube`, `bar`, `karaoke`, `event-system`, `college`, `digital-signage`

## License

MIT
