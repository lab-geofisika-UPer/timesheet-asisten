/* Penulis .xlsx kecil tanpa library (zip tanpa kompresi + XML Office Open).
   Sel: string | number | {d:'tttt-bb-hh'} tanggal | {t:'JJ:MM'} jam | {rp:n} rupiah | null.
   shortcut: tanpa kompresi, file sedikit lebih besar; cukup untuk rekap satu semester. */
const XLSX_MINI = (() => {
  const enc = new TextEncoder();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const kol = i => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  const SERIAL0 = Date.UTC(1899, 11, 30);
  // gaya: 0 biasa, 1 tanggal, 2 jam, 3 judul kolom tebal, 4 rupiah, 5 angka 2 desimal
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="hh:mm"/><numFmt numFmtId="166" formatCode="&quot;Rp&quot;#,##0"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFEDD5"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  function sel(v, ref, judul) {
    if (v == null || v === '') return '';
    if (judul) return `<c r="${ref}" s="3" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
    if (typeof v === 'number') return `<c r="${ref}" s="${Number.isInteger(v) ? 0 : 5}"><v>${v}</v></c>`;
    if (v.d) { const [y, m, d] = v.d.split('-').map(Number); return `<c r="${ref}" s="1"><v>${(Date.UTC(y, m - 1, d) - SERIAL0) / 864e5}</v></c>`; }
    if (v.t) { const [h, m] = v.t.split(':').map(Number); return `<c r="${ref}" s="2"><v>${(h * 60 + m) / 1440}</v></c>`; }
    if (v.rp != null) return `<c r="${ref}" s="4"><v>${v.rp}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }
  function lembar(s) {
    const rows = [s.kolom.map(k => k.h), ...s.baris];
    const isi = rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => sel(v, kol(j) + (i + 1), i === 0)).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${s.kolom.map((k, j) => `<col min="${j + 1}" max="${j + 1}" width="${k.w || 14}" customWidth="1"/>`).join('')}</cols><sheetData>${isi}</sheetData></worksheet>`;
  }
  const CRC = new Uint32Array(256).map((_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  const crc32 = b => { let c = ~0; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
  function zip(files) { // [[nama, Uint8Array]] -> Blob, metode simpan (0)
    const bagian = [], pusat = []; let off = 0;
    const u16 = n => [n & 255, n >>> 8 & 255], u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
    for (const [nama, data] of files) {
      const nm = enc.encode(nama), c = crc32(data), umum = [...u16(20), ...u16(0x800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(nm.length), ...u16(0)];
      const lokal = new Uint8Array([...u32(0x04034b50), ...umum]);
      bagian.push(lokal, nm, data);
      pusat.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...umum, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
      off += lokal.length + nm.length + data.length;
    }
    const pj = pusat.reduce((s, b) => s + b.length, 0);
    return new Blob([...bagian, ...pusat, new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(pj), ...u32(off), ...u16(0)])],
      {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function buat(sheets) {
    const n = sheets.length, f = (a, b) => [a, enc.encode(b)];
    return zip([
      f('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
      f('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
      f('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.nama.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
      f('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
      f('xl/styles.xml', STYLES),
      ...sheets.map((s, i) => f(`xl/worksheets/sheet${i + 1}.xml`, lembar(s)))]);
  }
  console.assert(crc32(enc.encode('123456789')) === 0xCBF43926 && kol(0) === 'A' && kol(26) === 'AA', 'xlsx');
  return {buat};
})();

// Simpan: dialog "Simpan sebagai" (bisa pilih folder OneDrive) bila browser mendukung, selain itu unduhan biasa.
async function simpanFile(blob, nama) {
  if (window.showSaveFilePicker) {
    try {
      const h = await showSaveFilePicker({id: 'rekap-timesheet', suggestedName: nama, types: [{description: 'Excel', accept: {[blob.type]: ['.xlsx']}}]});
      const w = await h.createWritable(); await w.write(blob); await w.close(); return true;
    } catch (x) { if (x.name === 'AbortError') return false; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); return true;
}
