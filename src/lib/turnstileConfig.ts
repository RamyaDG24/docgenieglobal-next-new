/**
 * Cloudflare Turnstile site key built into the pages (public; safe to ship to
 * the browser).
 *
 * The contact form first asks TURNSTILE_CONFIG_URL (below), which returns the
 * server setting TURNSTILE_SITE_KEY when set (e.g. the Lambda's environment
 * variables); this built-in NEXT_PUBLIC_TURNSTILE_SITE_KEY is the fallback (as
 * on EC2). Outside production it falls back to Cloudflare's documented
 * always-pass test key so the form works on localhost without a real key. In
 * production there is no such fallback: a missing key shows an error on the
 * form instead of silently skipping the check.
 */
export const TURNSTILE_SITE_KEY =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    (process.env.NODE_ENV === "production" ? "" : "1x00000000000000000000AA");

/** Cloudflare's documented always-pass test site key (public). */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

/**
 * Where the contact form asks for the site key when the page loads
 * (src/pages/api/turnstile-config.ts). Lets the key be changed in the server's
 * settings (e.g. the Lambda's environment variables) without a rebuild; the
 * build-time key above is the fallback.
 */
export const TURNSTILE_CONFIG_URL = "/api/turnstile-config/";

/** Action name sent with the token and checked on the server. */
export const TURNSTILE_CONTACT_ACTION = "contact_form";
