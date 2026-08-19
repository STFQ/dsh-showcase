/**
 * Minimal reader for DeepSeek Harness' concatenated Zstandard session frames.
 * The frame-boundary algorithm follows the MIT-licensed upstream implementation:
 * https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/session/session-persistence-jsonl/src/zstd.ts
 */
import { promisify } from "node:util";
import { zstdDecompress } from "node:zlib";
import { EXIT, ShowcaseError } from "./errors.js";

const ZSTD_MAGIC = 0xfd2fb528;
const MAX_DECOMPRESSED_BYTES = 128 * 1024 * 1024;
const zstdDecompressAsync = promisify(zstdDecompress);

interface FrameRange {
  readonly start: number;
  readonly end: number;
}

export function hasZstdMagic(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.readUInt32LE(0) === ZSTD_MAGIC;
}

export function scanZstdFrames(buffer: Buffer): {
  frames: FrameRange[];
  tornStart?: number;
} {
  const frames: FrameRange[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    const start = offset;
    if (buffer.length - offset < 4) return { frames, tornStart: start };
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
      throw new ShowcaseError(
        `Invalid Zstandard frame magic at byte ${offset}.`,
        EXIT.input,
      );
    }
    offset += 4;

    if (offset === buffer.length) return { frames, tornStart: start };
    const descriptor = buffer.readUInt8(offset++);
    if ((descriptor & 0x18) !== 0) {
      throw new ShowcaseError(
        `Invalid reserved Zstandard header bit at byte ${offset - 1}.`,
        EXIT.input,
      );
    }

    const contentSizeFlag = descriptor >>> 6;
    const singleSegment = (descriptor & 0x20) !== 0;
    const checksum = (descriptor & 0x04) !== 0;
    const dictionaryFlag = descriptor & 0x03;
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
    const contentSizeBytes =
      contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag;
    const remainingHeaderBytes =
      (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
    if (buffer.length - offset < remainingHeaderBytes)
      return { frames, tornStart: start };
    offset += remainingHeaderBytes;

    for (;;) {
      if (buffer.length - offset < 3) return { frames, tornStart: start };
      const blockHeader = buffer.readUIntLE(offset, 3);
      offset += 3;
      const lastBlock = (blockHeader & 1) !== 0;
      const blockType = (blockHeader >>> 1) & 0x03;
      const blockSize = blockHeader >>> 3;
      if (blockType === 0x03) {
        throw new ShowcaseError(
          `Invalid reserved Zstandard block at byte ${offset - 3}.`,
          EXIT.input,
        );
      }
      const payloadBytes = blockType === 0x01 ? 1 : blockSize;
      if (buffer.length - offset < payloadBytes)
        return { frames, tornStart: start };
      offset += payloadBytes;
      if (lastBlock) break;
    }

    if (checksum) {
      if (buffer.length - offset < 4) return { frames, tornStart: start };
      offset += 4;
    }
    frames.push({ start, end: offset });
  }

  return { frames };
}

export async function decompressConcatenatedZstd(
  buffer: Buffer,
): Promise<{ text: string; torn: boolean }> {
  const scan = scanZstdFrames(buffer);
  if (scan.frames.length === 0) {
    throw new ShowcaseError(
      "The Zstandard session contains no complete frame.",
      EXIT.input,
    );
  }
  const decoded: Buffer[] = [];
  let bytes = 0;
  for (const frame of scan.frames) {
    let part: Buffer;
    try {
      part = (await zstdDecompressAsync(
        buffer.subarray(frame.start, frame.end),
      )) as Buffer;
    } catch (error) {
      throw new ShowcaseError(
        `Could not validate Zstandard frame at byte ${frame.start}.`,
        EXIT.input,
        {
          cause: error,
        },
      );
    }
    bytes += part.length;
    if (bytes > MAX_DECOMPRESSED_BYTES) {
      throw new ShowcaseError(
        "Decompressed session exceeds the 128 MiB safety limit.",
        EXIT.input,
      );
    }
    decoded.push(part);
  }
  return {
    text: Buffer.concat(decoded, bytes).toString("utf8"),
    torn: scan.tornStart !== undefined,
  };
}
