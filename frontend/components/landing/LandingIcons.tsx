// Inline SVG icon sprite for the landing page.
// Rendered once near the top of the page; referenced via <svg className="ic"><use href="#i-xxx" /></svg>.
// Injected as raw markup so we don't have to camelCase every SVG attribute.

const SPRITE = `
<symbol id="i-bird" viewBox="0 0 24 24"><path d="M2 14 Q 7 7 12 13 Q 17 7 22 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-plane" viewBox="0 0 24 24"><path d="M21.5 12 3 5.2l1.8 5.3 7.7.5-7.7.5L3 16.8z" fill="currentColor"/></symbol>
<symbol id="i-swap" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v15M7 4 4 7M7 4l3 3"/><path d="M17 20V5M17 20l-3-3M17 20l3-3"/></g></symbol>
<symbol id="i-cal" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></g></symbol>
<symbol id="i-user" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c0-4 3.5-6 7.5-6s7.5 2 7.5 6"/></g></symbol>
<symbol id="i-chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/></g></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-4 8.2-8 9-4-.8-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></g></symbol>
<symbol id="i-receipt" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h14v18l-2.5-1.7-2 1.7-2-1.7-2 1.7-2-1.7L5 21z"/><path d="M8.5 8.5h7M8.5 12.5h7"/></g></symbol>
<symbol id="i-refresh" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5A8.5 8.5 0 1 0 18 17.8"/><path d="M21 5v5h-5"/></g></symbol>
<symbol id="i-support" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="2.5" y="12.8" width="4" height="6.4" rx="1.6"/><rect x="17.5" y="12.8" width="4" height="6.4" rx="1.6"/><path d="M20 19v1a3 3 0 0 1-3 3h-3"/></g></symbol>
<symbol id="i-anchor" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.4"/><path d="M12 7.4V21M7 11h10M4 13a8 8 0 0 0 16 0"/></g></symbol>
<symbol id="i-users" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.3"/><path d="M3 20c0-3.4 3-5.4 6-5.4s6 2 6 5.4"/><path d="M16 5a3.3 3.3 0 0 1 0 6.6"/><path d="M17.4 14.7c2 .5 3.6 2.1 3.6 4.3"/></g></symbol>
<symbol id="i-bag" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2.2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></g></symbol>
<symbol id="i-cap" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 22 9l-10 5L2 9z"/><path d="M6 11v4.2c0 1.5 2.7 3 6 3s6-1.5 6-3V11"/></g></symbol>
<symbol id="i-arrow" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></g></symbol>
<symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z" fill="currentColor"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.5 2"/></g></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5-6 8-9 8-13a8 8 0 1 0-16 0c0 4 3 7 8 13z"/><circle cx="12" cy="9" r="2.6"/></g></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><path d="M5 3h3.6l1.6 4.4-2.2 1.4a12 12 0 0 0 5.8 5.8l1.4-2.2L19.6 16V19.6a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
<symbol id="i-mail" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.2"/><path d="M3.5 7l8.5 6 8.5-6"/></g></symbol>
<symbol id="i-chat" viewBox="0 0 24 24"><path d="M21 11.5c0 4-3.9 7-8.5 7a10 10 0 0 1-3.4-.6L4 20l1.3-3.3A6.6 6.6 0 0 1 4 11.5c0-4 3.9-7 8.5-7s8.5 3 8.5 7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
<symbol id="i-fb" viewBox="0 0 24 24"><path d="M14 8.5h2.2V5.4c-.4-.05-1.6-.18-2.9-.18-2.9 0-4.8 1.75-4.8 4.96V13H5.7v3.4h2.8V24h3.5v-7.6h2.7l.43-3.4h-3.1v-2.1c0-1 .27-1.7 1.67-1.7z" fill="currentColor"/></symbol>
<symbol id="i-menu" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></g></symbol>
`;

export default function LandingIcons() {
  return (
    <svg
      width={0}
      height={0}
      style={{ position: 'absolute' }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: SPRITE }}
    />
  );
}
