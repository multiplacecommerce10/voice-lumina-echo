// Make.com forwarding is OFF by default. Make is not an active integration yet.
// The forwarder code in `make.server.ts` is preserved for future activation, but
// it must not be imported or called unless this flag is explicitly enabled.
//
// Enable by setting the server env var MAKE_FORWARDING_ENABLED="true".
export function isMakeForwardingEnabled(): boolean {
  return process.env.MAKE_FORWARDING_ENABLED === "true";
}

/** Audit/log marker used when the flag keeps Make off. */
export const MAKE_DISABLED_RESULT = {
  make_forwarded: false,
  make_disabled_by_flag: true,
} as const;
