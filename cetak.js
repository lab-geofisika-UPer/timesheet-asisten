'use strict';
/* Berkas pengajuan: rekap periode + dokumen cetak A4 yang meniru templat asli
   (Absensi & Insentif = templat Excel, LPJ & Memo = templat Word). */

const disetujui = () => db.lap.filter(e => e.status === 'disetujui');
function bulanDalam(dari, sampai) {
  const out = []; let [y, m] = dari.split('-').map(Number); const [y2, m2] = sampai.split('-').map(Number);
  while (y < y2 || (y === y2 && m <= m2)) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } }
  return out;
}
const dalamPeriode = t => t && t.slice(0, 7) >= ui.dari && t.slice(0, 7) <= ui.sampai;
const kegBulan = (kode, ym) => disetujui().filter(e => e.praktikum === kode)
  .flatMap(e => e.kegiatan.filter(k => k.tanggal.startsWith(ym)).map(k => ({...k, e})));
const urutAsisten = nims => db.asisten.map(a => a.nim).filter((n, i, s) => nims.includes(n) && s.indexOf(n) === i);
const durasi = h => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}:00`;
const detik = t => t ? t + ':00' : '';
const sumSesi = ks => Math.round(ks.reduce((s, k) => s + sesi(k), 0) * 100) / 100;
function perModul(ks) { // kelompok per modul, urut tanggal kegiatan pertama
  const g = {};
  ks.slice().sort((a, b) => (a.tanggal + a.mulai).localeCompare(b.tanggal + b.mulai)).forEach(k => (g[k.e.modul_no] = g[k.e.modul_no] || []).push(k));
  return Object.entries(g).sort((a, b) => (a[1][0].tanggal + a[1][0].mulai).localeCompare(b[1][0].tanggal + b[1][0].mulai));
}
const praktikumPeriode = () => db.prak.filter(p => bulanDalam(ui.dari, ui.sampai).some(ym => kegBulan(p.kode, ym).length));
const modulPeriode = kode => [...new Set(disetujui().filter(e => e.praktikum === kode && e.kegiatan.some(k => dalamPeriode(k.tanggal))).map(e => e.modul_no))].sort((a, b) => urutModul(a) - urutModul(b));
const penulisLPJ = (kode, no) => disetujui().filter(e => e.praktikum === kode && e.modul_no === no && e.penulis && e.laporan);

/* ---------- halaman Berkas ---------- */
function pilihBulan(id, key) {
  const tg = db.lap.flatMap(e => e.kegiatan.map(k => k.tanggal)).filter(Boolean).sort(), kini = hariIni().slice(0, 7);
  const min = [tg[0]?.slice(0, 7) || kini, ui.dari, ui.sampai].sort()[0], max = [tg[tg.length - 1]?.slice(0, 7) || kini, kini, ui.dari, ui.sampai].sort().pop();
  return `<select id="${id}" data-ui="${key}">${bulanDalam(min, max).map(ym => `<option value="${ym}" ${ui[key] === ym ? 'selected' : ''}>${bulanID(ym)}</option>`).join('')}</select>`;
}
const bulanAda = kode => bulanDalam(ui.dari, ui.sampai).filter(ym => kegBulan(kode, ym).length);
const BUNDEL = [ // urutan & pembagian sama dengan berkas yang diserahkan ke keuangan
  {k: 'memo', judul: 'Memo & Rekapitulasi', kertas: 'A4 tegak', ket: 'Ditandatangani Kaprodi dan Dekan.'},
  {k: 'absensi', judul: 'Absensi', kertas: 'A4 melintang', ket: 'Satu halaman per asisten per bulan.'},
  {k: 'insentif', judul: 'Insentif', kertas: 'A4 melintang', ket: 'Rekap dan tanda terima per praktikum per bulan.'},
  {k: 'laporan', judul: 'Laporan (LPJ)', kertas: 'A4 tegak', ket: 'Satu laporan per modul.'}];
function isiBundel(k) {
  const pr = praktikumPeriode();
  if (k === 'memo') return docMemo();
  if (k === 'absensi') return pr.map(p => bulanAda(p.kode).map(ym => docAbsensi(p.kode, ym)).join('')).join('');
  if (k === 'insentif') return pr.map(p => bulanAda(p.kode).map(ym => docInsentif(p.kode, ym)).join('')).join('');
  if (k === 'laporan') return pr.map(p => modulPeriode(p.kode).map(no => semuaLPJ(p.kode, no)).join('')).join('');
}
function vBerkas() {
  if (!ui.dari) { ui.dari = ui.sampai = hariIni().slice(0, 7); }
  const pr = praktikumPeriode(), cek = cekPeriode();
  let total = 0;
  const baris = pr.map(p => {
    const bl = bulanAda(p.kode);
    return bl.map((ym, i) => {
      const ks = kegBulan(p.kode, ym), s = sumSesi(ks); total += s;
      return `<tr>${i === 0 ? `<td rowspan="${bl.length}"><b>${esc(p.memo || p.nama)}</b><div class="docbtns" style="margin-top:6px">${modulPeriode(p.kode).map(no =>
        `<button class="btn sm" data-cetak="lpj" data-kode="${esc(p.kode)}" data-mod="${esc(no)}" ${penulisLPJ(p.kode, no).length ? '' : 'disabled title="Belum ada LPJ yang disetujui"'}>LPJ ${esc(NAMA_MODUL[no] ? labelNo(no) : 'M' + no)}${penulisLPJ(p.kode, no).length > 1 ? ` (${penulisLPJ(p.kode, no).length})` : ''}</button>`).join('')}</div></td>` : ''}
        <td style="white-space:nowrap">${bulanID(ym)}</td><td class="n">${urutAsisten(ks.map(k => k.e.nim)).length}</td><td class="n">${angka(s)}</td><td class="n">${rp(s * db.cfg.tarif)}</td>
        <td><div class="docbtns"><button class="btn sm" data-cetak="absensi" data-kode="${esc(p.kode)}" data-ym="${ym}">Absensi</button><button class="btn sm" data-cetak="insentif" data-kode="${esc(p.kode)}" data-ym="${ym}">Insentif</button></div></td></tr>`;
    }).join('');
  }).join('');
  const hal = Object.fromEntries(BUNDEL.map(b => [b.k, pr.length ? (isiBundel(b.k).match(/class="pg /g) || []).length : 0]));
  return `<h1>Berkas pengajuan</h1><p class="sub">Dihitung dari laporan yang sudah <b>disetujui</b>. Setiap berkas dipratinjau lalu dicetak atau disimpan sebagai PDF.</p>
  <section class="card"><div class="g4">
    <div><label class="l" for="bDari">Dari bulan</label>${pilihBulan('bDari', 'dari')}</div>
    <div><label class="l" for="bSampai">Sampai bulan</label>${pilihBulan('bSampai', 'sampai')}</div>
    <div><label class="l" for="bNo">Nomor memo</label><input id="bNo" data-ui="nomor" value="${esc(ui.nomor)}"></div>
    <div><label class="l" for="bTgl">Tanggal memo</label>${tglInput('bTgl', 'data-ui="tglMemo"', ui.tglMemo)}</div></div></section>
  ${cek.length ? `<div class="msg warn"><b>Periksa sebelum mengajukan:</b><ul>${cek.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : (pr.length ? '<div class="msg ok">Semua laporan di periode ini sudah disetujui dan konsisten.</div>' : '')}
  <div class="bundel">${BUNDEL.map((b, i) => `<div class="card bd"><span class="no">${i + 1}</span><div><b>${b.judul}</b><span class="sub meta"><span>${b.kertas}</span><span>${hal[b.k]} halaman</span></span><span class="sub">${b.ket}</span></div>
    <button class="btn ${i ? '' : 'primary'}" data-cetak="${b.k}Semua" ${hal[b.k] ? '' : 'disabled'}>Pratinjau &amp; cetak</button></div>`).join('')}</div>
  <section class="card"><h2>Rekap Excel</h2><p class="sub">Rekap insentif dan kegiatan yang disetujui di periode ini, ditambah sheet kegiatan yang belum disetujui, dalam satu file .xlsx. Simpan ke folder OneDrive agar tersinkron.</p>
    <div class="acts"><button class="btn" data-act="rekapExcel">Unduh rekap Excel</button></div></section>
  <section class="card"><h2>Rincian per praktikum</h2><div class="tablewrap"><table class="t"><thead><tr><th>Praktikum &amp; LPJ</th><th>Bulan</th><th class="n">Asisten</th><th class="n">Sesi</th><th class="n">Insentif</th><th>Berkas</th></tr></thead><tbody>
  ${baris || '<tr><td colspan="6" class="empty">Belum ada laporan disetujui di periode ini.</td></tr>'}
  ${pr.length ? `<tr><td colspan="3"><b>Total periode</b></td><td class="n"><b>${angka(total)}</b></td><td class="n"><b>${rp(total * db.cfg.tarif)}</b></td><td></td></tr>` : ''}
  </tbody></table></div></section>`;
}
function cekPeriode() {
  const out = [], semua = db.lap.filter(e => e.kegiatan.some(k => dalamPeriode(k.tanggal)));
  const belum = semua.filter(e => e.status !== 'disetujui');
  if (belum.length) out.push(`${belum.length} laporan belum disetujui sehingga tidak dihitung: ` + belum.map(e => `${namaOf(e.nim)} (${e.praktikum} ${modulLabel(e)}, ${STATUS[e.status].toLowerCase()})`).join('; '));
  praktikumPeriode().forEach(p => modulPeriode(p.kode).forEach(no => {
    const pn = penulisLPJ(p.kode, no), lbl = `${p.memo || p.kode} ${labelNo(no)}`;
    if (!pn.length) out.push(`LPJ ${lbl} belum ada (tidak ada penulis LPJ yang disetujui).`);
    if (pn.length > 1 && pn.some(e => !String(e.laporan.topik || '').trim())) out.push(`${lbl} punya ${pn.length} LPJ, tetapi ada yang belum mengisi metode/topik.`);
  }));
  const per = {};
  disetujui().forEach(e => e.kegiatan.filter(k => dalamPeriode(k.tanggal)).forEach(k => (per[e.nim] = per[e.nim] || []).push({...k, e})));
  Object.entries(per).forEach(([nim, ks]) => ks.forEach((a, i) => ks.slice(i + 1).forEach(b => {
    if (bertumpuk(a, b)) out.push(`${namaOf(nim)}: jam bertumpuk pada ${tglID(a.tanggal)} (${a.e.praktikum} ${modulLabel(a.e)} dan ${b.e.praktikum} ${modulLabel(b.e)}).`);
  })));
  return out;
}

