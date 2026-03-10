#!/usr/bin/env node
/**
 * Strider Labs Resy MCP Server
 *
 * MCP server that gives AI agents the ability to search restaurants,
 * check availability, make reservations, manage bookings, and join
 * waitlists on Resy.
 * https://striderlabs.ai
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  checkAuth,
  login,
  searchVenues,
  getVenueDetails,
  checkAvailability,
  makeReservation,
  getReservations,
  cancelReservation,
  getWaitlist,
  joinWaitlist,
  cleanup,
} from "./browser.js";
import { hasStoredCookies, clearCookies, getCookiesPath } from "./auth.js";

const server = new Server(
  {
    name: "io.github.markswendsen-code/resy",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── Tool Definitions ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "resy_status",
        description:
          "Check if the user is logged in to Resy. Returns authentication status and instructions if not logged in. Always call this before other Resy operations.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "resy_login",
        description:
          "Authenticate with Resy using email and password via browser automation. Saves session cookies for future requests.",
        inputSchema: {
          type: "object",
          properties: {
            email: {
              type: "string",
              description: "Resy account email address",
            },
            password: {
              type: "string",
              description: "Resy account password",
            },
          },
          required: ["email", "password"],
        },
      },
      {
        name: "resy_logout",
        description:
          "Clear the stored Resy session. Use this to log out or reset authentication.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "resy_search_venues",
        description:
          "Search for restaurants on Resy by location, query, date, and party size.",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description:
                "City or location to search (e.g. 'New York', 'San Francisco', 'Chicago')",
            },
            query: {
              type: "string",
              description:
                "Optional search query for restaurant name or cuisine (e.g. 'Italian', 'sushi', 'Nobu')",
            },
            date: {
              type: "string",
              description: "Date to search in YYYY-MM-DD format",
            },
            partySize: {
              type: "number",
              description: "Number of guests (default: 2)",
            },
          },
          required: ["location"],
        },
      },
      {
        name: "resy_get_venue",
        description:
          "Get detailed information about a specific Resy venue including photos, description, hours, and contact info.",
        inputSchema: {
          type: "object",
          properties: {
            venueId: {
              type: "string",
              description:
                "The venue ID, slug, or full profile URL (from resy_search_venues results)",
            },
          },
          required: ["venueId"],
        },
      },
      {
        name: "resy_check_availability",
        description:
          "Check available reservation time slots at a Resy venue for a specific date, time, and party size.",
        inputSchema: {
          type: "object",
          properties: {
            venueId: {
              type: "string",
              description: "The venue ID, slug, or full profile URL",
            },
            date: {
              type: "string",
              description: "Date to check in YYYY-MM-DD format",
            },
            time: {
              type: "string",
              description:
                "Preferred time in HH:MM format (e.g. '19:00'). Nearby times are also shown.",
            },
            partySize: {
              type: "number",
              description: "Number of guests",
            },
          },
          required: ["venueId", "date", "time", "partySize"],
        },
      },
      {
        name: "resy_make_reservation",
        description:
          "Book a table at a Resy restaurant. Set confirm=false to preview before booking, confirm=true to complete the reservation. Requires authentication.",
        inputSchema: {
          type: "object",
          properties: {
            venueId: {
              type: "string",
              description: "The venue ID, slug, or full profile URL",
            },
            date: {
              type: "string",
              description: "Reservation date in YYYY-MM-DD format",
            },
            time: {
              type: "string",
              description: "Desired reservation time in HH:MM format (e.g. '19:00')",
            },
            partySize: {
              type: "number",
              description: "Number of guests",
            },
            specialRequests: {
              type: "string",
              description:
                "Special requests, dietary restrictions, or notes (optional)",
            },
            confirm: {
              type: "boolean",
              description:
                "Set to true to complete the booking, false to preview details first",
            },
          },
          required: ["venueId", "date", "time", "partySize", "confirm"],
        },
      },
      {
        name: "resy_get_reservations",
        description:
          "List all upcoming reservations for the logged-in Resy user. Requires authentication.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "resy_cancel_reservation",
        description:
          "Cancel an existing Resy reservation. Set confirm=false to preview, confirm=true to actually cancel. This cannot be undone.",
        inputSchema: {
          type: "object",
          properties: {
            reservationId: {
              type: "string",
              description:
                "The reservation ID to cancel (from resy_get_reservations)",
            },
            confirm: {
              type: "boolean",
              description:
                "Set to true to actually cancel, false to preview the cancellation",
            },
          },
          required: ["reservationId", "confirm"],
        },
      },
      {
        name: "resy_get_waitlist",
        description:
          "Check if a Resy venue has a waitlist available and get estimated wait time information.",
        inputSchema: {
          type: "object",
          properties: {
            venueId: {
              type: "string",
              description: "The venue ID, slug, or full profile URL",
            },
          },
          required: ["venueId"],
        },
      },
      {
        name: "resy_join_waitlist",
        description:
          "Join the waitlist at a Resy restaurant. Set confirm=false to preview, confirm=true to join. Requires authentication.",
        inputSchema: {
          type: "object",
          properties: {
            venueId: {
              type: "string",
              description: "The venue ID, slug, or full profile URL",
            },
            partySize: {
              type: "number",
              description: "Number of guests for the waitlist entry",
            },
            confirm: {
              type: "boolean",
              description:
                "Set to true to join the waitlist, false to preview first",
            },
          },
          required: ["venueId", "partySize", "confirm"],
        },
      },
    ],
  };
});

// ─── Tool Execution ───────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "resy_status": {
        const hasCookies = hasStoredCookies();
        if (!hasCookies) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  isLoggedIn: false,
                  message:
                    "Not logged in to Resy. Use the resy_login tool with your email and password to authenticate.",
                  cookiesPath: getCookiesPath(),
                }),
              },
            ],
          };
        }
        const authState = await checkAuth();
        if (!authState.isLoggedIn) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  isLoggedIn: false,
                  message:
                    "Session expired or invalid. Use the resy_login tool to re-authenticate.",
                }),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                isLoggedIn: true,
                message: "Logged in to Resy.",
                email: authState.email,
              }),
            },
          ],
        };
      }

      case "resy_login": {
        const { email, password } = args as { email: string; password: string };
        const result = await login({ email, password });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
          isError: !result.success,
        };
      }

      case "resy_logout": {
        clearCookies();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message:
                  "Resy session cleared. You will need to log in again to make reservations.",
              }),
            },
          ],
        };
      }

      case "resy_search_venues": {
        const { location, query, date, partySize } = args as {
          location: string;
          query?: string;
          date?: string;
          partySize?: number;
        };
        const result = await searchVenues({ location, query, date, partySize });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
          isError: !result.success,
        };
      }

      case "resy_get_venue": {
        const { venueId } = args as { venueId: string };
        const result = await getVenueDetails(venueId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
          isError: !result.success,
        };
      }

      case "resy_check_availability": {
        const { venueId, date, time, partySize } = args as {
          venueId: string;
          date: string;
          time: string;
          partySize: number;
        };
        const result = await checkAvailability({ venueId, date, time, partySize });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
          isError: !result.success,
        };
      }

      case "resy_make_reservation": {
        const { venueId, date, time, partySize, specialRequests, confirm } =
          args as {
            venueId: string;
            date: string;
            time: string;
            partySize: number;
            specialRequests?: string;
            confirm: boolean;
          };
        const result = await makeReservation({
          venueId,
          date,
          time,
          partySize,
          specialRequests,
          confirm,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
          isError: !result.success,
        };
      }

      case "resy_get_reservations": {
        const result = await getReservations();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
          isError: !result.success,
        };
      }

      case "resy_cancel_reservation": {
        const { reservationId, confirm } = args as {
          reservationId: string;
          confirm: boolean;
        };
        const result = await cancelReservation({ reservationId, confirm });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
          isError: !result.success,
        };
      }

      case "resy_get_waitlist": {
        const { venueId } = args as { venueId: string };
        const result = await getWaitlist(venueId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
          isError: !result.success,
        };
      }

      case "resy_join_waitlist": {
        const { venueId, partySize, confirm } = args as {
          venueId: string;
          partySize: number;
          confirm: boolean;
        };
        const result = await joinWaitlist({ venueId, partySize, confirm });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
          isError: !result.success,
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Unknown tool: ${name}`,
              }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: errorMessage,
          }),
        },
      ],
      isError: true,
    };
  }
});

// ─── Lifecycle ────────────────────────────────────────────────────────────────

process.on("SIGINT", async () => {
  await cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await cleanup();
  process.exit(0);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Strider Resy MCP server running");
}

main().catch(console.error);
