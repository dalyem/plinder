// Unguessable identifiers. Session codes use a lowercase alphabet without
// confusable characters so the URL is easy to read aloud; secrets use the
// full alphabet for more entropy per character.

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no i/l/o/0/1
const SECRET_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomString(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** ~49 bits of entropy — the shareable session URL component. */
export function newSessionCode(): string {
  return randomString(CODE_ALPHABET, 10);
}

/** ~143 bits — hostKey / participantSecret / authSecret. */
export function newSecret(): string {
  return randomString(SECRET_ALPHABET, 24);
}
