/* Porchlight prototype — seller, buyer and team flows in one static page.
   Data is saved in this browser's localStorage only (test data). */
(function () {
  'use strict';

  var KEY = 'porchlight-proto-v1';
  var app = document.getElementById('app');

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { n = Math.round(n || 0); return (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US'); }
  function kfmt(n) { return '$' + (Math.round(n / 100) / 10) + 'k'; }
  function r500(n) { return Math.max(0, Math.round(n / 500) * 500); }
  function num(v) { var n = Number(String(v).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function go(h) { location.hash = h; }

  var ICON = {
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>',
    home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 11 12 4l8 7v9H4z"/></svg>',
    list: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    clock: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    chat: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    user: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="9" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    bookmark: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4z"/></svg>',
    check: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
    lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    logo: '<svg width="26" height="26" viewBox="0 0 28 28" fill="none" stroke="#7FB59C" stroke-width="2.2" aria-hidden="true"><path d="M4 13 14 5l10 8"/><path d="M7 11v12h14V11"/><circle cx="14" cy="17" r="2.5"/></svg>',
    tag: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
    briefcase: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2"/></svg>',
    grid: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>'
  };

  /* ---------- pricing rules (prototype assumptions) ---------- */
  var ITEMS = ['Roof', 'Heating & AC', 'Plumbing', 'Electrical', 'Foundation', 'Water damage'];
  var ITEM_COST = { 'Roof': 12000, 'Heating & AC': 7000, 'Plumbing': 4500, 'Electrical': 5000, 'Foundation': 9000, 'Water damage': 8500 };
  var NOT_SURE_COST = 2000;      // inspection / contingency per "not sure" item
  var COSMETIC_PER_SF = 7;        // paint, floors, cleanup
  var ARV_PER_SF = 250;           // placeholder until a real data feed
  var CLOSING_EST = 2100;         // seller taxes & attorney (prorated), sample
  var CC_SELLER = { 'Buyer pays': 0, 'Split': 1500, 'Seller pays': 3000 };
  var FLIP_COSTS_PCT = 0.10;      // selling, loan & holding for buyer math

  function repairBreakdown(cond, sqft) {
    var lines = [];
    ITEMS.forEach(function (it) {
      var v = cond[it] || 'OK';
      if (v === 'Needs work') lines.push({ label: it + ' (needs work)', cost: ITEM_COST[it], item: it });
      else if (v === 'Not sure') lines.push({ label: it + ' (check)', cost: NOT_SURE_COST, item: it });
    });
    lines.push({ label: 'Paint, floors, cleanup', cost: Math.round((sqft || 0) * COSMETIC_PER_SF), item: 'cosmetic' });
    return lines;
  }
  function estRepairs(cond, sqft) { return r500(repairBreakdown(cond, sqft).reduce(function (a, l) { return a + l.cost; }, 0)); }
  function estArv(sqft) { return Math.round((sqft || 0) * ARV_PER_SF / 1000) * 1000; }
  function estRent(beds) { return Math.min(3200, 1000 + (beds || 0) * 400); }
  function flipMax(arv, rep) { return r500(arv * 0.7 - rep); }
  function rentalMax(rent, rep) { return r500(rent * 100 - rep); }
  function sellerNet(deal, offer) { return offer.price - (deal.owe || 0) - CLOSING_EST - (CC_SELLER[offer.cc] || 0); }

  /* ---------- data ---------- */
  function sampleCond(o) { var c = {}; ITEMS.forEach(function (i) { c[i] = 'OK'; }); for (var key in o) c[key] = o[key]; return c; }
  function seed() {
    var now = Date.now();
    return {
      v: 1,
      myDealId: null,
      buyer: { entity: '', strats: ['Fix & flip', 'Rentals'], counties: [], maxPrice: 350000, pof: 'none' },
      draft: null,
      deals: [
        { id: 'd1', addr: '1234 Sample St', city: 'Charlotte', zip: '28205', county: 'Mecklenburg', beds: 3, baths: 2, sqft: 1420, year: 1978,
          occ: 'Me', when: 'Within 30 days', owe: 18000, sample: true, owner: 'Ed',
          cond: sampleCond({ 'Roof': 'Needs work', 'Water damage': 'Needs work', 'Plumbing': 'Not sure', 'Foundation': 'Not sure' }),
          arv: 355000, repairs: 34500, rent: 2200, ask: 214000, stage: 'offers', created: now - 864e5 * 2,
          arvReview: { note: 'New roof installed in 2022, receipt attached. Neighbor’s renovated house sold for more last spring.', status: 'pending' },
          offers: [
            { id: 'o1', buyer: 'Example Holdings LLC', tag: 'POF verified', type: 'Cash', price: 214000, emd: 5000, dd: '7 days', close: '14 days', cc: 'Buyer pays', status: 'open' },
            { id: 'o2', buyer: 'Sample Capital Group', tag: 'POF verified', type: 'Cash', price: 209500, emd: 5000, dd: '10 days', close: '21 days', cc: 'Split', status: 'open' },
            { id: 'o3', buyer: 'Atmore Properties LLC', tag: 'House offer', type: 'Cash', price: 205000, emd: 10000, dd: 'None', close: '10 days', cc: 'Buyer pays', status: 'open' },
            { id: 'o4', buyer: 'Demo Homes Inc', tag: 'POF verified', type: 'Hard money', price: 206000, emd: 3000, dd: '14 days', close: '30 days', cc: 'Seller pays', status: 'open' }
          ], notes: [{ by: 'Ed', text: 'Seller is motivated, moving closer to family. Prefers a fast close over top price.' }] },
        { id: 'd2', addr: '88 Example Ave', city: 'Gastonia', zip: '28052', county: 'Gaston', beds: 3, baths: 1, sqft: 1150, year: 1968,
          occ: 'Vacant', when: 'ASAP', owe: 0, sample: true, owner: 'Rep 2',
          cond: sampleCond({ 'Heating & AC': 'Needs work', 'Electrical': 'Not sure' }),
          arv: 235000, repairs: 22000, rent: 1750, ask: 148000, stage: 'live', created: now - 864e5 * 0.3, offers: [], notes: [] },
        { id: 'd3', addr: '501 Demo Ct', city: 'Concord', zip: '28025', county: 'Cabarrus', beds: 4, baths: 2, sqft: 1680, year: 1994,
          occ: 'A tenant', when: '60+ days', owe: 61000, sample: true, owner: 'Ed',
          cond: sampleCond({ 'Water damage': 'Not sure' }),
          arv: 290000, repairs: 18000, rent: 1950, ask: 189000, stage: 'live', created: now - 864e5, offers: [], notes: [] },
        { id: 'd4', addr: '77 Placeholder Rd', city: 'Monroe', zip: '28110', county: 'Union', beds: 2, baths: 1, sqft: 980, year: 1962,
          occ: 'Me', when: 'Just exploring', owe: 0, sample: true, owner: 'Rep 2', cond: sampleCond({}),
          arv: 0, repairs: 0, rent: 0, ask: 0, stage: 'new', created: now - 36e5 * 5, offers: [], notes: [] },
        { id: 'd5', addr: '9 Sketch Way', city: 'Rock Hill', zip: '29730', county: 'York, SC', beds: 3, baths: 2, sqft: 1300, year: 1985,
          occ: 'Vacant', when: 'ASAP', owe: 40000, sample: true, owner: 'Rep 3', cond: sampleCond({ 'Roof': 'Needs work' }),
          arv: 265000, repairs: 23000, rent: 1900, ask: 162000, stage: 'contract', created: now - 864e5 * 12,
          offers: [{ id: 'o9', buyer: 'Sample Capital Group', tag: 'POF verified', type: 'Cash', price: 162000, emd: 5000, dd: '7 days', close: '21 days', cc: 'Buyer pays', status: 'accepted' }],
          accepted: 'o9', todos: [true, true, false], notes: [] }
      ]
    };
  }
  var S;
  function load() {
    try { var raw = localStorage.getItem(KEY); S = raw ? JSON.parse(raw) : seed(); } catch (e) { S = seed(); }
    if (!S || S.v !== 1) S = seed();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ } }
  function deal(id) { return S.deals.filter(function (d) { return d.id === id; })[0]; }
  function offerOf(d, oid) { return (d.offers || []).filter(function (o) { return o.id === oid; })[0]; }

  var UI = {}; // transient, per screen
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }

  /* ---------- shared pieces ---------- */
  function topbar(o) {
    return '<div class="topbar' + (o.dark ? ' dark' : '') + '">' +
      (o.back ? '<a class="icon-btn" href="' + o.back + '" aria-label="Back">' + ICON.back + '</a>' : '<span style="width:8px"></span>') +
      '<div class="titles"><span class="title">' + esc(o.title) + '</span>' + (o.sub ? '<span class="sub">' + esc(o.sub) + '</span>' : '') + '</div>' +
      (o.right || '<span style="width:44px"></span>') + '</div>';
  }
  function progress(n) {
    var h = '<div class="progress" aria-label="Step ' + n + ' of 4">';
    for (var i = 1; i <= 4; i++) h += '<span class="' + (i <= n ? 'on' : '') + '"></span>';
    return h + '</div>';
  }
  function chips(name, options, value, multi, dark) {
    return '<div class="chips" role="group">' + options.map(function (o) {
      var on = multi ? value.indexOf(o) > -1 : value === o;
      return '<button type="button" class="chip' + (dark ? ' dark' : '') + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-act="chip" data-name="' + name + '" data-val="' + esc(o) + '"' + (multi ? ' data-multi="1"' : '') + '>' + esc(o) + '</button>';
    }).join('') + '</div>';
  }
  function seg(name, options, value, cols, dark) {
    return '<div class="seg' + (dark ? ' dark' : '') + '" role="group" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">' + options.map(function (o) {
      var on = value === o;
      return '<button type="button" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" data-act="chip" data-name="' + name + '" data-val="' + esc(o) + '">' + esc(o) + '</button>';
    }).join('') + '</div>';
  }
  function moneyField(id, value, bind, step, sm) {
    return '<div class="money-field' + (sm ? ' sm' : '') + '"><span aria-hidden="true">$</span><input id="' + id + '" inputmode="numeric" type="text" value="' + esc(value ? Math.round(value).toLocaleString('en-US') : '') + '" data-bind="' + bind + '" data-money="1"></div>';
  }
  function condPills(cond) {
    return '<div class="pills">' + ITEMS.map(function (i) {
      var v = cond[i] || 'OK'; var cls = v === 'Needs work' ? 'warn' : v === 'Not sure' ? 'neutral' : 'good';
      return '<span class="pill ' + cls + '">' + esc(i) + ': ' + esc(v.toLowerCase()) + '</span>';
    }).join('') + '</div>';
  }
  function sellerTabs(id, on) {
    return '<nav class="tabbar" aria-label="Seller">' +
      '<a href="#/seller/' + id + '" class="' + (on === 'offers' ? 'on' : '') + '">' + ICON.list + 'Offers</a>' +
      '<a href="#/seller/' + id + '/timeline" class="' + (on === 'timeline' ? 'on' : '') + '">' + ICON.clock + 'Timeline</a>' +
      '<a href="#" data-act="soon">' + ICON.chat + 'Messages</a>' +
      '<a href="#/">' + ICON.user + 'Exit</a></nav>';
  }
  function buyerTabs(on) {
    return '<nav class="tabbar" aria-label="Buyer">' +
      '<a href="#/buy" class="' + (on === 'deals' ? 'on' : '') + '">' + ICON.home + 'Deals</a>' +
      '<a href="#/buy/offers" class="' + (on === 'offers' ? 'on' : '') + '">' + ICON.list + 'My offers</a>' +
      '<a href="#/buy/verify" class="' + (on === 'account' ? 'on' : '') + '">' + ICON.user + 'Account</a>' +
      '<a href="#/">' + ICON.bookmark + 'Exit</a></nav>';
  }

  /* ---------- HOME ---------- */
  function vHome() {
    var mine = S.myDealId && deal(S.myDealId);
    return '<div class="screen">' +
      '<div class="hero"><div class="brand">' + ICON.logo + 'Porchlight</div>' +
      '<h1 class="h1" style="font-size:32px">Sell as-is. Guided from offer to closing.</h1>' +
      '<p class="lead">Working prototype. Pick a role to try it. Everything you enter is test data saved only on this phone.</p></div>' +
      '<div class="content">' +
      '<a class="card card-link role" href="' + (mine ? '#/seller/' + mine.id : '#/sell/1') + '"><span class="ic">' + ICON.tag + '</span><span class="stack" style="gap:2px"><strong style="font-size:17px">I’m selling a house</strong><span class="small">' + (mine ? 'Continue with ' + esc(mine.addr) : 'Get offers on an as-is home') + '</span></span></a>' +
      '<a class="card card-link role" href="#/buy"><span class="ic">' + ICON.briefcase + '</span><span class="stack" style="gap:2px"><strong style="font-size:17px">I’m a cash buyer</strong><span class="small">See deals, run numbers, make offers</span></span></a>' +
      '<a class="card card-link role" href="#/team"><span class="ic">' + ICON.grid + '</span><span class="stack" style="gap:2px"><strong style="font-size:17px">Team view</strong><span class="small">Pipeline, pricing reviews, offers</span></span></a>' +
      '<div class="notice neutral"><strong>Tip</strong><span>On iPhone tap Share → Add to Home Screen. On Android tap ⋮ → Add to Home screen.</span></div>' +
      (mine ? '<button class="btn secondary" data-act="start-over">Start a new seller listing</button>' : '') +
      '<button class="btn secondary" data-act="reset">Reset all demo data</button>' +
      '</div></div>';
  }

  /* ---------- SELLER: intake ---------- */
  function draft() {
    if (!S.draft) S.draft = { addr: '', county: 'Mecklenburg', beds: 3, baths: 2, sqft: '', year: '', occ: 'Me', when: 'Within 30 days', owe: '', cond: sampleCond({}), photos: 0, repairsOverride: null, rentOverride: null, arvNote: '', arvOpen: false, price: null };
    return S.draft;
  }
  function vSell1() {
    var d = draft();
    var ok = d.addr.trim().length > 4 && num(d.sqft) > 300;
    return '<div class="screen">' + topbar({ back: '#/', title: 'Step 1 of 4', sub: 'Your home' }) + '<div style="background:#fff;padding-bottom:10px;border-bottom:1px solid var(--line)">' + progress(1) + '</div>' +
      '<div class="content">' +
      '<div class="stack"><h1 class="h1">Tell us about your home</h1><p class="lead">Takes about 3 minutes.</p></div>' +
      '<div class="stack"><label class="lbl" for="addr">Property address</label><input class="field" id="addr" autocomplete="street-address" placeholder="Street, city, ZIP" value="' + esc(d.addr) + '" data-bind="draft.addr"></div>' +
      '<div class="stack"><label class="lbl" for="county">County</label><select class="field" id="county" data-bind="draft.county">' +
      ['Mecklenburg', 'Gaston', 'Cabarrus', 'Iredell', 'Union', 'Rowan', 'York, SC', 'Other'].map(function (c) { return '<option' + (d.county === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
      '<div class="grid3">' +
      '<div class="stack"><label class="lbl" for="beds">Beds</label><input class="field" id="beds" inputmode="numeric" value="' + esc(d.beds) + '" data-bind="draft.beds" data-num="1"></div>' +
      '<div class="stack"><label class="lbl" for="baths">Baths</label><input class="field" id="baths" inputmode="decimal" value="' + esc(d.baths) + '" data-bind="draft.baths" data-num="1"></div>' +
      '<div class="stack"><label class="lbl" for="sqft">Sq ft</label><input class="field" id="sqft" inputmode="numeric" placeholder="1,400" value="' + esc(d.sqft) + '" data-bind="draft.sqft" data-num="1"></div></div>' +
      '<div class="stack"><label class="lbl" for="year">Year built <span class="small" style="font-weight:400">(optional)</span></label><input class="field" id="year" inputmode="numeric" placeholder="1985" value="' + esc(d.year) + '" data-bind="draft.year" data-num="1"></div>' +
      '<div class="stack" style="gap:10px"><span class="lbl">Who lives there now?</span>' + chips('draft.occ', ['Me', 'A tenant', 'Vacant'], d.occ) + '</div>' +
      '<div class="stack" style="gap:10px"><span class="lbl">When do you want to sell?</span>' + chips('draft.when', ['ASAP', 'Within 30 days', '60+ days', 'Just exploring'], d.when) + '</div>' +
      '<div class="stack"><label class="lbl" for="owe">Roughly what do you owe? <span class="small" style="font-weight:400">(optional)</span></label>' + moneyField('owe', d.owe, 'draft.owe') + '<span class="small">Used only to estimate what you take home.</span></div>' +
      '</div><div class="footer-bar"><button class="btn" data-act="goto" data-to="#/sell/2"' + (ok ? '' : ' disabled') + '>Continue</button>' + (ok ? '' : '<span class="tiny" style="text-align:center">Add the address and square footage to continue.</span>') + '</div></div>';
  }
  function vSell2() {
    var d = draft();
    return '<div class="screen">' + topbar({ back: '#/sell/1', title: 'Step 2 of 4', sub: 'Condition' }) + '<div style="background:#fff;padding-bottom:10px;border-bottom:1px solid var(--line)">' + progress(2) + '</div>' +
      '<div class="content">' +
      '<div class="stack"><h1 class="h1">What shape is it in?</h1><p class="lead">No need to fix or clean anything. Honest answers get firmer offers.</p></div>' +
      ITEMS.map(function (it) { return '<div class="card" style="gap:10px;padding:14px"><span style="font-weight:600">' + esc(it) + '</span>' + seg('cond.' + it, ['OK', 'Needs work', 'Not sure'], d.cond[it] || 'OK', 3) + '</div>'; }).join('') +
      '<div class="stack" style="gap:10px"><div class="row"><span class="lbl" style="font-size:16px">Photos</span><span class="small">' + (d.photos ? d.photos + ' added' : 'Phone photos are fine') + '</span></div>' +
      '<label class="btn secondary" for="photos" style="cursor:pointer">' + (d.photos ? 'Add more photos' : 'Add photos') + '</label><input id="photos" class="sr" type="file" accept="image/*" multiple data-act-change="photos">' +
      '<span class="tiny">Prototype: photos are counted but not uploaded.</span></div>' +
      '</div><div class="footer-bar"><button class="btn" data-act="goto" data-to="#/sell/3">Continue to pricing</button></div></div>';
  }
  function draftNumbers(d) {
    var sqft = num(d.sqft), beds = num(d.beds);
    var arv = estArv(sqft);
    var repEst = estRepairs(d.cond, sqft);
    var rep = d.repairsOverride != null ? d.repairsOverride : repEst;
    var rentEst = estRent(beds);
    var rent = d.rentOverride != null ? d.rentOverride : rentEst;
    var flip = flipMax(arv, rep), rental = rentalMax(rent, rep);
    return { sqft: sqft, arv: arv, rep: rep, repEst: repEst, rent: rent, flip: flip, rental: rental, lo: Math.min(flip, rental), hi: Math.max(flip, rental) };
  }
  function priceStatus(p, n) {
    var stretch = r500(n.hi * 1.12);
    if (p <= n.lo) return ['good', 'Fits flippers and rental investors', 'Your widest pool of buyers. Expect the most offers and the fastest sale.'];
    if (p <= n.hi) return ['ok', n.flip >= n.rental ? 'Fits flippers' : 'Fits rental investors', 'Within what one type of investor can pay. A strong, realistic price.'];
    if (p <= stretch) return ['warn', 'A stretch for investors', 'Above investor formulas. Expect fewer offers, or counteroffers closer to ' + money(n.hi) + '.'];
    return ['neutral', 'Unlikely to get investor offers', 'This is closer to a retail price. Investors probably won’t bid. Listing with an agent may fit better.'];
  }
  function vSell3() {
    var d = draft(); var n = draftNumbers(d);
    if (d.price == null) d.price = n.hi;
    var min = Math.max(10000, r500(n.lo * 0.7)), max = r500(Math.max(n.arv * 0.85, n.hi * 1.3, min + 20000));
    var p = Math.min(max, Math.max(min, d.price));
    var st = priceStatus(p, n);
    var bd = repairBreakdown(d.cond, n.sqft);
    return '<div class="screen">' + topbar({ back: '#/sell/2', title: 'Step 3 of 4', sub: 'Your price' }) + '<div style="background:#fff;padding-bottom:10px;border-bottom:1px solid var(--line)">' + progress(3) + '</div>' +
      '<div class="content">' +
      '<div class="stack"><h1 class="h1">How investors price your home</h1><p class="lead">Check our estimates, fix anything you know better, and see what each type of buyer can pay.</p></div>' +
      '<div class="card" style="gap:16px"><strong>Your home’s numbers</strong>' +
      '<div class="stack"><div class="row"><span class="lbl">After-repair value</span><span class="money" style="font-size:20px;display:flex;gap:6px;align-items:center">' + ICON.lock + money(n.arv) + '</span></div>' +
      '<details><summary>How we got this</summary><p>What your home would likely sell for fully fixed up. Prototype estimate: ' + money(ARV_PER_SF) + ' per sq ft. A real data feed replaces this.</p></details>' +
      '<button type="button" class="btn secondary sm" style="align-self:flex-start" data-act="toggle-arv">Think it’s worth more?</button>' +
      (d.arvOpen ? '<div class="stack" style="background:var(--ground);border-radius:12px;padding:12px"><label class="lbl" for="arvnote" style="font-size:13px">Tell us about upgrades or recent sales we missed</label><textarea class="field" id="arvnote" rows="3" placeholder="New roof in 2022, finished basement…" data-bind="draft.arvNote">' + esc(d.arvNote) + '</textarea><span class="tiny">Our team reviews it and updates the number within 1 business day.</span></div>' : '') +
      '</div><div style="height:1px;background:var(--line-soft)"></div>' +
      '<div class="stack"><div class="row"><label class="lbl" for="rep">Repairs</label>' + moneyField('rep', n.rep, 'draft.repairsOverride', 500, true) + '</div>' +
      '<details><summary>How we got this</summary><div class="detail">' + bd.map(function (l) { return '<div class="row"><span>' + esc(l.label) + '</span><span>' + money(l.cost) + '</span></div>'; }).join('') + '<p>From your condition answers. Have a contractor quote? Enter it above.</p></div></details></div>' +
      '<div style="height:1px;background:var(--line-soft)"></div>' +
      '<div class="stack"><div class="row"><label class="lbl" for="rent">Monthly rent</label>' + moneyField('rent', n.rent, 'draft.rentOverride', 50, true) + '</div>' +
      '<details><summary>How we got this</summary><p>What similar homes rent for after repairs. Already rented? Enter the current rent.</p></details></div></div>' +
      '<div class="card"><div class="row top"><div class="stack" style="gap:2px"><strong>House flippers</strong><span class="small">The 70% rule</span></div><span class="money" style="font-size:22px">up to ' + money(n.flip) + '</span></div>' +
      '<div class="formula"><span>70% × ' + money(n.arv) + ' value</span><span>− ' + money(n.rep) + ' repairs</span><strong>= ' + money(n.flip) + ' max offer</strong></div>' +
      '<details><summary>Why 70%?</summary><p>The other 30% covers the flipper’s selling costs, loan costs, holding time and profit.</p></details></div>' +
      '<div class="card"><div class="row top"><div class="stack" style="gap:2px"><strong>Rental investors</strong><span class="small">The 1% rule</span></div><span class="money" style="font-size:22px">up to ' + money(n.rental) + '</span></div>' +
      '<div class="formula"><span>' + money(n.rent) + ' rent ÷ 1% = ' + money(n.rent * 100) + ' all-in</span><span>− ' + money(n.rep) + ' repairs</span><strong>= ' + money(n.rental) + ' max offer</strong></div>' +
      '<details><summary>Why 1%?</summary><p>Landlords want monthly rent to be at least 1% of their total cost so it covers the mortgage, taxes, insurance and upkeep.</p></details></div>' +
      '<div class="card" style="gap:14px"><div class="row"><label class="lbl" for="price" style="font-size:16px">Your asking price</label><span class="money" style="font-size:24px" id="price-out">' + money(p) + '</span></div>' +
      '<input id="price" type="range" min="' + min + '" max="' + max + '" step="500" value="' + p + '" data-bind="draft.price" data-num="1">' +
      '<div class="row tiny" style="margin-top:-8px"><span>' + kfmt(min) + '</span><span>' + kfmt(max) + '</span></div>' +
      '<div class="notice ' + st[0] + '"><strong>' + st[1] + '</strong><span>' + st[2] + '</span></div>' +
      '<button type="button" class="btn secondary" data-act="use-rec">Use recommended: ' + money(n.hi) + '</button></div>' +
      '<p class="tiny">Estimates to help you decide, not an appraisal. Buyers run their own numbers.</p>' +
      '</div><div class="footer-bar"><button class="btn" data-act="submit-listing">List at ' + money(p) + ' and send to buyers</button></div></div>';
  }
  function submitListing() {
    var d = draft(); var n = draftNumbers(d);
    var parts = d.addr.split(',');
    var nd = {
      id: uid('d'), addr: parts[0].trim(), city: (parts[1] || '').trim(), zip: (parts[2] || '').trim(), county: d.county,
      beds: num(d.beds), baths: num(d.baths), sqft: n.sqft, year: num(d.year) || '', occ: d.occ, when: d.when, owe: num(d.owe),
      cond: d.cond, arv: n.arv, repairs: n.rep, rent: n.rent, ask: d.price || n.hi, stage: 'live', created: Date.now(), owner: 'Unassigned',
      offers: [], notes: [], photos: d.photos,
      arvReview: d.arvNote.trim() ? { note: d.arvNote.trim(), status: 'pending' } : null
    };
    S.deals.unshift(nd); S.myDealId = nd.id; S.draft = null; save();
    go('#/seller/' + nd.id); toast('Listed! Verified buyers can now see your home.');
  }

  /* ---------- SELLER: offers ---------- */
  function vSellerOffers(id) {
    var d = deal(id); if (!d) return vMissing();
    UI.sort = UI.sort || 'net';
    var offers = (d.offers || []).slice().sort(function (a, b) {
      return UI.sort === 'net' ? sellerNet(d, b) - sellerNet(d, a) : num(a.close) - num(b.close);
    });
    var body;
    if (d.accepted) {
      var acc = offerOf(d, d.accepted);
      body = '<div class="notice good"><strong>You accepted ' + esc(acc.buyer) + '’s offer</strong><span>' + money(acc.price) + ' · closing in ' + esc(acc.close) + '. Follow the steps on your timeline.</span></div><a class="btn" href="#/seller/' + id + '/timeline">Open timeline</a>';
    } else if (!offers.length) {
      body = '<div class="card" style="text-align:center;align-items:center;padding:28px 18px"><strong style="font-size:18px">Waiting for offers</strong><p class="small">Verified buyers can see your home now. Offers usually start coming in within a day or two.</p>' +
        '<button class="btn secondary" data-act="simulate" data-id="' + id + '">Simulate buyer offers (demo)</button><span class="tiny">Or open the buyer side on this phone and make one yourself.</span></div>';
    } else {
      body = offers.map(function (o, i) {
        var badge = i === 0 ? '<span class="pill good">' + (UI.sort === 'net' ? 'Highest take-home' : 'Fastest close') + '</span>' : '';
        var st = o.status === 'countered' ? '<span class="pill warn">You countered ' + money(o.counter) + '</span>' : '';
        return '<a class="card card-link' + (i === 0 ? ' hl' : '') + '" href="#/seller/' + id + '/o/' + o.id + '">' +
          '<div class="row top"><div class="stack" style="gap:2px"><strong>' + esc(o.buyer) + '</strong><span class="small">' + esc(o.type) + ' · closes in ' + esc(o.close) + '</span></div>' + badge + '</div>' +
          '<div class="grid2"><div class="stack" style="gap:0"><span class="tiny">Offer</span><span class="money" style="font-size:22px">' + money(o.price) + '</span></div><div class="stack" style="gap:0"><span class="tiny">You take home (est.)</span><span class="money good" style="font-size:22px">' + money(sellerNet(d, o)) + '</span></div></div>' +
          '<div class="pills"><span class="pill ' + (o.tag === 'House offer' ? 'info' : 'good') + '">' + esc(o.tag) + '</span><span class="pill neutral">' + esc(o.dd) + ' due diligence</span><span class="pill neutral">' + esc(o.cc) + ' closing costs</span>' + st + '</div></a>';
      }).join('') + '<p class="tiny">"Take home" subtracts what you owe and estimated closing costs.</p>';
    }
    return '<div class="screen">' +
      '<div class="topbar"><span style="width:8px"></span><div class="titles"><span class="sub">' + esc(d.addr) + '</span><span class="title" style="font-size:24px;font-family:Space Grotesk">' + (d.accepted ? 'Under contract' : (d.offers.length + ' offer' + (d.offers.length === 1 ? '' : 's'))) + '</span></div><a class="icon-btn" href="#/" aria-label="Home">' + ICON.home + '</a></div>' +
      '<div class="content">' +
      (offers.length > 1 && !d.accepted ? '<div class="toggle" role="group" aria-label="Sort offers"><button class="' + (UI.sort === 'net' ? 'on' : '') + '" data-act="sort" data-val="net">Highest take-home</button><button class="' + (UI.sort === 'fast' ? 'on' : '') + '" data-act="sort" data-val="fast">Fastest close</button></div>' : '') +
      '<div class="row"><span class="small">Listed at ' + money(d.ask) + '</span>' + (d.arvReview && d.arvReview.status === 'pending' ? '<span class="pill warn">Value review pending</span>' : '') + '</div>' +
      body + '</div>' + sellerTabs(id, 'offers') + '</div>';
  }
  function simulateOffers(id) {
    var d = deal(id); var base = flipMax(d.arv, d.repairs) || d.ask;
    var mk = function (buyer, tag, type, pct, emd, dd, close, cc) { return { id: uid('o'), buyer: buyer, tag: tag, type: type, price: r500(base * pct), emd: emd, dd: dd, close: close, cc: cc, status: 'open' }; };
    d.offers = d.offers.concat([
      mk('Example Holdings LLC', 'POF verified', 'Cash', 1.0, 5000, '7 days', '14 days', 'Buyer pays'),
      mk('Sample Capital Group', 'POF verified', 'Cash', 0.975, 5000, '10 days', '21 days', 'Split'),
      mk('Atmore Properties LLC', 'House offer', 'Cash', 0.955, 10000, 'None', '10 days', 'Buyer pays')
    ]);
    d.stage = 'offers'; save(); render(); toast('3 demo offers added.');
  }
  function vSellerOffer(id, oid) {
    var d = deal(id); var o = d && offerOf(d, oid); if (!o) return vMissing();
    var net = sellerNet(d, o);
    var terms = [
      ['Earnest money', money(o.emd), 'A deposit the buyer puts down with the closing attorney. If they back out after due diligence, you keep it.'],
      ['Due diligence', o.dd, 'The buyer’s window to inspect. They can walk away during this time for any reason.'],
      ['Closing', 'In ' + o.close, 'The day you sign, get paid and hand over keys. You can ask to move it.'],
      ['Condition', 'As-is', 'No repair requests. You still must disclose what you know about the home.']
    ];
    var counterOpen = UI.counter === oid;
    return '<div class="screen">' + topbar({ back: '#/seller/' + id, title: o.buyer, sub: o.type + ' offer · ' + o.tag }) +
      '<div class="content">' +
      '<div class="card" style="gap:4px"><span class="small">You take home (estimate)</span><span class="big-num good">' + money(net) + '</span></div>' +
      '<div class="card lines" style="padding:4px 16px;gap:0">' +
      '<div><span>Offer price</span><strong>' + money(o.price) + '</strong></div>' +
      '<div><span>Mortgage payoff</span><span>−' + money(d.owe).replace('$', '$') + '</span></div>' +
      '<div><span>Taxes & attorney (est.)</span><span>−' + money(CLOSING_EST) + '</span></div>' +
      '<div><span>Your closing costs</span><span>' + (CC_SELLER[o.cc] ? '−' + money(CC_SELLER[o.cc]) : '<span class="good">Paid by buyer</span>') + '</span></div></div>' +
      '<div class="stack" style="gap:8px"><strong>The terms, in plain English</strong>' + terms.map(function (t) {
        return '<details class="card" style="gap:0;padding:14px"><summary style="display:flex;justify-content:space-between;color:var(--ink);font-size:15px;font-weight:500"><span>' + t[0] + '</span><strong>' + esc(t[1]) + '</strong></summary><p style="font-size:14px">' + t[2] + '</p></details>';
      }).join('') + '</div>' +
      (o.tag === 'House offer' ? '<div class="notice neutral"><span>This offer is from Atmore Properties, the company that runs Porchlight. It’s shown next to every other offer so you can compare.</span></div>' : '') +
      (counterOpen ? '<div class="card"><label class="lbl" for="ctr">Your counteroffer</label>' + moneyField('ctr', UI.counterPrice || o.price + 5000, 'ui.counterPrice') + '<button class="btn dark" data-act="send-counter" data-id="' + id + '" data-oid="' + oid + '">Send counteroffer</button></div>' : '') +
      '</div><div class="footer-bar">' +
      (d.accepted ? '<a class="btn" href="#/seller/' + id + '/timeline">Open timeline</a>' :
        '<button class="btn" data-act="accept" data-id="' + id + '" data-oid="' + oid + '">Accept this offer</button>' +
        '<div class="grid2"><button class="btn secondary" data-act="counter" data-oid="' + oid + '">Counter</button><button class="btn secondary" data-act="soon">Ask a question</button></div>') +
      '</div></div>';
  }

  /* ---------- SELLER: timeline ---------- */
  function vTimeline(id) {
    var d = deal(id); if (!d) return vMissing();
    if (!d.accepted) {
      return '<div class="screen">' + topbar({ back: '#/seller/' + id, title: 'Timeline', sub: d.addr }) +
        '<div class="content"><div class="card" style="text-align:center;align-items:center;padding:28px 18px"><strong style="font-size:18px">Your timeline starts when you accept an offer</strong><p class="small">Then you’ll see every step to closing, your to-dos and your closing coordinator here.</p><a class="btn secondary" href="#/seller/' + id + '">See offers</a></div></div>' + sellerTabs(id, 'timeline') + '</div>';
    }
    var o = offerOf(d, d.accepted);
    d.todos = d.todos || [false, false, false];
    var steps = [
      ['Offer accepted', 'Today', 'done'],
      ['Contract signed & earnest money in', money(o.emd) + ' held by the closing attorney', 'done'],
      ['Buyer due diligence', o.dd === 'None' ? 'Waived — no inspection window' : o.dd + ' inspection window', o.dd === 'None' ? 'done' : 'now'],
      ['Title search & payoff', 'Closing attorney orders your loan payoff', o.dd === 'None' ? 'now' : 'next'],
      ['Closing day', 'In ' + o.close + ' · sign, get paid, hand over keys', 'next']
    ];
    var todos = ['Sign seller disclosure', 'Upload a recent mortgage statement', 'Choose how to get paid (wire or check)'];
    var done = d.todos.filter(Boolean).length;
    return '<div class="screen">' + topbar({ back: '#/seller/' + id, title: 'Under contract', sub: d.addr + ' · ' + o.buyer }) +
      '<div class="content">' +
      '<div class="card" style="gap:4px"><span class="small">Closing in ' + esc(o.close) + ' · you take home (est.)</span><span class="big-num good">' + money(sellerNet(d, o)) + '</span></div>' +
      '<div class="card steps" style="gap:0">' + steps.map(function (s, i) {
        return '<div class="step"><div class="rail"><span class="dot ' + s[2] + '">' + (s[2] === 'done' ? '✓' : (i + 1)) + '</span>' + (i < steps.length - 1 ? '<span class="line"></span>' : '') + '</div><div class="body"><span style="font-weight:' + (s[2] === 'now' ? 700 : s[2] === 'done' ? 600 : 500) + ';color:' + (s[2] === 'next' ? 'var(--muted)' : 'var(--ink)') + '">' + s[0] + '</span><span class="small">' + esc(s[1]) + '</span></div></div>';
      }).join('') + '</div>' +
      '<div class="stack" style="gap:8px"><div class="row"><strong>Your to-dos</strong><span class="small">' + done + ' of 3 done</span></div>' + todos.map(function (t, i) {
        return '<label class="check-row' + (d.todos[i] ? ' done' : '') + '"><input type="checkbox" data-act-change="todo" data-id="' + id + '" data-i="' + i + '"' + (d.todos[i] ? ' checked' : '') + '><span class="t">' + t + '</span></label>';
      }).join('') + '</div>' +
      '<div class="card"><div class="row"><div class="stack" style="gap:2px"><strong>[COORDINATOR NAME]</strong><span class="small">Your closing coordinator</span></div><button class="btn secondary sm" data-act="soon">Message</button></div></div>' +
      '</div>' + sellerTabs(id, 'timeline') + '</div>';
  }

  /* ---------- BUYER ---------- */
  function buyerName() { return S.buyer.entity.trim() || 'Test Buyer LLC'; }
  function pofTag() { return S.buyer.pof === 'verified' ? 'POF verified' : 'POF in review'; }
  function vVerify() {
    var b = S.buyer;
    var ok = b.entity.trim().length > 1;
    var pofLabel = { none: ['warn', 'Needed'], review: ['info', 'In review'], verified: ['good', 'Verified'] }[b.pof];
    return '<div class="screen">' +
      '<div class="hero" style="padding-bottom:20px"><div class="row"><div class="brand" style="font-size:17px">' + ICON.logo + 'Porchlight <span style="font-weight:500;color:#B9BDC4">for Investors</span></div><a class="icon-btn" href="#/" aria-label="Home" style="color:#fff">' + ICON.home + '</a></div>' +
      '<h1 class="h1" style="font-size:26px">Get verified to see deals and make offers</h1><p class="lead" style="font-size:14px">Sellers only see offers from verified buyers.</p></div>' +
      '<div class="content">' +
      '<div class="stack"><label class="lbl" for="entity">Buying entity</label><input class="field" id="entity" placeholder="Your LLC or name" value="' + esc(b.entity) + '" data-bind="buyer.entity"></div>' +
      '<div class="stack" style="gap:10px"><span class="lbl">How you invest</span>' + chips('buyer.strats', ['Fix & flip', 'Rentals', 'Wholesale'], b.strats, true) + '</div>' +
      '<div class="stack" style="gap:10px"><span class="lbl">Counties you buy in <span class="small" style="font-weight:400">(none = all)</span></span>' + chips('buyer.counties', ['Mecklenburg', 'Gaston', 'Cabarrus', 'Iredell', 'Union', 'Rowan', 'York, SC'], b.counties, true) + '</div>' +
      '<div class="stack"><label class="lbl" for="maxp">Max price</label>' + moneyField('maxp', b.maxPrice, 'buyer.maxPrice') + '</div>' +
      '<div class="card"><div class="row"><strong>Proof of funds</strong><span class="pill ' + pofLabel[0] + '">' + pofLabel[1] + '</span></div>' +
      '<p class="small">Upload a recent bank statement or lender letter. Prototype: the file is not uploaded; the team marks you verified in the Team view.</p>' +
      '<label class="btn secondary" for="pof" style="cursor:pointer;border-style:dashed">' + (b.pof === 'none' ? 'Upload statement or letter' : 'Replace file') + '</label><input class="sr" id="pof" type="file" accept="image/*,application/pdf" data-act-change="pof"></div>' +
      '</div><div class="footer-bar"><button class="btn" data-act="goto" data-to="#/buy/deals"' + (ok ? '' : ' disabled') + '>See matching deals</button></div>' + buyerTabs('account') + '</div>';
  }
  function dealFits(d) {
    var fm = flipMax(d.arv, d.repairs); var ratio = d.rent / (d.ask + d.repairs) * 100;
    return { flipOk: d.ask <= fm, rentOk: ratio >= 1, fm: fm, ratio: ratio };
  }
  function vDeals() {
    if (!S.buyer.entity.trim()) { location.replace('#/buy/verify'); return ''; }
    UI.filter = UI.filter || 'all';
    var b = S.buyer;
    var list = S.deals.filter(function (d) {
      if (d.stage !== 'live' && d.stage !== 'offers') return false;
      if (b.counties.length && b.counties.indexOf(d.county) === -1) return false;
      if (b.maxPrice && d.ask > b.maxPrice) return false;
      var f = dealFits(d);
      if (UI.filter === 'flip' && !f.flipOk) return false;
      if (UI.filter === 'rent' && !f.rentOk) return false;
      return true;
    });
    var cards = list.map(function (d) {
      var f = dealFits(d); var mine = d.offers.some(function (o) { return o.mine; });
      return '<a class="card card-link" style="padding:0;overflow:hidden;gap:0" href="#/buy/d/' + d.id + '">' +
        '<div style="height:110px;background:#D9D6CC;display:flex;align-items:flex-end;justify-content:space-between;padding:10px 12px"><span class="pill" style="background:#fff">' + (Date.now() - d.created < 864e5 ? 'New' : 'Listed ' + Math.round((Date.now() - d.created) / 864e5) + 'd ago') + '</span>' + (mine ? '<span class="pill dark">You offered</span>' : '<span class="pill dark">' + d.offers.length + ' offers</span>') + '</div>' +
        '<div style="padding:14px;display:flex;flex-direction:column;gap:10px"><div class="row top"><div class="stack" style="gap:2px"><strong>' + esc(d.addr) + '</strong><span class="small">' + esc(d.city) + ' · ' + d.beds + ' bd · ' + d.baths + ' ba · ' + (d.sqft || 0).toLocaleString() + ' sf</span></div><span class="money" style="font-size:20px">' + money(d.ask) + '</span></div>' +
        '<div class="grid3"><div class="stat"><span class="k">ARV</span><span class="v" style="font-size:14px">' + kfmt(d.arv) + '</span></div><div class="stat"><span class="k">Repairs</span><span class="v" style="font-size:14px">' + kfmt(d.repairs) + '</span></div><div class="stat"><span class="k">Rent</span><span class="v" style="font-size:14px">' + money(d.rent) + '</span></div></div>' +
        '<div class="pills"><span class="pill ' + (f.flipOk ? 'good' : 'neutral') + '">' + (f.flipOk ? '✓ Meets 70% rule' : '70% rule: ' + kfmt(f.fm) + ' max') + '</span><span class="pill ' + (f.rentOk ? 'good' : 'neutral') + '">' + (f.rentOk ? '✓ ' : '') + 'Rent ratio ' + f.ratio.toFixed(2) + '%</span></div></div></a>';
    }).join('');
    return '<div class="screen">' +
      '<div class="topbar" style="flex-direction:column;align-items:stretch;gap:12px;padding:16px 20px 14px"><div class="stack" style="gap:2px"><span class="h1" style="font-size:26px">New deals</span><span class="small">' + esc(buyerName()) + ' · ' + (S.buyer.pof === 'verified' ? 'Verified ✓' : 'Proof of funds ' + (S.buyer.pof === 'review' ? 'in review' : 'needed')) + '</span></div>' +
      '<div class="chips" role="group" aria-label="Filter">' + [['all', 'All'], ['flip', 'Flip fits'], ['rent', 'Rental fits']].map(function (x) { return '<button class="chip dark' + (UI.filter === x[0] ? ' on' : '') + '" style="min-height:40px" data-act="filter" data-val="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="content">' + (cards || '<p class="empty">No deals match right now. Try another filter or widen your counties.</p>') + '<p class="tiny">Seller estimates shown. Run your own numbers before offering.</p></div>' + buyerTabs('deals') + '</div>';
  }
  function vBuyerDeal(id) {
    var d = deal(id); if (!d) return vMissing();
    UI.mode = UI.mode || 'flip';
    if (UI.myPriceFor !== id) { UI.myPriceFor = id; UI.myPrice = d.ask; }
    var price = UI.myPrice; var allIn = price + d.repairs; var costs = Math.round(d.arv * FLIP_COSTS_PCT);
    var profit = d.arv - allIn - costs; var roi = allIn ? profit / allIn * 100 : 0; var ratio = allIn ? d.rent / allIn * 100 : 0;
    var calc = UI.mode === 'flip'
      ? '<div class="stack" style="font-size:14px"><div class="row"><span class="small">Sell price (ARV)</span><span>' + money(d.arv) + '</span></div><div class="row"><span class="small">− Purchase + repairs</span><span>' + money(allIn) + '</span></div><div class="row"><span class="small">− Selling, loan & holding (10%)</span><span>' + money(costs) + '</span></div><div class="row" style="border-top:1px solid var(--line-soft);padding-top:8px;font-weight:700"><span>Est. profit</span><span style="color:' + (profit > 0 ? 'var(--accent-ink)' : '#9A2A1A') + '">' + money(profit) + '</span></div><span class="tiny">Return on cash in: ' + roi.toFixed(1) + '%. Your own costs may differ.</span></div>'
      : '<div class="stack" style="font-size:14px"><div class="row"><span class="small">All-in (price + repairs)</span><span>' + money(allIn) + '</span></div><div class="row"><span class="small">Rent needed for 1%</span><span>' + money(allIn / 100) + '/mo</span></div><div class="row" style="border-top:1px solid var(--line-soft);padding-top:8px;font-weight:700"><span>Rent ratio at ' + money(d.rent) + '</span><span style="color:' + (ratio >= 1 ? 'var(--accent-ink)' : 'var(--warn-ink)') + '">' + ratio.toFixed(2) + '%</span></div><span class="tiny">' + (ratio >= 1 ? 'Meets the 1% rule at this price.' : 'Below 1%. To hit it, pay about ' + money(rentalMax(d.rent, d.repairs)) + ' or less.') + '</span></div>';
    return '<div class="screen">' + topbar({ back: '#/buy/deals', title: d.addr, sub: d.city + ' ' + d.zip + ' · ' + d.offers.length + ' offers so far' }) +
      '<div style="display:grid;grid-template-columns:2fr 1fr;grid-template-rows:84px 84px;gap:4px"><div style="grid-row:span 2;background:#D9D6CC;display:flex;align-items:flex-end;padding:10px;font-size:12px;font-weight:600">Front' + (d.photos ? ' · ' + d.photos + ' photos' : '') + '</div><div style="background:#CFCBC0;display:flex;align-items:flex-end;padding:8px;font-size:12px;font-weight:600">Kitchen</div><button class="btn dark" style="border-radius:0;min-height:0;font-size:13px" data-act="soon">▶ Walkthrough</button></div>' +
      '<div class="content">' +
      '<div class="grid2"><div class="stat" style="background:#fff;border:1px solid var(--line)"><span class="k">Seller asking</span><span class="v">' + money(d.ask) + '</span></div><div class="stat" style="background:#fff;border:1px solid var(--line)"><span class="k">ARV (est.)</span><span class="v">' + money(d.arv) + '</span></div><div class="stat" style="background:#fff;border:1px solid var(--line)"><span class="k">Repairs (est.)</span><span class="v">' + money(d.repairs) + '</span></div><div class="stat" style="background:#fff;border:1px solid var(--line)"><span class="k">Rent (est.)</span><span class="v">' + money(d.rent) + '/mo</span></div></div>' +
      '<div class="card"><strong>Seller’s condition answers</strong>' + condPills(d.cond) + '<span class="small">' + esc(d.occ === 'Me' ? 'Owner-occupied' : d.occ === 'A tenant' ? 'Tenant-occupied' : 'Vacant') + ' · wants to sell ' + esc(d.when.toLowerCase()) + (d.year ? ' · built ' + d.year : '') + '</span></div>' +
      '<div class="card"><div class="row"><strong>Your numbers</strong><div class="toggle" role="group" aria-label="Strategy" style="padding:3px"><button class="' + (UI.mode === 'flip' ? 'on' : '') + '" data-act="mode" data-val="flip" style="min-height:36px">Flip</button><button class="' + (UI.mode === 'rent' ? 'on' : '') + '" data-act="mode" data-val="rent" style="min-height:36px">Rental</button></div></div>' +
      '<div class="row"><label class="lbl" for="myprice">If I pay</label>' + moneyField('myprice', price, 'ui.myPrice', 500, true) + '</div><div id="calc">' + calc + '</div></div>' +
      '</div><div class="footer-bar"><a class="btn" href="#/buy/d/' + id + '/offer">Make an offer</a></div></div>';
  }
  function vBuyerOffer(id) {
    var d = deal(id); if (!d) return vMissing();
    if (UI.offerFor !== id) { UI.offerFor = id; UI.of = { price: r500(Math.min(d.ask, UI.myPrice || d.ask)), emd: 5000, dd: '7 days', close: '14 days', cc: 'Buyer pays' }; }
    var f = UI.of; var net = sellerNet(d, f);
    var canOffer = S.buyer.pof !== 'none';
    return '<div class="screen">' + topbar({ back: '#/buy/d/' + id, title: 'Offer on ' + d.addr, sub: 'Asking ' + money(d.ask) }) +
      '<div class="content">' +
      '<div class="stack"><label class="lbl" for="op">Offer price</label>' + moneyField('op', f.price, 'ui.of.price') + '</div>' +
      '<div class="stack"><label class="lbl" for="emd">Earnest money</label>' + moneyField('emd', f.emd, 'ui.of.emd') + '</div>' +
      '<div class="stack" style="gap:10px"><span class="lbl">Due diligence period</span>' + seg('ui.of.dd', ['None', '7 days', '10 days', '14 days'], f.dd, 4, true) + '</div>' +
      '<div class="stack" style="gap:10px"><span class="lbl">Close in</span>' + seg('ui.of.close', ['7 days', '14 days', '21 days', '30 days'], f.close, 4, true) + '</div>' +
      '<div class="stack" style="gap:10px"><span class="lbl">Closing costs</span>' + seg('ui.of.cc', ['Buyer pays', 'Split', 'Seller pays'], f.cc, 3, true) + '</div>' +
      '<div class="notice good"><span style="font-size:13px">The seller will see this as their take-home</span><span class="money" style="font-size:26px" id="net-out">' + money(net) + '</span><span class="tiny" style="color:inherit">Offers are ranked by take-home, then speed.</span></div>' +
      (canOffer ? '' : '<div class="notice warn"><strong>Upload proof of funds first</strong><span>Sellers only see offers from buyers with proof of funds. <a href="#/buy/verify">Upload it here.</a></span></div>') +
      '</div><div class="footer-bar"><button class="btn" data-act="send-offer" data-id="' + id + '"' + (canOffer && f.price > 0 ? '' : ' disabled') + '>Send ' + money(f.price) + ' offer</button></div></div>';
  }
  function vOfferSent(id) {
    var d = deal(id); if (!d) return vMissing();
    var o = d.offers.filter(function (x) { return x.mine; }).slice(-1)[0];
    return '<div class="screen">' + topbar({ back: '#/buy/deals', title: 'Offer sent', sub: d.addr }) +
      '<div class="content" style="align-items:center;text-align:center;padding-top:48px"><span style="width:64px;height:64px;border-radius:50%;background:var(--accent-soft);color:var(--accent-ink);display:flex;align-items:center;justify-content:center">' + ICON.check + '</span>' +
      '<h1 class="h1">Offer sent</h1><p class="lead">Your ' + money(o.price) + ' offer (' + esc(o.dd) + ' due diligence, closing in ' + esc(o.close) + ') is with the seller. We’ll let you know if they accept or counter.</p>' +
      '<div class="notice neutral" style="text-align:left"><span>Testing on one phone? Open the seller side to see your offer arrive' + (S.myDealId === id ? '.' : ', or check it in the Team view.') + '</span></div>' +
      (S.myDealId === id ? '<a class="btn" href="#/seller/' + id + '">Switch to seller view</a>' : '<a class="btn" href="#/team/d/' + id + '">See it in Team view</a>') +
      '<a class="btn secondary" href="#/buy/deals">Back to deals</a></div></div>';
  }
  function vMyOffers() {
    var rows = [];
    S.deals.forEach(function (d) { d.offers.forEach(function (o) { if (o.mine) rows.push({ d: d, o: o }); }); });
    var stat = function (r) {
      if (r.d.accepted === r.o.id) return ['good', 'Accepted'];
      if (r.d.accepted) return ['neutral', 'Seller chose another offer'];
      if (r.o.status === 'countered') return ['warn', 'Countered at ' + money(r.o.counter)];
      return ['info', 'Waiting on seller'];
    };
    return '<div class="screen">' + topbar({ title: 'My offers', sub: buyerName() }) + '<div class="content">' +
      (rows.length ? rows.map(function (r) { var s = stat(r); return '<a class="card card-link" href="#/buy/d/' + r.d.id + '"><div class="row top"><div class="stack" style="gap:2px"><strong>' + esc(r.d.addr) + '</strong><span class="small">' + esc(r.d.city) + '</span></div><span class="money" style="font-size:20px">' + money(r.o.price) + '</span></div><span class="pill ' + s[0] + '" style="align-self:flex-start">' + s[1] + '</span></a>'; }).join('') : '<p class="empty">No offers yet. Find a deal and make one.</p>') +
      '</div>' + buyerTabs('offers') + '</div>';
  }

  /* ---------- TEAM ---------- */
  var STAGES = [['new', 'New sellers'], ['review', 'Pricing review'], ['live', 'Live with buyers'], ['offers', 'Offers in'], ['contract', 'Under contract']];
  function stageOf(d) { if (d.accepted) return 'contract'; if (d.arvReview && d.arvReview.status === 'pending') return 'review'; return d.stage === 'contract' ? 'contract' : d.stage; }
  function adminShell(inner, on) {
    return '<div class="screen wide">' +
      '<div class="topbar dark" style="padding:12px 20px"><div class="brand" style="font-size:18px;flex:1">' + ICON.logo + 'Porchlight <span style="color:#B9BDC4;font-weight:500">Team</span></div><a class="icon-btn" href="#/" aria-label="Home" style="color:#fff">' + ICON.home + '</a></div>' +
      '<div class="admin-wrap"><nav class="admin-nav" aria-label="Team"><a href="#/team" class="' + (on === 'pipe' ? 'on' : '') + '">Pipeline</a><a href="#" data-act="soon">Sellers</a><a href="#" data-act="soon">Buyers</a><a href="#" data-act="soon">Closings</a><a href="#" data-act="soon">Pricing rules</a></nav>' +
      '<main class="admin-main">' + inner + '</main></div></div>';
  }
  function vTeam() {
    UI.owner = UI.owner || 'all';
    var list = S.deals.filter(function (d) { return UI.owner === 'all' || d.owner === 'Ed'; });
    var count = function (s) { return list.filter(function (d) { return stageOf(d) === s; }).length; };
    var attn = [];
    S.deals.forEach(function (d) {
      if (d.arvReview && d.arvReview.status === 'pending') attn.push(['warn', 'Value review', '<strong>' + esc(d.addr) + '</strong> — seller says it’s worth more: “' + esc(d.arvReview.note.slice(0, 70)) + (d.arvReview.note.length > 70 ? '…' : '') + '”', '<a class="btn secondary sm" href="#/team/d/' + d.id + '">Review</a>']);
      if (d.stage === 'new') attn.push(['neutral', 'New seller', '<strong>' + esc(d.addr) + '</strong> — needs condition answers and photos', '<a class="btn secondary sm" href="#/team/d/' + d.id + '">Open</a>']);
    });
    if (S.buyer.pof === 'review') attn.unshift(['info', 'Proof of funds', '<strong>' + esc(buyerName()) + '</strong> uploaded proof of funds to verify', '<button class="btn sm" data-act="verify-buyer">Mark verified</button>']);
    var cols = STAGES.map(function (s) {
      var cards = list.filter(function (d) { return stageOf(d) === s[0]; });
      return '<div class="col"><div class="row"><strong style="font-size:14px">' + s[1] + '</strong><span class="pill" style="background:#fff">' + cards.length + '</span></div>' +
        cards.map(function (d) {
          var top = d.offers.length ? Math.max.apply(null, d.offers.map(function (o) { return o.price; })) : 0;
          var sub = s[0] === 'offers' ? d.offers.length + ' offers' : s[0] === 'review' ? 'Value review requested' : s[0] === 'contract' ? 'Accepted ' + money((offerOf(d, d.accepted) || {}).price) : d.county;
          return '<a class="mini" href="#/team/d/' + d.id + '"><strong style="font-size:14px">' + esc(d.addr) + '</strong><span class="tiny">' + esc(sub) + '</span><div class="row"><strong style="font-size:14px">' + (top ? 'Top ' + money(top) : d.ask ? money(d.ask) : '—') + '</strong><span class="tiny">' + esc(d.owner) + '</span></div></a>';
        }).join('') + '</div>';
    }).join('');
    return adminShell(
      '<div class="row" style="flex-wrap:wrap"><div class="stack" style="gap:2px"><h1 class="h1" style="font-size:30px">Pipeline</h1><span class="small">Test data on this device</span></div><div class="toggle" role="group" aria-label="Owner"><button class="' + (UI.owner === 'all' ? 'on' : '') + '" data-act="owner" data-val="all">All deals</button><button class="' + (UI.owner === 'mine' ? 'on' : '') + '" data-act="owner" data-val="mine">My deals</button></div></div>' +
      '<div class="kpis">' + [['New sellers', count('new')], ['Pricing reviews', count('review')], ['Live with buyers', count('live')], ['Offers in', count('offers')], ['Under contract', count('contract')]].map(function (k) { return '<div class="card" style="gap:2px"><span class="small">' + k[0] + '</span><span class="big-num" style="font-size:28px">' + k[1] + '</span></div>'; }).join('') + '</div>' +
      '<section class="card" aria-labelledby="att"><h2 id="att" style="font-size:18px">Needs attention</h2><div>' + (attn.length ? attn.map(function (a) { return '<div class="attn"><span class="pill ' + a[0] + '">' + a[1] + '</span><span class="t">' + a[2] + '</span>' + a[3] + '</div>'; }).join('') : '<p class="small">All caught up.</p>') + '</div></section>' +
      '<section class="stack" style="gap:12px"><h2 style="font-size:18px">Deals by stage</h2><div class="board-scroll"><div class="board">' + cols + '</div></div></section>', 'pipe');
  }
  function vTeamDeal(id) {
    var d = deal(id); if (!d) return vMissing();
    if (UI.reviewFor !== id) {
      UI.reviewFor = id; UI.arv = d.arv; UI.removed = {};
      UI.rec = d.recommended || (d.offers[0] && d.offers.slice().sort(function (a, b) { return sellerNet(d, b) - sellerNet(d, a); })[0].id);
    }
    var bd = repairBreakdown(d.cond, d.sqft);
    var baseRep = d.repairs;
    var removed = Object.keys(UI.removed).reduce(function (a, k) { return a + (UI.removed[k] || 0); }, 0);
    var rep = Math.max(0, baseRep - removed);
    var rv = d.arvReview;
    var review = rv ? '<section class="card ' + (rv.status === 'pending' ? 'warn' : '') + '" aria-labelledby="rvh"><div class="row" style="flex-wrap:wrap"><h2 id="rvh" style="font-size:18px">Seller asked for a value review</h2><span class="pill ' + (rv.status === 'pending' ? 'warn' : rv.status === 'approved' ? 'good' : 'neutral') + '">' + { pending: 'Waiting on review', approved: 'Updated · seller notified', kept: 'Kept original · seller notified' }[rv.status] + '</span></div>' +
      '<blockquote style="margin:0;padding:12px 14px;background:var(--ground);border-radius:10px">“' + esc(rv.note) + '”</blockquote>' +
      (rv.status === 'pending' ? '<div class="stack"><label class="lbl" for="tarv">After-repair value</label>' + moneyField('tarv', UI.arv, 'ui.arv', 1000) + '</div>' +
        '<div class="stack" style="gap:8px"><span class="lbl">Remove from repairs</span>' + bd.filter(function (l) { return l.item !== 'cosmetic'; }).map(function (l) { return '<label class="check-row" style="padding:10px 12px"><input type="checkbox" data-act-change="rm" data-item="' + esc(l.item) + '" data-cost="' + l.cost + '"' + (UI.removed[l.item] ? ' checked' : '') + '><span>' + esc(l.label) + ' — ' + money(l.cost) + '</span></label>'; }).join('') + '</div>' +
        '<div class="grid3" id="rv-stats"><div class="stat"><span class="k">Repairs</span><span class="v">' + money(rep) + '</span></div><div class="stat"><span class="k">70% max</span><span class="v">' + money(flipMax(UI.arv, rep)) + '</span></div><div class="stat"><span class="k">1% max</span><span class="v">' + money(rentalMax(d.rent, rep)) + '</span></div></div>' +
        '<div class="row" style="flex-wrap:wrap;justify-content:flex-start"><button class="btn sm" data-act="rv-approve" data-id="' + id + '">Save and notify seller</button><button class="btn secondary sm" data-act="rv-keep" data-id="' + id + '">Keep original numbers</button></div>' : '') + '</section>' : '';
    var offers = d.offers.slice().sort(function (a, b) { return sellerNet(d, b) - sellerNet(d, a); });
    var table = offers.length ? '<div class="table-wrap"><table><thead><tr><th scope="col">Recommend</th><th scope="col">Buyer</th><th scope="col">Price</th><th scope="col">Terms</th><th scope="col">Seller nets</th></tr></thead><tbody>' + offers.map(function (o) {
      var on = UI.rec === o.id;
      return '<tr class="' + (on ? 'sel' : '') + '"><td><input type="radio" name="rec" aria-label="Recommend ' + esc(o.buyer) + '" data-act-change="rec" data-oid="' + o.id + '"' + (on ? ' checked' : '') + (d.accepted ? ' disabled' : '') + '></td><td><div class="stack" style="gap:3px"><strong>' + esc(o.buyer) + '</strong><span class="pill ' + (o.tag === 'House offer' ? 'info' : o.tag === 'POF verified' ? 'good' : 'warn') + '" style="align-self:flex-start">' + esc(o.tag) + '</span></div></td><td><strong>' + money(o.price) + '</strong>' + (o.status === 'countered' ? '<div class="tiny">Seller countered ' + money(o.counter) + '</div>' : '') + (d.accepted === o.id ? '<div><span class="pill good">Accepted</span></div>' : '') + '</td><td class="small">' + esc(o.type) + ' · ' + esc(o.dd) + ' DD · close ' + esc(o.close) + ' · ' + esc(o.cc.toLowerCase()) + '</td><td><strong class="good">' + money(sellerNet(d, o)) + '</strong></td></tr>';
    }).join('') + '</tbody></table></div>' + (d.accepted ? '' : '<div class="row" style="flex-wrap:wrap;justify-content:flex-start"><button class="btn sm" data-act="recommend" data-id="' + id + '">Send recommendation to seller</button><span class="small">' + (d.recommended ? 'Recommended: ' + esc((offerOf(d, d.recommended) || {}).buyer) : 'Seller still sees all offers.') + '</span></div>') +
      '<button class="btn secondary sm" style="align-self:flex-start" data-act="house-offer" data-id="' + id + '">+ Add Atmore house offer</button>' :
      '<p class="small">No offers yet.</p><button class="btn secondary sm" style="align-self:flex-start" data-act="house-offer" data-id="' + id + '">+ Add Atmore house offer</button>';
    return adminShell(
      '<a href="#/team" style="font-weight:600;font-size:14px;text-decoration:none">← Pipeline</a>' +
      '<div class="row" style="flex-wrap:wrap;align-items:flex-end"><div class="stack"><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><h1 class="h1" style="font-size:30px">' + esc(d.addr) + '</h1><span class="pill good">' + esc((STAGES.filter(function (s) { return s[0] === stageOf(d); })[0] || ['', ''])[1]) + '</span></div><span class="small">' + esc([d.city, d.zip].filter(Boolean).join(' ')) + ' · ' + d.beds + ' bd · ' + d.baths + ' ba · ' + (d.sqft || 0).toLocaleString() + ' sf' + (d.year ? ' · built ' + d.year : '') + ' · ' + esc(d.county) + '</span></div>' +
      '<div class="row"><button class="btn secondary sm" data-act="soon">Message seller</button><button class="btn secondary sm" data-act="soon">Blast to more buyers</button></div></div>' +
      '<div class="two-col"><div>' + review +
      '<section class="card"><h2 style="font-size:18px">Seller & condition</h2><div class="grid2"><div class="stat"><span class="k">Asking</span><span class="v">' + (d.ask ? money(d.ask) : '—') + '</span></div><div class="stat"><span class="k">Owes (stated)</span><span class="v">' + money(d.owe) + '</span></div><div class="stat"><span class="k">ARV / repairs</span><span class="v" style="font-size:15px">' + money(d.arv) + ' / ' + money(d.repairs) + '</span></div><div class="stat"><span class="k">Rent</span><span class="v">' + money(d.rent) + '</span></div></div>' + condPills(d.cond) + '<span class="small">' + esc(d.occ) + ' · wants to sell ' + esc(d.when.toLowerCase()) + '</span></section></div>' +
      '<div><section class="card"><div class="row" style="flex-wrap:wrap"><h2 style="font-size:18px">Offers</h2><span class="small">Pick one to recommend</span></div>' + table + '<p class="tiny">House offers from Atmore are labeled and shown to the seller next to every other offer.</p></section>' +
      '<section class="card"><h2 style="font-size:18px">Team notes</h2>' + (d.notes || []).map(function (n) { return '<div style="font-size:14px;padding:10px 12px;background:var(--ground);border-radius:10px"><strong>' + esc(n.by) + ':</strong> ' + esc(n.text) + '</div>'; }).join('') +
      '<label class="sr" for="note">Add a note</label><textarea class="field" id="note" rows="3" placeholder="Add a note for the team…" data-bind="ui.note">' + esc(UI.note || '') + '</textarea><button class="btn secondary sm" style="align-self:flex-start" data-act="add-note" data-id="' + id + '">Add note</button></section></div></div>', 'pipe');
  }

  function vMissing() { return '<div class="screen">' + topbar({ back: '#/', title: 'Not found' }) + '<div class="content"><p class="empty">That page doesn’t exist anymore. Data may have been reset.</p><a class="btn" href="#/">Go home</a></div></div>'; }

  /* ---------- router ---------- */
  var lastRoute = '';
  function route() {
    var p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!p.length) return vHome();
    if (p[0] === 'sell') return p[1] === '2' ? vSell2() : p[1] === '3' ? vSell3() : vSell1();
    if (p[0] === 'seller') { if (p[2] === 'o') return vSellerOffer(p[1], p[3]); if (p[2] === 'timeline') return vTimeline(p[1]); return vSellerOffers(p[1]); }
    if (p[0] === 'buy') {
      if (!p[1]) { location.replace('#/buy/' + (S.buyer.entity.trim() ? 'deals' : 'verify')); return ''; }
      if (p[1] === 'verify') return vVerify();
      if (p[1] === 'deals') return vDeals();
      if (p[1] === 'offers') return vMyOffers();
      if (p[1] === 'd') { if (p[3] === 'offer') return vBuyerOffer(p[2]); if (p[3] === 'sent') return vOfferSent(p[2]); return vBuyerDeal(p[2]); }
    }
    if (p[0] === 'team') return p[1] === 'd' ? vTeamDeal(p[2]) : vTeam();
    return vMissing();
  }
  function render() {
    var a = document.activeElement; var fid = a && a.id; var ss = null, se = null;
    try { ss = a.selectionStart; se = a.selectionEnd; } catch (e) { /* not a text field */ }
    var html = route(); if (html === '') return;
    app.innerHTML = html;
    if (location.hash !== lastRoute) { window.scrollTo(0, 0); lastRoute = location.hash; return; }
    if (fid) { var el = document.getElementById(fid); if (el) { el.focus({ preventScroll: true }); try { if (ss != null) el.setSelectionRange(ss, se); } catch (e) { /* ignore */ } } }
  }

  /* ---------- binding ---------- */
  function setPath(path, val) {
    var parts = path.split('.'); var root = parts[0] === 'ui' ? UI : parts[0] === 'draft' ? draft() : parts[0] === 'buyer' ? S.buyer : null;
    if (parts[0] === 'cond') { draft().cond[parts.slice(1).join('.')] = val; return; }
    var obj = root; for (var i = 1; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = val;
  }
  function getPath(path) {
    var parts = path.split('.'); var obj = parts[0] === 'ui' ? UI : parts[0] === 'draft' ? draft() : parts[0] === 'buyer' ? S.buyer : null;
    if (parts[0] === 'cond') return draft().cond[parts.slice(1).join('.')];
    for (var i = 1; i < parts.length; i++) obj = obj && obj[parts[i]];
    return obj;
  }

  app.addEventListener('input', function (e) {
    var el = e.target; var b = el.getAttribute('data-bind'); if (!b) return;
    var v = el.value;
    if (el.getAttribute('data-money')) { v = num(v); }
    else if (el.getAttribute('data-num')) { v = el.type === 'range' ? Number(v) : v.replace(/[^0-9.]/g, ''); }
    setPath(b, v); save();
    if (el.getAttribute('data-money')) {
      // reformat with commas but keep caret near the end
      var formatted = v ? v.toLocaleString('en-US') : '';
      if (el.value !== formatted) { el.value = formatted; }
    }
    if (el.tagName === 'TEXTAREA' || (el.type === 'text' && !el.getAttribute('data-money') && !el.getAttribute('data-num'))) {
      // plain text: only re-render screens whose buttons depend on it
      if (b === 'draft.addr' || b === 'buyer.entity') softRender();
      return;
    }
    softRender();
  });
  app.addEventListener('change', function (e) {
    var el = e.target;
    if (el.tagName === 'SELECT' && el.getAttribute('data-bind')) { setPath(el.getAttribute('data-bind'), el.value); save(); return; }
    var act = el.getAttribute('data-act-change'); if (!act) return;
    if (act === 'photos') { draft().photos += el.files ? el.files.length : 0; save(); render(); }
    if (act === 'pof') { if (el.files && el.files.length) { S.buyer.pof = 'review'; save(); render(); toast('Uploaded. The team will verify it.'); } }
    if (act === 'todo') { var d = deal(el.getAttribute('data-id')); d.todos[+el.getAttribute('data-i')] = el.checked; save(); render(); }
    if (act === 'rm') { var it = el.getAttribute('data-item'); UI.removed[it] = el.checked ? +el.getAttribute('data-cost') : 0; render(); }
    if (act === 'rec') { UI.rec = el.getAttribute('data-oid'); render(); }
  });
  var softTimer;
  function softRender() { clearTimeout(softTimer); softTimer = setTimeout(render, 0); }

  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act'); var id = el.getAttribute('data-id'); var d;
    if (act !== 'goto' && el.tagName === 'A') e.preventDefault();
    switch (act) {
      case 'goto': if (!el.disabled) go(el.getAttribute('data-to')); break;
      case 'chip': {
        var name = el.getAttribute('data-name'); var val = el.getAttribute('data-val');
        if (el.getAttribute('data-multi')) { var arr = getPath(name).slice(); var i = arr.indexOf(val); if (i > -1) arr.splice(i, 1); else arr.push(val); setPath(name, arr); }
        else setPath(name, val);
        save(); render(); break;
      }
      case 'soon': toast('Coming in the next version.'); break;
      case 'reset': if (confirmReset()) { localStorage.removeItem(KEY); UI = {}; load(); render(); toast('Demo data reset.'); } break;
      case 'start-over': S.myDealId = null; S.draft = null; save(); go('#/sell/1'); break;
      case 'toggle-arv': draft().arvOpen = !draft().arvOpen; save(); render(); break;
      case 'use-rec': { var n = draftNumbers(draft()); draft().price = n.hi; save(); render(); break; }
      case 'submit-listing': submitListing(); break;
      case 'sort': UI.sort = el.getAttribute('data-val'); render(); break;
      case 'simulate': simulateOffers(id); break;
      case 'counter': UI.counter = UI.counter === el.getAttribute('data-oid') ? null : el.getAttribute('data-oid'); UI.counterPrice = null; render(); break;
      case 'send-counter': {
        d = deal(id); var o = offerOf(d, el.getAttribute('data-oid')); var oo = o.price;
        o.status = 'countered'; o.counter = UI.counterPrice || oo + 5000; UI.counter = null; save(); go('#/seller/' + id); toast('Counteroffer sent to ' + o.buyer + '.'); break;
      }
      case 'accept': {
        d = deal(id); d.accepted = el.getAttribute('data-oid'); d.stage = 'contract'; d.todos = [false, false, false];
        d.offers.forEach(function (x) { x.status = x.id === d.accepted ? 'accepted' : 'declined'; }); save(); go('#/seller/' + id + '/timeline'); toast('Offer accepted. Your timeline is ready.'); break;
      }
      case 'filter': UI.filter = el.getAttribute('data-val'); render(); break;
      case 'mode': UI.mode = el.getAttribute('data-val'); render(); break;
      case 'send-offer': {
        d = deal(id); var f = UI.of;
        d.offers.push({ id: uid('o'), buyer: buyerName(), tag: pofTag(), type: 'Cash', price: f.price, emd: f.emd, dd: f.dd, close: f.close, cc: f.cc, status: 'open', mine: true });
        if (d.stage === 'live') d.stage = 'offers'; UI.offerFor = null; save(); go('#/buy/d/' + id + '/sent'); break;
      }
      case 'owner': UI.owner = el.getAttribute('data-val'); render(); break;
      case 'verify-buyer': S.buyer.pof = 'verified'; S.deals.forEach(function (x) { x.offers.forEach(function (o) { if (o.mine) o.tag = 'POF verified'; }); }); save(); render(); toast('Buyer marked verified.'); break;
      case 'rv-approve': {
        d = deal(id); var removed = Object.keys(UI.removed).reduce(function (a, k) { return a + (UI.removed[k] || 0); }, 0);
        d.arv = UI.arv; d.repairs = Math.max(0, d.repairs - removed);
        Object.keys(UI.removed).forEach(function (k) { if (UI.removed[k] && k !== 'cosmetic') d.cond[k] = 'OK'; });
        d.arvReview.status = 'approved'; UI.reviewFor = null; save(); render(); toast('Numbers updated. Seller notified.'); break;
      }
      case 'rv-keep': d = deal(id); d.arvReview.status = 'kept'; UI.reviewFor = null; save(); render(); toast('Kept original numbers. Seller notified.'); break;
      case 'recommend': d = deal(id); d.recommended = UI.rec; save(); render(); toast('Recommendation sent to seller.'); break;
      case 'house-offer': {
        d = deal(id); var base = flipMax(d.arv, d.repairs) || d.ask;
        d.offers.push({ id: uid('o'), buyer: 'Atmore Properties LLC', tag: 'House offer', type: 'Cash', price: r500(base * 0.955), emd: 10000, dd: 'None', close: '10 days', cc: 'Buyer pays', status: 'open' });
        if (d.stage === 'live') d.stage = 'offers'; save(); render(); toast('House offer added.'); break;
      }
      case 'add-note': d = deal(id); if ((UI.note || '').trim()) { d.notes.push({ by: 'Ed', text: UI.note.trim() }); UI.note = ''; save(); render(); } break;
    }
  });
  function confirmReset() { return window.confirm('Reset all demo data on this phone?'); }

  /* live-updating bits that should not wait (price slider label) */
  window.addEventListener('hashchange', function () { UI.counter = null; render(); });

  load();
  render();
})();
