import type { Locale } from "@/lib/locale";
import { dirFor } from "@/lib/locale";

/**
 * The frame every KaguOs email is drawn in, and the reason it looks nothing
 * like the rest of the codebase.
 *
 * ── Why tables and inline styles ───────────────────────────────────────────
 *
 * Mail clients are not browsers. Outlook on Windows renders HTML through Word,
 * Gmail strips `<style>` blocks it doesn't like along with anything they were
 * holding, and no client of consequence supports flexbox or grid. A table with
 * inline styles is the one layout every reader agrees on, and it has been for
 * twenty years. Tailwind cannot help here — the classes never arrive.
 *
 * ── Why the colours are hex and not the app's tokens ───────────────────────
 *
 * `globals.css` states the palette in `oklch()`, which is correct for a browser
 * in 2026 and unreadable to Outlook, Apple Mail and every Android client — an
 * unparsed colour is a transparent one, and a transparent foreground on a
 * transparent background is an empty email. These are the same tokens converted
 * once to sRGB hex. If the palette moves in `globals.css`, it has to be moved
 * here too; that duplication is the price of the medium.
 *
 * ── Why dark ───────────────────────────────────────────────────────────────
 *
 * Because the link goes to a dark portal, and an email that flashes white
 * before handing the reader a black page reads as two different companies. Dark
 * is also the safer direction: a dark-mode client leaves a dark email alone,
 * where a light one gets its colours inverted by whichever heuristic the client
 * happens to use that month.
 */

const C = {
  page: "#070d0a",
  card: "#111815",
  line: "#1d2521",
  ink: "#ebf0ed",
  muted: "#b1bab5",
  faint: "#8d9490",
  primary: "#73edb1",
  primaryInk: "#021109",
  track: "#1d2521",
} as const;

/**
 * No web fonts: `@font-face` is dropped by most clients and the ones that keep
 * it charge a render delay for it. The Arabic faces are named ahead of the
 * Latin ones for the RTL half, so an Arabic email is set in a face the reader's
 * own system actually has rather than in whatever the Latin stack falls back to.
 */
const FONT_LTR =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_RTL =
  "'SF Arabic', 'Geeza Pro', 'Segoe UI', Tahoma, 'Noto Naskh Arabic', Arial, sans-serif";

/**
 * Everything interpolated into the HTML goes through here first.
 *
 * Project names, client names and the note a producer types in the send box are
 * all free text that ends up inside an attribute or a tag. An unescaped `&` is
 * a broken entity in a mail client's parser; an unescaped `<` is worse.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailBlock =
  /** One sentence of body copy. */
  | { kind: "paragraph"; text: string }
  /** A labelled progress bar — the headline number of both client emails. */
  | { kind: "meter"; label: string; pct: number; caption?: string }
  /** A bordered aside: what the producer typed in the send box, in their words. */
  | { kind: "note"; label: string; text: string }
  /** A short list of facts — outstanding sections, phases that moved. */
  | { kind: "list"; items: string[] };

export type RenderedEmail = { html: string; text: string };

function paragraphHtml(text: string, align: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.muted};text-align:${align};">${escapeHtml(text)}</p>`;
}

/**
 * A progress bar built from two nested tables.
 *
 * A `<div>` with a width percentage and a background is what this would be on
 * the web; in Outlook it is a full-width block with no background at all. Table
 * cells with a `bgcolor` attribute and a `width` attribute are the one bar
 * every client draws, and the number is repeated in text beside it so a client
 * that draws none still tells the reader where the build is.
 *
 * ⚠️ The bar's own table is pinned `dir="ltr"` and the two cells are SWAPPED in
 * the source for Arabic, rather than left in reading order under a `dir="rtl"`
 * that would flip them. Both produce a right-anchored bar in a browser; only
 * one of them does it in a client that ignores `dir` on a table, and the
 * failure mode of the other is a bar that fills backwards — which reads as 39%
 * done to an Arabic client looking at 61%. The order is stated outright so no
 * renderer has to be trusted with it.
 */
function meterHtml(
  label: string,
  pct: number,
  caption: string | undefined,
  align: string,
  rtl: boolean
): string {
  const filled = Math.max(0, Math.min(100, Math.round(pct)));
  const empty = 100 - filled;
  // A zero-width cell still renders a hairline in some clients, so the two
  // halves are only emitted when they have something to show.
  const filledCell =
    filled > 0
      ? `<td width="${filled}%" bgcolor="${C.primary}" style="background-color:${C.primary};height:8px;line-height:8px;font-size:0;">&nbsp;</td>`
      : "";
  const emptyCell =
    empty > 0
      ? `<td width="${empty}%" bgcolor="${C.track}" style="background-color:${C.track};height:8px;line-height:8px;font-size:0;">&nbsp;</td>`
      : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr>
    <td style="padding:0 0 8px;font-size:13px;color:${C.faint};text-align:${align};">${escapeHtml(label)}</td>
  </tr>
  <tr>
    <td style="padding:0 0 8px;font-size:28px;font-weight:700;line-height:1.1;color:${C.ink};text-align:${align};">${filled}%</td>
  </tr>
  <tr>
    <td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="ltr">
        <tr>${rtl ? emptyCell + filledCell : filledCell + emptyCell}</tr>
      </table>
    </td>
  </tr>
  ${
    caption
      ? `<tr><td style="padding:8px 0 0;font-size:13px;color:${C.faint};text-align:${align};">${escapeHtml(caption)}</td></tr>`
      : ""
  }
</table>`;
}

function noteHtml(label: string, text: string, align: string, rtl: boolean): string {
  const side = rtl ? "border-right" : "border-left";
  const pad = rtl ? "padding:0 14px 0 0;" : "padding:0 0 0 14px;";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr>
    <td style="${side}:2px solid ${C.primary};${pad}">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:${C.faint};text-align:${align};">${escapeHtml(label)}</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${C.ink};text-align:${align};white-space:pre-wrap;">${escapeHtml(text)}</p>
    </td>
  </tr>
</table>`;
}

