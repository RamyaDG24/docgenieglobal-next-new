import type { NextApiRequest, NextApiResponse } from "next";
import { TEST_MODE } from "@/lib/turnstile";
import { TURNSTILE_SITE_KEY, TURNSTILE_TEST_SITE_KEY } from "@/lib/turnstileConfig";

/**
 * Tells the contact form which Turnstile site key to use (public value).
 *
 * Order: test mode (TURNSTILE_TEST_MODE=1) → Cloudflare's test key;
 * else TURNSTILE_SITE_KEY from the server's settings (on AWS: the Lambda's
 * environment variables, changeable without a rebuild); else the key built
 * into the site (NEXT_PUBLIC_TURNSTILE_SITE_KEY, as on EC2 today).
 * An empty answer makes the form show "The security check could not load".
 */
export default function handler(req: NextApiRequest, res: NextApiResponse<{ siteKey: string }>) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).end();
    }
    const siteKey = TEST_MODE
        ? TURNSTILE_TEST_SITE_KEY
        : process.env.TURNSTILE_SITE_KEY || TURNSTILE_SITE_KEY;
    // Never cached (browser or CloudFront), so a changed key applies at once.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ siteKey });
}
