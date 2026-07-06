'use client';

import { useEffect, useRef } from 'react';

// ===========================================================================
// HeaderGlobe — NỀN động cho header landing (Approach C: "mạng lưới đường bay
// toàn cầu"). Một quả cầu xoay chậm với GRATICULE cong (vĩ tuyến / kinh tuyến
// great-circle) tạo SILHOUETTE cầu rõ ràng ngay trong dải cao ~64px; trên đó
// các CUNG great-circle nối các thành phố thật, với "máy bay" comet mint/trắng
// sáng bay liên tục head→tail. Vài comet luôn hiển thị & rõ ràng ĐANG DI CHUYỂN.
//
// Bố cục header: logo bên TRÁI, nav GIỮA, CTA xanh bên PHẢI — chữ trắng nằm
// TRÊN canvas. Vì vậy mọi thứ được làm DỊU ở mép trái (để logo sạch) và RỰC RỠ
// hơn ở giữa / giữa-phải (ngôi sao của màn trình diễn). Không vẽ gì quá sáng/dày
// trên toàn chiều rộng để chữ trắng luôn đọc được.
// ===========================================================================

interface Flight {
  arc: number; // index cung
  t: number; // vị trí đầu comet dọc cung [0..1]
  speed: number; // tốc độ (đơn vị/giây) — t tăng theo speed
  hue: number; // 0 = mint, 1 = cyan-trắng (chỉ đổi nhẹ tông)
}

