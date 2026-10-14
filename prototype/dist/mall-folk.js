/* Little shoppers inside the Mall's boxes (owner, 14 Oct 2026: "cute avatars wearing kurta pajama for ethnic,
   streetwear for streetwear and a suit or shirt for formals"). Drawn here as small vectors, adapted from the
   ChatGPT hackathon's fashion characters, with a suit and a dress added. Decorative only (aria-hidden). */
(() => {
  'use strict';
  const INK = '#392631', SKIN = ['#E9B88C', '#C88D67', '#A86E4E'];
  // One person: gender (hair and earrings), outfit, main colour, skin tone.
  function person(gender, outfit, colour, skin) {
    const female = gender === 'female', ethnic = outfit === 'kurta' || outfit === 'saree';
    const legs = outfit === 'saree' || outfit === 'dress' ? '' : `<path d="M28 57h24l-2 27H39l-1-19-1 19H26z" fill="${ethnic ? '#FFF4DE' : outfit === 'suit' ? colour : '#465A50'}"/>`;
    let top;
    if (outfit === 'kurta') top = `<path d="M28 32h24l8 14-8 4-1-8 3 30H26l3-30-1 8-8-4z" fill="${colour}"/><path d="M38 33v28m-5-28 7 6 7-6" fill="none" stroke="#FFE7B5" stroke-width="2"/>`;
    else if (outfit === 'saree') top = `<path d="M25 58h30l5 25H20z" fill="${colour}"/><path d="M27 33h26l7 15-9 3-1-8 5 21H25l5-21-1 8-9-3z" fill="#465A50"/><path d="m49 32 8 5-22 40-11-6z" fill="${colour}"/><path d="m51 34-22 39" stroke="#F5C978" stroke-width="3"/>`;
    else if (outfit === 'dress') top = `<path d="M30 32h20l6 14-6 3 9 32H15l9-32-6-3z" fill="${colour}"/><path d="M33 33q7 8 14 0" fill="none" stroke="#FFF4DE" stroke-width="2"/><path d="M22 66h36" stroke="#FFF4DE" stroke-width="1.6" opacity=".7"/>`;
    else if (outfit === 'suit') top = `<path d="M28 33h24l10 14-10 5-2-9 3 21H27l3-21-2 9-10-5z" fill="${colour}"/><path d="M36 33l4 9 4-9z" fill="#FFF4DE"/><path d="M40 42v16" stroke="${colour === '#2F3A4F' ? '#B83B72' : '#2F3A4F'}" stroke-width="3" stroke-linecap="round"/><path d="m33 33 7 13M47 33l-7 13" fill="none" stroke="#1F1A24" stroke-width="1.6" opacity=".5"/>`;
    else {
      top = `<path d="M28 33h24l10 14-10 5-2-9 3 21H27l3-21-2 9-10-5z" fill="${colour}"/>`;
      if (outfit === 'graphic') top += '<path d="m40 42 2 5 6 1-4 4 1 6-5-3-5 3 1-6-4-4 6-1z" fill="#FFE3A1"/>';
      if (outfit === 'hoodie') top += '<path d="M29 34q11 15 22 0m-11 8v8m-7 5h14v7H33z" fill="none" stroke="#FFF4DE" stroke-width="2"/>';
      if (outfit === 'sport') top += '<path d="M31 37v20m18-20v20m-18-10h18" stroke="#FFF4DE" stroke-width="2"/>';
      if (outfit === 'shirt') top += '<path d="m32 33 8 8 8-8m-8 8v22" fill="none" stroke="#FFF4DE" stroke-width="2"/>';
    }
    const hair = female ? `<path d="M24 15q2-15 16-15t16 15v${outfit === 'saree' ? 30 : 25}H24z" fill="${INK}"/>` : '';
    const studs = female ? '<circle cx="25" cy="26" r="2" fill="#E4B358"/><circle cx="55" cy="26" r="2" fill="#E4B358"/>' : '';
    const cap = outfit === 'hoodie' ? `<path d="M23 16q2-17 17-17t17 17q-6-6-17-6t-17 6z" fill="${colour}"/>` : '';
    return `<svg viewBox="0 0 80 96" focusable="false" data-outfit="${outfit}" data-gender="${gender}"><ellipse cx="40" cy="89" rx="23" ry="4" fill="#4D3038" opacity=".12"/>${hair}<path d="M23 46v13m34-13v13" stroke="${skin}" stroke-width="8" stroke-linecap="round"/>${legs}${top}<rect x="35" y="26" width="10" height="10" rx="3" fill="${skin}"/><circle cx="40" cy="18" r="15" fill="${skin}"/><path d="M25 17Q22 0 39 1q19-2 17 19-7-1-11-12-7 9-20 9" fill="${INK}"/>${cap}<g class="folk-eyes"><circle cx="34" cy="20" r="1.8" fill="${INK}"/><circle cx="46" cy="20" r="1.8" fill="${INK}"/></g><path d="M37 26q3 3 6 0" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="29" cy="25" rx="3" ry="2" fill="#E58D94" opacity=".6"/><ellipse cx="51" cy="25" rx="3" ry="2" fill="#E58D94" opacity=".6"/>${studs}<path d="M27 85h10m6 0h10" stroke="${INK}" stroke-width="6" stroke-linecap="round"/></svg>`;
  }
  // Who stands in each district: [gender, outfit, colour] for a pair.
  const DISTRICTS = {
    everyday: [['male', 'casual', '#465A50'], ['female', 'casual', '#B83B72']],
    graphics: [['male', 'graphic', '#2F3A4F'], ['female', 'graphic', '#B83B72']],
    streetwear: [['male', 'hoodie', '#5A4A6E'], ['female', 'hoodie', '#C46A3A']],
    menswear: [['male', 'suit', '#2F3A4F'], ['male', 'suit', '#7A5A44']],
    women: [['female', 'dress', '#B83B72'], ['female', 'dress', '#7C859E']],
    ethnic: [['male', 'kurta', '#C79853'], ['female', 'saree', '#B83B72']],
    active: [['male', 'sport', '#2E8B57'], ['female', 'sport', '#3B6EA8']],
    'multi-brand': [['female', 'shirt', '#7C859E'], ['male', 'casual', '#B57855']],
    indie: [['female', 'kurta', '#5A7D6A'], ['male', 'graphic', '#C46A3A']]
  };
  // Lanes inside a district pick their pair from the lane's own name where it says enough.
  const lane = (name, district) => {
    const n = String(name || '');
    if (/saree/i.test(n)) return [['female', 'saree', '#C79853'], ['female', 'saree', '#B83B72']];
    if (/kurta|ethnic|festive|craft/i.test(n)) return [['male', 'kurta', '#C79853'], ['female', 'kurta', '#B83B72']];
    if (/tailor|formal|work|office|suit/i.test(n)) return DISTRICTS.menswear;
    if (/shirt/i.test(n)) return [['male', 'shirt', '#465A50'], ['male', 'shirt', '#B57855']];
    if (/street|hood|denim|oversized/i.test(n)) return DISTRICTS.streetwear;
    if (/sport|active|gym|run/i.test(n)) return DISTRICTS.active;
    if (/dress|women/i.test(n)) return DISTRICTS.women;
    if (/anime|graphic|fandom|pop/i.test(n)) return DISTRICTS.graphics;
    return DISTRICTS[String(district || '').toLowerCase()] || DISTRICTS.everyday;
  };
  const pair = list => `<span class="mall-folk" aria-hidden="true">${list.map(([g, o, c], i) => person(g, o, c, SKIN[i % SKIN.length])).join('')}</span>`;
  window.MallFolk = {
    district: short => pair(DISTRICTS[String(short || '').toLowerCase()] || DISTRICTS.everyday),
    lane: (name, district) => pair(lane(name, district)),
    person
  };
})();
