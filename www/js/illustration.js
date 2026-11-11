/* On-device outfit illustration: flat editorial-style SVG, recoloured from the user's own items. No network, no cost. */
(function (g) {
  'use strict';
  const OF = (g.OF = g.OF || {});

  function rgb(hex) {
    let h = String(hex || '#999999').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return isNaN(n) ? [153, 153, 153] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /** amt > 0 lightens towards white, amt < 0 darkens towards black */
  function shade(hex, amt) {
    const t = amt >= 0 ? 255 : 0, a = Math.abs(amt);
    return '#' + rgb(hex).map((v) => Math.round(v + (t - v) * a).toString(16).padStart(2, '0')).join('');
  }
  const M = (x) => 900 - x; // mirror around the body centre line x=450

  /* ------------------------------------------------------------ hair */
  function hairBack(id, c, len) {
    const cap = `M392 250 Q388 180 450 174 Q512 180 508 250 Q500 320 470 326 L430 326 Q400 320 392 250 Z`;
    const d = shade(c, -0.15);
    switch (id) {
      case 'down':
      case 'halfup':
        return len === 'medium'
          ? `<path d="M392 250 Q380 176 450 170 Q520 176 508 250 Q522 330 498 358 L402 358 Q378 330 392 250 Z" fill="${c}"/>`
          : `<path d="M392 250 Q380 176 450 170 Q520 176 508 250 Q522 372 494 404 L406 404 Q378 372 392 250 Z" fill="${c}"/>`;
      case 'ponytail':
        return `<path d="${cap}" fill="${c}"/><path d="M500 214 Q568 262 556 430 Q548 480 532 424 Q536 322 494 250 Z" fill="${d}"/>`;
      case 'bun':
        return `<circle cx="450" cy="172" r="25" fill="${d}"/><path d="${cap}" fill="${c}"/>`;
      case 'lowbun':
        return `<circle cx="450" cy="346" r="27" fill="${d}"/><path d="${cap}" fill="${c}"/>`;
      case 'braid': {
        let b = '';
        for (let i = 0; i < 7; i++) b += `<ellipse cx="${508 + i * 3.4}" cy="${302 + i * 27}" rx="11" ry="15" fill="${i % 2 ? d : c}"/>`;
        return `<path d="${cap}" fill="${c}"/>${b}`;
      }
      case 'short':
      default:
        return `<path d="M394 254 Q386 182 450 176 Q514 182 506 254 Q506 292 496 302 L404 302 Q394 292 394 254 Z" fill="${c}"/>`;
    }
  }
  function hairFront(id, c, figure) {
    const part = figure === 'masculine' || id === 'short'
      ? `<path d="M398 246 Q400 190 450 184 Q500 190 502 246 Q494 214 462 206 Q420 208 398 246 Z" fill="${c}"/><path d="M440 192 Q438 206 428 212" stroke="${shade(c, 0.25)}" stroke-width="2" fill="none"/>`
      : `<path d="M398 244 Q404 190 450 186 Q496 190 502 244 Q488 212 450 208 Q412 212 398 244 Z" fill="${c}"/>`;
    const knot = id === 'halfup' ? `<ellipse cx="450" cy="178" rx="19" ry="15" fill="${shade(c, -0.12)}"/>` : '';
    return knot + part;
  }

  /* ------------------------------------------------------------ garments */
  function shortSleeves(c) {
    return `<path d="M398 382 L366 394 L350 472 L386 480 L402 426 Z" fill="${c}"/><path d="M${M(398)} 382 L${M(366)} 394 L${M(350)} 472 L${M(386)} 480 L${M(402)} 426 Z" fill="${c}"/>`;
  }
  /** new kinds are drawn with the closest base shape */
  const SHAPE = { polo: 'shirt', blouse: 'shirt', sweatshirt: 'knit', hoodie: 'knit', crop: 'tee',
    overalls: 'trousers', wideleg: 'trousers', joggers: 'trousers', leggings: 'trousers', cargo: 'trousers', culottes: 'trousers', maxiskirt: 'skirt',
    maxi: 'midi', shirtdress: 'midi', qipao: 'midi', kurung: 'midi', kebaya: 'midi',
    denim: 'jacket', puffer: 'jacket', sunshield: 'jacket', kimono: 'cardigan',
    loafers: 'flats', boots: 'flats', slides: 'sandals', wedges: 'heels', crossbody: 'shoulder', handbag: 'tote', clutch: 'tote', beltbag: 'shoulder' };
  const shp = (t) => SHAPE[t] || t;
  function top(type, c) {
    type = shp(type);
    const d = shade(c, -0.14), l = shade(c, 0.18);
    const body = `<path d="M396 380 Q450 406 504 380 L518 562 L382 562 Z" fill="${c}"/>`;
    switch (type) {
      case 'tank':
        return `<path d="M404 384 L420 380 Q450 440 480 380 L496 384 L512 562 L388 562 Z" fill="${c}"/><path d="M420 380 Q450 440 480 380" stroke="${d}" stroke-width="2.5" fill="none"/>`;
      case 'tee':
        return body + shortSleeves(c) + `<path d="M424 382 Q450 414 476 382" stroke="${d}" stroke-width="4" fill="none"/>`;
      case 'knit': {
        let rib = '';
        for (let x = 392; x <= 508; x += 12) rib += `<line x1="${x}" y1="548" x2="${x}" y2="562" stroke="${d}" stroke-width="2"/>`;
        return body + shortSleeves(c) + `<path d="M424 382 Q450 414 476 382" stroke="${d}" stroke-width="5" fill="none"/><rect x="382" y="546" width="136" height="16" fill="${shade(c, -0.06)}"/>${rib}`;
      }
      case 'shirt':
      default:
        return body + shortSleeves(c) +
          `<path d="M432 384 L450 436 L436 446 L414 394 Z" fill="${l}"/><path d="M${M(432)} 384 L${M(450)} 436 L${M(436)} 446 L${M(414)} 394 Z" fill="${l}"/>` +
          `<line x1="450" y1="436" x2="450" y2="562" stroke="${d}" stroke-width="2"/>` +
          [466, 496, 526].map((y) => `<circle cx="450" cy="${y}" r="2.6" fill="${d}"/>`).join('');
    }
  }
  function bottom(type, c) {
    type = shp(type);
    const d = shade(c, -0.14);
    const band = `<rect x="390" y="540" width="120" height="16" fill="${d}"/>`;
    switch (type) {
      case 'skirt':
        return `<path d="M390 540 L510 540 L526 806 L374 806 Z" fill="${c}"/>${band}<path d="M450 556 L450 806" stroke="${d}" stroke-width="2"/>`;
      case 'shorts':
        return `<path d="M392 540 L508 540 L516 764 L458 764 L450 690 L442 764 L384 764 Z" fill="${c}"/>${band}`;
      case 'jeans':
        return `<path d="M392 540 L508 540 L514 1030 L462 1030 L450 716 L438 1030 L386 1030 Z" fill="${c}"/>${band}` +
          `<path d="M404 560 Q420 590 438 574" stroke="${d}" stroke-width="2" fill="none"/><path d="M496 560 Q480 590 462 574" stroke="${d}" stroke-width="2" fill="none"/>`;
      case 'trousers':
      default:
        return `<path d="M392 540 L508 540 L534 1030 L462 1030 L450 716 L438 1030 L366 1030 Z" fill="${c}"/>${band}<path d="M450 556 L450 716" stroke="${d}" stroke-width="2"/>`;
    }
  }
  function dress(type, c) {
    type = shp(type);
    const d = shade(c, -0.16), l = shade(c, 0.16);
    const hem = type === 'mini' ? 700 : 832;
    const flare = type === 'mini' ? 540 : 556;
    return `<path d="M400 380 Q450 450 500 380 L518 556 Q${flare} ${hem - 90} ${flare - 4} ${hem} L${900 - flare + 4} ${hem} Q${900 - flare} ${hem - 90} 382 556 Z" fill="${c}"/>` +
      `<path d="M400 380 Q450 450 500 380" stroke="${d}" stroke-width="3" fill="none"/><path d="M382 556 L518 556" stroke="${d}" stroke-width="4"/>` +
      `<path d="M450 440 L500 556 L462 560 Z" fill="${l}" opacity=".7"/>`;
  }
  function outer(type, c) {
    type = shp(type);
    const d = shade(c, -0.14), l = shade(c, 0.1);
    const hem = type === 'jacket' ? 600 : type === 'cardigan' ? 700 : 650;
    const sleeve = `<path d="M376 384 L406 382 L402 480 L368 638 L328 630 Q324 500 362 408 Z" fill="${c}"/><path d="M${M(376)} 384 L${M(406)} 382 L${M(402)} 480 L${M(368)} 638 L${M(328)} 630 Q${M(324)} 500 ${M(362)} 408 Z" fill="${c}"/>`;
    const panels = (open) => {
      const gap = open ? 0 : 22;
      return `<path d="M384 378 L414 374 L${440 + gap} 520 L${436 + gap} ${hem} L378 ${hem - 6} L368 452 Z" fill="${c}"/><path d="M${M(384)} 378 L${M(414)} 374 L${M(440 + gap)} 520 L${M(436 + gap)} ${hem} L${M(378)} ${hem - 6} L${M(368)} 452 Z" fill="${c}"/>`;
    };
    if (type === 'cardigan')
      return sleeve + panels(true) + `<line x1="${436}" y1="520" x2="${436}" y2="${hem}" stroke="${d}" stroke-width="2"/><line x1="${M(436)}" y1="520" x2="${M(436)}" y2="${hem}" stroke="${d}" stroke-width="2"/>` +
        `<rect x="378" y="${hem - 12}" width="60" height="12" fill="${d}"/><rect x="${M(438)}" y="${hem - 12}" width="60" height="12" fill="${d}"/>`;
    if (type === 'jacket')
      return sleeve + panels(false) + `<line x1="450" y1="388" x2="450" y2="${hem}" stroke="${d}" stroke-width="3"/><path d="M414 374 L432 396 L450 388 L468 396 L486 374 L470 366 L450 378 L430 366 Z" fill="${d}"/>` +
        `<rect x="376" y="${hem - 14}" width="148" height="14" fill="${d}"/>`;
    return sleeve + panels(true) + `<path d="M414 374 L436 428 L418 446 Z" fill="${d}"/><path d="M${M(414)} 374 L${M(436)} 428 L${M(418)} 446 Z" fill="${d}"/>` +
      `<circle cx="${436}" cy="560" r="3" fill="${l}"/><circle cx="${M(436)}" cy="560" r="3" fill="${l}"/>`;
  }
  function foot(type, c, mirror) {
    type = shp(type);
    const X = (x) => (mirror ? M(x) : x);
    const d = shade(c, -0.22);
    const P = (arr) => arr.map(([x, y], i) => (i ? 'L' : 'M') + X(x) + ' ' + y).join(' ') + ' Z';
    switch (type) {
      case 'flats':
        return `<path d="${P([[398, 1040], [436, 1040], [444, 1058], [440, 1068], [394, 1068], [390, 1058]])}" fill="${c}"/>`;
      case 'sneakers':
        return `<path d="${P([[396, 1038], [438, 1038], [448, 1056], [450, 1066], [388, 1066], [390, 1052]])}" fill="${c}"/><rect x="${mirror ? M(452) : 386}" y="1062" width="66" height="9" rx="4" fill="#F4F4F2" stroke="#00000022"/>` +
          `<path d="M${X(404)} 1048 L${X(430)} 1048 M${X(402)} 1054 L${X(432)} 1054" stroke="#ffffff" stroke-opacity=".7" stroke-width="2"/>`;
      case 'sandals':
        return `<path d="${P([[398, 1042], [436, 1042], [444, 1062], [392, 1062]])}" fill="__SKIN__"/><path d="M${X(394)} 1066 L${X(444)} 1066" stroke="${c}" stroke-width="5" stroke-linecap="round"/>` +
          `<path d="M${X(402)} 1046 L${X(432)} 1046 M${X(398)} 1056 L${X(438)} 1056" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
      case 'heels':
      default:
        return `<path d="${P([[398, 1038], [436, 1038], [446, 1060], [392, 1062]])}" fill="${c}"/><rect x="${mirror ? M(436) : 425}" y="1060" width="11" height="18" fill="${d}"/><path d="M${X(392)} 1062 L${X(446)} 1060" stroke="${d}" stroke-width="3"/>`;
    }
  }
  function shoes(it, skin) {
    if (!it) return `<ellipse cx="418" cy="1052" rx="20" ry="14" fill="${skin}"/><ellipse cx="482" cy="1052" rx="20" ry="14" fill="${skin}"/>`;
    return (foot(it.type, it.color, false) + foot(it.type, it.color, true)).replace(/__SKIN__/g, skin);
  }
  function bag(it) {
    if (!it) return { back: '', front: '' };
    const c = it.color, d = shade(c, -0.18), hand = '';
    switch (shp(it.type)) {
      case 'shoulder':
        return {
          back: '',
          front: `<path d="M520 386 Q566 520 574 676" stroke="${c}" stroke-width="6" fill="none"/><path d="M542 676 L612 676 L608 744 Q576 754 546 744 Z" fill="${c}"/><path d="M542 676 L612 676 L606 702 Q577 714 548 702 Z" fill="${d}"/><circle cx="577" cy="702" r="3.5" fill="${shade(c, 0.4)}"/>`,
        };
      case 'backpack':
        return {
          back: `<rect x="338" y="396" width="34" height="190" rx="14" fill="${d}"/><rect x="528" y="396" width="34" height="190" rx="14" fill="${d}"/>`,
          front: `<path d="M412 384 Q402 470 414 548" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M488 384 Q498 470 486 548" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/>`,
        };
      case 'tote':
      default:
        return {
          back: '',
          front: `<path d="M548 672 Q562 620 578 672" stroke="${c}" stroke-width="6" fill="none"/><path d="M534 668 L606 668 L600 752 L540 752 Z" fill="${c}"/><path d="M534 690 L606 690" stroke="${d}" stroke-width="2.5"/>`,
        };
    }
  }
  function jewelry(it, sx) {
    if (!it) return '';
    const bx = 450 + (342 - 450) * (sx || 1);
    const c = it.color;
    return `<circle cx="397" cy="292" r="6" fill="none" stroke="${c}" stroke-width="3.5"/><circle cx="503" cy="292" r="6" fill="none" stroke="${c}" stroke-width="3.5"/>` +
      `<path d="M430 354 Q450 392 470 354" stroke="${c}" stroke-width="2.5" fill="none"/><circle cx="450" cy="389" r="3.6" fill="${c}"/>` +
      `<circle cx="${bx}" cy="644" r="8" fill="none" stroke="${c}" stroke-width="3"/>`;
  }

  /* ------------------------------------------------------------ face */
  function face(profile, makeup, lip, groomId) {
    const male = profile.figure === 'masculine';
    const brow = shade(profile.hairColor, 0.1);
    const lipC = makeup ? lip : shade(profile.skin, -0.28);
    return `<path d="M424 250 Q434 243 444 249" stroke="${brow}" stroke-width="${male ? 4.5 : 3}" fill="none" stroke-linecap="round"/>` +
      `<path d="M456 249 Q466 243 476 250" stroke="${brow}" stroke-width="${male ? 4.5 : 3}" fill="none" stroke-linecap="round"/>` +
      `<path d="M425 262 Q434 267 443 262" stroke="#3A2A25" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M457 262 Q466 267 475 262" stroke="#3A2A25" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M450 266 Q446 280 452 283" stroke="${shade(profile.skin, -0.18)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
      `<path d="M436 297 Q450 ${makeup ? 307 : 303} 464 297 Q450 ${makeup ? 301 : 300} 436 297 Z" fill="${lipC}" stroke="${lipC}" stroke-width="1.5" stroke-linejoin="round"/>` +
      (makeup ? `<ellipse cx="420" cy="283" rx="12" ry="7" fill="#E29A8D" opacity=".42"/><ellipse cx="480" cy="283" rx="12" ry="7" fill="#E29A8D" opacity=".42"/>` : '');
  }

  const LIPS = { work: '#B8645E', casual: '#CF8A80', beach: '#D77A6E', sport: '#C9847A', glam: '#A33C3C', formal: '#9C4B4B' };

  /** profile: {figure, skin, hairColor, hairLength, makeup}; parts: {Top,Bottom,Dress,Outerwear,Shoes,Bag,Jewelry} (item|null); groom: {hairId, makeupKeys} */
  function render(profile, parts, groom, opts) {
    opts = opts || {};
    const skin = profile.skin, skinSh = shade(skin, -0.11);
    const hc = profile.hairColor;
    const sx = profile.figure === 'masculine' ? 1.12 : profile.figure === 'neutral' ? 1.05 : 1;
    const main = (parts.Dress || parts.Top || parts.Outerwear || { color: '#CCCCCC' }).color;
    const bg0 = shade(main, 0.8);
    const bg = Math.min(...rgb(bg0)) > 238 ? '#ECE5D8' : bg0;
    const makeup = !!profile.makeup && profile.figure !== 'masculine';
    const mk = (groom && groom.makeupKeys && groom.makeupKeys[0]) || 'mk.casual';
    const lip = LIPS[mk.replace('mk.', '')] || LIPS.casual;
    const b = bag(parts.Bag);
    const hairId = (groom && groom.hairId) || (profile.hairLength === 'short' ? 'short' : 'down');
    const bodyArms = `<path d="M368 392 Q338 520 332 640 L352 646 Q372 530 392 440 Z" fill="${skin}"/><path d="M532 392 Q562 520 568 640 L548 646 Q528 530 508 440 Z" fill="${skin}"/><circle cx="342" cy="648" r="12" fill="${skin}"/><circle cx="558" cy="648" r="12" fill="${skin}"/>`;
    const legs = `<path d="M404 650 L450 650 L448 760 L436 1040 L406 1040 Z" fill="${skin}"/><path d="M450 650 L496 650 L494 1040 L464 1040 L452 760 Z" fill="${skin}"/>`;
    const torsoBase = `<path d="M396 378 Q450 404 504 378 L514 560 L386 560 Z" fill="${skin}"/>`;
    const bib = (c) => `<path d="M414 472 L486 472 L490 552 L410 552 Z" fill="${c}"/><path d="M420 472 L424 396 L432 396 L428 472 Z" fill="${c}"/><path d="M480 472 L476 396 L468 396 L472 472 Z" fill="${c}"/>`;
    const one = (d) => d.type === 'jumpsuit' ? bottom('trousers', d.color) + top('tank', d.color) : d.type === 'playsuit' ? bottom('shorts', d.color) + top('tank', d.color) : dress(d.type, d.color);
    const garments = (parts.Dress ? one(parts.Dress) : (parts.Bottom ? bottom(parts.Bottom.type, parts.Bottom.color) : '') + (parts.Top ? top(parts.Top.type, parts.Top.color) : '') + (parts.Bottom && parts.Bottom.type === 'overalls' ? bib(parts.Bottom.color) : '')) +
      (parts.Outerwear ? outer(parts.Outerwear.type, parts.Outerwear.color) : '');
    const label = opts.label ? ` aria-label="${String(opts.label).replace(/"/g, '&quot;')}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="250 130 400 970" role="img"${label} preserveAspectRatio="xMidYMid meet">` +
      `<circle cx="450" cy="590" r="215" fill="${bg}"/>` +
      `<ellipse cx="450" cy="1074" rx="120" ry="9" fill="#00000018"/>` +
      hairBack(hairId, hc, profile.hairLength) +
      `<path d="M432 300 L432 352 Q450 374 468 352 L468 300 Z" fill="${skinSh}"/>` +
      `<ellipse cx="450" cy="262" rx="52" ry="62" fill="${skin}"/>` +
      `<g transform="translate(450 0) scale(${sx} 1) translate(-450 0)">${b.back}${bodyArms}${legs}${shoes(parts.Shoes, skin)}${torsoBase}${garments}${b.front}</g>` +
      face(profile, makeup, lip) +
      hairFront(hairId, hc, profile.figure) +
      jewelry(parts.Jewelry, sx) +
      `</svg>`;
  }

  OF.illustration = { render, shade };
})(typeof window !== 'undefined' ? window : globalThis);
