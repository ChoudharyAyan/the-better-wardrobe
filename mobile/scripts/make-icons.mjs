// Draws the Android launcher icons and splash from the app's brand mark (prototype/dist/index.html,
// .brand-mark). Run from mobile/: node scripts/make-icons.mjs  (uses sharp from prototype/).
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
const sharp=createRequire(new URL('../../prototype/package.json',import.meta.url))('sharp');
const res=new URL('../android/app/src/main/res/',import.meta.url).pathname;
const INK='#28101F',CREAM='#FBF5EC';
const defs='<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7A8CB"/><stop offset="1" stop-color="#C2477F"/></linearGradient></defs>';
const hanger='<path d="M16.8 12.4a3.2 3.2 0 1 1 3.2 3.2v2.2" fill="none" stroke="url(#g)" stroke-width="2.6" stroke-linecap="round"/><path d="M20 17.8 8.3 26a1.5 1.5 0 0 0 .9 2.7h21.6a1.5 1.5 0 0 0 .9-2.7Z" fill="none" stroke="url(#g)" stroke-width="2.6" stroke-linejoin="round"/><circle cx="31.5" cy="8.5" r="2.6" fill="#7BE0A6"/>';
// Legacy icon: the full rounded square. Round icon: same mark on a circle.
const square=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${defs}<rect width="40" height="40" rx="11" fill="${INK}"/>${hanger}</svg>`;
const round=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${defs}<circle cx="20" cy="20" r="20" fill="${INK}"/><g transform="translate(20 20) scale(.86) translate(-20 -20)">${hanger}</g></svg>`;
// Adaptive foreground: 108dp canvas, mark kept inside the 66dp safe circle.
const fg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${defs}<g transform="translate(54 54) scale(1.55) translate(-20 -19)">${hanger}</g></svg>`;
// Splash: the square mark centred on cream.
const splash=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 288">${defs.replace('id="g"','id="g"')}<g transform="translate(96 96) scale(2.4)"><rect width="40" height="40" rx="11" fill="${INK}"/>${hanger}</g></svg>`;
const sizes={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
const png=(svg,size)=>sharp(Buffer.from(svg),{density:Math.ceil(72*size/40)}).resize(size,size).png().toBuffer();
for(const [d,s] of Object.entries(sizes)){
 const dir=`${res}mipmap-${d}/`;mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'ic_launcher.png',await png(square,s));
 writeFileSync(dir+'ic_launcher_round.png',await png(round,s));
 writeFileSync(dir+'ic_launcher_foreground.png',await png(fg,Math.round(s*108/48)));
}
writeFileSync(`${res}values/ic_launcher_background.xml`,`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${INK}</color>\n</resources>\n`);
// Android 12+ draws the splash itself (Theme.SplashScreen): cream background, this icon in the middle.
mkdirSync(`${res}drawable-nodpi`,{recursive:true});
writeFileSync(`${res}drawable-nodpi/splash_icon.png`,await png(splash,576));
// Capacitor's sample splash images are replaced by the theme colour.
for(const d of readdirSync(res))if(/^drawable(-(port|land)-\w+)?$/.test(d))rmSync(`${res}${d}/splash.png`,{force:true});
writeFileSync(`${res}drawable/splash.xml`,`<?xml version="1.0" encoding="utf-8"?>\n<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n    <item android:drawable="@color/tbw_cream" />\n</layer-list>\n`);
writeFileSync(`${res}values/colors.xml`,`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="tbw_cream">${CREAM}</color>\n    <color name="tbw_ink">${INK}</color>\n    <color name="colorPrimary">#8E1B4D</color>\n    <color name="colorPrimaryDark">${INK}</color>\n    <color name="colorAccent">#C2477F</color>\n</resources>\n`);
console.log('icons and splash written');
