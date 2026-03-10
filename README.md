# @striderlabs/mcp-resy

MCP server for [Resy](https://resy.com) — let AI agents search restaurants, check availability, make reservations, and join waitlists.

Part of the [Strider Labs](https://striderlabs.ai) MCP connector suite alongside Instacart, DoorDash, OpenTable, and Uber Eats.

## Installation

```bash
npx @striderlabs/mcp-resy
```

Or install globally:

```bash
npm install -g @striderlabs/mcp-resy
```

## Setup with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "resy": {
      "command": "npx",
      "args": ["-y", "@striderlabs/mcp-resy"]
    }
  }
}
```

## Authentication

Use the `resy_login` tool with your Resy email and password. Session cookies are stored at `~/.striderlabs/resy/cookies.json` and persist across sessions.

## Tools

### `resy_status`
Check authentication status. Always call this first.

**Returns:** `{ isLoggedIn: boolean, message: string }`

---

### `resy_login`
Authenticate with Resy via browser automation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | Resy account email |
| password | string | Yes | Resy account password |

---

### `resy_logout`
Clear the stored Resy session cookies.

---

### `resy_search_venues`
Search for restaurants on Resy.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| location | string | Yes | City or location (e.g. "New York", "San Francisco") |
| query | string | No | Restaurant name or cuisine filter |
| date | string | No | Date in YYYY-MM-DD format |
| partySize | number | No | Number of guests (default: 2) |

**Returns:** `{ venues: [{ id, name, cuisine, neighborhood, priceRange, rating, profileUrl }] }`

---

### `resy_get_venue`
Get detailed venue information including photos, description, hours, and contact info.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| venueId | string | Yes | Venue ID, slug, or profile URL |

---

### `resy_check_availability`
Check available time slots at a venue.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| venueId | string | Yes | Venue ID, slug, or profile URL |
| date | string | Yes | Date in YYYY-MM-DD format |
| time | string | Yes | Preferred time in HH:MM format (e.g. "19:00") |
| partySize | number | Yes | Number of guests |

**Returns:** `{ venueName, slots: [{ time, date, partySize, configId }] }`

---

### `resy_make_reservation`
Book a table at a Resy restaurant. Requires authentication.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| venueId | string | Yes | Venue ID, slug, or profile URL |
| date | string | Yes | Date in YYYY-MM-DD format |
| time | string | Yes | Time in HH:MM format (e.g. "19:00") |
| partySize | number | Yes | Number of guests |
| specialRequests | string | No | Special requests or dietary notes |
| confirm | boolean | Yes | `false` to preview, `true` to book |

**Returns:** `{ reservation: { id, venueName, date, time, partySize, status, confirmationNumber } }`

---

### `resy_get_reservations`
List upcoming reservations for the logged-in user. Requires authentication.

**Returns:** `{ reservations: [{ id, venueName, date, time, partySize, status }] }`

---

### `resy_cancel_reservation`
Cancel an existing reservation. Requires authentication.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reservationId | string | Yes | Reservation ID (from `resy_get_reservations`) |
| confirm | boolean | Yes | `false` to preview, `true` to cancel |

---

### `resy_get_waitlist`
Check if a venue has a waitlist available and get estimated wait times.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| venueId | string | Yes | Venue ID, slug, or profile URL |

**Returns:** `{ waitlist: { available, estimatedWaitTime } }`

---

### `resy_join_waitlist`
Join the waitlist at a restaurant. Requires authentication.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| venueId | string | Yes | Venue ID, slug, or profile URL |
| partySize | number | Yes | Number of guests |
| confirm | boolean | Yes | `false` to preview, `true` to join |

---

## Session Storage

Cookies are stored at `~/.striderlabs/resy/cookies.json`. Delete this file or use `resy_logout` to clear your session.

## License

MIT — [Strider Labs](https://striderlabs.ai)
