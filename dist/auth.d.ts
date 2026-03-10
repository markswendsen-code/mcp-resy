import type { BrowserContext } from "playwright";
export declare function saveCookies(context: BrowserContext): Promise<void>;
export declare function loadCookies(context: BrowserContext): Promise<boolean>;
export declare function clearCookies(): void;
export declare function hasStoredCookies(): boolean;
export declare function getAuthState(context: BrowserContext): Promise<{
    isLoggedIn: boolean;
    email?: string;
}>;
export declare function getCookiesPath(): string;
//# sourceMappingURL=auth.d.ts.map