function listHtml(items: string[], align: string, rtl: boolean): string {
  const rows = items
    .map(
      (item) =>
        `<tr><td style="padding:0 0 8px;font-size:15px;line-height:1.5;color:${C.muted};text-align:${align};">${rtl ? "" : "&#8226;&nbsp;&nbsp;"}${escapeHtml(item)}${rtl ? "&nbsp;&nbsp;&#8226;" : ""}</td></tr>`
    )
    .join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">${rows}</table>`;
}

function blockHtml(block: EmailBlock, align: string, rtl: boolean): string {
  switch (block.kind) {
    case "paragraph":
      return paragraphHtml(block.text, align);
    case "meter":
      return meterHtml(block.label, block.pct, block.caption, align, rtl);
    case "note":
      return noteHtml(block.label, block.text, align, rtl);
    case "list":
      return listHtml(block.items, align, rtl);
  }
}

function blockText(block: EmailBlock): string {
  switch (block.kind) {
    case "paragraph":
      return block.text;
    case "meter":
      return `${block.label}: ${Math.round(block.pct)}%${block.caption ? `\n${block.caption}` : ""}`;
    case "note":
      return `${block.label}:\n${block.text}`;
    case "list":
      return block.items.map((item) => `- ${item}`).join("\n");
  }
}

export type EmailShell = {
  locale: Locale;
  /**
   * The grey line an inbox prints after the subject. Left unset it fills with
   * whatever the first markup happens to be — usually "View this email in your
   * browser" or, here, a wordmark — so it is always written deliberately.
   */
  preheader: string;
  heading: string;
  blocks: EmailBlock[];
  cta: { label: string; href: string };
  /** The line under the rule: who sent this and why they have your address. */
  footer: string;
};

/** Draw one email. Returns both parts; every send needs both. */
export function renderEmail(shell: EmailShell): RenderedEmail {
  const rtl = dirFor(shell.locale) === "rtl";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const font = rtl ? FONT_RTL : FONT_LTR;
  const href = escapeHtml(shell.cta.href);

  const body = shell.blocks.map((block) => blockHtml(block, align, rtl)).join("\n      ");

  const html = `<!doctype html>
<html lang="${shell.locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(shell.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.page};" bgcolor="${C.page}">
  <!-- The preheader. Hidden by every rule a mail client honours at once,
       because no single one of them works everywhere, then padded with
       zero-width joiners so the client cannot pull the footer up into the
       preview to fill the space. -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.page};">
    ${escapeHtml(shell.preheader)}
    ${"&#8204;&nbsp;".repeat(60)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background-color:${C.page};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <tr>
            <td dir="ltr" align="${rtl ? "right" : "left"}" style="padding:0 0 20px;font-family:${FONT_LTR};font-size:15px;font-weight:600;letter-spacing:-0.01em;color:${C.ink};">
              Kagu<span style="color:${C.primary};">Os</span>
            </td>
          </tr>

          <tr>
            <td bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.line};border-radius:12px;padding:28px 28px 24px;font-family:${font};" dir="${dir}">
              <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;font-weight:600;color:${C.ink};text-align:${align};">${escapeHtml(shell.heading)}</h1>
              ${body}

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
                <tr>
                  <td bgcolor="${C.primary}" style="background-color:${C.primary};border-radius:8px;">
                    <a href="${href}" style="display:inline-block;padding:11px 22px;font-family:${font};font-size:15px;font-weight:600;color:${C.primaryInk};text-decoration:none;">${escapeHtml(shell.cta.label)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 4px 0;font-family:${font};font-size:12px;line-height:1.6;color:${C.faint};text-align:${align};" dir="${dir}">
              ${escapeHtml(shell.footer)}
              <br>
              <!-- The bare URL, because a client that blocks the button leaves
                   the reader with nothing to click and no address to type. -->
              <a href="${href}" style="color:${C.faint};text-decoration:underline;" dir="ltr">${href}</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    shell.heading,
    "",
    ...shell.blocks.map(blockText),
    "",
    `${shell.cta.label}: ${shell.cta.href}`,
    "",
    shell.footer,
  ].join("\n");

  return { html, text };
}
