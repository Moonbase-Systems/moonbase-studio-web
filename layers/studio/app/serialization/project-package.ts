export type PackagedAsset = {
  key: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type DecodedProjectPackage =
  | { ok: true; projectJson: string; assets: PackagedAsset[] }
  | { ok: false; reason: 'not-package' | 'invalid' };

type ZipEntry = {
  name: string;
  data: Uint8Array;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value;
}

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const concat = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
};

/** ZIP store method, no compression. Image, video and audio bytes are already compressed. */
const encodeZip = (entries: ZipEntry[]): Uint8Array => {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + nameBytes.length + entry.data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(entry.data, 30 + nameBytes.length);
    locals.push(local);

    const header = new Uint8Array(46 + nameBytes.length);
    const headerView = new DataView(header.buffer);
    headerView.setUint32(0, 0x02014b50, true);
    headerView.setUint16(4, 20, true);
    headerView.setUint16(6, 20, true);
    headerView.setUint16(8, 0x0800, true);
    headerView.setUint32(16, crc, true);
    headerView.setUint32(20, entry.data.length, true);
    headerView.setUint32(24, entry.data.length, true);
    headerView.setUint16(28, nameBytes.length, true);
    headerView.setUint32(42, offset, true);
    header.set(nameBytes, 46);
    central.push(header);
    offset += local.length;
  }

  const directory = concat(central);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, directory.length, true);
  endView.setUint32(16, offset, true);
  return concat([...locals, directory, end]);
};

const findEndOfCentralDirectory = (bytes: Uint8Array): number => {
  const earliest = Math.max(0, bytes.length - 22 - 65535);
  for (let index = bytes.length - 22; index >= earliest; index -= 1) {
    if (bytes[index] === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === 0x05 && bytes[index + 3] === 0x06) {
      return index;
    }
  }
  return -1;
};

const decodeZip = (bytes: Uint8Array): ZipEntry[] | null => {
  const endOffset = findEndOfCentralDirectory(bytes);
  if (endOffset < 0) {
    return null;
  }
  const end = new DataView(bytes.buffer, bytes.byteOffset + endOffset, 22);
  const count = end.getUint16(10, true);
  const directoryOffset = end.getUint32(16, true);
  const entries: ZipEntry[] = [];
  let cursor = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > bytes.length) {
      return null;
    }
    const header = new DataView(bytes.buffer, bytes.byteOffset + cursor, 46);
    if (header.getUint32(0, true) !== 0x02014b50) {
      return null;
    }
    if (header.getUint16(10, true) !== 0) {
      return null;
    }
    const nameLength = header.getUint16(28, true);
    const extraLength = header.getUint16(30, true);
    const commentLength = header.getUint16(32, true);
    const size = header.getUint32(24, true);
    const localOffset = header.getUint32(42, true);
    const name = textDecoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (localOffset + 30 > bytes.length) {
      return null;
    }
    const local = new DataView(bytes.buffer, bytes.byteOffset + localOffset, 30);
    if (local.getUint32(0, true) !== 0x04034b50) {
      return null;
    }
    const localNameLength = local.getUint16(26, true);
    const localExtraLength = local.getUint16(28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + size > bytes.length) {
      return null;
    }
    entries.push({ name, data: bytes.slice(dataOffset, dataOffset + size) });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

const PACKAGE_FILENAME_FALLBACK = 'project';

export const projectPackageFilename = (name: string): string => {
  const safe = name
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `${safe || PACKAGE_FILENAME_FALLBACK}.moonbase`;
};

type AssetManifest = {
  files: { key: string; name: string; mimeType: string }[];
};

const readManifest = (bytes: Uint8Array): AssetManifest | null => {
  try {
    const parsed = JSON.parse(textDecoder.decode(bytes)) as unknown;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { files?: unknown }).files)) {
      return null;
    }
    const files = (parsed as { files: unknown[] }).files.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }
      const file = item as { key?: unknown; name?: unknown; mimeType?: unknown };
      if (typeof file.key !== 'string' || typeof file.name !== 'string' || typeof file.mimeType !== 'string') {
        return [];
      }
      return [{ key: file.key, name: file.name, mimeType: file.mimeType }];
    });
    if (files.length !== (parsed as { files: unknown[] }).files.length) {
      return null;
    }
    return { files };
  } catch {
    return null;
  }
};

/** One transferable file: project JSON plus the bytes behind each storage key. */
export const encodeProjectPackage = (projectJson: string, assets: PackagedAsset[]): Uint8Array => {
  const manifest: AssetManifest = {
    files: assets.map((asset, index) => ({
      key: asset.key,
      name: `assets/${index}`,
      mimeType: asset.mimeType,
    })),
  };
  return encodeZip([
    { name: 'project.json', data: textEncoder.encode(projectJson) },
    { name: 'assets.json', data: textEncoder.encode(JSON.stringify(manifest)) },
    ...assets.map((asset, index) => ({ name: `assets/${index}`, data: asset.bytes })),
  ]);
};

export const decodeProjectPackage = (bytes: Uint8Array): DecodedProjectPackage => {
  const entries = decodeZip(bytes);
  if (!entries) {
    return { ok: false, reason: 'not-package' };
  }
  const project = entries.find((entry) => entry.name === 'project.json');
  const manifestEntry = entries.find((entry) => entry.name === 'assets.json');
  if (!project || !manifestEntry) {
    return { ok: false, reason: 'invalid' };
  }
  const manifest = readManifest(manifestEntry.data);
  if (!manifest) {
    return { ok: false, reason: 'invalid' };
  }
  const byName = new Map(entries.map((entry) => [entry.name, entry.data]));
  const assets: PackagedAsset[] = [];
  for (const file of manifest.files) {
    const data = byName.get(file.name);
    if (!data) {
      return { ok: false, reason: 'invalid' };
    }
    assets.push({ key: file.key, mimeType: file.mimeType, bytes: data });
  }
  return { ok: true, projectJson: textDecoder.decode(project.data), assets };
};
