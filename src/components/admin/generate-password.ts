const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// Largest multiple of the alphabet size below 256; bytes above it are dropped
// so every character is equally likely.
const LIMIT = 256 - (256 % ALPHABET.length);

/** A random 16 character password without look alike characters. */
export function generatePassword(length = 16) {
  let out = "";
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < LIMIT && out.length < length)
        out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}
