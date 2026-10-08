/**
 * True if the text matches an internal agy system message envelope
 * (e.g. `<SYSTEM_MESSAGE>\n[Message]...` or `[Message] timestamp=... sender=...`).
 */
export declare function isSystemMessage(text: string): boolean;
/**
 * True while a growing text value could still become an internal system
 * message envelope. Streaming callers defer these prefixes until they can be
 * classified, avoiding emission of a partial internal marker.
 */
export declare function isSystemMessagePrefix(text: string): boolean;
