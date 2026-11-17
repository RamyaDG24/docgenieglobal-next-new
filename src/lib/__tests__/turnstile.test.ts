/** @jest-environment node */
// Turnstile modes: test mode switch, empty keys, real keys; and the
// /api/turnstile-config route the contact form reads its site key from.
import type { NextApiRequest, NextApiResponse } from "next";

const ENV = { ...process.env };
type Env = Record<string, string | undefined>;

// Each call loads the modules afresh, so they read the given settings.
async function load(env: Env) {
    process.env = { ...ENV, ...env } as NodeJS.ProcessEnv;
    let mod: typeof import("@/lib/turnstile") | undefined;
    let route: typeof import("@/pages/api/turnstile-config").default | undefined;
    await jest.isolateModulesAsync(async () => {
        mod = await import("@/lib/turnstile");
        route = (await import("@/pages/api/turnstile-config")).default;
    });
    return { verify: mod!.verifyTurnstile, route: route! };
}

function siteverifyReturns(body: object) {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => body });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
}

function callRoute(route: Awaited<ReturnType<typeof load>>["route"], method = "GET") {
    const res = { headers: {} as Record<string, string>, statusCode: 0, body: undefined as unknown,
        setHeader(k: string, v: string) { this.headers[k] = v; return this; },
        status(c: number) { this.statusCode = c; return this; },
        json(b: unknown) { this.body = b; return this; },
        end() { return this; } };
    route({ method } as NextApiRequest, res as unknown as NextApiResponse<{ siteKey: string }>);
    return res;
}

afterEach(() => { process.env = { ...ENV }; jest.restoreAllMocks(); });

describe("verifyTurnstile", () => {
    beforeEach(() => { jest.spyOn(console, "error").mockImplementation(() => {}); jest.spyOn(console, "warn").mockImplementation(() => {}); });

    test("production, empty keys, no test mode: rejected without asking Cloudflare", async () => {
        const fetchMock = siteverifyReturns({ success: true });
        const { verify } = await load({ NODE_ENV: "production", TURNSTILE_SECRET_KEY: "", TURNSTILE_TEST_MODE: undefined });
        expect(await verify("tok", "contact_form")).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test("test mode: uses Cloudflare's test secret, on any host", async () => {
        const fetchMock = siteverifyReturns({ success: true, hostname: "example.com", action: "" });
        const { verify } = await load({ NODE_ENV: "production", TURNSTILE_TEST_MODE: "1", TURNSTILE_SECRET_KEY: "real-secret-ignored", TURNSTILE_HOSTNAMES: "www.docgenieglobal.com" });
        expect(await verify("tok", "contact_form")).toBe(true);
        const sent = String(fetchMock.mock.calls[0][1].body);
        expect(sent).toContain("secret=1x0000000000000000000000000000000AA");
        expect(console.warn).toHaveBeenCalled();
    });

    test("TURNSTILE_TEST_MODE other than 1 is ignored", async () => {
        siteverifyReturns({ success: true });
        const { verify } = await load({ NODE_ENV: "production", TURNSTILE_TEST_MODE: "true", TURNSTILE_SECRET_KEY: "" });
        expect(await verify("tok", "contact_form")).toBe(false);
    });

    test("real keys: host and action must match", async () => {
        siteverifyReturns({ success: true, hostname: "abc.lambda-url.ap-south-1.on.aws", action: "contact_form" });
        let { verify } = await load({ NODE_ENV: "production", TURNSTILE_SECRET_KEY: "real-secret", TURNSTILE_HOSTNAMES: "www.docgenieglobal.com,docgenieglobal.com" });
        expect(await verify("tok", "contact_form")).toBe(false);
        siteverifyReturns({ success: true, hostname: "www.docgenieglobal.com", action: "contact_form" });
        ({ verify } = await load({ NODE_ENV: "production", TURNSTILE_SECRET_KEY: "real-secret", TURNSTILE_HOSTNAMES: "www.docgenieglobal.com,docgenieglobal.com" }));
        expect(await verify("tok", "contact_form")).toBe(true);
    });

    test("development with empty keys keeps using test keys (npm run dev)", async () => {
        const fetchMock = siteverifyReturns({ success: true });
        const { verify } = await load({ NODE_ENV: "development", TURNSTILE_SECRET_KEY: "" });
        expect(await verify("tok", "contact_form")).toBe(true);
        expect(String(fetchMock.mock.calls[0][1].body)).toContain("secret=1x0000000000000000000000000000000AA");
    });
});

describe("/api/turnstile-config", () => {
    test("test mode: Cloudflare's test site key", async () => {
        const res = callRoute((await load({ NODE_ENV: "production", TURNSTILE_TEST_MODE: "1", TURNSTILE_SITE_KEY: "0x4AAAAreal" })).route);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ siteKey: "1x00000000000000000000AA" });
        expect(res.headers["Cache-Control"]).toBe("no-store");
    });

    test("TURNSTILE_SITE_KEY from the server's settings", async () => {
        const res = callRoute((await load({ NODE_ENV: "production", TURNSTILE_SITE_KEY: "0x4AAAAfromLambda" })).route);
        expect(res.body).toEqual({ siteKey: "0x4AAAAfromLambda" });
    });

    test("nothing set in production: empty (the form then shows its error)", async () => {
        const res = callRoute((await load({ NODE_ENV: "production", TURNSTILE_SITE_KEY: "", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "" })).route);
        expect(res.body).toEqual({ siteKey: "" });
    });

    test("only GET/HEAD", async () => {
        expect(callRoute((await load({})).route, "POST").statusCode).toBe(405);
    });
});
