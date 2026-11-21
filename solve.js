// A fast drop-in replacement for make.fun's csv-reader 1.0.0, written for
// the csv-reader-speed-01 bounty. run(input) returns exactly the answer
// csv-reader 1.0.0 returns for every input {text, header}: the value
// {columns, rows, errors} under csv-reader's broken-row policy —
//
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is
//     no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not
//     doubled ("" inside it is one quote; each CRLF or lone CR inside it
//     is read as LF); what follows its closing quote, up to the next
//     comma or line break, is appended as it stands (quote_junk, when
//     the field ends); a quote that never closes is a literal character
//     and the text after it is read again as unquoted
//     (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields
//     stay strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows
//     holds the records after it (every record when header is false),
//     each padded with "" (short_row, with fields: its count) or cut
//     (long_row, with extra: the cut fields) to the first record's
//     width;
//   - each error is {code, line, row}: line the 1-based line its record
//     starts on (every LF, CRLF and lone CR inside quotes counted), row
//     its record's index in rows (null for the header), in the order
//     met.
//
// Where the reference builds every field a character at a time (a
// string concatenation per character), this reader walks the text once
// and slices each field out of it whole: an unquoted field is a tight
// charCodeAt scan between slice points, a quoted field is found with
// indexOf and sliced when its content needs no edits. The field just
// read is passed back in shared slots, not a fresh array. Pure: nothing
// is kept from one call to the next.

// How a field ended.
const COMMA = 0;
const BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows
  // it takes (null: the header). Every error of the record carries both.
  let recordLine = 1;
  let recordRow = null;

  // The field just read, in shared slots: the two readers are never
  // live at once (readQuoted hands its junk tail wholly to
  // readUnquoted), so one set of slots serves both.
  let fValue = '';
  let fEnded = END;
  let fAdded = 0;

  // Reads unquoted characters from pos, on top of the value already in
  // hand, up to the next comma or line break. A CR not followed by LF is
  // dropped (stray_cr). Leaves the field in the shared slots;
  // fAdded counts the characters kept by this call.
  function readUnquoted(value) {
    let added = 0;
    let seg = pos; // start of the segment not yet copied into value
    let i = pos;
    for (;;) {
      if (i >= n) {
        fValue = value + text.slice(seg);
        fAdded = added + (n - seg);
        fEnded = END;
        pos = n;
        return;
      }
      const c = text.charCodeAt(i);
      if (c === 44) {
        fValue = value + text.slice(seg, i);
        fAdded = added + (i - seg);
        fEnded = COMMA;
        pos = i + 1;
        return;
      }
      if (c === 10) {
        fValue = value + text.slice(seg, i);
        fAdded = added + (i - seg);
        fEnded = BREAK;
        pos = i + 1;
        line += 1;
        return;
      }
      if (c === 13) {
        if (text.charCodeAt(i + 1) === 10) {
          fValue = value + text.slice(seg, i);
          fAdded = added + (i - seg);
          fEnded = BREAK;
          pos = i + 2;
          line += 1;
          return;
        }
        // A lone CR outside quotes: an error, the character dropped,
        // and the field goes on.
        value += text.slice(seg, i);
        added += i - seg;
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        i += 1;
        seg = i;
        continue;
      }
      i += 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const start = pos + 1; // first content character
    // Find the closing quote: the first quote that is not doubled.
    let i = start;
    let close = -1;
    let doubled = false;
    for (;;) {
      const q = text.indexOf('"', i);
      if (q === -1) break;
      if (text.charCodeAt(q + 1) === 34) { doubled = true; i = q + 2; continue; }
      close = q;
      break;
    }
    if (close === -1) {
      // The quote never closes: it is a literal character, and the text
      // after it is read again as unquoted.
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      pos = start;
      readUnquoted('"');
      return;
    }
    const crAt = text.indexOf('\r', start);
    const hasCR = crAt !== -1 && crAt < close;
    let value;
    if (!doubled && !hasCR) {
      // Clean content: one slice; only the line count needs a pass.
      value = text.slice(start, close);
      let k = start;
      for (;;) {
        const m = text.indexOf('\n', k);
        if (m === -1 || m >= close) break;
        line += 1;
        k = m + 1;
      }
    } else {
      // Content needing edits: "" is one quote, and each CRLF or lone
      // CR is one LF. Build from slices between the edited points.
      const parts = [];
      let seg = start;
      let j = start;
      while (j < close) {
        const c = text.charCodeAt(j);
        if (c === 13) {
          parts.push(text.slice(seg, j), '\n');
          line += 1;
          j += text.charCodeAt(j + 1) === 10 ? 2 : 1;
          seg = j;
        } else if (c === 10) {
          line += 1;
          j += 1;
        } else if (c === 34) {
          parts.push(text.slice(seg, j), '"');
          j += 2;
          seg = j;
        } else {
          j += 1;
        }
      }
      parts.push(text.slice(seg, close));
      value = parts.join('');
    }
    pos = close + 1;
    fValue = value;
    fAdded = 0;
    if (pos >= n) { fEnded = END; return; }
    const c = text.charCodeAt(pos);
    if (c === 44) { pos += 1; fEnded = COMMA; return; }
    if (c === 10) { pos += 1; line += 1; fEnded = BREAK; return; }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      fEnded = BREAK;
      return;
    }
    // What follows the closing quote is appended as it stands, up to
    // the next comma or line break (quote_junk, when the field ends).
    readUnquoted(value);
    if (fAdded > 0) {
      errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos += 1; line += 1; }
      else if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended = COMMA;
    let quoted = false;
    while (ended === COMMA) {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted(); else readUnquoted('');
      fields.push(fValue);
      ended = fEnded;
    }

    // A line that held only stray CRs is left with no characters: no
    // record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
