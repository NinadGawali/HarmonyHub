# Changelog

Each phase of the [refinement plan](docs/REFINEMENT_PLAN.md) ships as a tagged, runnable version.
Check out any version with `git checkout v<version>`.

## [0.1.0] - 2026-09-21 — Phase 1: voting fix

### Fixed
- **Votes were rejected until the admin closed and reopened voting.** New rooms were created without a
  `votingOpen` flag, which the server read as "closed" while the UI showed "open". Rooms now start open,
  a missing flag is treated as open, and clients receive the real voting state when they join.
- Rejected votes were only logged to the browser console. They now show a toast with the reason
  (voting closed, already voted, song removed).
- Duplicate-vote check was not atomic; a fast double click could count twice. It now relies on the
  result of `SADD`.
- Voting for a song that had been removed silently re-added it to the leaderboard.
- Removing and re-adding a song kept the old voter list, so earlier voters could not vote on it again.
- A guest's identity changed on every page refresh, which allowed re-voting and lost the "Voted" state.
  The server-issued id is now kept per room, and the server sends back the user's existing votes on join.
- After a socket reconnect the client was no longer in the room and stopped receiving live updates.
- The admin's voting toggle updated optimistically and could disagree with the server; it now waits for
  the server broadcast.

### Improved
- Song request outcomes ("approved" / "rejected") are sent only to the guest who made the request
  instead of to everyone in the room.
- New toast notifications replace `alert()` and surface socket errors on the room and admin pages.

## [0.0.0] — Baseline

State of the project before the refinement plan.
