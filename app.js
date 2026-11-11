'use strict';
/* Timesheet Asisten Praktikum — tiap asisten mengisi absensi & laporannya sendiri,
   koordinator meninjau, lalu Insentif menggabungkan semua asisten.
   Prototipe: data di IndexedDB perangkat ini; nanti dipindah ke SIM Lab (Supabase). */

const KAT = ['Persiapan', 'Pelaksanaan', 'Evaluasi', 'Demo Alat', 'Mentoring', 'Ujian'];
const RINCI = {
  Persiapan: 'Mempersiapkan data, software, materi dan tes awal untuk praktikum {m}',
  Pelaksanaan: 'Kegiatan praktikum yang diawali dengan tes awal, penyampaian materi hingga mendampingi praktikan untuk {m}',
  Evaluasi: 'Melakukan koreksi dan memberi penilaian tes awal dan laporan akhir praktikan {m}',
  'Demo Alat': 'Melakukan demo alat yang digunakan untuk praktikum {m}',
  Mentoring: 'Mendampingi praktikan dalam pengerjaan tugas {m}',
  Ujian: 'Mengawas dan menilai ujian praktikum'
};
const BAG = ['Persiapan Praktikum', 'Pelaksanaan Praktikum', 'Evaluasi Praktikum'];
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const STATUS = {draf: 'Draf', dikirim: 'Menunggu tinjauan', revisi: 'Perlu revisi', disetujui: 'Disetujui'};
const KOSONG = {cfg: {semester: 'Ganjil', ta: '', prodi: 'Teknik Geofisika', unit: 'LABORATORIUM GEOFISIKA-UNIVERSITAS PERTAMINA',
  direktorat: 'DIREKTORAT KEMAHASISWAAN DAN ALUMNI', menit: 50, tarif: 30000, kaprodi: '', nipKaprodi: '', dekan: '', nipDekan: '',
  bank: '', norek: '', atasNama: '', kepada: 'Manajer Pelayanan Mahasiswa', kota: 'Jakarta'}, prak: [], asisten: [], lap: [], ttd: {}};

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const rp = x => 'Rp' + Math.round(x).toLocaleString('id-ID');
const rpMemo = x => 'Rp. ' + x.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const angka = x => (Math.round(x * 100) / 100).toLocaleString('id-ID');
const hariIni = () => new Date().toISOString().slice(0, 10);
const tglID = s => { const d = new Date(s + 'T00:00'); return `${d.getDate()} ${BLN[d.getMonth()]} ${d.getFullYear()}`; };
const hariID = s => HARI[new Date(s + 'T00:00').getDay()];
const bulanID = ym => `${BLN[+ym.slice(5) - 1]} ${ym.slice(0, 4)}`;
const menit = t => { const [h, m] = String(t || '').split(':').map(Number); return h * 60 + m; };
// jam 24 jam "HH:MM"; menerima ketikan 1300, 13.00, 9:5 -> "" bila tidak sah
const normJam = v => { const m = String(v).trim().match(/^(\d{1,2})(?:[:.\s]?(\d{2}))?$/) || String(v).trim().match(/^(\d{1,2})[:.](\d)$/);
  if (!m) return ''; const h = +m[1], mn = +(m[2] || 0); return h < 24 && mn < 60 ? `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}` : ''; };
console.assert(normJam('1300') === '13:00' && normJam('9.30') === '09:30' && normJam('7') === '07:00' && normJam('24:00') === '' && normJam('13:61') === '', 'normJam');
// tanggal tampil hh/bb/tttt (tidak ikut bahasa browser), disimpan ISO tttt-bb-hh
const isoKeTeks = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '';
const teksKeIso = v => {
  const s = String(v).trim(), m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})$/) || s.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) return '';
  const y = m[3].length === 2 ? 2000 + +m[3] : +m[3], mo = +m[2], d = +m[1], dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : '';
};
console.assert(teksKeIso('2/11/2026') === '2026-11-02' && teksKeIso('02112026') === '2026-11-02' && teksKeIso('31/02/2026') === '' && isoKeTeks('2026-11-02') === '02/11/2026', 'tanggal');
const IKON_KAL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
const tglInput = (id, attr, iso, dis = '') => `<div class="tglw"><input id="${id}" class="tgl" ${attr} inputmode="numeric" maxlength="10" placeholder="hh/bb/tttt" autocomplete="off" value="${isoKeTeks(iso)}" ${dis}>
  <button type="button" class="pick" data-pick aria-label="Pilih dari kalender" ${dis}>${IKON_KAL}</button><input type="date" class="pickd" tabindex="-1" aria-hidden="true" value="${esc(iso || '')}"></div>`;
const jam = k => (k.mulai && k.selesai) ? Math.max(0, (menit(k.selesai) - menit(k.mulai)) / 60) : 0;
const sesi = k => Math.round(jam(k) * 60 / (+db.cfg.menit || 50) * 100) / 100;
const NAMA_MODUL = {Ujian: 'Ujian Praktikum', KL: 'Kuliah Lapangan'};
const labelNo = no => NAMA_MODUL[no] || 'Modul ' + no;
const modulLabel = e => labelNo(e.modul_no);
const modulPanjang = e => modulLabel(e) + (e.modul_judul ? ' - ' + e.modul_judul : '');
const prakOf = kode => db.prak.find(p => p.kode === kode) || {kode, nama: kode, judul: kode, memo: kode};
// kode berakhiran -A/-B = kelas GPA/GPB dari satu mata kuliah (Judul Rekap sama); digabung di Memo, dipisah per lembar
const kelasOf = kode => { const m = /-([A-Z])$/.exec(kode || ''); return m ? 'GP' + m[1] : ''; };
const labelPrak = kode => { const p = prakOf(kode), k = kelasOf(kode); return (p.memo || p.nama || kode) + (k ? ' ' + k : ''); };
const namaOf = nim => (db.asisten.find(a => a.nim === nim) || {nama: nim}).nama;
const urutModul = no => ({KL: 97, Ujian: 99})[no] || +no || 98;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));

let db, ui = {peran: '', tab: '', id: null, filter: null, fprak: '', dari: '', sampai: '', nomor: 'XXX', tglMemo: hariIni()};

/* ---------- penyimpanan ---------- */
// shortcut: seluruh data (termasuk foto) disimpan sebagai satu objek; cukup untuk satu semester, pindah ke tabel saat masuk SIM.
function idb(mode, fn) {
  return new Promise((ok, no) => {
    const r = indexedDB.open('timesheet-asisten', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onerror = () => no(r.error);
    r.onsuccess = () => {
      const t = r.result.transaction('kv', mode), q = fn(t.objectStore('kv'));
      t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error);
    };
  });
}
let tSimpan;
const ON = typeof ONLINE !== 'undefined'; // versi online: data di Google Sheet (online/online.js)
function simpan() {
  if (ON) return ONLINE.simpan();
  clearTimeout(tSimpan);
  tSimpan = setTimeout(() => idb('readwrite', s => s.put(db, 'db')).catch(() => toast('Gagal menyimpan di perangkat ini. Unduh cadangan dari menu Data.')), 400);
}
function lokal(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 3200); }
function unduh(nama, isi, tipe = 'application/json') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([isi], {type: tipe})); a.download = nama;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function pilihFile(accept) {
  return new Promise(ok => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = true; i.onchange = () => ok([...i.files]); i.click(); });
}

