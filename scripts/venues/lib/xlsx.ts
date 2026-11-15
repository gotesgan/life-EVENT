/**
 * A minimal, dependency-free `.xlsx` reader.
 *
 * The venue workbooks are the only spreadsheets this repository reads, and the
 * project deliberately keeps its dependency list short (see AGENTS.md). An
 * `.xlsx` file is a ZIP of XML parts, so the whole job is: read the central
 * directory, inflate the three parts we need (`sharedStrings.xml`,
 * `workbook.xml`, `worksheets/*.xml`) and pull text out of them.
 *
 * Scope, stated so nobody mistakes this for a general library:
 *  * cell values only — no styles, formulas, merged cells or dates;
 *  * shared strings, inline strings and raw numeric values;
 *  * stored (method 0) and deflated (method 8) entries, which is everything
 *    Excel, Numbers and LibreOffice write.
 */

import { inflateRawSync } from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function readZipEntries(buffer: Buffer): Map<string, ZipEntry> {
  // The End Of Central Directory record sits at the tail, after a comment of
  // unknown length, so scan backwards for its signature.
  let eocd = -1;
  for (
    let offset = buffer.length - 22;
    offset >= 0 && offset > buffer.length - 66_000;
    offset -= 1
  ) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      eocd = offset;
      break;
    }
  }
  if (eocd === -1) throw new Error('Not a ZIP archive: no end-of-central-directory record.');

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      throw new Error('Corrupt ZIP central directory.');
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);

    entries.set(name, { name, method, compressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== LOCAL_SIGNATURE) {
    throw new Error(`Corrupt ZIP local header for ${entry.name}.`);
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const data = buffer.subarray(start, start + entry.compressedSize);

  if (entry.method === 0) return Buffer.from(data);
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`Unsupported ZIP compression method ${entry.method} for ${entry.name}.`);
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeXmlText(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return ENTITIES[entity] ?? match;
  });
}

/** Concatenates every `<t>` run inside a shared-string item. */
function readSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  for (const item of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const body = item[1] ?? '';
    let text = '';
    for (const run of body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
      text += decodeXmlText(run[1] ?? '');
    }
    strings.push(text);
  }
  return strings;
}

function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? 'A';
  let index = 0;
  for (const character of letters) {
    index = index * 26 + (character.charCodeAt(0) - 64);
  }
  return index - 1;
}

function readSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];

  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cellMatch of (rowMatch[1] ?? '').matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1] ?? '';
      const body = cellMatch[2] ?? '';
      const reference = /r="([A-Z]+\d+)"/.exec(attributes)?.[1] ?? 'A1';
      const type = /t="([^"]+)"/.exec(attributes)?.[1] ?? 'n';

      let value = '';
      if (type === 'inlineStr') {
        for (const run of body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
          value += decodeXmlText(run[1] ?? '');
        }
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '';
        value = type === 's' ? (sharedStrings[Number(raw)] ?? '') : decodeXmlText(raw);
      }

      cells[columnIndex(reference)] = value.trim();
    }
    rows.push(cells);
  }

  return rows;
}

export interface WorkbookSheet {
  name: string;
  rows: string[][];
}

export function readWorkbook(buffer: Buffer): WorkbookSheet[] {
  const entries = readZipEntries(buffer);
  const read = (name: string): string | null => {
    const entry = entries.get(name);
    return entry ? readZipEntry(buffer, entry).toString('utf8') : null;
  };

  const sharedStringsXml = read('xl/sharedStrings.xml');
  const sharedStrings = sharedStringsXml ? readSharedStrings(sharedStringsXml) : [];

  const workbookXml = read('xl/workbook.xml');
  if (!workbookXml) throw new Error('Workbook is missing xl/workbook.xml.');

  const relationshipsXml = read('xl/_rels/workbook.xml.rels') ?? '';
  const targets = new Map<string, string>();
  for (const match of relationshipsXml.matchAll(/<Relationship\s([^>]*)\/>/g)) {
    const attributes = match[1] ?? '';
    const id = /Id="([^"]+)"/.exec(attributes)?.[1];
    const target = /Target="([^"]+)"/.exec(attributes)?.[1];
    if (id && target) targets.set(id, target);
  }

  const sheets: WorkbookSheet[] = [];
  for (const match of workbookXml.matchAll(/<sheet\s([^>]*)\/>/g)) {
    const attributes = match[1] ?? '';
    const name = decodeXmlText(/name="([^"]*)"/.exec(attributes)?.[1] ?? 'Sheet');
    const relationshipId = /r:id="([^"]+)"/.exec(attributes)?.[1];
    const target = relationshipId ? targets.get(relationshipId) : undefined;
    if (!target) continue;

    const path = target.startsWith('/')
      ? target.slice(1)
      : target.startsWith('xl/')
        ? target
        : `xl/${target}`;
    const sheetXml = read(path);
    if (!sheetXml) continue;

    sheets.push({ name, rows: readSheetRows(sheetXml, sharedStrings) });
  }

  return sheets;
}
