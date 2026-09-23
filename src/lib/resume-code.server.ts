// Short, unguessable code used in recovery emails to bring a lead back
// exactly to the plan and details they left behind.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newResumeCode(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
