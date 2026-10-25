/**
 * dsh-webview — host half.
 *
 * The host entry exists only so the client-modules loader sees an enabled
 * Loader entry carrying a `dsh.client` declaration; every bit of UI lives in
 * ./client.js. This half deliberately does nothing: no providers, no requests,
 * no services.
 */
export const name = 'dsh-webview'
export const inject = []

export function apply() {}
