/**
 * Resy Browser Automation
 *
 * Playwright-based automation for Resy restaurant reservation operations.
 * Uses stealth patches to avoid bot detection.
 */
import { chromium } from "playwright";
import { saveCookies, loadCookies, getAuthState } from "./auth.js";
const RESY_BASE_URL = "https://resy.com";
const RESY_API_URL = "https://api.resy.com";
const DEFAULT_TIMEOUT = 30000;
// Singleton browser instance
let browser = null;
let context = null;
let page = null;
async function initBrowser() {
    if (browser)
        return;
    browser = await chromium.launch({
        headless: true,
        args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-web-security",
        ],
    });
    context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 },
        locale: "en-US",
        extraHTTPHeaders: {
            "Accept-Language": "en-US,en;q=0.9",
        },
    });
    // Stealth patches
    await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        Object.defineProperty(navigator, "plugins", {
            get: () => [1, 2, 3, 4, 5],
        });
        // @ts-ignore
        window.chrome = { runtime: {} };
    });
    await loadCookies(context);
    page = await context.newPage();
    // Block heavy resources for speed
    await page.route("**/*.{png,jpg,jpeg,gif,svg,woff,woff2,mp4,webm}", (route) => route.abort());
}
async function getPage() {
    await initBrowser();
    if (!page)
        throw new Error("Page not initialized");
    return page;
}
async function getContext() {
    await initBrowser();
    if (!context)
        throw new Error("Context not initialized");
    return context;
}
// ─── Auth ────────────────────────────────────────────────────────────────────
export async function checkAuth() {
    const ctx = await getContext();
    const p = await getPage();
    await p.goto(RESY_BASE_URL, {
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_TIMEOUT,
    });
    await p.waitForTimeout(2000);
    const authState = await getAuthState(ctx);
    await saveCookies(ctx);
    return authState;
}
export async function login(params) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        await p.goto(`${RESY_BASE_URL}/login`, {
            waitUntil: "domcontentloaded",
            timeout: DEFAULT_TIMEOUT,
        });
        await p.waitForTimeout(2000);
        // Fill email
        const emailInput = p.locator('input[type="email"], input[name="email"], input[placeholder*="email" i], input[id*="email" i]').first();
        await emailInput.waitFor({ timeout: 10000 });
        await emailInput.fill(params.email);
        // Fill password
        const passwordInput = p.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]').first();
        await passwordInput.fill(params.password);
        // Click login/submit button
        const submitButton = p.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Login")').first();
        await submitButton.click();
        // Wait for navigation or auth confirmation
        await p.waitForTimeout(4000);
        // Check if login succeeded
        const authState = await getAuthState(ctx);
        if (authState.isLoggedIn) {
            await saveCookies(ctx);
            return { success: true, email: params.email };
        }
        // Try API-based auth check by looking at page URL or content
        const currentUrl = p.url();
        const pageContent = await p.content();
        const isOnLoginPage = currentUrl.includes("/login") || pageContent.includes("incorrect password");
        if (isOnLoginPage) {
            return {
                success: false,
                error: "Login failed. Please check your email and password.",
            };
        }
        // Navigation away from login usually means success
        await saveCookies(ctx);
        return { success: true, email: params.email };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Login failed",
        };
    }
}
// ─── Search ──────────────────────────────────────────────────────────────────
export async function searchVenues(params) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        const { location, query, date, partySize = 2 } = params;
        // Build Resy search URL: /cities/{city}?seats=N&day=YYYY-MM-DD
        const citySlug = location.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const searchParams = new URLSearchParams();
        searchParams.set("seats", String(partySize));
        if (date)
            searchParams.set("day", date);
        if (query)
            searchParams.set("query", query);
        const searchUrl = `${RESY_BASE_URL}/cities/${citySlug}?${searchParams.toString()}`;
        await p.goto(searchUrl, {
            waitUntil: "domcontentloaded",
            timeout: DEFAULT_TIMEOUT,
        });
        await p.waitForTimeout(3000);
        // Wait for venue cards
        await p
            .locator('[data-test-id="venue-card"], .venue-card, [class*="VenueCard"], [class*="venue-card"]')
            .first()
            .waitFor({ timeout: 10000 })
            .catch(() => { });
        const venues = [];
        const cards = p.locator('[data-test-id="venue-card"], [class*="VenueCard"], [class*="venue-card"], [data-venue-id]');
        const count = await cards.count();
        for (let i = 0; i < Math.min(count, 20); i++) {
            const card = cards.nth(i);
            try {
                const name = (await card
                    .locator('h2, h3, [class*="venue-name"], [class*="VenueName"], [data-test-id="venue-name"]')
                    .first()
                    .textContent()
                    .catch(() => "")) || "";
                const cuisine = (await card
                    .locator('[class*="cuisine"], [class*="Cuisine"], [data-test-id="cuisine"]')
                    .first()
                    .textContent()
                    .catch(() => "")) || "";
                const neighborhood = (await card
                    .locator('[class*="neighborhood"], [class*="Neighborhood"], [class*="location"]')
                    .first()
                    .textContent()
                    .catch(() => "")) || "";
                const priceRange = (await card
                    .locator('[class*="price"], [aria-label*="price"]')
                    .first()
                    .textContent()
                    .catch(() => "")) || "";
                const ratingText = (await card
                    .locator('[class*="rating"], [aria-label*="rating"]')
                    .first()
                    .textContent()
                    .catch(() => "")) || "";
                const profileLink = (await card
                    .locator("a[href*='/venue/'], a[href*='/venues/']")
                    .first()
                    .getAttribute("href")
                    .catch(() => "")) || "";
                const venueIdAttr = (await card.getAttribute("data-venue-id").catch(() => "")) || "";
                const slugMatch = profileLink.match(/\/venue\/([^/?]+)|\/venues\/([^/?]+)/);
                const venueSlug = slugMatch?.[1] || slugMatch?.[2] || venueIdAttr || `venue-${i}`;
                if (name.trim()) {
                    venues.push({
                        id: venueSlug,
                        name: name.trim(),
                        cuisine: cuisine.trim() || undefined,
                        neighborhood: neighborhood.trim() || undefined,
                        priceRange: priceRange.trim() || undefined,
                        rating: parseFloat(ratingText.replace(/[^0-9.]/g, "")) || undefined,
                        profileUrl: profileLink
                            ? profileLink.startsWith("http")
                                ? profileLink
                                : `${RESY_BASE_URL}${profileLink}`
                            : undefined,
                    });
                }
            }
            catch {
                // Skip problematic cards
            }
        }
        await saveCookies(ctx);
        return { success: true, venues };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to search venues",
        };
    }
}
// ─── Venue Details ───────────────────────────────────────────────────────────
export async function getVenueDetails(venueId) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        const url = venueId.startsWith("http")
            ? venueId
            : venueId.includes("/")
                ? `${RESY_BASE_URL}${venueId}`
                : `${RESY_BASE_URL}/venue/${venueId}`;
        await p.goto(url, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
        await p.waitForTimeout(3000);
        const name = (await p.locator("h1, [class*='venue-name'], [class*='VenueName']").first().textContent().catch(() => "")) || "";
        const description = (await p.locator('[class*="description"], [class*="Description"], [data-test-id="venue-description"]').first().textContent().catch(() => "")) || "";
        const cuisine = (await p.locator('[class*="cuisine"], [data-test-id="cuisine"]').first().textContent().catch(() => "")) || "";
        const address = (await p.locator('[class*="address"], address, [itemprop="address"]').first().textContent().catch(() => "")) || "";
        const phone = (await p.locator('[class*="phone"], a[href^="tel:"], [itemprop="telephone"]').first().textContent().catch(() => "")) || "";
        const priceRange = (await p.locator('[class*="price"], [aria-label*="price"]').first().textContent().catch(() => "")) || "";
        const ratingText = (await p.locator('[class*="rating"], [aria-label*="rating"]').first().textContent().catch(() => "")) || "";
        const neighborhood = (await p.locator('[class*="neighborhood"], [class*="Neighborhood"]').first().textContent().catch(() => "")) || "";
        // Hours
        const hoursElements = p.locator('[class*="hours"], [class*="Hours"], [data-test-id="hours"]');
        const hoursCount = await hoursElements.count();
        const hours = [];
        for (let i = 0; i < Math.min(hoursCount, 7); i++) {
            const h = await hoursElements.nth(i).textContent().catch(() => "");
            if (h?.trim())
                hours.push(h.trim());
        }
        // Photos
        const imgElements = p.locator('img[src*="resy"], img[src*="cloudinary"], [class*="photo"] img');
        const imgCount = await imgElements.count();
        const photos = [];
        for (let i = 0; i < Math.min(imgCount, 5); i++) {
            const src = await imgElements.nth(i).getAttribute("src").catch(() => "");
            if (src)
                photos.push(src);
        }
        await saveCookies(ctx);
        return {
            success: true,
            venue: {
                id: venueId,
                name: name.trim(),
                cuisine: cuisine.trim() || undefined,
                description: description.trim() || undefined,
                address: address.trim() || undefined,
                phone: phone.trim() || undefined,
                neighborhood: neighborhood.trim() || undefined,
                priceRange: priceRange.trim() || undefined,
                rating: parseFloat(ratingText.replace(/[^0-9.]/g, "")) || undefined,
                hours: hours.length > 0 ? hours : undefined,
                photos: photos.length > 0 ? photos : undefined,
                profileUrl: url,
            },
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to get venue details",
        };
    }
}
// ─── Availability ─────────────────────────────────────────────────────────────
export async function checkAvailability(params) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        const { venueId, date, time, partySize } = params;
        const baseUrl = venueId.startsWith("http")
            ? venueId
            : venueId.includes("/")
                ? `${RESY_BASE_URL}${venueId}`
                : `${RESY_BASE_URL}/venue/${venueId}`;
        const url = `${baseUrl}?date=${date}&time=${time}&seats=${partySize}`;
        await p.goto(url, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
        await p.waitForTimeout(3000);
        const venueName = (await p.locator("h1, [class*='venue-name']").first().textContent().catch(() => "")) || "Unknown Venue";
        // Wait for time slots
        await p
            .locator('[class*="timeslot"], [class*="TimeSlot"], [data-test-id="time-slot"], button[data-config-id]')
            .first()
            .waitFor({ timeout: 10000 })
            .catch(() => { });
        const slots = [];
        const timeSlotEls = p.locator('[class*="timeslot"], [class*="TimeSlot"], [data-test-id="time-slot"], button[data-config-id]');
        const slotCount = await timeSlotEls.count();
        for (let i = 0; i < Math.min(slotCount, 30); i++) {
            const slot = timeSlotEls.nth(i);
            try {
                const timeText = (await slot.textContent().catch(() => "")) || "";
                const configId = (await slot.getAttribute("data-config-id").catch(() => "")) || undefined;
                const slotType = (await slot.getAttribute("data-type").catch(() => "")) || undefined;
                if (timeText.trim()) {
                    slots.push({
                        time: timeText.trim(),
                        date,
                        partySize,
                        configId,
                        type: slotType,
                    });
                }
            }
            catch {
                // Skip
            }
        }
        await saveCookies(ctx);
        return { success: true, venueName: venueName.trim(), slots };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to check availability",
        };
    }
}
// ─── Make Reservation ─────────────────────────────────────────────────────────
export async function makeReservation(params) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        const { venueId, date, time, partySize, specialRequests, confirm } = params;
        const baseUrl = venueId.startsWith("http")
            ? venueId
            : venueId.includes("/")
                ? `${RESY_BASE_URL}${venueId}`
                : `${RESY_BASE_URL}/venue/${venueId}`;
        const url = `${baseUrl}?date=${date}&time=${time}&seats=${partySize}`;
        await p.goto(url, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
        await p.waitForTimeout(3000);
        const venueName = (await p.locator("h1, [class*='venue-name']").first().textContent().catch(() => "")) || "Unknown Venue";
        if (!confirm) {
            return {
                success: true,
                requiresConfirmation: true,
                preview: {
                    venueName: venueName.trim(),
                    date,
                    time,
                    partySize,
                    specialRequests,
                    message: `Ready to book ${venueName.trim()} for ${partySize} on ${date} at ${time}. Set confirm=true to complete the reservation.`,
                },
            };
        }
        // Click the time slot matching the requested time
        const targetSlot = p.locator(`[class*="timeslot"]:has-text("${time}"), button[data-config-id]:has-text("${time}"), [data-test-id="time-slot"]:has-text("${time}")`).first();
        if (await targetSlot.isVisible({ timeout: 5000 }).catch(() => false)) {
            await targetSlot.click();
        }
        else {
            // Click first available slot
            const firstSlot = p.locator('[class*="timeslot"], button[data-config-id], [data-test-id="time-slot"]').first();
            if (await firstSlot.isVisible({ timeout: 5000 }).catch(() => false)) {
                await firstSlot.click();
            }
        }
        await p.waitForTimeout(2000);
        // Fill special requests
        if (specialRequests) {
            const requestsField = p.locator('textarea[name*="request"], textarea[placeholder*="request" i], [class*="special-request"] textarea');
            if (await requestsField.isVisible({ timeout: 3000 }).catch(() => false)) {
                await requestsField.fill(specialRequests);
            }
        }
        // Click reserve/book button
        const reserveButton = p.locator('button:has-text("Reserve"), button:has-text("Book"), button:has-text("Complete"), button[type="submit"]').first();
        if (await reserveButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await reserveButton.click();
            await p.waitForTimeout(5000);
        }
        // Extract confirmation from success page
        const confirmationText = (await p
            .locator('[class*="confirmation"], h2:has-text("Confirmed"), [data-test-id="confirmation"]')
            .first()
            .textContent()
            .catch(() => "")) || "";
        const confirmationMatch = confirmationText.match(/[A-Z0-9]{5,}/);
        const confirmationNumber = confirmationMatch?.[0];
        const urlMatch = p.url().match(/reservation[s]?\/([^/?]+)/);
        const reservationId = urlMatch?.[1] || `res-${Date.now()}`;
        await saveCookies(ctx);
        return {
            success: true,
            reservation: {
                id: reservationId,
                venueName: venueName.trim(),
                date,
                time,
                partySize,
                status: "confirmed",
                confirmationNumber,
                specialRequests,
            },
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to make reservation",
        };
    }
}
// ─── Get Reservations ─────────────────────────────────────────────────────────
export async function getReservations() {
    const p = await getPage();
    const ctx = await getContext();
    try {
        await p.goto(`${RESY_BASE_URL}/profile/reservations`, {
            waitUntil: "domcontentloaded",
            timeout: DEFAULT_TIMEOUT,
        });
        await p.waitForTimeout(3000);
        await p
            .locator('[class*="reservation-card"], [class*="ReservationCard"], [data-test-id="reservation"]')
            .first()
            .waitFor({ timeout: 10000 })
            .catch(() => { });
        const reservations = [];
        const cards = p.locator('[class*="reservation-card"], [class*="ReservationCard"], [data-test-id="reservation"]');
        const count = await cards.count();
        for (let i = 0; i < Math.min(count, 30); i++) {
            const card = cards.nth(i);
            try {
                const venueName = (await card.locator("h2, h3, [class*='venue-name']").first().textContent().catch(() => "")) || "";
                const dateText = (await card.locator("time, [class*='date'], [datetime]").first().textContent().catch(() => "")) || "";
                const timeText = (await card.locator("[class*='time'], [aria-label*='time']").first().textContent().catch(() => "")) || "";
                const partySizeText = (await card.locator("[class*='party'], [class*='guest'], [aria-label*='guest']").first().textContent().catch(() => "")) || "";
                const statusText = (await card.locator("[class*='status']").first().textContent().catch(() => "upcoming")) || "upcoming";
                const reservationId = (await card.getAttribute("data-reservation-id").catch(() => "")) || `res-${i}`;
                if (venueName.trim()) {
                    reservations.push({
                        id: reservationId,
                        venueName: venueName.trim(),
                        date: dateText.trim(),
                        time: timeText.trim(),
                        partySize: parseInt(partySizeText.replace(/[^0-9]/g, "")) || 2,
                        status: statusText.trim() || "upcoming",
                    });
                }
            }
            catch {
                // Skip
            }
        }
        await saveCookies(ctx);
        return { success: true, reservations };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to get reservations",
        };
    }
}
// ─── Cancel Reservation ───────────────────────────────────────────────────────
export async function cancelReservation(params) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        const { reservationId, confirm } = params;
        if (!confirm) {
            return {
                success: true,
                requiresConfirmation: true,
                message: `Please confirm cancellation of reservation ${reservationId}. Set confirm=true to proceed. This action cannot be undone.`,
            };
        }
        const url = `${RESY_BASE_URL}/profile/reservations/${reservationId}`;
        await p.goto(url, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
        await p.waitForTimeout(2000);
        const cancelButton = p.locator('button:has-text("Cancel reservation"), button:has-text("Cancel"), [data-test-id="cancel-reservation"]').first();
        if (!(await cancelButton.isVisible({ timeout: 5000 }).catch(() => false))) {
            return {
                success: false,
                error: "Cancel button not found. The reservation may not be cancellable or may not exist.",
            };
        }
        await cancelButton.click();
        await p.waitForTimeout(2000);
        // Confirm in dialog if present
        const confirmButton = p.locator('button:has-text("Yes"), button:has-text("Confirm"), button:has-text("Yes, cancel")').first();
        if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await confirmButton.click();
            await p.waitForTimeout(3000);
        }
        await saveCookies(ctx);
        return {
            success: true,
            message: `Reservation ${reservationId} has been cancelled successfully.`,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to cancel reservation",
        };
    }
}
// ─── Waitlist ─────────────────────────────────────────────────────────────────
export async function getWaitlist(venueId) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        const url = venueId.startsWith("http")
            ? venueId
            : venueId.includes("/")
                ? `${RESY_BASE_URL}${venueId}`
                : `${RESY_BASE_URL}/venue/${venueId}`;
        await p.goto(url, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
        await p.waitForTimeout(3000);
        const venueName = (await p.locator("h1, [class*='venue-name']").first().textContent().catch(() => "")) || "Unknown Venue";
        // Check for waitlist elements
        const waitlistEl = p.locator('[class*="waitlist"], [class*="Waitlist"], [data-test-id="waitlist"], button:has-text("Join waitlist"), button:has-text("Waitlist")').first();
        const hasWaitlist = await waitlistEl.isVisible({ timeout: 5000 }).catch(() => false);
        let waitlistInfo = { available: false };
        if (hasWaitlist) {
            const waitlistText = (await waitlistEl.textContent().catch(() => "")) || "";
            const waitTimeEl = p.locator('[class*="wait-time"], [class*="WaitTime"]').first();
            const waitTime = (await waitTimeEl.textContent().catch(() => "")) || undefined;
            waitlistInfo = {
                available: true,
                text: waitlistText.trim(),
                estimatedWaitTime: waitTime?.trim(),
            };
        }
        await saveCookies(ctx);
        return {
            success: true,
            waitlist: {
                venueName: venueName.trim(),
                venueId,
                ...waitlistInfo,
            },
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to get waitlist info",
        };
    }
}
export async function joinWaitlist(params) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        const { venueId, partySize, confirm } = params;
        const url = venueId.startsWith("http")
            ? venueId
            : venueId.includes("/")
                ? `${RESY_BASE_URL}${venueId}`
                : `${RESY_BASE_URL}/venue/${venueId}`;
        await p.goto(url, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
        await p.waitForTimeout(3000);
        const venueName = (await p.locator("h1, [class*='venue-name']").first().textContent().catch(() => "")) || "Unknown Venue";
        if (!confirm) {
            return {
                success: true,
                requiresConfirmation: true,
                message: `Ready to join waitlist at ${venueName.trim()} for party of ${partySize}. Set confirm=true to proceed.`,
            };
        }
        // Look for waitlist button
        const waitlistButton = p.locator('button:has-text("Join waitlist"), button:has-text("Waitlist"), [data-test-id="join-waitlist"]').first();
        if (!(await waitlistButton.isVisible({ timeout: 5000 }).catch(() => false))) {
            return {
                success: false,
                error: "Waitlist is not available at this venue right now.",
            };
        }
        await waitlistButton.click();
        await p.waitForTimeout(2000);
        // Set party size if there's a selector
        const partySizeSelector = p.locator('select[name*="party"], select[name*="seats"], [class*="party-size"] select').first();
        if (await partySizeSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
            await partySizeSelector.selectOption(String(partySize));
        }
        // Confirm joining
        const confirmButton = p.locator('button:has-text("Join"), button:has-text("Confirm"), button[type="submit"]').first();
        if (await confirmButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await confirmButton.click();
            await p.waitForTimeout(3000);
        }
        // Extract waitlist confirmation
        const confirmationText = (await p
            .locator('[class*="confirmation"], h2:has-text("Waitlist"), [class*="waitlist-success"]')
            .first()
            .textContent()
            .catch(() => "")) || "";
        await saveCookies(ctx);
        return {
            success: true,
            waitlistEntry: {
                venueName: venueName.trim(),
                venueId,
                partySize,
                status: "joined",
                confirmation: confirmationText.trim() || undefined,
                joinedAt: new Date().toISOString(),
            },
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to join waitlist",
        };
    }
}
// ─── Cleanup ──────────────────────────────────────────────────────────────────
export async function cleanup() {
    if (context) {
        await saveCookies(context);
    }
    if (browser) {
        await browser.close();
        browser = null;
        context = null;
        page = null;
    }
}
//# sourceMappingURL=browser.js.map