import { BinaryReader } from "@bufbuild/protobuf/wire";
type FieldHandlers<T> = Record<number, (message: T, reader: BinaryReader) => void>;
/**
 * Walk a length-delimited protobuf message, dispatching each field to its
 * handler by field number and skipping anything unrecognized (unknown fields,
 * future additions we don't care about).
 */
export declare function readMessage<T>(bytes: Uint8Array, base: T, fields: FieldHandlers<T>): T;
/** Read a length-delimited submessage field and decode it with `decode`. */
export declare function readSubmessage<T>(reader: BinaryReader, decode: (bytes: Uint8Array) => T): T;
/** Convert a protobuf varint field to a JS number, guarding against precision loss. */
export declare function readInt(reader: BinaryReader): number;
export {};
