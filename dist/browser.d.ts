export declare function checkAuth(): Promise<{
    isLoggedIn: boolean;
    email?: string;
}>;
export declare function login(params: {
    email: string;
    password: string;
}): Promise<{
    success: boolean;
    email?: string;
    error?: string;
}>;
export declare function searchVenues(params: {
    location: string;
    query?: string;
    date?: string;
    partySize?: number;
}): Promise<{
    success: boolean;
    venues?: object[];
    error?: string;
}>;
export declare function getVenueDetails(venueId: string): Promise<{
    success: boolean;
    venue?: object;
    error?: string;
}>;
export declare function checkAvailability(params: {
    venueId: string;
    date: string;
    time: string;
    partySize: number;
}): Promise<{
    success: boolean;
    slots?: object[];
    venueName?: string;
    error?: string;
}>;
export declare function makeReservation(params: {
    venueId: string;
    date: string;
    time: string;
    partySize: number;
    specialRequests?: string;
    confirm: boolean;
}): Promise<{
    success: boolean;
    reservation?: object;
    requiresConfirmation?: boolean;
    preview?: object;
    error?: string;
}>;
export declare function getReservations(): Promise<{
    success: boolean;
    reservations?: object[];
    error?: string;
}>;
export declare function cancelReservation(params: {
    reservationId: string;
    confirm: boolean;
}): Promise<{
    success: boolean;
    requiresConfirmation?: boolean;
    message?: string;
    error?: string;
}>;
export declare function getWaitlist(venueId: string): Promise<{
    success: boolean;
    waitlist?: object;
    error?: string;
}>;
export declare function joinWaitlist(params: {
    venueId: string;
    partySize: number;
    confirm: boolean;
}): Promise<{
    success: boolean;
    requiresConfirmation?: boolean;
    message?: string;
    waitlistEntry?: object;
    error?: string;
}>;
export declare function cleanup(): Promise<void>;
//# sourceMappingURL=browser.d.ts.map