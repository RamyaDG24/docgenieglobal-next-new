// Server-only: verifies a Cloudflare Turnstile token. Do not import from client code.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare rejects anything longer; checking first saves a network call. */
const MAX_TOKEN_LENGTH = 2048;

/**
 * True when a real secret is configured. Outside production we otherwise fall
 * back to Cloudflare's documented always-pass test secret, whose responses
 * carry no meaningful action or hostname, so those checks only apply here.
 */
/**
 * TURNSTILE_TEST_MODE=1 switches to Cloudflare's always-pass test keys on any
 * host, e.g. to test the contact form on the Lambda's own address. It turns the
 * bot check off in effect, so it is only for testing: remove it afterwards.
 * Empty keys alone never do this in production (see SECRET_KEY below).
 */
export const TEST_MODE = process.env.TURNSTILE_TEST_MODE === "1";
const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

const HAS_REAL_SECRET = !TEST_MODE && Boolean(process.env.TURNSTILE_SECRET_KEY);

/**
 * In production TURNSTILE_SECRET_KEY must be set, otherwise every submission
 * is rejected: failing closed is deliberate, so a missing key can never
 * quietly turn the bot check off.
 */
const SECRET_KEY = TEST_MODE
    ? TEST_SECRET_KEY
    : process.env.TURNSTILE_SECRET_KEY ||
      (process.env.NODE_ENV === "production" ? "" : TEST_SECRET_KEY);

/**
 * Frontend hostnames this deployment accepts tokens from, comma-separated in
 * TURNSTILE_HOSTNAMES. Production must list only the live hostnames, never
 * localhost: one widget serves every environment, so this is what stops a
 * token solved on another host being redeemed against production.
 */
const EXPECTED_HOSTNAMES = new Set(
    (process.env.TURNSTILE_HOSTNAMES ?? "")
        .split(",")
        .map((hostname) => hostname.trim())
        .filter(Boolean)
);

type SiteverifyResponse = {
    success: boolean;
    action?: string;
    hostname?: string;
    "error-codes"?: string[];
};

/**
 * Asks Cloudflare whether the token came from a real visitor.
 *
 * Tokens are single-use and expire after 5 minutes, so the form resets the
 * widget after every submit attempt. Cloudflare itself rejects a replayed
 * token (timeout-or-duplicate).
 *
 * @param token          The token the widget handed the browser.
 * @param expectedAction The action the widget was rendered with.
 * @param remoteIp       The visitor's IP, if known (optional extra signal).
 */
export async function verifyTurnstile(
    token: unknown,
    expectedAction: string,
    remoteIp?: string
): Promise<boolean> {
    if (TEST_MODE) {
        console.warn("Turnstile: TEST MODE is on (TURNSTILE_TEST_MODE=1); test keys accepted. Remove it after testing.");
    }
    if (!SECRET_KEY) {
        console.error("Turnstile: TURNSTILE_SECRET_KEY is not set; rejecting submission.");
        return false;
    }
    if (HAS_REAL_SECRET && EXPECTED_HOSTNAMES.size === 0) {
        console.error("Turnstile: TURNSTILE_HOSTNAMES is not set; rejecting submission.");
        return false;
    }
    if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
        return false;
    }

    const body = new URLSearchParams({ secret: SECRET_KEY, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);

    let data: SiteverifyResponse;
    try {
        const res = await fetch(VERIFY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`siteverify ${res.status}`);
        data = (await res.json()) as SiteverifyResponse;
    } catch (err) {
        console.error("Turnstile: verification request failed:", err);
        return false;
    }

    if (!data.success) return false;
    if (HAS_REAL_SECRET) {
        if (data.action !== expectedAction) return false;
        if (!data.hostname || !EXPECTED_HOSTNAMES.has(data.hostname)) return false;
    }
    return true;
}
