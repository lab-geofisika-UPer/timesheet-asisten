/* Penghubung aplikasi (di GitHub Pages) ke Google Sheet + Drive lewat web app Apps Script. Hanya di versi online (bangun.py).
   Asisten: pilih nama (+ PIN bila diatur koordinator) → hanya laporannya sendiri yang dimuat dan disimpan.
   Koordinator: sandi → semua laporan, daftar asisten, dan pengaturan. */
const ONLINE = (() => {
  const run = async (fn, ...args) => { // TS_API = URL web app Apps Script, diisi di config.js
    const r = await fetch(TS_API, {method: 'POST', body: JSON.stringify({fn, args}), headers: {'Content-Type': 'text/plain;charset=utf-8'}});
    const j = await r.json(); if (!j.ok) throw new Error(j.error); return j.data;
  };
  const pesan = x => String((x && x.message) || x).replace(/^Error:\s*/, '').replace(/^Exception:\s*/, '');
  const meta = () => JSON.stringify([db.cfg, db.prak, db.asisten]);
  let kred = null, snap = new Map(), metaSnap = '', antre = Promise.resolve(), tunda, menunggu = false;
  const isi = lap => { db.lap = lap; snap = new Map(lap.map(e => [e.id, JSON.stringify(e)])); };

  async function muat() {
    $('#app').innerHTML = '<p class="sub">Memuat data…</p>';
    try { return await run('awal'); }
    catch (x) { $('#app').innerHTML = `<div class="msg err">Tidak bisa memuat data: ${esc(pesan(x))}</div>`; throw x; }
  }
  async function masuk(peran) {
    await flush();
    const kunci = 'ts-kred-' + peran;
    if (!peran) { kred = null; isi([]); return true; }
    try {
      if (peran === 'koordinator') {
        const sandi = lokal(kunci) || prompt('Sandi koordinator:'); if (!sandi) return false;
        $('#app').innerHTML = '<p class="sub">Memuat semua laporan…</p>';
        const d = await run('semua', sandi);
        Object.assign(db, {cfg: d.cfg, prak: d.prak, asisten: d.asisten}); metaSnap = meta();
        kred = {sandi}; lokal(kunci, sandi); isi(d.lap); return true;
      }
      const a = db.asisten.find(x => x.nim === peran) || {};
      const pin = (a.adaPin || a.pin) ? (lokal(kunci) || prompt(`PIN untuk ${a.nama}:`)) : '';
      if ((a.adaPin || a.pin) && !pin) return false;
      $('#app').innerHTML = '<p class="sub">Memuat laporan Anda…</p>';
      isi(await run('laporanSaya', peran, pin)); kred = {nim: peran, pin}; lokal(kunci, pin); return true;
    } catch (x) { lokal(kunci, ''); alert(pesan(x)); return false; }
  }
  // kirim laporan yang berubah sejak terakhir tersimpan; antre agar tidak ada dua simpanan bersamaan
  function kirim() {
    menunggu = false;
    return (antre = antre.then(async () => {
      if (!kred) return;
      try {
        const ada = new Set(db.lap.map(e => e.id));
        for (const id of [...snap.keys()]) if (!ada.has(id)) { await run('hapusLap', kred, id); snap.delete(id); }
        for (const e of db.lap) {
          const s = JSON.stringify(e); if (snap.get(e.id) === s) continue;
          if (!kred.sandi && e.nim !== kred.nim) continue;
          const kirimE = JSON.parse(s);
          (kirimE.laporan?.bagian || []).forEach(b => { b.foto = (b.foto || []).map(f => f.id ? {id: f.id, ket: f.ket} : {data: f.data, ket: f.ket}); });
          const r = await run('simpanLap', kred, kirimE);
          r.foto.forEach((ids, i) => ids.forEach((id, j) => { const f = e.laporan?.bagian[i]?.foto[j]; if (f) f.id = id; }));
          snap.set(e.id, s); // id foto baru membuat laporan tampak berubah sekali lagi; simpanan berikutnya ringan (tanpa foto)
        }
        if (kred.sandi && meta() !== metaSnap) { const m = meta(); await run('simpanMeta', kred.sandi, {cfg: db.cfg, prak: db.prak, asisten: db.asisten}); metaSnap = m; }
      } catch (x) { toast('Gagal menyimpan ke Google Sheet: ' + pesan(x)); }
    }));
  }
  function simpan() { menunggu = true; clearTimeout(tunda); tunda = setTimeout(kirim, 800); }
  function flush() { clearTimeout(tunda); return menunggu ? kirim() : antre; }
  window.addEventListener('beforeunload', ev => { if (menunggu) { kirim(); ev.preventDefault(); ev.returnValue = ''; } });
  return {muat, masuk, simpan, flush};
})();