/* ---------- dokumen ---------- */
function docAbsensi(kode, ym, ks = kegBulan(kode, ym)) {
  const p = prakOf(kode), c = db.cfg, bln = BLN[+ym.slice(5) - 1];
  return urutAsisten(ks.map(k => k.e.nim)).map(nim => {
    const milik = ks.filter(k => k.e.nim === nim);
    let no = 0, total = 0;
    const isi = perModul(milik).map(([, g]) => {
      const sub = g.reduce((s, k) => s + jam(k), 0); total += sub;
      return g.map(k => `<tr><td>${++no}</td><td class="small">${tglID(k.tanggal)}</td><td>${esc(k.kategori)}</td><td class="kiri small">${esc(k.rincian)}</td>
        <td>${detik(k.mulai)}</td><td>${detik(k.selesai)}</td><td>${durasi(jam(k))}</td><td class="kiri" style="font-size:8pt;word-break:break-all">${esc(k.link)}</td></tr>`).join('')
        + `<tr class="kuning"><td colspan="6" class="b">Subtotal Jam Kerja</td><td>${durasi(sub)}</td><td></td></tr>`;
    }).join('');
    return `<div class="pg land xl"><div class="fit" data-tinggi="1"><table>
      <tr><td colspan="8" class="biru">ABSENSI MAGANG BULAN ${bln.toUpperCase()}</td></tr><tr><td colspan="8" class="biru">${esc(c.direktorat)}</td></tr></table>
      <table class="idt" style="width:auto;margin:14px 0 14px 50px">${[['Nama', namaOf(nim)], ['NIM', nim], ['Prodi', c.prodi], ['MK', p.nama]].map(([a, b]) => `<tr><td style="width:120px">${a}</td><td>: ${esc(b)}</td></tr>`).join('')}</table>
      <table><colgroup><col style="width:4%"><col style="width:12%"><col style="width:10%"><col style="width:36%"><col style="width:8%"><col style="width:8%"><col style="width:9%"><col style="width:13%"></colgroup>
      <tr class="biru"><td>No.</td><td>Tanggal</td><td>Kategori Kegiatan</td><td>Rincian Kegiatan</td><td>Waktu Mulai</td><td>Waktu Selesai</td><td>Jumlah Jam Kerja</td><td>Tautan Dokumen Output Pekerjaan</td></tr>
      ${isi}<tr class="kuning"><td colspan="6" class="b">Grand Total Jam Kerja Bulan ${bln}</td><td class="b">${durasi(total)}</td><td></td></tr></table>
      <div class="ttd"><div><b>Penanggungjawab</b><br>Ketua Program Studi ${esc(c.prodi)}<div class="nm">${esc(c.kaprodi)}</div><b>NIP. ${esc(c.nipKaprodi)}</b></div>
        <div><b>Mahasiswa</b><br>Asisten Praktikum<div class="nm">${esc(namaOf(nim))}</div><b>NIM. ${esc(nim)}</b></div></div></div></div>`;
  }).join('');
}
function docInsentif(kode, ym) {
  const p = prakOf(kode), c = db.cfg, ks = kegBulan(kode, ym), nims = urutAsisten(ks.map(k => k.e.nim));
  // satu kolom per (modul, tanggal, kategori); sel = sesi asisten itu pada kolom tsb.
  const grup = perModul(ks).map(([no, g]) => {
    const kol = [...new Map(g.slice().sort((a, b) => a.tanggal.localeCompare(b.tanggal) || KAT.indexOf(a.kategori) - KAT.indexOf(b.kategori))
      .map(k => [`${k.tanggal}|${k.kategori}`, k])).values()];
    return {label: labelNo(no), no, kol};
  });
  const semuaKol = grup.flatMap(g => g.kol.map(k => ({...k, no: g.no})));
  const sel = (nim, k) => sumSesi(ks.filter(x => x.e.nim === nim && x.e.modul_no === k.no && x.tanggal === k.tanggal && x.kategori === k.kategori));
  const tarifTeks = 'Rp. ' + (+c.tarif).toLocaleString('id-ID');
  const halaman = ttd => {
    let tot = 0;
    const rows = nims.map((nim, i) => {
      const s = sumSesi(ks.filter(k => k.e.nim === nim)); tot += s;
      return `<tr style="height:${ttd ? 34 : 24}px"><td>${i + 1}</td><td>${esc(nim)}</td><td class="kiri">${esc(namaOf(nim))}</td><td>${esc(c.prodi)}</td>
        ${semuaKol.map(k => { const v = sel(nim, k); return `<td>${v ? angka(v) : ''}</td>`; }).join('')}<td>${angka(s)}</td><td>${rpMemo(s * c.tarif)}</td>
        ${ttd ? `<td style="text-align:${i % 2 ? 'right' : 'left'};white-space:nowrap">${i + 1}.${(db.ttd || {})[nim] ? ` <img src="${(db.ttd || {})[nim]}" alt="" style="height:28px;max-width:96px;vertical-align:middle">` : ''}</td>` : ''}</tr>`;
    }).join('');
    return `<div class="pg land xl"><div class="fit" data-tinggi="1"><table class="judul">${[`REKAP ABSENSI ASISTEN PRAKTIKUM SEMESTER ${String(c.semester).toUpperCase()} TA. ${c.ta}`, p.judul, c.unit, `BULAN ${bulanID(ym).toUpperCase()}`].map(t => `<tr><td>${esc(t)}</td></tr>`).join('')}</table>
      <table style="margin-top:22px"><tr class="biru"><td rowspan="2">NO</td><td rowspan="2">NIM ASPRAK</td><td rowspan="2">NAMA ASPRAK</td><td rowspan="2">PRODI</td>
        ${grup.map(g => `<td colspan="${g.kol.length}">${esc(g.label)}</td>`).join('')}<td rowspan="2">TOTAL (SESI)</td><td rowspan="2">TOTAL INSENTIF<br>(1 sesi ${tarifTeks})</td>${ttd ? '<td rowspan="2" style="width:120px">TANDA TANGAN</td>' : ''}</tr>
      <tr>${semuaKol.map(k => `<td class="kuning b">${+k.tanggal.slice(8)}</td>`).join('')}</tr>
      ${rows}<tr class="kuning b"><td colspan="${4 + semuaKol.length}">TOTAL</td><td>${angka(tot)}</td><td>${rpMemo(tot * c.tarif)}</td>${ttd ? '<td></td>' : ''}</tr></table>
      <div class="ttd" style="justify-content:flex-end;margin-right:40px"><div>Mengajukan,<br>Ketua Program Studi<div class="nm">${esc(c.kaprodi)}</div><b>NIP. ${esc(c.nipKaprodi)}</b></div></div></div></div>`;
  };
  return halaman(false) + halaman(true);
}
const semuaLPJ = (kode, no) => penulisLPJ(kode, no).map(e => docLPJ(kode, no, e)).join('');
function docLPJ(kode, no, e = penulisLPJ(kode, no)[0], nimsTambahan = []) {
  const p = prakOf(kode); if (!e) return '';
  const L = e.laporan, pel = e.kegiatan.find(k => k.kategori === 'Pelaksanaan') || e.kegiatan[0];
  const sendiri = String(L.topik || '').trim() || db.lap.some(x => x !== e && x.praktikum === kode && x.modul_no === no && x.penulis && x.laporan);
  const nims = sendiri ? [e.nim] : urutAsisten([...disetujui().filter(x => x.praktikum === kode && x.modul_no === no).map(x => x.nim), ...nimsTambahan]);
  const judul = modulPanjang(e) + (String(L.topik || '').trim() ? ' - ' + L.topik.trim() : ''), tahun = hariIni().slice(0, 4);
  return `<div class="pg port wd"><table class="rp">
    <thead><tr><td><div class="kop"><img src="assets/logo-lpj.png" alt="Universitas Pertamina"><div>LAPORAN PEMBELAJARAN<br>PRAKTIKUM ${esc(String(p.memo || p.nama).toUpperCase())}<br>${esc(judul.toUpperCase())}</div></div></td></tr></thead>
    <tfoot><tr><td><div class="kaki">© ${tahun} Teknik Geofisika, Universitas Pertamina.</div></td></tr></tfoot>
    <tbody><tr><td><div class="isi">
      <table class="idn" style="margin:0 0 12px 20px">
        <tr><td>Asisten</td><td>:</td><td>${nims.map((n, i) => `${i + 1}. ${esc(namaOf(n))}`).join('<br>')}</td></tr>
        <tr><td>Hari/ Tanggal</td><td>:</td><td>${hariID(pel.tanggal)}, ${tglID(pel.tanggal)}</td></tr>
        <tr><td>Waktu</td><td>:</td><td>${pel.mulai.replace(':', '.')} – ${pel.selesai.replace(':', '.')} WIB</td></tr>
        <tr><td>Media Pelaksanaan</td><td>:</td><td>${esc(L.media)}</td></tr></table>
      <p class="ket-j">Keterangan Pelaksanaan Praktikum:</p>
      <p>Pada praktikum ${esc(judul)} terdapat ${esc(L.hadir)} mahasiswa yang hadir dan ${esc(L.tidak_hadir)} mahasiswa yang tidak hadir. ${esc(L.keterangan)}</p>
      ${L.bagian.map((b, i) => `<h4>${i + 1}. ${esc(b.judul)}</h4>${String(b.teks).split('\n').filter(s => s.trim()).map(s => `<p class="in">${esc(s.trim())}</p>`).join('')}
        ${b.foto.map((f, j) => `<figure><img src="${f.data}" alt=""><figcaption>Gambar ${i + 1}.${j + 1}. ${esc(f.ket || b.judul)}</figcaption></figure>`).join('')}`).join('')}
    </div></td></tr></tbody></table></div>`;
}
function rekapMemo() {
  const bl = bulanDalam(ui.dari, ui.sampai);
  return praktikumPeriode().map(p => ({p, bulan: bl.map(ym => ({ym, rp: sumSesi(kegBulan(p.kode, ym)) * db.cfg.tarif}))}));
}
function docMemo() {
  const c = db.cfg, rk = rekapMemo(), total = rk.reduce((s, r) => s + r.bulan.reduce((t, b) => t + b.rp, 0), 0);
  const fak = c.fakultas || 'Fakultas Teknologi Eksplorasi dan Produksi';
  const per = ui.dari === ui.sampai ? bulanID(ui.dari) : `${bulanID(ui.dari)} – ${bulanID(ui.sampai)}`;
  const halaman = isi => `<div class="pg port memo"><img class="logo" src="assets/kop-memo.jpeg" alt="Universitas Pertamina"><div class="badan"><div class="fit" data-tinggi="1">${isi}</div></div><img class="foot" src="assets/footer-memo.png" alt=""></div>`;
  const ttdK = `${esc(c.kaprodi)}`;
  return halaman(`<h3>MEMORANDUM</h3><div class="no">No.${esc(ui.nomor)}</div><br>
    <p>${esc(c.kota)}, ${tglID(ui.tglMemo)}</p><br>
    <table class="kv"><tr><td style="width:30mm">Kepada</td><td>:</td><td>${esc(c.kepada)}</td></tr><tr><td>Dari</td><td>:</td><td>Ketua Program Studi ${esc(c.prodi)}</td></tr>
      <tr><td>Lampiran</td><td>:</td><td>1 (satu) berkas</td></tr><tr><td>Perihal</td><td>:</td><td><b><u>Permohonan Pembayaran Insentif Asisten Praktikum Program Studi ${esc(c.prodi)}</u></b></td></tr></table><br>
    <p>Sehubungan dengan Peraturan Rektor Universitas Pertamina Nomor: 0008/UP-R/PER/HK.00/VII/2021 tentang Pekerjaan Paruh Waktu untuk mahasiswa di Lingkungan Kampus Universitas Pertamina, maka dengan ini kami memohon pelaksanaan penerbitan Surat Permintaan Proses Pembayaran (SPPP) insentif tersebut.</p>
    <p>Adapun pelaksanaan kerja paruh waktu oleh mahasiswa magang sebagai Asisten Praktikum telah dilaksanakan pada Bulan ${per} Tahun Akademik ${esc(c.ta)} dengan rincian terlampir.</p>
    <p>Total insentif yang harus di bayarkan adalah sebesar <b>${rpMemo(total)}</b> dan mohon ditransfer ke rekening Bank ${esc(c.bank)} nomor rekening ${esc(c.norek)} atas nama ${esc(c.atasNama)}</p>
    <p>Demikian memorandum ini kami sampaikan untuk dapat disetujui dan diproses. Atas perhatian dan kerjasama yang telah diberikan, kami ucapkan terima kasih.</p><br>
    <div>Hormat kami,<br><b>Ketua Program Studi ${esc(c.prodi)}</b><br><br><br><br><b><u>${ttdK}</u></b><br><b>NIP. ${esc(c.nipKaprodi)}</b></div><br>
    <div style="font-size:10pt;line-height:1.15">Tembusan:<ol style="margin:0;padding-left:18px"><li>Arsip Dekan ${esc(fak)}</li><li>Arsip Program Studi ${esc(c.prodi)}</li></ol></div>`) + halaman(`<h3 style="text-decoration:none;font-size:14pt;margin:4mm 10mm 4mm">Rekapitulasi Anggaran Pengajuan Honor Asisten Praktikum Program Studi ${esc(c.prodi)}</h3>
    <table class="rk"><tr><th>No</th><th>Nama Praktikum</th><th></th><th>Bulan Pengajuan</th><th>Nominal Pengajuan</th></tr>
    ${rk.map((r, i) => r.bulan.map((b, j) => `<tr>${j === 0 ? `<td rowspan="${r.bulan.length}" style="text-align:center">${i + 1}</td><td rowspan="${r.bulan.length}">${esc(r.p.memo || r.p.nama)}</td><td rowspan="${r.bulan.length}">:</td>` : ''}
      <td>${bulanID(b.ym)}</td><td>${b.rp ? rpMemo(b.rp) : '-'}</td></tr>`).join('')).join('')}
    <tr><td colspan="4" style="text-align:center;padding:8px"><b>Total Keseluruhan</b></td><td><b>${rpMemo(total)}</b></td></tr></table>
    <div class="tt"><div>Mengetahui,<br>Ketua Program Studi ${esc(c.prodi)}<br><br><br><br><b><u>${ttdK}</u></b><br>NIP. ${esc(c.nipKaprodi)}</div>
      <div>Menyetujui<br>Dekan ${esc(fak)}<br><br><br><br><b><u>${esc(c.dekan)}</u></b><br>NIP. ${esc(c.nipDekan)}</div></div>`);
}

