import { deflateSync } from "node:zlib";
import { EditImageInput, GenerateImageInput, ImageProvider } from "@/lib/providers/types";

export class MockImageProvider implements ImageProvider {
  name = "mock";

  async generate(input: GenerateImageInput) {
    return {
      requestId: `mock_${Date.now()}`,
      revisedPrompt: input.prompt,
      images: Array.from({ length: input.params.n ?? 1 }, () => ({
        b64Json: createMockPng().toString("base64"),
        mimeType: "image/png",
        revisedPrompt: input.prompt,
      })),
    };
  }

  async edit(input: EditImageInput) {
    return this.generate(input);
  }
}

function createMockPng() {
  const width = 512;
  const height = 768;
  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y += 1) {
    const row = y * rowLength;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      const vignette = Math.max(0, 1 - Math.hypot((x - width / 2) / width, (y - height / 2) / height));
      raw[offset] = Math.round(22 + 120 * vignette);
      raw[offset + 1] = Math.round(24 + 60 * (x / width));
      raw[offset + 2] = Math.round(30 + 150 * (y / height));
      raw[offset + 3] = 255;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", createIhdr(width, height)),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createIhdr(width: number, height: number) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
