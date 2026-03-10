/**
 * Resy Authentication & Session Management
 *
 * Handles cookie persistence and login state detection.
 * Cookies stored at ~/.striderlabs/resy/cookies.json
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { BrowserContext } from "playwright";

const CONFIG_DIR = join(homedir(), ".striderlabs", "resy");
const COOKIES_FILE = join(CONFIG_DIR, "cookies.json");

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export async function saveCookies(context: BrowserContext): Promise<void> {
  ensureConfigDir();
  const cookies = await context.cookies();
  writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
}

export async function loadCookies(context: BrowserContext): Promise<boolean> {
  if (!existsSync(COOKIES_FILE)) {
    return false;
  }
  try {
    const cookiesData = readFileSync(COOKIES_FILE, "utf-8");
    const cookies = JSON.parse(cookiesData);
    if (Array.isArray(cookies) && cookies.length > 0) {
      await context.addCookies(cookies);
      return true;
    }
  } catch (error) {
    console.error("Failed to load cookies:", error);
  }
  return false;
}

export function clearCookies(): void {
  if (existsSync(COOKIES_FILE)) {
    writeFileSync(COOKIES_FILE, "[]");
  }
}

export function hasStoredCookies(): boolean {
  if (!existsSync(COOKIES_FILE)) {
    return false;
  }
  try {
    const cookiesData = readFileSync(COOKIES_FILE, "utf-8");
    const cookies = JSON.parse(cookiesData);
    return Array.isArray(cookies) && cookies.length > 0;
  } catch {
    return false;
  }
}

export async function getAuthState(
  context: BrowserContext
): Promise<{ isLoggedIn: boolean; email?: string }> {
  const cookies = await context.cookies("https://resy.com");
  // Resy uses auth_token / resy_auth_token / tt_resy session cookies
  const authCookie = cookies.find(
    (c) =>
      c.name === "auth_token" ||
      c.name === "resy_auth_token" ||
      c.name === "tt_resy" ||
      c.name === "resy-token" ||
      c.name === "_resy_session"
  );
  if (authCookie) {
    return { isLoggedIn: true };
  }
  return { isLoggedIn: false };
}

export function getCookiesPath(): string {
  return COOKIES_FILE;
}
