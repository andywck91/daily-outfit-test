/* Demo wardrobe so testers can try the app without photographing 40 items first. */
(function (g) {
  'use strict';
  const OF = (g.OF = g.OF || {});
  const A = (s) => s.split(' ');
  // [cat, type, name, zh, colour, occasions, weather]
  const ROWS = [
    ['Top', 'shirt', 'White linen shirt', '白色亚麻衬衫', '#F7F5F0', 'Business ClientVisit Casual Summer', 'hot_humid aircon'],
    ['Top', 'shirt', 'Light blue oxford shirt', '浅蓝牛津衬衫', '#A9C7E8', 'Business ClientVisit Casual', 'hot_humid aircon'],
    ['Top', 'shirt', 'Sage green blouse', '鼠尾草绿衬衫', '#9DB59A', 'Business Date Casual', 'hot_humid aircon'],
    ['Top', 'tee', 'Black fitted tee', '黑色修身T恤', '#1E1E20', 'Casual Travel Sport', 'hot_sunny hot_humid'],
    ['Top', 'tee', 'White crew tee', '白色圆领T恤', '#F7F5F0', 'Casual Travel Summer Beach', 'hot_sunny hot_humid'],
    ['Top', 'tee', 'Navy tee', '藏青T恤', '#1F2E4D', 'Casual Travel', 'hot_sunny hot_humid'],
    ['Top', 'tank', 'Cream camisole', '奶油色吊带背心', '#EFE3CF', 'Casual Date Summer Beach Party', 'hot_sunny hot_humid'],
    ['Top', 'tank', 'Black sports tank', '黑色运动背心', '#26262A', 'Sport', 'hot_sunny hot_humid'],
    ['Top', 'knit', 'Dusty pink knit top', '灰粉针织上衣', '#D9A5A5', 'Date Casual Business', 'aircon cool'],
    ['Top', 'shirt', 'Terracotta blouse', '陶土色衬衫', '#C46A4A', 'Festive Party Date', 'hot_humid aircon'],
    ['Top', 'knit', 'Beige ribbed knit', '米色罗纹针织', '#D8C7A8', 'Business Casual Date', 'aircon cool'],
    ['Top', 'tee', 'Olive tee', '橄榄绿T恤', '#6B7048', 'Casual Travel Sport', 'hot_sunny hot_humid'],

    ['Bottom', 'trousers', 'Beige wide-leg trousers', '米色阔腿裤', '#CDB89A', 'Business ClientVisit Casual Formal', 'hot_humid aircon'],
    ['Bottom', 'trousers', 'Black tailored trousers', '黑色西裤', '#1E1E20', 'Business ClientVisit Formal', 'aircon hot_humid'],
    ['Bottom', 'trousers', 'Navy slacks', '藏青长裤', '#1F2E4D', 'Business ClientVisit Casual', 'aircon hot_humid'],
    ['Bottom', 'jeans', 'Light-wash jeans', '浅蓝牛仔裤', '#8FB0D6', 'Casual Travel Date', 'aircon'],
    ['Bottom', 'jeans', 'Black jeans', '黑色牛仔裤', '#26262A', 'Casual Date Party', 'aircon'],
    ['Bottom', 'skirt', 'Black pencil skirt', '黑色铅笔裙', '#1E1E20', 'Business ClientVisit Formal', 'aircon hot_humid'],
    ['Bottom', 'skirt', 'Cream midi skirt', '奶油色中长裙', '#EFE3CF', 'Date Casual Festive Party', 'hot_humid hot_sunny'],
    ['Bottom', 'shorts', 'Denim shorts', '牛仔短裤', '#6F94C2', 'Casual Beach Summer Travel', 'hot_sunny hot_humid'],
    ['Bottom', 'shorts', 'Black running shorts', '黑色运动短裤', '#26262A', 'Sport', 'hot_sunny hot_humid'],
    ['Bottom', 'trousers', 'Grey jogger pants', '灰色运动长裤', '#9AA0A6', 'Sport Casual Travel', 'aircon cool'],

    ['Dress', 'midi', 'Navy wrap midi dress', '海军蓝裹身中长裙', '#1F2E4D', 'Date Party Formal Business ClientVisit', 'aircon hot_humid'],
    ['Dress', 'midi', 'Red midi dress', '红色中长裙', '#B9362C', 'Festive Party Date', 'hot_humid'],
    ['Dress', 'mini', 'Mint sundress', '薄荷绿连衣裙', '#BFE3D0', 'Beach Summer Casual', 'hot_sunny hot_humid'],

    ['Outerwear', 'blazer', 'Beige lightweight blazer', '米色轻薄西装外套', '#D9C7AB', 'Business ClientVisit Formal', 'aircon'],
    ['Outerwear', 'blazer', 'Black blazer', '黑色西装外套', '#26262A', 'Formal Party Business', 'aircon'],
    ['Outerwear', 'cardigan', 'Grey cardigan', '灰色开衫', '#B3B6BA', 'Casual Business Travel', 'aircon cool'],
    ['Outerwear', 'jacket', 'Denim jacket', '牛仔夹克', '#5B7DB1', 'Casual Travel', 'aircon cool'],

    ['Shoes', 'heels', 'Nude block heels', '裸色粗跟鞋', '#E3C4A8', 'Business Formal Date Party ClientVisit', ''],
    ['Shoes', 'flats', 'Black pointed flats', '黑色尖头平底鞋', '#1E1E20', 'Business Casual ClientVisit Formal', ''],
    ['Shoes', 'sneakers', 'White sneakers', '白色运动鞋', '#F4F4F2', 'Casual Sport Travel', ''],
    ['Shoes', 'sneakers', 'Grey running shoes', '灰色跑鞋', '#7C828A', 'Sport', ''],
    ['Shoes', 'sandals', 'Tan sandals', '棕褐色凉鞋', '#C8A582', 'Beach Summer Casual Travel Festive', 'hot_sunny hot_humid'],
    ['Shoes', 'heels', 'Black strappy heels', '黑色细带高跟鞋', '#1E1E20', 'Party Date Formal Festive', ''],

    ['Bag', 'tote', 'Black structured tote', '黑色挺括托特包', '#1D1D1F', 'Business ClientVisit Casual Travel', ''],
    ['Bag', 'shoulder', 'Ivory shoulder bag', '象牙白单肩包', '#E4DCCF', 'Date Party Formal Casual Festive', ''],
    ['Bag', 'tote', 'Camel mini tote', '驼色迷你托特包', '#C8A582', 'Business Casual Date', ''],
    ['Bag', 'backpack', 'Black backpack', '黑色双肩包', '#26262A', 'Sport Travel Casual', ''],

    ['Jewelry', 'set', 'Gold hoops + fine chain', '金色圈形耳环+细链', '#D4AF37', 'Business Casual Date Party Festive', ''],
    ['Jewelry', 'set', 'Silver studs + chain', '银色耳钉+项链', '#C0C0C0', 'Business ClientVisit Formal Casual', ''],
    ['Jewelry', 'set', 'Pearl set', '珍珠套装', '#EFE9DD', 'Formal Date Business', ''],
    ['Jewelry', 'set', 'Gold statement set', '金色夸张款套装', '#D9B44A', 'Party Festive', ''],
  ];

  function makeDemoItems(state) {
    const tmp = { ...state, items: state.items.slice(), counters: { ...(state.counters || {}) } };
    const out = [];
    for (const [cat, type, name, zh, color, occ, wx] of ROWS) {
      const it = { id: OF.engine.nextId(tmp, cat), cat, type, name, nameZh: zh, color, occasions: A(occ).filter(Boolean), weather: A(wx).filter(Boolean), laundry: false, demo: true, addedAt: Date.now() };
      tmp.items.push(it);
      out.push(it);
    }
    return { items: out, counters: tmp.counters };
  }
  OF.demo = { makeDemoItems, count: ROWS.length };
})(typeof window !== 'undefined' ? window : globalThis);