function startHeaderGlobe(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const c = ctx;
  const TAU = Math.PI * 2;

  // -------- trạng thái hình học (tính lại khi resize) --------
  let W = 0;
  let H = 0;
  let DPR = 1;
  let CX = 0; // tâm cầu (x)
  let CY = 0; // tâm cầu (y)
  let R = 0; // bán kính cầu (px)

  // lat/lon (độ) -> vector đơn vị, ghi vào out tại i*3
  function ll(lat: number, lon: number, out: Float32Array, i: number): void {
    const p = (lat * Math.PI) / 180;
    const l = (lon * Math.PI) / 180;
    const cp = Math.cos(p);
    out[i * 3] = cp * Math.cos(l);
    out[i * 3 + 1] = Math.sin(p);
    out[i * 3 + 2] = cp * Math.sin(l);
  }

  // -------- chấm bề mặt (sao li ti theo cầu) --------
  const dlist: number[][] = [];
  for (let la = -78; la <= 78; la += 9) {
    for (let lo = 0; lo < 360; lo += 8) {
      dlist.push([la, lo]);
    }
  }
  const nD = dlist.length;
  const DU = new Float32Array(nD * 3); // unit (gốc)
  const DR = new Float32Array(nD * 3); // rotated
  for (let i = 0; i < nD; i++) ll(dlist[i][0], dlist[i][1], DU, i);

  // -------- GRATICULE: vĩ tuyến + kinh tuyến (đường cong → đọc ra "cầu") --------
  // Mỗi đường là một polyline điểm trên mặt cầu. Gom tất cả vào 1 typed array,
  // kèm mảng độ dài từng đường để vẽ tách đoạn.
  const gLatLines = [-66, -44, -22, 0, 22, 44, 66]; // vĩ tuyến
  const gLonLines: number[] = []; // kinh tuyến mỗi 18° → lưới dày, lấp giữa header
  for (let lo = 0; lo < 360; lo += 18) gLonLines.push(lo);
  const GSTEP = 6; // độ phân giải (độ) dọc mỗi đường
  const gCounts: number[] = []; // số điểm mỗi đường
  const gTmp: number[] = [];
  // vĩ tuyến: lon 0..360
  for (const la of gLatLines) {
    let n = 0;
    for (let lo = 0; lo <= 360; lo += GSTEP) {
      const p = (la * Math.PI) / 180;
      const l = (lo * Math.PI) / 180;
      const cp = Math.cos(p);
      gTmp.push(cp * Math.cos(l), Math.sin(p), cp * Math.sin(l));
      n++;
    }
    gCounts.push(n);
  }
  // kinh tuyến: lat -80..80
  for (const lo of gLonLines) {
    let n = 0;
    for (let la = -80; la <= 80; la += GSTEP) {
      const p = (la * Math.PI) / 180;
      const l = (lo * Math.PI) / 180;
      const cp = Math.cos(p);
      gTmp.push(cp * Math.cos(l), Math.sin(p), cp * Math.sin(l));
      n++;
    }
    gCounts.push(n);
  }
  const nGP = gTmp.length / 3; // tổng số điểm graticule
  const GU = new Float32Array(gTmp); // unit
  const GR = new Float32Array(nGP * 3); // rotated

  // -------- thành phố (lat, lon) — Á châu làm trung tâm --------
  const C: number[][] = [
    [21.0, 105.8], // 0  Hà Nội
    [10.8, 106.7], // 1  TP.HCM
    [16.0, 108.2], // 2  Đà Nẵng
    [37.5, 126.5], // 3  Seoul
    [35.7, 140.4], // 4  Tokyo
    [13.7, 100.5], // 5  Bangkok
    [1.35, 103.8], // 6  Singapore
    [25.0, 121.5], // 7  Đài Bắc
    [22.3, 114.2], // 8  Hồng Kông
    [3.1, 101.7], // 9  Kuala Lumpur
    [-33.9, 151.2], // 10 Sydney
    [25.2, 55.3], // 11 Dubai
    [48.9, 2.35], // 12 Paris
    [51.5, -0.1], // 13 London
    [34.0, -118.2], // 14 Los Angeles
    [50.1, 8.7], // 15 Frankfurt
  ];
  const nC = C.length;
  const CU = new Float32Array(nC * 3);
  const CR = new Float32Array(nC * 3);
  for (let i = 0; i < nC; i++) ll(C[i][0], C[i][1], CU, i);

  // -------- cặp tuyến (great-circle) — nhiều để luôn có chuyến bay --------
  const PAIRS: number[][] = [
    [0, 3], [0, 4], [0, 6], [0, 7], [0, 8], [0, 11], [0, 12], [0, 15],
    [1, 5], [1, 6], [1, 3], [1, 8], [1, 10], [1, 11], [1, 14],
    [2, 3], [2, 7], [2, 8],
    [5, 11], [5, 6], [3, 4], [3, 14], [7, 8], [8, 9], [4, 14],
    [11, 12], [11, 13], [12, 15], [13, 15], [6, 10], [9, 11],
  ];
  const nA = PAIRS.length;
  const NSEG = 40; // đoạn / cung (cong mượt)
  const PP = NSEG + 1; // điểm / cung
  const LIFT = 0.46; // nâng cung khỏi mặt cầu → vồng cao qua chân trời vào dải
  const nAP = nA * PP;
  const AU = new Float32Array(nAP * 3); // unit (đã nâng)
  const AR = new Float32Array(nAP * 3); // rotated

  // SLERP a→b, nâng theo sin(pi*t), ghi vào AU bắt đầu từ base
  function buildArc(ai: number, bi: number, base: number): void {
    const ax = CU[ai * 3];
    const ay = CU[ai * 3 + 1];
    const az = CU[ai * 3 + 2];
    const bx = CU[bi * 3];
    const by = CU[bi * 3 + 1];
    const bz = CU[bi * 3 + 2];
    let d = ax * bx + ay * by + az * bz;
    if (d > 1) d = 1;
    else if (d < -1) d = -1;
    const om = Math.acos(d);
    const so = Math.sin(om);
    for (let s = 0; s <= NSEG; s++) {
      const t = s / NSEG;
      let f1: number;
      let f2: number;
      if (so < 1e-6) {
        f1 = 1 - t;
        f2 = t;
      } else {
        f1 = Math.sin((1 - t) * om) / so;
        f2 = Math.sin(t * om) / so;
      }
      const x = ax * f1 + bx * f2;
      const y = ay * f1 + by * f2;
      const z = az * f1 + bz * f2;
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      const h = 1 + LIFT * Math.sin(Math.PI * t);
      const idx = (base + s) * 3;
      AU[idx] = (x / len) * h;
      AU[idx + 1] = (y / len) * h;
      AU[idx + 2] = (z / len) * h;
    }
  }
  for (let i = 0; i < nA; i++) buildArc(PAIRS[i][0], PAIRS[i][1], i * PP);

  // -------- đàn máy bay (comet) bay liên tục dọc các cung --------
  const FLIGHTS = Math.min(52, nA + 20);
  const flights: Flight[] = [];
  function spawnFlight(f: Flight): void {
    f.arc = (Math.random() * nA) | 0;
    f.t = 0;
    f.speed = 0.18 + Math.random() * 0.18; // ~2.8..5.5s mỗi chuyến
    f.hue = Math.random();
  }
  for (let i = 0; i < FLIGHTS; i++) {
    const f: Flight = { arc: 0, t: 0, speed: 0.2, hue: 0 };
    spawnFlight(f);
    f.t = Math.random(); // rải đều lúc khởi tạo → ngay lập tức "đang bay"
    flights.push(f);
  }

  // -------- xoay (yaw quay + tilt cố định) --------
  const tilt = 0.36;
  let yaw = 0.6;

  // -------- trọng số ngang: CHỈ làm dịu vùng logo xa-trái, còn lại để lộ rõ --------
  // trả về [0..1] theo toạ độ màn x. Vành cầu nằm ở hai mép nên không được làm tối
  // hai mép; chỉ hạ sáng ở dải logo (u < 0.15) và rất nhẹ ở góc phải ngoài cùng.
  function biasX(sx: number): number {
    const u = W > 0 ? sx / W : 0.5;
    let w = 1;
    if (u < 0.15) w = 0.4 + (u / 0.15) * 0.6; // logo: dịu dần
    else if (u > 0.93) w = 1 - ((u - 0.93) / 0.07) * 0.4; // góc phải: dịu nhẹ
    if (w < 0.4) w = 0.4;
    if (w > 1) w = 1;
    return w;
  }

  const reduce = !!(
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  let last = 0;
  let running = true;
  let raf = 0;

  function resize(): void {
    const r = canvas.getBoundingClientRect();
    W = r.width || canvas.clientWidth || 1280;
    H = r.height || canvas.clientHeight || 64;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    c.setTransform(DPR, 0, 0, DPR, 0, 0);

    // Tâm cầu hơi dưới đáy dải → CHỎM TRÊN cong (limb) cắt qua dải thấp, thấy rõ
    // là mặt cầu. R đủ lớn để cung trải ngang & cong rõ; CY đặt sao cho đỉnh cầu
    // (CY-R) nằm gần / hơi trên mép trên header.
    CX = W * 0.5;
    R = Math.max(H * 1.85, W * 0.34);
    CY = H * 0.5 + R * 0.62;
  }

  // xoay một mảng unit[i*3..] → out[i*3..]
  function rotateInto(src: Float32Array, dst: Float32Array, n: number): void {
    const cY = Math.cos(yaw);
    const sY = Math.sin(yaw);
    const cT = Math.cos(tilt);
    const sT = Math.sin(tilt);
    for (let i = 0; i < n; i++) {
      const vx = src[i * 3];
      const vy = src[i * 3 + 1];
      const vz = src[i * 3 + 2];
      const x = vx * cY + vz * sY;
      const z = -vx * sY + vz * cY;
      dst[i * 3] = x;
      dst[i * 3 + 1] = vy * cT - z * sT;
      dst[i * 3 + 2] = vy * sT + z * cT;
    }
  }
  function rotateAll(): void {
    rotateInto(DU, DR, nD);
    rotateInto(GU, GR, nGP);
    rotateInto(CU, CR, nC);
    rotateInto(AU, AR, nAP);
  }

  // ---- vẽ một chấm comet (đầu tại t dọc cung arc, offset back đoạn về đuôi) ----
  // back: số đoạn lùi về phía đuôi; rad: bán kính chấm. Trả về true nếu vẽ được.
  function dot(arc: number, t: number, back: number, rad: number): boolean {
    const fi = t * NSEG - back;
    if (fi < 0 || fi > NSEG) return false;
    let i0 = Math.floor(fi);
    if (i0 >= NSEG) i0 = NSEG - 1;
    const fr = fi - i0;
    const pa = (arc * PP + i0) * 3;
    const pb = pa + 3;
    const z = AR[pa + 2] * (1 - fr) + AR[pb + 2] * fr;
    if (z <= -0.04) return false; // sau limb → ẩn
    const x = AR[pa] * (1 - fr) + AR[pb] * fr;
    const y = AR[pa + 1] * (1 - fr) + AR[pb + 1] * fr;
    const sx = x * R + CX;
    const sy = CY - y * R;
    c.moveTo(sx + rad, sy);
    c.arc(sx, sy, rad, 0, TAU);
    return true;
  }

  function draw(dt: number): void {
    c.clearRect(0, 0, W, H);

    // ---- 1) ATMOSPHERE: quầng cong gợi rìa hành tinh ----
    const atmo = c.createRadialGradient(CX, CY, R * 0.86, CX, CY, R * 1.06);
    atmo.addColorStop(0, 'rgba(40,120,180,0)');
    atmo.addColorStop(0.78, 'rgba(56,150,210,0.10)');
    atmo.addColorStop(0.93, 'rgba(96,200,236,0.16)');
    atmo.addColorStop(1, 'rgba(120,220,245,0)');
    c.fillStyle = atmo;
    c.beginPath();
    c.arc(CX, CY, R * 1.06, 0, TAU);
    c.fill();

    // ---- 2) LIMB: viền cong sáng của mặt cầu (chỏm trên) ----
    c.lineWidth = 1.6;
    c.strokeStyle = 'rgba(128,212,244,0.52)';
    c.beginPath();
    c.arc(CX, CY, R, Math.PI * 1.06, Math.PI * 1.94);
    c.stroke();
    c.lineWidth = 4.0;
    c.strokeStyle = 'rgba(96,184,228,0.16)';
    c.beginPath();
    c.arc(CX, CY, R + 1.2, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();

    // ---- 3) GRATICULE: vĩ/kinh tuyến cong (mặt trước) → đọc ra "quả cầu" ----
    let gp = 0; // con trỏ điểm
    c.lineWidth = 1;
    for (let li = 0; li < gCounts.length; li++) {
      const cnt = gCounts[li];
      for (let s = 0; s < cnt - 1; s++) {
        const ia = (gp + s) * 3;
        const ib = (gp + s + 1) * 3;
        if (GR[ia + 2] <= 0.02 || GR[ib + 2] <= 0.02) continue; // mặt sau → bỏ
        const ax = GR[ia] * R + CX;
        const ay = CY - GR[ia + 1] * R;
        const bx = GR[ib] * R + CX;
        const by = CY - GR[ib + 1] * R;
        if (ay > H + 8 && by > H + 8) continue; // ngoài dải → bỏ
        const w = biasX((ax + bx) * 0.5);
        const zc = (GR[ia + 2] + GR[ib + 2]) * 0.5; // gần tâm đĩa → sáng hơn
        const a = (0.11 + 0.3 * zc) * w;
        c.strokeStyle = 'rgba(130,206,242,' + a.toFixed(3) + ')';
        c.beginPath();
        c.moveTo(ax, ay);
        c.lineTo(bx, by);
        c.stroke();
      }
      gp += cnt;
    }

    // ---- 4) CHẤM bề mặt (sao li ti theo cầu) — mặt trước, dịu trái ----
    c.beginPath();
    let lastA = -1;
    for (let i = 0; i < nD; i++) {
      const z = DR[i * 3 + 2];
      if (z <= 0.04) continue;
      const sx = DR[i * 3] * R + CX;
      const sy = CY - DR[i * 3 + 1] * R;
      if (sy > H + 6) continue;
      const w = biasX(sx);
      const a = (0.1 + 0.24 * z) * w;
      if (Math.abs(a - lastA) > 0.04) {
        if (lastA >= 0) c.fill();
        c.fillStyle = 'rgba(168,214,242,' + a.toFixed(3) + ')';
        c.beginPath();
        lastA = a;
      }
      const rad = 0.7 + 0.7 * z;
      c.moveTo(sx + rad, sy);
      c.arc(sx, sy, rad, 0, TAU);
    }
    if (lastA >= 0) c.fill();

    // ---- 5) CUNG đường bay (great-circle tĩnh, mờ) — nền cho comet ----
    for (let seg = 0; seg < nA; seg++) {
      const b = seg * PP;
      c.beginPath();
      let on = false;
      let midx = 0;
      for (let i = 0; i < NSEG; i++) {
        const p0 = (b + i) * 3;
        const p1 = (b + i + 1) * 3;
        if (AR[p0 + 2] + AR[p1 + 2] <= 0) {
          on = false;
          continue;
        }
        const x0 = AR[p0] * R + CX;
        const y0 = CY - AR[p0 + 1] * R;
        const x1 = AR[p1] * R + CX;
        const y1 = CY - AR[p1 + 1] * R;
        if (!on) {
          c.moveTo(x0, y0);
          on = true;
        }
        c.lineTo(x1, y1);
        midx = x1;
      }
      const w = biasX(midx);
      c.lineWidth = 1.1;
      c.strokeStyle = 'rgba(126,232,190,' + (0.16 + 0.28 * w).toFixed(3) + ')';
      c.stroke();
    }

    // ---- 6) tiến các chuyến bay & vẽ COMET (ngôi sao của màn trình diễn) ----
    // Luôn tiến (kể cả reduced-motion) — đây là hiệu ứng thương hiệu chủ đích;
    // tốc độ đã được giảm ở frame() khi reduced-motion để vẫn nhẹ nhàng.
    for (let i = 0; i < FLIGHTS; i++) {
      const f = flights[i];
      f.t += dt * f.speed;
      if (f.t > 1) spawnFlight(f); // tới đích → tái sinh tuyến mới
    }

    // 6a) HALO mềm (additive) — cảm giác phát sáng
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < FLIGHTS; i++) {
      const f = flights[i];
      const fi = f.t * NSEG;
      let i0 = Math.floor(fi);
      if (i0 >= NSEG) i0 = NSEG - 1;
      if (i0 < 0) i0 = 0;
      const fr = fi - i0;
      const pa = (f.arc * PP + i0) * 3;
      const pb = pa + 3;
      const z = AR[pa + 2] * (1 - fr) + AR[pb + 2] * fr;
      if (z <= -0.04) continue;
      const x = (AR[pa] * (1 - fr) + AR[pb] * fr) * R + CX;
      const y = CY - (AR[pa + 1] * (1 - fr) + AR[pb + 1] * fr) * R;
      const w = biasX(x);
      const ha = (0.22 + 0.2 * z) * (0.55 + 0.45 * w);
      const rr = 14;
      const g = c.createRadialGradient(x, y, 0, x, y, rr);
      const tint = f.hue < 0.5 ? '150,250,205' : '170,240,255';
      g.addColorStop(0, 'rgba(' + tint + ',' + ha.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + tint + ',0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, rr, 0, TAU);
      c.fill();
    }

    // 6b) ĐUÔI: chuỗi chấm lùi dần, mờ dần (additive) → vệt bay rõ "đang di chuyển"
    for (let tb = 7; tb >= 1; tb--) {
      const a = (0.07 + (7 - tb) * 0.05).toFixed(3);
      const rad = 1.0 + (7 - tb) * 0.16;
      c.fillStyle = 'rgba(150,245,205,' + a + ')';
      c.beginPath();
      for (let i = 0; i < FLIGHTS; i++) {
        const f = flights[i];
        dot(f.arc, f.t, tb * 0.85, rad);
      }
      c.fill();
    }

    // 6c) LÕI sáng (đầu máy bay): thân mint + lõi trắng
    c.fillStyle = 'rgba(192,253,224,0.9)';
    c.beginPath();
    for (let i = 0; i < FLIGHTS; i++) dot(flights[i].arc, flights[i].t, 0, 3.0);
    c.fill();
    c.fillStyle = 'rgba(242,255,249,1.0)';
    c.beginPath();
    for (let i = 0; i < FLIGHTS; i++) dot(flights[i].arc, flights[i].t, 0, 1.55);
    c.fill();
    c.globalCompositeOperation = 'source-over';

    // ---- 7) CITY nodes: quầng + lõi, đập nhẹ (pulse) ----
    const pulse = 0.5 + 0.5 * Math.sin(yaw * 3.0);
    c.fillStyle = 'rgba(150,236,200,' + (0.16 + 0.14 * pulse).toFixed(3) + ')';
    c.beginPath();
    for (let i = 0; i < nC; i++) {
      const z = CR[i * 3 + 2];
      if (z <= -0.04) continue;
      const sx = CR[i * 3] * R + CX;
      const sy = CY - CR[i * 3 + 1] * R;
      if (sy > H + 6) continue;
      const rad = 3.2 + 1.2 * pulse;
      c.moveTo(sx + rad, sy);
      c.arc(sx, sy, rad, 0, TAU);
    }
    c.fill();
    c.fillStyle = 'rgba(236,255,246,0.92)';
    c.beginPath();
    for (let i = 0; i < nC; i++) {
      const z = CR[i * 3 + 2];
      if (z <= -0.04) continue;
      const sx = CR[i * 3] * R + CX;
      const sy = CY - CR[i * 3 + 1] * R;
      if (sy > H + 6) continue;
      c.moveTo(sx + 1.5, sy);
      c.arc(sx, sy, 1.5, 0, TAU);
    }
    c.fill();
  }

  function frame(ts: number): void {
    if (!running) return;
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    if (dt > 0.05) dt = 0.05;
    last = ts;
    yaw += dt * (reduce ? 0.055 : 0.1); // quay chậm (chậm hơn khi reduced-motion)
    rotateAll();
    draw(dt);
    raf = requestAnimationFrame(frame);
  }

  function onVisibility(): void {
    if (document.hidden) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else if (!running) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  // ---- khởi động (luôn chạy animation — hiệu ứng nền thương hiệu) ----
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  rotateAll();
  draw(0); // vẽ ngay 1 khung để không bị trống trước/giữa lúc rAF bị tiết lưu
  raf = requestAnimationFrame(frame);

  // ---- cleanup ----
  return () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

export default function HeaderGlobe() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;

    // Canvas quả cầu là hiệu ứng nền trang trí + chạy rAF liên tục (~1.6s eval trên
    // CPU mobile bị tiết lưu). Nếu khởi động ngay lúc hydrate, nó chiếm main-thread
    // đúng lúc trình duyệt cần paint ảnh hero (LCP) → đẩy render delay lên ~3s.
    // Vì vậy HOÃN khởi động tới khi trang tải xong + trình duyệt rảnh.
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    const idleWin = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId = 0;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const start = () => {
      if (!cancelled && ref.current) cleanup = startHeaderGlobe(ref.current);
    };
    const schedule = () => {
      if (idleWin.requestIdleCallback) idleId = idleWin.requestIdleCallback(start, { timeout: 2500 });
      else timerId = setTimeout(start, 1200);
    };

    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
      if (idleId && idleWin.cancelIdleCallback) idleWin.cancelIdleCallback(idleId);
      if (timerId) clearTimeout(timerId);
      window.removeEventListener('load', schedule);
    };
  }, []);
  return <canvas ref={ref} className="apgx-globe-canvas" aria-hidden="true" />;
}