/* ---------- peran & navigasi ---------- */
const isKoor = () => ui.peran === 'koordinator';
const prakSaya = () => db.asisten.filter(a => a.nim === ui.peran).map(a => a.prak);
function isiPeran() {
  $('#sem').textContent = `Semester ${db.cfg.semester || '-'}, TA ${db.cfg.ta || '-'}`;
  const grup = db.prak.map(p => {
    const as = db.asisten.filter(a => a.prak === p.kode);
    return as.length ? `<optgroup label="Asisten ${esc(labelPrak(p.kode))}">${as.map(a => `<option value="${esc(a.nim)}">${esc(a.nama)}</option>`).join('')}</optgroup>` : '';
  }).join('');
  $('#peran').innerHTML = (ON ? '<option value="">Pilih nama Anda…</option>' : '') + '<option value="koordinator">Koordinator / Aslab</option>' + grup;
  if (![...$('#peran').options].some(o => o.value === ui.peran)) ui.peran = ON ? '' : 'koordinator';
  $('#peran').value = ui.peran;
}
$('#peran').onchange = async e => { if (ON && !(await ONLINE.masuk(e.target.value))) { e.target.value = ui.peran; return tampil(); } ui.peran = e.target.value; lokal('ts-peran', ui.peran); ui.tab = ''; ui.id = null; tampil(); };
function tampil() {
  if (ON && !ui.peran) { $('#tabs').innerHTML = ''; $('.bar')?.remove(); $('#app').innerHTML = '<h1>Selamat datang</h1><p class="sub">Pilih nama Anda di kotak <b>Masuk sebagai</b> di atas untuk mengisi jam kerja dan LPJ. Koordinator memilih Koordinator / Aslab lalu memasukkan sandi.</p>'; return; }
  const tabs = isKoor() ? [['tinjau', 'Tinjau'], ['berkas', 'Berkas pengajuan'], ['data', 'Data']] : [['saya', 'Laporan saya']];
  if (!tabs.some(t => t[0] === ui.tab)) ui.tab = tabs[0][0];
  $('#tabs').innerHTML = tabs.length < 2 || ui.id ? '' : tabs.map(([k, l]) => `<button type="button" data-tab="${k}" ${ui.tab === k ? 'aria-current="page"' : ''}>${l}</button>`).join('');
  $('.bar')?.remove();
  const v = {saya: vSaya, edit: vEdit, tinjau: vTinjau, detail: vDetail, berkas: vBerkas, data: vData}[ui.id ? (isKoor() ? 'detail' : 'edit') : ui.tab];
  $('#app').innerHTML = v();
  keAlamat();
  if (ui.id && !isKoor() && lapOf(ui.id)) ringkas(lapOf(ui.id));
  window.scrollTo(0, 0);
}
$('#tabs').onclick = e => { const t = e.target.dataset.tab; if (t) { ui.tab = t; ui.id = null; tampil(); } };
const lapOf = id => db.lap.find(e => e.id === id);
const badge = s => `<span class="badge s-${s}">${STATUS[s]}</span>`;
const totalJam = e => e.kegiatan.reduce((s, k) => s + jam(k), 0);
const totalSesi = e => e.kegiatan.reduce((s, k) => s + sesi(k), 0);

