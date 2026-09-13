import { randomInt } from 'node:crypto';

/**
 * A password nobody chose and nobody who typed it into a form ever sees —
 * used wherever this app provisions a Firebase credential on somebody else's
 * behalf (a new staff hire, an invited guardian) rather than the account
 * holder choosing their own. One of each character class is forced in so it
 * clears a typical strength check outright rather than merely by chance.
 */
export function generateTemporaryPassword(): string {
  const classes = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%^&*-_'];
  const all = classes.join('');
  const pick = (charset: string) => charset[randomInt(charset.length)];

  const required = classes.map(pick);
  const rest = Array.from({ length: 8 }, () => pick(all));
  const chars = [...required, ...rest];

  // Fisher-Yates, so the forced characters are not always the first four.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
