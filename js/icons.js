const paths={
 upload:'<path d="M12 16V3m-4 4 4-4 4 4M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
 pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/>',
 route:'<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h3"/>',
 bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>',
 shade:'<path d="M3 12a9 9 0 0 1 18 0H3Zm9 0v8a2 2 0 0 0 4 0M12 1v2"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
 cube:'<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm-9 5 9 5 9-5M12 12v10"/>',
 focus:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="4"/>',
 layers:'<path d="m12 3 10 6-10 6L2 9l10-6ZM2 13l10 6 10-6M2 17l10 6 10-6"/>',
 plus:'<path d="M5 12h14M12 5v14"/>',minus:'<path d="M5 12h14"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
 walk:'<circle cx="14" cy="4" r="2"/><path d="m7 21 4-6 2-7-5 4H5m7-3 4 5h4m-9 1 5 3v4"/>',
 hand:'<path d="M8 12V6a2 2 0 0 1 4 0v6-3a2 2 0 0 1 4 0v4-2a2 2 0 0 1 4 0v5c0 4-2 6-6 6h-1c-3 0-4-1-6-4l-4-6a2 2 0 0 1 3-2l2 2Z"/>',
 swap:'<path d="M8 3v16m-4-4 4 4 4-4m4 6V5m-4 4 4-4 4 4"/>',
 sliders:'<path d="M4 7h9m5 0h2M4 17h2m5 0h9"/><circle cx="15.5" cy="7" r="2.5"/><circle cx="8.5" cy="17" r="2.5"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 'arrow-left':'<path d="M20 12H4m6-6-6 6 6 6"/>',
 'arrow-up':'<path d="M12 21V3m-7 7 7-7 7 7"/>',
 'arrow-up-right':'<path d="M5 19 19 5M5 5h14v14"/>',
 'chevron-down':'<path d="m6 9 6 6 6-6"/>','chevron-up':'<path d="m6 15 6-6 6 6"/>'
};
export function installIcons(root=document){for(const el of root.querySelectorAll('[data-icon]'))el.innerHTML=`<svg aria-hidden="true" viewBox="0 0 24 24">${paths[el.dataset.icon]||''}</svg>`;}
