/**
 * The tiny placeholder language school administrators write templates in:
 * `{firstName}`, `{schoolName}` and so on. Braces around a name nobody
 * supplied are left as typed, so a typo shows up in the message rather than
 * vanishing — a parent reading "Happy birthday, {firstname}!" is a clearer
 * signal than one reading "Happy birthday, !".
 */
export type TemplateVars = Record<string, string | number | null | undefined>;

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}/g, (match, name: string) => {
      const value = vars[name];
      return value === null || value === undefined ? match : String(value);
    })
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/**
 * What one SMS page holds. A message made only of GSM-7 characters fits 160
 * per page; one carrying anything outside that set (an emoji, a curly quote,
 * a naira sign) is sent as UCS-2 and drops to 70. KudiSMS bills per page, so
 * the settings screen tells the administrator how many pages their template
 * comes to, using the same arithmetic as here.
 */
const GSM7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENDED = '^{}\\[~]|€';

export function smsPageCount(text: string): number {
  let gsm = true;
  let length = 0;
  for (const char of text) {
    if (GSM7.includes(char)) length += 1;
    else if (GSM7_EXTENDED.includes(char)) length += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (!gsm) {
    const units = text.length;
    return units <= 70 ? 1 : Math.ceil(units / 67);
  }
  return length <= 160 ? 1 : Math.ceil(length / 153);
}
