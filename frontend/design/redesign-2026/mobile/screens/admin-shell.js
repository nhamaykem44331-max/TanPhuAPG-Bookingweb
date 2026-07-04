/* Tan Phu APG - Admin shell: injects topbar + drawer nav.
   Usage: <body><div class="phone admin"> ... </div>
   call initAdmin('bookings','Quản lý đặt chỗ') at end. */
const ADMIN_NAV=[
  {sec:'Tổng quan'},
  {id:'dashboard',label:'Bảng điều khiển',file:'admin-dashboard.html',icon:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'},
  {id:'bookings',label:'Đặt chỗ',file:'admin-bookings.html',icon:'<path d="M4 4h16v6a2 2 0 0 0 0 4v6H4v-6a2 2 0 0 0 0-4z"/><path d="M14 4v16" stroke-dasharray="2 2"/>'},
  {id:'payments',label:'Thanh toán',file:'admin-payments.html',icon:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'},
  {sec:'Quan hệ'},
  {id:'customers',label:'Khách hàng',file:'admin-customers.html',icon:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5a3 3 0 0 1 0 6"/>'},
  {id:'users',label:'Người dùng hệ thống',file:'admin-users.html',icon:'<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>'},
  {sec:'Doanh thu & quy tắc'},
  {id:'markup-rules',label:'Quy tắc markup',file:'admin-markup-rules.html',icon:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'},
  {id:'price-alerts',label:'Cảnh báo giá',file:'admin-price-alerts.html',icon:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'},
  {id:'reports-revenue',label:'Báo cáo doanh thu',file:'admin-reports-revenue.html',icon:'<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>'},
  {sec:'Hệ thống'},
  {id:'audit',label:'Nhật ký kiểm toán',file:'admin-audit.html',icon:'<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'},
  {id:'menu',label:'Quản lý menu',file:'admin-menu.html',icon:'<path d="M4 6h16M4 12h16M4 18h16"/>'},
  {id:'web-vitals',label:'Web Vitals',file:'admin-web-vitals.html',icon:'<path d="M3 12h4l3 8 4-16 3 8h4"/>'},
];
function initAdmin(active,title){
  const phone=document.querySelector('.phone.admin');
  // topbar
  const top=document.createElement('div');top.className='atop';
  top.innerHTML=`<button class="menu" onclick="openDrawer()"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
    <span class="ttl">${title}</span><span class="av">QT</span>`;
  // drawer
  const bd=document.createElement('div');bd.className='drawer-bd';bd.id='drawerBd';bd.onclick=closeDrawer;
  const dr=document.createElement('div');dr.className='drawer';dr.id='drawer';
  let nav='';
  ADMIN_NAV.forEach(n=>{
    if(n.sec){nav+=`<div class="dsec">${n.sec}</div>`;return;}
    nav+=`<a class="dlink ${n.id===active?'on':''}" href="${n.file}"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${n.icon}</svg> ${n.label}</a>`;
  });
  dr.innerHTML=`<div class="dh"><img src="../assets/logo-appicon.png" alt=""><div><div class="nm">Tân Phú APG</div><div class="rl">Bảng quản trị</div></div></div>
    <div class="dnav">${nav}</div>
    <div class="dfoot"><a class="dlink" href="admin-login.html"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg> Đăng xuất</a></div>`;
  const statusbar=phone.querySelector('.statusbar');
  if(statusbar)statusbar.after(top);else phone.prepend(top);
  phone.appendChild(bd);phone.appendChild(dr);
}
function openDrawer(){document.getElementById('drawer').classList.add('open');document.getElementById('drawerBd').classList.add('open');}
function closeDrawer(){document.getElementById('drawer').classList.remove('open');document.getElementById('drawerBd').classList.remove('open');}