/* ---------- pratinjau & cetak ---------- */
let judulAsli = document.title;
function bukaCetak(jenis, d) {
  let html = '', nama = '';
  const per = `${ui.dari}_${ui.sampai}`;
  if (jenis === 'absensi') { html = docAbsensi(d.kode, d.ym); nama = `Absensi_${d.kode}_${d.ym}`; }
  if (jenis === 'insentif') { html = docInsentif(d.kode, d.ym); nama = `Insentif_${d.kode}_${d.ym}`; }
  if (jenis === 'lpj') { html = semuaLPJ(d.kode, d.mod); nama = `LPJ_${d.kode}_${labelNo(d.mod).replace(/ /g, "")}`; }
  if (jenis === 'memo') { html = docMemo(); nama = `Memo_Insentif_${per}`; }
  const bd = BUNDEL.find(x => jenis === x.k + 'Semua');
  if (bd) { html = isiBundel(bd.k); nama = `${bd.judul.split(' ')[0]}_${per}`; }
  if (jenis === 'pratinjau') { html = d.html; nama = d.nama; }
  const n = (html.match(/class="pg /g) || []).length;
  let gaya = document.getElementById('gayaHalaman');
  if (!gaya) { gaya = document.createElement('style'); gaya.id = 'gayaHalaman'; document.head.appendChild(gaya); }
  gaya.textContent = `@page{size:A4 ${html.includes('class="pg land') ? 'landscape' : 'portrait'};margin:0}`;
  $('#cetak').innerHTML = `<div class="tb"><b>${esc(nama)}</b><span class="sub" style="margin-right:auto">${n} halaman</span><button class="btn" data-act="tutupCetak">Tutup</button><button class="btn primary" data-act="print">Cetak / Simpan PDF</button></div>${html}`;
  document.title = nama; // dipakai browser sebagai nama file PDF
  document.body.classList.add('mencetak'); window.scrollTo(0, 0);
  pasKertas($('#cetak'));
}
/* Skala isi agar tidak terpotong: lebar selalu pas kertas; memo juga tingginya (harus 1 halaman).
   Di layar, seluruh halaman diperkecil mengikuti lebar jendela (tidak memengaruhi hasil cetak). */
function pasKertas(akar) {
  const jalankan = () => {
    akar.style.setProperty('--zl', '1');
    akar.querySelectorAll('.fit').forEach(f => {
      f.style.zoom = '';
      const k = f.parentElement, cs = getComputedStyle(k);
      let r = (k.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / f.scrollWidth;
      if (f.dataset.tinggi) r = Math.min(r, (k.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / f.scrollHeight);
      if (r < 0.995) f.style.zoom = (Math.floor(r * 1000) / 1000).toString();
    });
    const pg = akar.querySelector('.pg');
    if (pg) akar.style.setProperty('--zl', Math.min(1, (akar.clientWidth - 24) / pg.offsetWidth).toFixed(3));
  };
  jalankan();
  akar.querySelectorAll('img').forEach(i => { if (!i.complete) i.addEventListener('load', jalankan, {once: true}); });
}
window.addEventListener('resize', () => { if (document.body.classList.contains('mencetak')) pasKertas($('#cetak')); });
document.addEventListener('click', ev => {
  const a = ev.target.closest('[data-act]')?.dataset.act;
  if (a === 'print') window.print();
  if (a === 'tutupCetak') { document.body.classList.remove('mencetak'); $('#cetak').innerHTML = ''; document.title = judulAsli; }
});
app.addEventListener('change', ev => {
  const k = ev.target.dataset.ui; if (!k) return;
  if (ev.target.classList.contains('tgl')) { const iso = teksKeIso(ev.target.value); if (!iso) return; ui[k] = iso; } else ui[k] = ev.target.value;
  if (ui.dari > ui.sampai) ui[k === 'dari' ? 'sampai' : 'dari'] = ui[k];
  tampil();
});

/* ---------- pratinjau satu laporan (sebelum disetujui) ---------- */
function prevAbsensi(e) {
  const ks = e.kegiatan.filter(k => k.tanggal && jam(k) > 0).map(k => ({...k, e}));
  return [...new Set(ks.map(k => k.tanggal.slice(0, 7)))].sort().map(ym => docAbsensi(e.praktikum, ym, ks.filter(k => k.tanggal.startsWith(ym)))).join('');
}
function prevLPJ(e) {
  const penulis = e.penulis ? e : db.lap.find(x => x !== e && x.praktikum === e.praktikum && x.modul_no === e.modul_no && x.penulis && x.laporan);
  if (!penulis || !penulis.laporan || !penulis.kegiatan.some(k => k.kategori === 'Pelaksanaan' && k.tanggal && k.mulai && k.selesai)) return '';
  return docLPJ(e.praktikum, e.modul_no, penulis, [penulis.nim, e.nim]);
}

/* ---------- rekap Excel: sheet Log/Asisten/Praktikum/Pengaturan sama dengan Master_Timesheet.xlsx (buat_berkas.py) ---------- */
const KOL_LOG = [{h: 'Tanggal', w: 11}, {h: 'Praktikum', w: 10}, {h: 'Modul'}, {h: 'Kategori', w: 12}, {h: 'Rincian', w: 60}, {h: 'Mulai', w: 7}, {h: 'Selesai', w: 7}, {h: 'Asisten', w: 12}, {h: 'Link Output', w: 30},
  {h: 'Nama', w: 32}, {h: 'Jam', w: 7}, {h: 'Sesi', w: 7}, {h: 'Insentif', w: 12}, {h: 'Status', w: 18}];
function rekapExcel() {
  const c = db.cfg, tarif = +c.tarif || 0;
  const ks = db.lap.flatMap(e => e.kegiatan.filter(k => dalamPeriode(k.tanggal)).map(k => ({...k, e})))
    .sort((a, b) => (a.tanggal + a.mulai).localeCompare(b.tanggal + b.mulai));
  const baris = k =>  [{d: k.tanggal}, k.e.praktikum, modulLabel(k.e), k.kategori, k.rincian, k.mulai ? {t: k.mulai} : null, k.selesai ? {t: k.selesai} : null,
    k.e.nim, k.link, namaOf(k.e.nim), Math.round(jam(k) * 100) / 100, sesi(k), {rp: sesi(k) * tarif}, STATUS[k.e.status]];
  const ok = ks.filter(k => k.e.status === 'disetujui'), belum = ks.filter(k => k.e.status !== 'disetujui');
  const per = {};
  ok.forEach(k => {
    const key = [k.e.praktikum, k.e.nim, k.tanggal.slice(0, 7)].join('|'), r = per[key] = per[key] || {kode: k.e.praktikum, nim: k.e.nim, ym: k.tanggal.slice(0, 7), jam: 0, sesi: 0, n: 0};
    r.jam += jam(k); r.sesi += sesi(k); r.n++;
  });
  const rekap = Object.values(per).sort((a, b) => a.kode.localeCompare(b.kode) || a.ym.localeCompare(b.ym) || namaOf(a.nim).localeCompare(namaOf(b.nim)))
    .map(r => [r.kode, bulanID(r.ym), r.nim, namaOf(r.nim), r.n, Math.round(r.jam * 100) / 100, Math.round(r.sesi * 100) / 100, {rp: Math.round(r.sesi * 100) / 100 * tarif}]);
  const tot = rekap.reduce((s, r) => s + r[7].rp, 0);
  if (rekap.length) rekap.push(['Total', '', '', '', '', '', '', {rp: tot}]);
  const blob = XLSX_MINI.buat([
    {nama: 'Rekap', kolom: [{h: 'Praktikum', w: 11}, {h: 'Bulan', w: 16}, {h: 'NIM', w: 12}, {h: 'Nama', w: 36}, {h: 'Kegiatan', w: 9}, {h: 'Jam', w: 8}, {h: 'Sesi', w: 8}, {h: 'Insentif', w: 14}], baris: rekap},
    {nama: 'Log', kolom: KOL_LOG, baris: ok.map(baris)},
    {nama: 'Belum disetujui', kolom: KOL_LOG, baris: belum.map(baris)},
    {nama: 'Asisten', kolom: [{h: 'NIM', w: 12}, {h: 'Nama', w: 36}, {h: 'Prodi', w: 18}, {h: 'Kode Praktikum', w: 15}], baris: db.asisten.map(a => [a.nim, a.nama, c.prodi, a.prak])},
    {nama: 'Praktikum', kolom: [{h: 'Kode', w: 8}, {h: 'Nama MK', w: 50}, {h: 'Judul Rekap', w: 60}, {h: 'Nama di Memo', w: 40}], baris: db.prak.map(p => [p.kode, p.nama, p.judul, p.memo])},
    {nama: 'Pengaturan', kolom: [{h: 'Kunci', w: 16}, {h: 'Nilai', w: 48}], baris: [['Semester', c.semester], ['TA', c.ta], ['Prodi', c.prodi], ['Unit', c.unit], ['Direktorat', c.direktorat],
      ['Menit per sesi', +c.menit], ['Rp per sesi', tarif], ['Kaprodi', c.kaprodi], ['NIP Kaprodi', c.nipKaprodi], ['Dekan', c.dekan], ['NIP Dekan', c.nipDekan], ['Bank', c.bank], ['No Rekening', c.norek], ['Atas Nama', c.atasNama]]}]);
  return simpanFile(blob, `Rekap_Timesheet_${ui.dari}${ui.sampai !== ui.dari ? '_sd_' + ui.sampai : ''}.xlsx`);
}
