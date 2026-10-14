// Draws the Android launcher icons and splash from the app's brand mark (prototype/dist/index.html,
// .brand-mark). Run from mobile/: node scripts/make-icons.mjs  (uses sharp from prototype/).
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
const sharp=createRequire(new URL('../../prototype/package.json',import.meta.url))('sharp');
const res=new URL('../android/app/src/main/res/',import.meta.url).pathname;
const INK='#28101F',CREAM='#FBF5EC';
const defs='<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7A8CB"/><stop offset="1" stop-color="#C2477F"/></linearGradient></defs>';
// The kawaii tee (prototype/dist/index.html .brand-mark), drawn on the 40x40 tile.
const hanger='<path d="M14.5 10.5 17.6 9q2.4 2.6 4.8 0l3.1 1.5 5.5 4.3-2.8 3.9-1.9-1.3V30a1.8 1.8 0 0 1-1.8 1.8h-9.6A1.8 1.8 0 0 1 13 30V17.4l-1.9 1.3-2.8-3.9z" fill="url(#g)"/><circle cx="17.3" cy="22.2" r="1.55" fill="#28101F"/><circle cx="22.7" cy="22.2" r="1.55" fill="#28101F"/><circle cx="17.8" cy="21.6" r=".5" fill="#fff"/><circle cx="23.2" cy="21.6" r=".5" fill="#fff"/><path d="M18.5 24.7q1.5 1.4 3 0" fill="none" stroke="#28101F" stroke-width="1" stroke-linecap="round"/><ellipse cx="15.3" cy="24.6" rx="1.5" ry=".9" fill="#FF7BAC" opacity=".9"/><ellipse cx="24.7" cy="24.6" rx="1.5" ry=".9" fill="#FF7BAC" opacity=".9"/><path d="M32 5.5l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z" fill="#7BE0A6"/>';
// Legacy icon: the full rounded square. Round icon: same mark on a circle.
const square=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${defs}<rect width="40" height="40" rx="11" fill="${INK}"/>${hanger}</svg>`;
const round=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${defs}<circle cx="20" cy="20" r="20" fill="${INK}"/><g transform="translate(20 20) scale(.86) translate(-20 -20)">${hanger}</g></svg>`;
// Adaptive foreground: 108dp canvas, mark kept inside the 66dp safe circle.
const fg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${defs}<g transform="translate(54 54) scale(2.15) translate(-20 -19.5)">${hanger}</g></svg>`;
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