/* ---------- ASISTEN: daftar laporan ---------- */
function vSaya() {
  const mine = db.lap.filter(e => e.nim === ui.peran).sort((a, b) => a.praktikum.localeCompare(b.praktikum) || urutModul(a.modul_no) - urutModul(b.modul_no));
  const s = mine.filter(e => e.status === 'disetujui').reduce((t, e) => t + totalSesi(e), 0);
  return `<h1>Laporan saya</h1><p class="sub">${esc(namaOf(ui.peran))} (NIM <span class="mono">${esc(ui.peran)}</span>). Isi satu laporan untuk setiap modul yang Anda kerjakan; jam kerja diisi sesuai yang Anda lakukan sendiri.</p>
  <div class="acts" style="margin-bottom:6px"><button class="btn primary" data-act="baru">+ Isi laporan modul</button></div>
  <div class="sum" style="max-width:640px"><div><b>${mine.length}</b><span>laporan</span></div><div><b>${angka(s)}</b><span>sesi disetujui</span></div><div><b>${rp(s * db.cfg.tarif)}</b><span>insentif disetujui</span></div></div>
  ${kartuTtd()}
  ${mine.some(e => e.status === 'revisi') ? '<div class="msg warn">Ada laporan yang diminta revisi. Buka, perbaiki, lalu kirim ulang.</div>' : ''}
  ${mine.length ? `<div class="list" style="margin-top:14px">${mine.map(e => `<button class="card it" data-buka="${e.id}">
     <b>${esc(modulLabel(e))}, ${esc(labelPrak(e.praktikum))}</b><span class="sub">${esc(e.modul_judul || '')}</span>
     <div class="row"><span class="sub meta"><span>${angka(totalJam(e))} jam</span><span>${angka(totalSesi(e))} sesi</span>${e.penulis ? '<span>penulis LPJ</span>' : ''}</span>${badge(e.status)}</div></button>`).join('')}</div>`
    : '<div class="card empty">Belum ada laporan. Tekan <b>+ Isi laporan modul</b> setelah selesai mengerjakan satu modul.</div>'}`;
}
function dialogBaru() {
  const pr = prakSaya();
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog"><h3>Laporan modul baru</h3>
    <div class="f"><label class="l" for="dPr">Praktikum</label><select id="dPr">${pr.map(k => `<option value="${esc(k)}">${esc(labelPrak(k))}</option>`).join('')}</select></div>
    <div class="f"><label class="l" for="dMo">Modul</label><select id="dMo">${[...Array(12)].map((_, i) => `<option value="${i + 1}">Modul ${i + 1}</option>`).join('')}<option value="KL">Kuliah Lapangan</option><option value="Ujian">Ujian Praktikum</option></select></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn" value="batal">Batal</button><button class="btn primary" value="ok">Lanjut</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  d.onclose = () => {
    if (d.returnValue === 'ok') {
      const p = d.querySelector('#dPr').value, m = d.querySelector('#dMo').value;
      let e = db.lap.find(x => x.nim === ui.peran && x.praktikum === p && x.modul_no === m);
      if (e) toast('Laporan modul ini sudah ada, dibuka kembali.');
      else {
        const penulisLain = db.lap.some(x => x.praktikum === p && x.modul_no === m && x.penulis);
        e = {id: uid(), nim: ui.peran, praktikum: p, modul_no: m, modul_judul: (db.lap.find(x => x.praktikum === p && x.modul_no === m) || {}).modul_judul || '',
          kegiatan: ['Persiapan', 'Pelaksanaan', 'Evaluasi'].map(k => ({kategori: k, tanggal: '', mulai: '', selesai: '', rincian: '', link: ''})),
          penulis: !penulisLain, laporan: null, status: 'draf', catatan: '', riwayat: []};
        rinciOtomatis(e); db.lap.push(e); simpan();
      }
      ui.id = e.id; ui.langkah = 'jam'; tampil();
    }
    d.remove();
  };
}
/* ---------- ASISTEN: tanda tangan (gambar di layar atau unggah foto) ---------- */
function kartuTtd() {
  const t = (db.ttd || {})[ui.peran];
  return `<section class="card it" style="max-width:640px"><b>Tanda tangan</b><div class="row">
    <span class="sub">${t ? 'Dipakai di berkas Absensi dan Insentif.' : 'Belum ada. Dibutuhkan untuk berkas Absensi dan Insentif.'}</span>
    ${t ? `<img src="${t}" alt="Tanda tangan Anda" style="max-height:44px;max-width:150px">` : ''}
    <button class="btn sm ${t ? '' : 'primary'}" data-act="ttd">${t ? 'Ganti' : 'Buat tanda tangan'}</button></div></section>`;
}
// latar kertas dibuat transparan lalu dipangkas, supaya rapi di sel tabel
function bersihkanTtd(src) {
  const c = document.createElement('canvas'), s = Math.min(1, 600 / src.width, 300 / src.height);
  c.width = Math.max(1, Math.round(src.width * s)); c.height = Math.max(1, Math.round(src.height * s));
  const x = c.getContext('2d'); x.drawImage(src, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  let jml = 0, n = 0;
  for (let i = 0; i < p.length; i += 4) if (p[i + 3] > 40) { jml += p[i] + p[i + 1] + p[i + 2]; n++; }
  const rata = n ? jml / n : 0, batas = rata > 300 ? 0.7 * rata : Infinity; // foto kertas (rata-rata terang): tinta jauh lebih gelap; gambar di layar: semua goresan dipakai
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] <= 40 || p[i] + p[i + 1] + p[i + 2] > batas) { p[i + 3] = 0; continue; }
    p[i + 3] = 255; const k = (i / 4) % c.width, j = Math.floor(i / 4 / c.width);
    if (k < x0) x0 = k; if (k > x1) x1 = k; if (j < y0) y0 = j; if (j > y1) y1 = j;
  }
  if (x1 < 0) return '';
  x.putImageData(d, 0, 0);
  const o = document.createElement('canvas'); o.width = x1 - x0 + 9; o.height = y1 - y0 + 9;
  o.getContext('2d').drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 4, 4, x1 - x0 + 1, y1 - y0 + 1);
  return o.toDataURL('image/png');
}
function dialogTtd() {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog"><h3>Tanda tangan</h3><p class="sub" style="margin-top:0">Gambar dengan jari atau mouse di kotak putih, atau unggah foto tanda tangan di kertas putih (tinta gelap).</p>
    <canvas width="600" height="240" aria-label="Kotak tanda tangan" style="display:block;width:100%;aspect-ratio:5/2;background:#fff;border:1px solid var(--border);border-radius:12px;touch-action:none;cursor:crosshair"></canvas>
    <div class="acts" style="justify-content:space-between"><span class="acts" style="margin:0"><button type="button" class="btn sm" data-t="ulang">Ulangi</button><button type="button" class="btn sm" data-t="unggah">Unggah foto</button></span>
    <span class="acts" style="margin:0"><button class="btn" value="batal">Batal</button><button class="btn primary" value="ok">Simpan</button></span></div></form>`;
  document.body.appendChild(d); d.showModal();
  const c = d.querySelector('canvas'), x = c.getContext('2d'); let akhir = null, ada = false;
  const gaya = () => { x.lineWidth = 3.5; x.lineCap = x.lineJoin = 'round'; x.strokeStyle = x.fillStyle = '#111'; }; gaya();
  const pos = ev => { const r = c.getBoundingClientRect(); return [(ev.clientX - r.left) * c.width / r.width, (ev.clientY - r.top) * c.height / r.height]; };
  c.onpointerdown = ev => { try { c.setPointerCapture(ev.pointerId); } catch (x) { /* pointer sudah lepas */ } akhir = pos(ev); x.beginPath(); x.arc(akhir[0], akhir[1], 1.7, 0, 7); x.fill(); ada = true; };
  c.onpointermove = ev => { if (!akhir) return; const q = pos(ev); x.beginPath(); x.moveTo(...akhir); x.lineTo(...q); x.stroke(); akhir = q; };
  c.onpointerup = c.onpointercancel = () => { akhir = null; };
  d.querySelector('[data-t=ulang]').onclick = () => { x.clearRect(0, 0, c.width, c.height); ada = false; };
  d.querySelector('[data-t=unggah]').onclick = async () => {
    const [f] = await pilihFile('image/*'); if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onerror = () => { URL.revokeObjectURL(url); alert('Foto tidak bisa dibaca.'); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const bersih = new Image(); bersih.onload = () => {
        x.clearRect(0, 0, c.width, c.height); const s = Math.min(1, (c.width - 20) / bersih.width, (c.height - 20) / bersih.height);
        x.drawImage(bersih, (c.width - bersih.width * s) / 2, (c.height - bersih.height * s) / 2, bersih.width * s, bersih.height * s); gaya(); ada = true;
      };
      const v = bersihkanTtd(img); if (!v) return alert('Tidak ada tanda tangan yang terbaca di foto itu.'); bersih.src = v;
    };
    img.src = url;
  };
  d.onclose = () => {
    if (d.returnValue === 'ok') {
      const v = ada && bersihkanTtd(c);
      if (!v) alert('Kotak tanda tangan masih kosong.');
      else { (db.ttd = db.ttd || {})[ui.peran] = v; simpan(); tampil(); toast('Tanda tangan tersimpan.'); }
    }
    d.remove();
  };
}
function rinciOtomatis(e) { e.kegiatan.forEach(k => { if (!k.ubah) k.rincian = (RINCI[k.kategori] || '').replace('{m}', modulPanjang(e)); }); }
function laporanBaru() { return {media: 'Offline, G-Classroom', hadir: '', tidak_hadir: '', keterangan: '', bagian: BAG.map(j => ({judul: j, teks: '', foto: [], tetap: true}))}; }

/* ---------- ASISTEN: editor laporan (3 langkah) ---------- */
const LANGKAH = [['jam', 'Jam kerja'], ['lpj', 'Laporan (LPJ)'], ['pratinjau', 'Pratinjau']];
function vEdit() {
  const e = lapOf(ui.id); if (!e) { ui.id = null; return vSaya(); }
  const ro = !['draf', 'revisi'].includes(e.status), dis = ro ? 'disabled' : '';
  const lain = db.lap.find(x => x !== e && x.praktikum === e.praktikum && x.modul_no === e.modul_no && x.penulis);
  const L = ui.langkah = ui.langkah || 'jam', i = LANGKAH.findIndex(x => x[0] === L);
  setTimeout(() => {
    const b = document.createElement('div'); b.className = 'bar';
    const mundur = i ? `<button class="btn" data-langkah="${LANGKAH[i - 1][0]}">← ${LANGKAH[i - 1][1]}</button>` : `<button class="btn" data-act="kembali">${ro ? 'Kembali' : 'Simpan draf &amp; kembali'}</button>`;
    const maju = i < 2 ? `<button class="btn primary" data-langkah="${LANGKAH[i + 1][0]}">Lanjut: ${LANGKAH[i + 1][1]} →</button>`
      : (ro ? '<button class="btn" data-act="unduhKiriman">Unduh file kiriman</button>' : '<button class="btn primary" data-act="kirim">Periksa &amp; kirim</button>');
    b.innerHTML = mundur + maju; document.body.appendChild(b);
    document.querySelectorAll('.prev').forEach(p => pasKertas(p));
  });
  let isi = '';
  if (L === 'jam') isi = `<section class="card"><h2>Judul modul</h2>
      <input id="mjud" data-e="modul_judul" value="${esc(e.modul_judul)}" placeholder="mis. Akuisisi dan Pengolahan GPR" aria-label="Judul modul" ${dis}></section>
    <section class="card"><h2>Kegiatan &amp; jam kerja saya</h2><p class="sub">Isi jam yang benar-benar Anda kerjakan sendiri. Rincian terisi otomatis dan boleh diubah.</p>
    <div id="kegs">${e.kegiatan.map((k, j) => `<div class="keg" data-i="${j}">
      <div class="keg-h">
        <div class="kat"><label class="l" for="k${j}">Kategori</label><select id="k${j}" data-k="kategori" ${dis}>${KAT.map(c => `<option ${c === k.kategori ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div><label class="l" for="t${j}">Tanggal</label>${tglInput(`t${j}`, 'data-k="tanggal"', k.tanggal, dis)}</div>
        <div><label class="l" for="a${j}">Mulai</label><input id="a${j}" data-k="mulai" class="jam24" inputmode="numeric" maxlength="5" placeholder="00:00" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" autocomplete="off" value="${esc(k.mulai)}" ${dis}></div>
        <div><label class="l" for="b${j}">Selesai</label><input id="b${j}" data-k="selesai" class="jam24" inputmode="numeric" maxlength="5" placeholder="00:00" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" autocomplete="off" value="${esc(k.selesai)}" ${dis}></div>
        <span class="dur" aria-label="Durasi">${jam(k) ? angka(jam(k)) + ' jam' : '—'}</span>
        ${ro ? '<span></span>' : `<button class="btn x" type="button" data-hapuskeg="${j}" aria-label="Hapus kegiatan ${j + 1}">✕</button>`}
      </div>
      <textarea data-k="rincian" aria-label="Rincian kegiatan ${j + 1}" ${dis}>${esc(k.rincian)}</textarea>
      ${k.kategori === 'Pelaksanaan' ? `<input data-k="link" type="url" style="margin-top:8px" placeholder="Link output (folder Drive / Classroom) — wajib untuk Pelaksanaan" aria-label="Link output" value="${esc(k.link)}" ${dis}>` : ''}
      </div>`).join('')}</div>
    ${ro ? '' : '<button class="btn sm" data-act="tambahKeg">+ Tambah kegiatan</button>'}
    <div class="sum" id="ring"></div></section>
    ${ro ? '' : '<div class="acts"><button class="btn danger sm" data-act="hapusLap">Hapus laporan ini</button></div>'}`;
  if (L === 'lpj') isi = `<section class="card"><h2>Laporan pelaksanaan (LPJ)</h2>
    <p class="sub">Satu LPJ per modul ditulis oleh satu asisten. Nama semua asisten yang mengisi modul ini otomatis tercantum.</p>
    ${lain ? `<div class="msg info">Sudah ada LPJ modul ini dari ${esc(namaOf(lain.nim))}. Praktikum biasa cukup satu LPJ, jadi Anda cukup mengisi jam kerja. Untuk kuliah lapangan atau kegiatan dengan beberapa metode, tiap asisten boleh menulis LPJ sendiri: centang di bawah dan isi metodenya.</div>` : ''}
    <label class="switch"><input type="checkbox" data-act="penulis" ${e.penulis ? 'checked' : ''} ${dis}><span>Saya menulis LPJ untuk modul ini<br><span class="sub">Isi ringkasan, uraian tiap bagian, dan foto dokumentasi.</span></span></label>
    ${e.penulis ? vLaporan(e.laporan || (e.laporan = laporanBaru()), dis) : ''}</section>`;
  if (L === 'pratinjau') {
    const abs = prevAbsensi(e), lpj = prevLPJ(e);
    isi = `<p class="sub" style="margin-top:12px">Beginilah berkas Anda saat dicetak koordinator. Periksa dulu, lalu kirim.</p>
      <div class="prev-h"><h2 style="margin:0">Absensi</h2>${abs ? '<button class="btn sm" data-act="prevPenuh" data-jenis="abs">Lihat ukuran penuh</button>' : ''}</div>
      ${abs ? `<div class="prev">${abs}</div>` : '<div class="card empty">Isi tanggal dan jam kegiatan dulu.</div>'}
      <div class="prev-h"><h2 style="margin:0">Laporan (LPJ)</h2>${lpj ? '<button class="btn sm" data-act="prevPenuh" data-jenis="lpj">Lihat ukuran penuh</button>' : ''}</div>
      ${lpj ? `<div class="prev">${lpj}</div>` : `<div class="card empty">${e.penulis ? 'Isi tanggal dan jam kegiatan Pelaksanaan dulu.' : 'LPJ modul ini ditulis asisten lain; pratinjau muncul setelah laporannya ada di perangkat ini.'}</div>`}`;
  }
  return `<p style="margin:12px 0 0"><button class="btn sm" data-act="kembali">← Laporan saya</button></p>
  <div class="head"><div class="grow"><h1>${esc(modulLabel(e))}</h1><p class="sub meta" style="margin:0"><span>${esc(labelPrak(e.praktikum))}</span><span>${esc(namaOf(e.nim))}</span>${badge(e.status)}</p></div></div>
  ${e.status === 'revisi' ? `<div class="msg warn"><b>Catatan koordinator:</b> ${esc(e.catatan)}</div>` : ''}
  ${e.status === 'dikirim' ? '<div class="msg info">Sudah dikirim, menunggu tinjauan koordinator. Jika koordinator memakai perangkat lain, tekan <b>Unduh file kiriman</b> lalu kirimkan filenya.</div>' : ''}
  ${e.status === 'disetujui' ? '<div class="msg ok">Disetujui dan ikut dihitung dalam insentif.</div>' : ''}
  <nav class="steps" aria-label="Langkah">${LANGKAH.map(([k, l], j) => `<button type="button" data-langkah="${k}" aria-label="Langkah ${j + 1}: ${l}" ${k === L ? 'aria-current="step"' : ''}><span class="n">${j + 1}</span><span class="lbl">${l}</span></button>`).join('')}</nav>
  <div id="hasil" aria-live="polite"></div>${isi}`;
}
function vLaporan(L, dis) {
  return `<div class="f" style="margin-top:14px"><label class="l" for="topik">Metode / topik laporan</label>
      <input id="topik" data-l="topik" value="${esc(L.topik || '')}" placeholder="Kosongkan untuk praktikum biasa" aria-describedby="topikH" ${dis}><p class="hint" id="topikH">Isi hanya bila satu modul punya beberapa LPJ, mis. kuliah lapangan per metode: "Metode GPR".</p></div>
    <div class="g3 f">
      <div><label class="l need" for="media">Media pelaksanaan</label><input id="media" data-l="media" value="${esc(L.media)}" ${dis}></div>
      <div><label class="l need" for="hadir">Mahasiswa hadir</label><input id="hadir" type="number" min="0" inputmode="numeric" data-l="hadir" value="${esc(L.hadir)}" ${dis}></div>
      <div><label class="l need" for="absen">Tidak hadir</label><input id="absen" type="number" min="0" inputmode="numeric" data-l="tidak_hadir" value="${esc(L.tidak_hadir)}" ${dis}></div></div>
    <div class="f"><label class="l need" for="ket">Ringkasan jalannya praktikum</label><textarea id="ket" data-l="keterangan" ${dis}
      placeholder="Contoh: Praktikum diawali tes awal tertulis, dilanjutkan penyampaian materi oleh asisten, lalu hands-on pengolahan data ...">${esc(L.keterangan)}</textarea></div>
    ${L.bagian.map((b, i) => `<div class="bag" data-b="${i}">
      <div class="bag-h"><b>${i + 1}.</b>${b.tetap ? `<b>${esc(b.judul)}</b>` : `<input data-bf="judul" value="${esc(b.judul)}" aria-label="Judul bagian" placeholder="Judul bagian" ${dis}>`}
        ${b.tetap || dis ? '' : `<button class="btn x" type="button" data-hapusbag="${i}" aria-label="Hapus bagian">✕</button>`}</div>
      <textarea data-bf="teks" aria-label="Uraian ${esc(b.judul)}" placeholder="Uraikan kegiatan ${esc(b.judul.toLowerCase())}..." ${dis}>${esc(b.teks)}</textarea>
      <div class="fotos">${b.foto.map((f, j) => `<div class="foto"><img src="${f.data}" alt="Foto ${j + 1} ${esc(b.judul)}">
          ${dis ? '' : `<button type="button" data-hapusfoto="${j}" aria-label="Hapus foto ${j + 1}">×</button>`}
          <input data-ket="${j}" value="${esc(f.ket)}" placeholder="Keterangan foto" aria-label="Keterangan foto ${j + 1}" ${dis}></div>`).join('')}
        ${dis ? '' : `<label class="add-foto"><input type="file" accept="image/*" multiple data-tambahfoto><span style="font-size:24px">＋</span>Tambah foto${i === 1 ? ' (wajib)' : ''}</label>`}</div>
    </div>`).join('')}
    ${dis ? '' : '<button class="btn sm" data-act="tambahBag" style="margin-top:12px">+ Tambah bagian (mis. Input Nilai)</button>'}`;
}
function ringkas(e) {
  const r = $('#ring'); if (!r) return;
  const j = totalJam(e), s = totalSesi(e);
  r.innerHTML = `<div><b>${angka(j)}</b><span>jam kerja</span></div><div><b>${angka(s)}</b><span>sesi</span></div><div><b>${rp(s * db.cfg.tarif)}</b><span>perkiraan insentif</span></div>`;
  document.querySelectorAll('.keg').forEach(el => { const k = e.kegiatan[el.dataset.i]; el.querySelector('.dur').textContent = jam(k) ? angka(jam(k)) + ' jam' : '—'; });
}
function kecilkan(file, maks = 1400) { // perkecil foto supaya data ringan
  return new Promise((ok, gagal) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, maks / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', .8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); gagal(); };
    img.src = url;
  });
}
function bertumpuk(a, b) { return a.tanggal && a.tanggal === b.tanggal && a.mulai && b.mulai && menit(a.mulai) < menit(b.selesai) && menit(b.mulai) < menit(a.selesai); }
function periksaLap(e) { // aturan yang sama dengan yang dicek keuangan
  const err = [], hari = 864e5, kini = Date.now();
  if (!e.kegiatan.length) err.push('Isi minimal satu kegiatan.');
  e.kegiatan.forEach((k, i) => {
    const n = `Kegiatan ${i + 1} (${k.kategori})`;
    if (!k.tanggal) err.push(`${n}: tanggal belum diisi.`);
    else {
      const t = new Date(k.tanggal + 'T00:00').getTime();
      if (t > kini + 14 * hari) err.push(`${n}: tanggal di masa depan, periksa lagi.`);
      if (t < kini - 400 * hari) err.push(`${n}: tanggal lebih dari setahun lalu, kemungkinan salah tahun.`);
    }
    if (!k.mulai || !k.selesai) err.push(`${n}: jam mulai/selesai belum diisi.`);
    else if (jam(k) <= 0) err.push(`${n}: jam selesai harus setelah jam mulai.`);
    if (!String(k.rincian).trim()) err.push(`${n}: rincian kosong.`);
    if (k.kategori === 'Pelaksanaan' && !/^https?:\/\//.test(String(k.link).trim())) err.push(`${n}: link output wajib diisi (diawali https://).`);
    e.kegiatan.forEach((o, j) => { if (j > i && bertumpuk(k, o)) err.push(`Kegiatan ${i + 1} dan ${j + 1}: jamnya bertumpuk.`); });
    db.lap.filter(x => x !== e && x.nim === e.nim).forEach(x => x.kegiatan.forEach(o => {
      if (bertumpuk(k, o)) err.push(`${n}: bertumpuk dengan kegiatan di laporan ${labelPrak(x.praktikum)} ${modulLabel(x)}.`);
    }));
  });
  if (e.penulis) {
    const L = e.laporan || {};
    if (!e.kegiatan.some(k => k.kategori === 'Pelaksanaan')) err.push('Penulis LPJ harus mencantumkan kegiatan Pelaksanaan (dipakai untuk tanggal dan waktu di LPJ).');
    if (db.lap.some(x => x !== e && x.praktikum === e.praktikum && x.modul_no === e.modul_no && x.penulis) && !String(L.topik || '').trim())
      err.push('Modul ini sudah punya LPJ dari asisten lain. Isi "Metode / topik laporan" agar kedua LPJ bisa dibedakan, atau hapus centang penulis LPJ.');
    if (!String(L.media || '').trim()) err.push('Media pelaksanaan belum diisi.');
    if (L.hadir === '' || L.hadir == null || +L.hadir < 0) err.push('Jumlah mahasiswa hadir belum diisi.');
    if (L.tidak_hadir === '' || L.tidak_hadir == null || +L.tidak_hadir < 0) err.push('Jumlah mahasiswa tidak hadir belum diisi (isi 0 bila semua hadir).');
    if (String(L.keterangan || '').trim().length < 40) err.push('Ringkasan jalannya praktikum terlalu singkat (minimal 1–2 kalimat).');
    (L.bagian || []).forEach((b, i) => {
      if (!String(b.judul).trim()) err.push(`Bagian ${i + 1}: judul kosong.`);
      if (b.tetap && String(b.teks).trim().length < 20) err.push(`${b.judul}: uraian belum diisi.`);
    });
    if (!(L.bagian || [])[1]?.foto.length) err.push('Pelaksanaan Praktikum: tambahkan minimal satu foto dokumentasi.');
  }
  return err;
}
function kiriman(e) {
  const o = JSON.parse(JSON.stringify(e)); o.versi = 2; o.dikirim = new Date().toISOString();
  o.kegiatan.forEach(k => delete k.ubah);
  const t = (db.ttd || {})[e.nim]; if (t) o.ttd = t; // ikut ke koordinator untuk kolom TANDA TANGAN
  return o;
}

/* ---------- KOORDINATOR: tinjau ---------- */
function vTinjau() {
  if (ui.filter == null) ui.filter = db.lap.some(e => e.status === 'dikirim') ? 'dikirim' : '';
  const daftar = db.lap.filter(e => (!ui.filter || e.status === ui.filter) && (!ui.fprak || e.praktikum === ui.fprak))
    .sort((a, b) => a.praktikum.localeCompare(b.praktikum) || urutModul(a.modul_no) - urutModul(b.modul_no) || namaOf(a.nim).localeCompare(namaOf(b.nim)));
  const n = s => db.lap.filter(e => e.status === s).length;
  return `<h1>Tinjau laporan asisten</h1><p class="sub">Hanya laporan <b>disetujui</b> yang dihitung di Absensi, Insentif, LPJ, dan Memo.</p>
  <div class="g2" style="max-width:640px">
    <div><label class="l" for="fSt">Status</label><select id="fSt" data-filter="filter"><option value="">Semua (${db.lap.length})</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${ui.filter === k ? 'selected' : ''}>${v} (${n(k)})</option>`).join('')}</select></div>
    <div><label class="l" for="fPr">Praktikum</label><select id="fPr" data-filter="fprak"><option value="">Semua praktikum</option>${db.prak.map(p => `<option value="${esc(p.kode)}" ${ui.fprak === p.kode ? 'selected' : ''}>${esc(labelPrak(p.kode))}</option>`).join('')}</select></div></div>
  <div class="acts"><button class="btn" data-act="imporKiriman">Impor file kiriman asisten</button>${n('dikirim') ? `<button class="btn ok" data-act="setujuiSemua">Setujui semua yang tampil &amp; lolos cek (${daftar.filter(e => e.status === 'dikirim' && !periksaLap(e).length).length})</button>` : ''}</div>
  <section class="card"><div class="tablewrap"><table class="t"><thead><tr><th>Asisten</th><th>Praktikum</th><th>Modul</th><th class="n">Jam</th><th class="n">Sesi</th><th>LPJ</th><th>Status</th><th></th></tr></thead><tbody>
  ${daftar.map(e => `<tr><td>${esc(namaOf(e.nim))}</td><td>${esc(labelPrak(e.praktikum))}</td><td>${esc(modulLabel(e))}</td>
    <td class="n">${angka(totalJam(e))}</td><td class="n">${angka(totalSesi(e))}</td><td>${e.penulis ? 'Penulis' : '—'}</td><td>${badge(e.status)}</td>
    <td><button class="btn sm" data-buka="${e.id}">Lihat</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">Tidak ada laporan dengan saringan ini.</td></tr>'}
  </tbody></table></div></section>`;
}
function vDetail() {
  const e = lapOf(ui.id); if (!e) { ui.id = null; return vTinjau(); }
  const err = periksaLap(e), L = e.laporan;
  setTimeout(() => {
    const b = document.createElement('div'); b.className = 'bar';
    b.innerHTML = `<button class="btn" data-act="kembali">Kembali</button>` + (e.status === 'disetujui'
      ? `<button class="btn" data-act="batalSetuju">Batalkan persetujuan</button>`
      : `<button class="btn" data-act="revisi">Minta revisi</button><button class="btn primary" data-act="setujui" ${err.length ? 'disabled title="Masih ada kesalahan"' : ''}>Setujui</button>`);
    document.body.appendChild(b);
  });
  return `<p style="margin:12px 0 0"><button class="btn sm" data-act="kembali">← Tinjau</button></p>
  <div class="head"><div class="grow"><h1>${esc(namaOf(e.nim))}</h1><p class="sub meta" style="margin:0"><span>${esc(labelPrak(e.praktikum))}</span><span>${esc(modulPanjang(e))}</span>${badge(e.status)}</p></div>
    <div class="acts" style="margin-top:14px"><button class="btn sm" data-act="prevAbs">Pratinjau Absensi</button>${e.penulis ? '<button class="btn sm" data-act="prevLpj">Pratinjau LPJ</button>' : ''}</div></div>
  ${err.length ? `<div class="msg ${e.status === 'disetujui' ? 'warn' : 'err'}"><b>${e.status === 'disetujui' ? 'Catatan pemeriksaan (laporan sudah disetujui):' : 'Belum bisa disetujui:'}</b><ul>${err.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<div class="msg ok">Lolos semua pemeriksaan otomatis.</div>'}
  ${e.catatan ? `<div class="msg warn"><b>Catatan revisi terakhir:</b> ${esc(e.catatan)}</div>` : ''}
  <section class="card"><h2>Kegiatan</h2><div class="tablewrap"><table class="t"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Rincian</th><th>Waktu</th><th class="n">Jam</th><th class="n">Sesi</th></tr></thead><tbody>
  ${e.kegiatan.map(k => `<tr><td style="white-space:nowrap">${k.tanggal ? tglID(k.tanggal) : '-'}</td><td>${esc(k.kategori)}</td><td>${esc(k.rincian)}${k.link ? `<br><a href="${esc(k.link)}" target="_blank" rel="noopener" class="sub">${esc(k.link)}</a>` : ''}</td>
    <td class="mono" style="white-space:nowrap">${esc(k.mulai)}–${esc(k.selesai)}</td><td class="n">${angka(jam(k))}</td><td class="n">${angka(sesi(k))}</td></tr>`).join('')}
  <tr><td colspan="4"><b>Total</b></td><td class="n"><b>${angka(totalJam(e))}</b></td><td class="n" style="white-space:nowrap"><b>${angka(totalSesi(e))}</b><div class="sub">${rp(totalSesi(e) * db.cfg.tarif)}</div></td></tr></tbody></table></div></section>
  ${e.penulis && L ? `<section class="card"><h2>LPJ</h2><p class="meta"><span>Media: ${esc(L.media)}</span><span>Hadir: ${esc(L.hadir)}</span><span>Tidak hadir: ${esc(L.tidak_hadir)}</span></p><p>${esc(L.keterangan)}</p>
    ${L.bagian.map((b, i) => `<h3 style="font-size:15px;margin:14px 0 4px">${i + 1}. ${esc(b.judul)}</h3><p style="white-space:pre-line;margin:0">${esc(b.teks)}</p>
      <div class="fotos">${b.foto.map(f => `<div class="foto"><img src="${f.data}" alt="${esc(f.ket)}"><span class="sub" style="display:block;padding:4px 8px">${esc(f.ket)}</span></div>`).join('')}</div>`).join('')}</section>` : ''}
  <section class="card"><h2>Riwayat</h2>${(e.riwayat || []).map(r => `<div class="sub meta"><span>${new Date(r.t).toLocaleString('id-ID')}</span><span>${esc(r.aksi)}</span><span>oleh ${esc(r.oleh)}</span></div>`).join('') || '<span class="sub">—</span>'}</section>`;
}
function catat(e, aksi, status) { e.status = status; (e.riwayat = e.riwayat || []).push({t: new Date().toISOString(), oleh: isKoor() ? 'Koordinator' : namaOf(e.nim), aksi}); simpan(); }
function imporKiriman(files) {
  let n = 0; const pesan = [];
  return Promise.all(files.map(f => f.text().then(txt => {
    let arr; try { arr = JSON.parse(txt); } catch (x) { pesan.push(`${f.name}: bukan file kiriman`); return; }
    for (const k of [].concat(arr)) {
      // file dari luar: periksa bentuknya sebelum dipakai
      if (!k || typeof k !== 'object' || !k.id || !k.nim || !Array.isArray(k.kegiatan) || !db.asisten.some(a => a.nim === k.nim && a.prak === k.praktikum)) { pesan.push(`${f.name}: asisten/praktikum tidak dikenal`); continue; }
      if (!k.kegiatan.every(g => g && KAT.includes(g.kategori) && /^\d{4}-\d{2}-\d{2}$/.test(g.tanggal) && /^\d{2}:\d{2}$/.test(g.mulai) && /^\d{2}:\d{2}$/.test(g.selesai))) { pesan.push(`${f.name}: isi kegiatan tidak valid`); continue; }
      if (k.laporan && (k.laporan.bagian || []).some(b => (b.foto || []).some(x => !/^data:image\/(jpeg|png);base64,/.test(x.data || '')))) { pesan.push(`${f.name}: foto tidak valid`); continue; }
      const lama = db.lap.find(x => x.id === k.id || (x.nim === k.nim && x.praktikum === k.praktikum && x.modul_no === k.modul_no));
      if (lama && lama.status === 'disetujui') { pesan.push(`${f.name}: ${namaOf(k.nim)} ${modulLabel(k)} sudah disetujui, tidak ditimpa`); continue; }
      const e = {id: k.id, nim: k.nim, praktikum: k.praktikum, modul_no: String(k.modul_no), modul_judul: String(k.modul_judul || ''),
        kegiatan: k.kegiatan.map(g => ({kategori: g.kategori, tanggal: g.tanggal, mulai: g.mulai, selesai: g.selesai, rincian: String(g.rincian || ''), link: String(g.link || '')})),
        penulis: !!k.penulis, laporan: k.penulis ? k.laporan : null, status: 'dikirim', catatan: lama?.catatan || '', riwayat: [...(lama?.riwayat || []), ...(k.riwayat || []).slice(-5)]};
      e.riwayat.push({t: new Date().toISOString(), oleh: 'Koordinator', aksi: 'impor file kiriman'});
      if (lama) db.lap.splice(db.lap.indexOf(lama), 1, e); else db.lap.push(e);
      if (/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(k.ttd || '') && k.ttd.length < 400000) (db.ttd = db.ttd || {})[k.nim] = k.ttd;
      n++;
    }
  }))).then(() => { simpan(); tampil(); if (pesan.length) alert(`${n} laporan masuk.\n\nDilewati:\n- ` + pesan.join('\n- ')); else toast(`${n} laporan masuk, menunggu tinjauan.`); });
}

/* ---------- KOORDINATOR: data ---------- */
function vData() {
  const c = db.cfg, F = [['semester', 'Semester'], ['ta', 'Tahun akademik'], ['prodi', 'Program studi'], ['unit', 'Unit (judul rekap)'], ['direktorat', 'Direktorat (judul absensi)'],
    ['menit', 'Menit per sesi'], ['tarif', 'Rupiah per sesi'], ['kaprodi', 'Ketua Program Studi'], ['nipKaprodi', 'NIP Kaprodi'], ['fakultas', 'Fakultas'], ['dekan', 'Dekan'], ['nipDekan', 'NIP Dekan'],
    ['kepada', 'Memo ditujukan kepada'], ['kota', 'Kota (memo)'], ['bank', 'Bank penerima'], ['norek', 'Nomor rekening'], ['atasNama', 'Atas nama rekening']];
  return `<h1>Data</h1><p class="sub">Diisi koordinator sekali per semester.</p>
  <section class="card"><h2>Pengaturan</h2><div class="g3">${F.map(([k, l]) => `<div class="f"><label class="l" for="c-${k}">${l}</label><input id="c-${k}" data-cfg="${k}" value="${esc(c[k])}" ${['menit', 'tarif'].includes(k) ? 'type="number" min="1"' : ''}></div>`).join('')}</div>
    <p class="sub">Aturan hitung: sesi = jam × 60 / menit per sesi; insentif = sesi × rupiah per sesi.</p></section>
  <section class="card"><h2>Praktikum</h2><div class="tablewrap"><table class="t"><thead><tr><th>Kode</th><th>Nama MK (absensi)</th><th>Judul rekap insentif</th><th>Nama di memo</th><th></th></tr></thead><tbody>
    ${db.prak.map((p, i) => `<tr>${['kode', 'nama', 'judul', 'memo'].map(k => `<td><input data-prak="${i}" data-f="${k}" value="${esc(p[k])}" aria-label="${k} praktikum ${i + 1}"></td>`).join('')}<td><button class="btn x" data-hapusprak="${i}" aria-label="Hapus praktikum">✕</button></td></tr>`).join('')}
  </tbody></table></div><button class="btn sm" data-act="tambahPrak">+ Tambah praktikum</button></section>
  <section class="card"><h2>Asisten</h2><p class="sub">Satu baris per asisten per praktikum.${ON ? ' PIN boleh dikosongkan: asisten cukup memilih nama. Bila diisi, bagikan lewat japri.' : ''}</p><div class="tablewrap"><table class="t"><thead><tr><th>NIM</th><th>Nama</th><th>Praktikum</th>${ON ? '<th>PIN</th>' : ''}<th></th></tr></thead><tbody>
    ${db.asisten.map((a, i) => `<tr><td><input data-as="${i}" data-f="nim" value="${esc(a.nim)}" inputmode="numeric" aria-label="NIM asisten ${i + 1}"></td><td><input data-as="${i}" data-f="nama" value="${esc(a.nama)}" aria-label="Nama asisten ${i + 1}"></td>
      <td><select data-as="${i}" data-f="prak" aria-label="Praktikum asisten ${i + 1}">${db.prak.map(p => `<option value="${esc(p.kode)}" ${p.kode === a.prak ? 'selected' : ''}>${esc(p.kode)}</option>`).join('')}</select></td>
      ${ON ? `<td><input data-as="${i}" data-f="pin" value="${esc(a.pin || '')}" inputmode="numeric" maxlength="6" placeholder="tanpa PIN" aria-label="PIN asisten ${i + 1}"></td>` : ''}
      <td><button class="btn x" data-hapusas="${i}" aria-label="Hapus asisten">✕</button></td></tr>`).join('')}
  </tbody></table></div><button class="btn sm" data-act="tambahAs">+ Tambah asisten</button></section>
  <section class="card"><h2>Cadangan</h2><p class="sub">${ON ? 'Data tersimpan di Google Sheet dan folder Drive. Cadangan berguna sebagai arsip per periode.' : 'Data tersimpan di peramban perangkat ini. Unduh cadangan secara berkala.'}</p>
    <div class="acts"><button class="btn" data-act="ekspor">Unduh cadangan</button><button class="btn" data-act="pulihkan">Pulihkan dari cadangan</button>
    ${ON ? '' : '<button class="btn" data-act="contoh">Kembalikan daftar awal semester ini</button><button class="btn danger" data-act="kosongkan">Kosongkan semua data</button>'}</div></section>`;
}

/* ---------- event ---------- */
const app = $('#app');
document.addEventListener('click', async ev => {
  const t = ev.target.closest('[data-act],[data-langkah],[data-buka],[data-hapuskeg],[data-hapusbag],[data-hapusfoto],[data-hapusprak],[data-hapusas],[data-cetak]');
  if (!t) return;
  const e = ui.id && lapOf(ui.id), d = t.dataset;
  if (d.buka) { ui.id = d.buka; ui.langkah = 'jam'; return tampil(); }
  if (d.langkah) { ui.langkah = d.langkah; return tampil(); }
  if (d.cetak) return bukaCetak(d.cetak, d);
  if (d.hapuskeg) { if (!confirm(`Hapus kegiatan ${+d.hapuskeg + 1}?`)) return; e.kegiatan.splice(+d.hapuskeg, 1); simpan(); return tampil(); }
  if (d.hapusbag) { if (!confirm('Hapus bagian LPJ ini beserta uraian dan fotonya?')) return; e.laporan.bagian.splice(+d.hapusbag, 1); simpan(); return tampil(); }
  if (d.hapusfoto) { if (!confirm('Hapus foto ini?')) return; e.laporan.bagian[t.closest('.bag').dataset.b].foto.splice(+d.hapusfoto, 1); simpan(); return tampil(); }
  if (d.hapusprak) { if (confirm('Hapus praktikum ini?')) { db.prak.splice(+d.hapusprak, 1); simpan(); isiPeran(); tampil(); } return; }
  if (d.hapusas) { const x = db.asisten[+d.hapusas]; if (!confirm(`Hapus ${x.nama || 'asisten'} (${x.nim || 'tanpa NIM'}) dari ${x.prak}? Laporan yang sudah ada tidak ikut terhapus.`)) return; db.asisten.splice(+d.hapusas, 1); simpan(); isiPeran(); return tampil(); }
  switch (d.act) {
    case 'baru': return dialogBaru();
    case 'ttd': return dialogTtd();
    case 'kembali': ui.id = null; return tampil();
    case 'tambahKeg': { const a = e.kegiatan[e.kegiatan.length - 1] || {}; e.kegiatan.push({kategori: 'Evaluasi', tanggal: a.tanggal || '', mulai: '', selesai: '', rincian: '', link: ''}); rinciOtomatis(e); simpan(); return tampil(); }
    case 'tambahBag': e.laporan.bagian.push({judul: '', teks: '', foto: [], tetap: false}); simpan(); return tampil();
    case 'penulis': e.penulis = t.checked; if (e.penulis && !e.laporan) e.laporan = laporanBaru(); simpan(); return tampil();
    case 'hapusLap': if (confirm('Hapus laporan modul ini?')) { db.lap.splice(db.lap.indexOf(e), 1); ui.id = null; simpan(); tampil(); } return;
    case 'kirim': {
      const err = periksaLap(e);
      if (err.length) { $('#hasil').innerHTML = `<div class="msg err" role="alert"><b>Masih ada ${err.length} hal yang perlu dilengkapi:</b><ul>${err.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`; window.scrollTo({top: $('#hasil').offsetTop - 80}); return; }
      catat(e, e.status === 'revisi' ? 'kirim ulang setelah revisi' : 'dikirim', 'dikirim'); return tampil();
    }
    case 'prevPenuh': case 'prevAbs': case 'prevLpj': {
      const lpj = d.jenis === 'lpj' || d.act === 'prevLpj';
      return bukaCetak('pratinjau', {html: lpj ? prevLPJ(e) : prevAbsensi(e), nama: `${lpj ? 'LPJ' : 'Absensi'}_${e.praktikum}_${modulLabel(e).replace(/ /g, '')}_${e.nim}`});
    }
    case 'unduhKiriman': return unduh(`Kiriman_${e.praktikum}_${modulLabel(e).replace(/ /g, '')}_${e.nim}.json`, JSON.stringify(kiriman(e)));
    case 'setujui': catat(e, 'disetujui', 'disetujui'); e.catatan = ''; ui.id = null; return tampil();
    case 'batalSetuju': if (confirm('Batalkan persetujuan? Laporan kembali menunggu tinjauan.')) { catat(e, 'persetujuan dibatalkan', 'dikirim'); tampil(); } return;
    case 'revisi': { const c = prompt('Catatan revisi untuk asisten:'); if (c && c.trim()) { e.catatan = c.trim(); catat(e, 'minta revisi: ' + e.catatan, 'revisi'); ui.id = null; tampil(); } return; }
    case 'setujuiSemua': {
      const ls = db.lap.filter(x => x.status === 'dikirim' && (!ui.fprak || x.praktikum === ui.fprak) && !periksaLap(x).length);
      if (confirm(`Setujui ${ls.length} laporan yang lolos semua pemeriksaan?`)) { ls.forEach(x => catat(x, 'disetujui', 'disetujui')); tampil(); } return;
    }
    case 'imporKiriman': return imporKiriman(await pilihFile('.json,application/json'));
    case 'tambahPrak': db.prak.push({kode: 'BARU', nama: '', judul: '', memo: ''}); simpan(); return tampil();
    case 'tambahAs': db.asisten.push({nim: '', nama: '', prak: db.prak[0]?.kode || ''}); simpan(); return tampil();
    case 'rekapExcel': if (await rekapExcel()) toast('Rekap Excel tersimpan.'); return;
    case 'ekspor': return unduh(`Cadangan_Timesheet_${hariIni()}.json`, JSON.stringify(db));
    case 'pulihkan': {
      const [f] = await pilihFile('.json'); if (!f) return;
      try { const x = JSON.parse(await f.text()); if (!x.cfg || !Array.isArray(x.lap) || !Array.isArray(x.asisten)) throw 0;
        if (confirm('Ganti semua data di perangkat ini dengan isi cadangan?')) { db = x; db.versi = db.versi || CONTOH.versi; simpan(); isiPeran(); tampil(); toast('Data dipulihkan.'); } }
      catch (x) { alert('File itu bukan cadangan Timesheet.'); } return;
    }
    case 'contoh': if (confirm(`Kembalikan ke daftar awal asisten Semester ${CONTOH.cfg.semester} ${CONTOH.cfg.ta}? Semua laporan dan perubahan di perangkat ini terhapus.`)) { db = JSON.parse(JSON.stringify(CONTOH)); simpan(); isiPeran(); tampil(); } return;
    case 'kosongkan': if (confirm('Hapus SEMUA data (praktikum, asisten, laporan) di perangkat ini?')) { db = JSON.parse(JSON.stringify(KOSONG)); simpan(); isiPeran(); tampil(); } return;
  }
});
app.addEventListener('input', ev => {
  const t = ev.target, d = t.dataset, e = ui.id && lapOf(ui.id);
  if (d.filter) { ui[d.filter] = t.value; return tampil(); }
  if (d.cfg) { db.cfg[d.cfg] = ['menit', 'tarif'].includes(d.cfg) ? +t.value : t.value; simpan(); if (['semester', 'ta'].includes(d.cfg)) isiPeran(); return; }
  if (d.prak) { db.prak[d.prak][d.f] = t.value; simpan(); return; }
  if (d.as) { db.asisten[d.as][d.f] = ['nim', 'pin'].includes(d.f) ? t.value.replace(/\D/g, '') : t.value; simpan(); return; }
  if (!e) return;
  if (d.e) { e[d.e] = t.value; rinciOtomatis(e); document.querySelectorAll('.keg').forEach(el => { const k = e.kegiatan[el.dataset.i]; if (!k.ubah) el.querySelector('textarea').value = k.rincian; }); }
  if (d.k) { const k = e.kegiatan[t.closest('.keg').dataset.i]; k[d.k] = t.classList.contains('jam24') ? normJam(t.value) : t.classList.contains('tgl') ? teksKeIso(t.value) : t.value; if (d.k === 'rincian') k.ubah = true;
    if (d.k === 'kategori') { k.ubah = false; rinciOtomatis(e); simpan(); return tampil(); } ringkas(e); }
  if (d.l) e.laporan[d.l] = t.value;
  if (d.bf) e.laporan.bagian[t.closest('.bag').dataset.b][d.bf] = t.value;
  if (d.ket) e.laporan.bagian[t.closest('.bag').dataset.b].foto[d.ket].ket = t.value;
  simpan();
});
app.addEventListener('change', async ev => {
  const t = ev.target; if (!t.hasAttribute('data-tambahfoto')) return;
  const b = lapOf(ui.id).laporan.bagian[t.closest('.bag').dataset.b];
  for (const f of t.files) { try { b.foto.push({data: await kecilkan(f), ket: ''}); } catch (x) { alert(`Foto "${f.name}" tidak bisa dibaca.`); } }
  simpan(); tampil();
});

/* ---------- mulai ---------- */
(async () => {
  if (ON) db = await ONLINE.muat();
  else try { db = await idb('readonly', s => s.get('db')); } catch (x) { toast('Penyimpanan perangkat tidak tersedia; data hilang saat halaman ditutup.'); }
  if (ON) { /* data dari Google Sheet */ } else if (!db) { db = JSON.parse(JSON.stringify(CONTOH)); simpan(); }
  else if (db.versi !== CONTOH.versi) {
    // ganti semester: daftar praktikum & asisten diganti; laporan contoh lama dan milik asisten yang tidak terdaftar lagi dibuang
    const nims = new Set(CONTOH.asisten.map(a => a.nim));
    // NIM bisa dikoreksi antarversi: laporan dipindah ke NIM baru lewat nama asisten
    const namaLama = new Map(db.asisten.map(a => [a.nim, a.nama])), nimBaru = new Map(CONTOH.asisten.map(a => [a.nama, a.nim]));
    db.lap.forEach(e => { const n = nimBaru.get(namaLama.get(e.nim)); if (n) e.nim = n; });
    Object.assign(db, {versi: CONTOH.versi, prak: CONTOH.prak, asisten: CONTOH.asisten, cfg: {...db.cfg, semester: CONTOH.cfg.semester, ta: CONTOH.cfg.ta},
      lap: db.lap.filter(e => !String(e.id).startsWith('contoh-') && nims.has(e.nim))});
    simpan();
  }
  ui.peran = lokal('ts-peran') || (ON ? '' : 'koordinator');
  if (ON && !(await ONLINE.masuk(ui.peran))) ui.peran = '';
  const bl = db.lap.filter(e => e.status === 'disetujui').flatMap(e => e.kegiatan.map(k => k.tanggal.slice(0, 7))).filter(Boolean).sort();
  ui.dari = bl[0] || hariIni().slice(0, 7); ui.sampai = bl[bl.length - 1] || ui.dari;
  isiPeran(); dariAlamat(); tampil();
})();

// rapikan tampilan jam setelah kolom ditinggalkan; durasi diperbarui
app.addEventListener('change', ev => {
  const t = ev.target; if (!t.classList.contains('jam24')) return;
  const v = normJam(t.value); t.setCustomValidity(t.value && !v ? 'Format jam 24 jam, mis. 13:00' : ''); t.reportValidity();
  if (v) { t.value = v; const e = lapOf(ui.id), k = e?.kegiatan[t.closest('.keg').dataset.i]; if (k) t.closest('.keg').querySelector('.dur').textContent = jam(k) ? angka(jam(k)) + ' jam' : '—'; }
});

// rapikan teks tanggal saat kolom ditinggalkan; tombol kalender membuka pemilih bawaan browser
app.addEventListener('change', ev => {
  const t = ev.target;
  if (t.classList.contains('pickd')) { const x = t.closest('.tglw').querySelector('.tgl'); x.value = isoKeTeks(t.value); x.dispatchEvent(new Event('input', {bubbles: true})); x.dispatchEvent(new Event('change', {bubbles: true})); return; }
  if (!t.classList.contains('tgl')) return;
  const iso = teksKeIso(t.value); t.setCustomValidity(t.value && !iso ? 'Format tanggal hh/bb/tttt, mis. 02/11/2026' : ''); t.reportValidity();
  if (iso) { t.value = isoKeTeks(iso); t.closest('.tglw').querySelector('.pickd').value = iso; }
});
app.addEventListener('click', ev => {
  const b = ev.target.closest('[data-pick]'); if (!b) return;
  const p = b.parentElement.querySelector('.pickd'); try { p.showPicker(); } catch { p.click(); }
});
let alamatAwal = true;
function keAlamat() {
  const h = ui.id ? `#lap/${ui.id}${isKoor() ? '' : '/' + (ui.langkah || 'jam')}` : '#' + ui.tab;
  if (location.hash !== h) history[alamatAwal ? 'replaceState' : 'pushState'](null, '', h);
  alamatAwal = false;
}
function dariAlamat() {
  const [jenis, id, langkah] = location.hash.slice(1).split('/');
  if (jenis === 'lap') {
    const e = lapOf(id); if (!e || !(isKoor() || e.nim === ui.peran)) return false;
    ui.id = id; ui.langkah = LANGKAH.some(x => x[0] === langkah) ? langkah : 'jam';
  } else { ui.id = null; if (jenis) ui.tab = jenis; }
  return true;
}
window.addEventListener('popstate', () => {
  if (document.body.classList.contains('mencetak')) { document.body.classList.remove('mencetak'); $('#cetak').innerHTML = ''; document.title = judulAsli; }
  dariAlamat(); tampil();
});
