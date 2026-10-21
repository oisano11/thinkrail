/**
 * Localizes a message the host sent us.
 *
 * The host formats its failures in English and sends the formatted text — it has no locale and no
 * catalog, and its tests assert the exact strings. So the client translates here, at the display
 * edge: `translate` handles the messages whose text is a catalog key verbatim, and `HOST_MESSAGES`
 * handles the templated ones by recovering the interpolated values (a path, a session id, a raw git
 * error) so the surrounding sentence can be translated with those values slotted back in.
 *
 * A message no catalog knows — a client-side error, or a host diagnostic nobody has translated —
 * comes back unchanged, which is also what makes this safe to wrap around arbitrary text.
 */
import { HOST_MESSAGES } from "./hostMessages.generated";
import { getLocale, type Locale } from "./locale";
import { translate } from "./translate";

/** `locale` defaults to the active one; tests pass it explicitly to avoid touching global state. */
export function translateHostMessage(message: string, locale: Locale = getLocale()): string {
	for (const { key, pattern } of HOST_MESSAGES) {
		const match = pattern.exec(message);
		if (match) return translate(key, match.slice(1), locale);
	}
	return translate(message, undefined, locale);
}
