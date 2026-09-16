# Inclusive Health Open House Trivia

A mobile-first live trivia experience for Inclusive Health's October 1, 2026 Open House celebration.

## Current version

The production build includes:

- separate host and player views
- Firebase Realtime Database synchronization
- six-character live room codes
- QR-code joining
- a full Inclusive Health question bank
- live scoring and response totals
- synchronized question, reveal, and leaderboard phases
- final rankings
- responsive phone and desktop layouts
- late joining while a game is already in progress

## Late joining

The room remains open until the host finishes the game. A guest arriving after trivia has started can scan the room QR code or enter the room code, choose a nickname, and join immediately.

- If a question is currently open, the new player joins that question with whatever answer time remains.
- If the answer is being revealed, the new player sees the reveal and begins scoring with the next question.
- If the leaderboard is on screen, the new player sees the current standings and joins the next question automatically.
- Questions that happened before the player joined are simply skipped; no retroactive points are awarded.
- Once the host finishes the game, the room stops accepting new players.

The host view keeps a QR code and room code visible during live play so late arrivals can join without interrupting the game.

## Firebase

`firebase-config.js` contains the live Firebase project configuration. `database.rules.json` includes the required Realtime Database rules, including permission for authenticated players to create their player entry while the room status is either `lobby` or `active`.

## GitHub Pages

Deployment is handled by the workflow in `.github/workflows/pages.yml`.
