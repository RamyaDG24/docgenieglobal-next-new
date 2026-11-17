import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/**
 * Reads a value that only exists in the browser (window, navigator).
 * The server render and the first client render use `serverValue`, so the
 * HTML matches; React then re-renders with `read()` after hydration (the
 * same result as setting state in a mount effect, without the extra effect).
 * `read` is called on every render, so it always reflects the current value.
 */
export function useBrowserValue<T>(read: () => T, serverValue: T): T {
    return useSyncExternalStore(noSubscription, read, () => serverValue);
}
