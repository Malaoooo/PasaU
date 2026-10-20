/* PasaU judge demo: sample people, listings and chats. Made up; nothing here is a real student. */
(function () {
  var now = Date.now();
  var ago = function (h) { return new Date(now - h * 3600e3).toISOString(); };
  var ahead = function (h) { return new Date(now + h * 3600e3).toISOString(); };
  // Tomorrow 2:00 PM Philippine time, so the meetup is always upcoming during a presentation
  var t = new Date(now + 8 * 3600e3); t.setUTCHours(6, 0, 0, 0); if (t.getTime() < now + 3600e3) t = new Date(t.getTime() + 864e5);
  var MEET_AT = t.toISOString();
  var meetLabel = new Date(MEET_AT).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  var ME = '11111111-1111-4111-8111-111111111111';
  var MIGUEL = '22222222-2222-4222-8222-222222222222';
  var BEA = '33333333-3333-4333-8333-333333333333';
  var PAOLO = '44444444-4444-4444-8444-444444444444';
  var KRIS = '55555555-5555-4555-8555-555555555555';
  var MARIA = '66666666-6666-4666-8666-666666666666';
  var SLU = 'Saint Louis University (SLU)', UC = 'University of the Cordilleras (UC)', UB = 'University of Baguio (UB)', UPB = 'University of the Philippines Baguio (UP Baguio)', BSU = 'Benguet State University (BSU)';

  var people = [
    { id: ME, full_name: 'Andrea Santos', display_name: 'Andrea Santos', school: UC, course: 'BS Nursing', year_level: '2nd year', verified: true, vouch_count: 4, avatar_url: null, created_at: ago(24 * 60), show_full_name: true, show_course_year: true, notify_prefs: {}, is_admin: false, suspended: false, email: 'andrea.santos@students.uc-bcf.edu.ph' },
    { id: MIGUEL, full_name: 'Miguel Reyes', display_name: 'Miguel Reyes', school: UC, course: 'BS Civil Engineering', year_level: '3rd year', verified: true, vouch_count: 7, avatar_url: null, created_at: ago(24 * 90) },
    { id: BEA, full_name: 'Bea Flores', display_name: 'Bea Flores', school: UC, course: 'BS Nursing', year_level: '4th year', verified: true, vouch_count: 2, avatar_url: null, created_at: ago(24 * 40) },
    { id: PAOLO, full_name: 'Paolo Cruz', display_name: 'Paolo C.', school: UB, course: 'BS Criminology', year_level: '1st year', verified: false, vouch_count: 0, avatar_url: null, created_at: ago(24 * 10) },
    { id: MARIA, full_name: 'Maria Santos', display_name: 'Maria Santos', role: 'guardian', school: null, course: null, year_level: null, verified: false, vouch_count: 0, avatar_url: null, created_at: ago(24 * 5), email: 'maria.santos@gmail.com' },
    { id: KRIS, full_name: 'Kristine Dulay', display_name: 'Kristine Dulay', school: UPB, course: 'BS Biology', year_level: '2nd year', verified: true, vouch_count: 3, avatar_url: null, created_at: ago(24 * 30) }
  ];

  var lid = 100;
  function L(o) {
    var id = ++lid;
    var l = { id: id, seller_id: MIGUEL, kind: 'sell', status: 'active', views: 12, condition: 'Like new', size: null, retail_php: null, description: null,
      college: null, program: null, course_code: null, year_level: null, reserved_by: null, swap_for: null, created_at: ago(id - 100), bumped_at: ago(id - 100) };
    for (var k in o) l[k] = o[k];
    l.listing_photos = (o.photos || []).map(function (p, i) { return { path: p, position: i }; });
    delete l.photos;
    return l;
  }
  var listings = [
    L({ title: 'Anatomy & Physiology (Marieb, 11th ed.)', category: 'books', price_php: 850, retail_php: 2400, condition: 'Like new', size: '11th edition', pickup_spot: 'Library lobby', school: UC, seller_id: BEA, course_code: 'NCM 101', year_level: '1st year', description: 'Light pencil notes in chapters 1–4 only. No torn pages.', photos: ['books-red.png', 'books-blue.png'], views: 41 }),
    L({ title: 'UC PE Shirt (Medium)', category: 'uniforms', price_php: 200, retail_php: 450, condition: 'Used', size: 'M', pickup_spot: 'Gym lobby', school: UC, seller_id: ME, photos: ['shirt-green.png'], views: 23 }),
    L({ title: 'Casio fx-991ES Plus Calculator', category: 'supplies', price_php: 600, retail_php: 1100, condition: 'Like new', pickup_spot: 'Canteen', school: UC, seller_id: MIGUEL, description: 'Exam-approved. Comes with the hard cover and fresh battery.', photos: ['calc.png'], views: 58 }),
    L({ title: 'Engineering Drawing Set', category: 'lab_art', price_php: 350, condition: 'Used', pickup_spot: 'Guard house', school: UC, seller_id: MIGUEL, photos: ['bag-orange.png'], status: 'reserved', reserved_by: ME }),
    L({ title: 'Criminology Uniform Pants (32)', category: 'uniforms', price_php: 300, condition: 'Like new', size: '32 waist', pickup_spot: 'Student center', school: UB, seller_id: PAOLO, photos: ['pants.png'] }),
    L({ title: 'Nursing Fundamentals Reviewer', category: 'books', price_php: 0, kind: 'free', condition: 'Used', pickup_spot: 'Library lobby', school: UC, seller_id: BEA, photos: ['books-gold.png'] }),
    L({ title: 'Laptop Backpack (15 in)', category: 'supplies', price_php: 0, kind: 'swap', swap_for: 'Scientific calculator', condition: 'Like new', pickup_spot: 'Canteen', school: UPB, seller_id: KRIS, photos: ['bag-teal.png'] }),
    L({ title: 'General Chemistry Lab Gown (S)', category: 'lab_art', price_php: 250, condition: 'New', size: 'S', pickup_spot: 'Library lobby', school: BSU, seller_id: KRIS, photos: ['shirt-white.png'] }),
    L({ title: 'Calculus: Early Transcendentals', category: 'books', price_php: 700, retail_php: 2100, condition: 'Used', pickup_spot: 'Library lobby', school: UPB, seller_id: KRIS, photos: ['books-blue.png'] }),
    L({ title: 'UC Type B Uniform Set', category: 'uniforms', price_php: 550, condition: 'Like new', size: 'S', pickup_spot: 'Guard house', school: UC, seller_id: MIGUEL, photos: ['shirt-navy.png'] })
  ];
  var byTitle = function (s) { return listings.filter(function (l) { return l.title.indexOf(s) === 0; })[0]; };
  var ANAT = byTitle('Anatomy'), SHIRT = byTitle('UC PE'), CALC = byTitle('Casio'), DRAW = byTitle('Engineering'), BAG = byTitle('Laptop'), NURSE = byTitle('Nursing');

  var conversations = [
    { id: 501, listing_id: ANAT.id, buyer_id: ME, seller_id: BEA, created_at: ago(30) },
    { id: 502, listing_id: DRAW.id, buyer_id: ME, seller_id: MIGUEL, created_at: ago(20) },
    { id: 503, listing_id: SHIRT.id, buyer_id: PAOLO, seller_id: ME, created_at: ago(5) }
  ].map(function (c) { c.listings = listings.filter(function (l) { return l.id === c.listing_id; })[0]; return c; });

  var wanted_posts = [
    { id: 901, user_id: ME, title: 'Pharmacology textbook', category: 'books', school: UC, max_price_php: 800, created_at: ago(6) },
    { id: 902, user_id: MIGUEL, title: 'Scientific calculator', category: 'supplies', school: UC, max_price_php: 700, created_at: ago(12) },
    { id: 903, user_id: PAOLO, title: 'Criminology PE shirt, size L', category: 'uniforms', school: UB, max_price_php: 250, created_at: ago(30) },
    { id: 904, user_id: KRIS, title: 'Lab goggles', category: 'lab_art', school: null, max_price_php: 0, created_at: ago(50) }
  ];

  var tables = {
    listings: listings, conversations: conversations, wanted_posts: wanted_posts,
    profiles: people, public_profiles: people,
    meetups: [{ id: 801, listing_id: DRAW.id, buyer_id: ME, seller_id: MIGUEL, spot: 'Guard house', meet_at: MEET_AT, proposed_by: MIGUEL, status: 'accepted', created_at: ago(3) }],
    messages: [
      { id: 1, conversation_id: 501, sender_id: ME, body: 'Hi! Is the Anatomy book still available?', created_at: ago(29.5) },
      { id: 2, conversation_id: 501, sender_id: BEA, body: 'Yes it is! Only a few pencil notes in the first chapters.', created_at: ago(29) },
      { id: 3, conversation_id: 501, sender_id: ME, body: 'Great, can we meet at the library lobby after class?', created_at: ago(28) },
      { id: 4, conversation_id: 502, sender_id: ME, body: 'Hello, I reserved the drawing set. When are you free?', created_at: ago(19) },
      { id: 5, conversation_id: 502, sender_id: MIGUEL, body: 'Tomorrow works. I suggested a time below.', created_at: ago(4) },
      { id: 6, conversation_id: 502, sender_id: MIGUEL, body: 'Meetup proposed: Guard house, ' + meetLabel, meetup_id: 801, created_at: ago(3) },
      { id: 9, conversation_id: 502, sender_id: ME, body: 'Meetup accepted: Guard house, ' + meetLabel, meetup_id: 801, created_at: ago(2.6) },
      { id: 7, conversation_id: 502, sender_id: ME, body: 'Confirmed, see you there!', created_at: ago(2.5) },
      { id: 8, conversation_id: 503, sender_id: PAOLO, body: 'Hi po, does the PE shirt still fit a medium?', created_at: ago(1) }
    ],
    offers: [
      { id: 701, listing_id: SHIRT.id, buyer_id: PAOLO, amount_php: 180, status: 'pending', created_at: ago(2), offered: null },
      { id: 702, listing_id: SHIRT.id, buyer_id: KRIS, amount_php: null, status: 'pending', created_at: ago(1), offered: { id: BAG.id, title: BAG.title } }
    ],
    notifications: [
      { id: 1, user_id: ME, kind: 'chat', body: 'New message from Paolo C. about "UC PE Shirt (Medium)"', listing_id: SHIRT.id, read: false, created_at: ago(1) },
      { id: 2, user_id: ME, kind: 'meetups', body: 'Meetup accepted: Guard house, ' + meetLabel + ' for "Engineering Drawing Set"', listing_id: DRAW.id, read: false, created_at: ago(2.5) },
      { id: 3, user_id: ME, kind: 'listings', body: 'Someone offered ₱180 for "UC PE Shirt (Medium)"', listing_id: SHIRT.id, read: false, created_at: ago(2) },
      { id: 4, user_id: ME, kind: 'listings', body: 'PasaMatch: a listing may fit your Looking For post "Pharmacology textbook"', wanted_id: 901, read: true, created_at: ago(8) },
      { id: 5, user_id: ME, kind: 'listings', body: 'Bea Flores vouched for you', read: true, created_at: ago(48) }
    ],
    transactions: [
      { id: 601, listing_id: DRAW.id, buyer_id: ME, seller_id: MIGUEL, kind: 'sell', price_php: 350, status: 'meetup', created_at: ago(20), updated_at: ago(3), listing: { id: DRAW.id, title: DRAW.title, listing_photos: DRAW.listing_photos } },
      { id: 602, listing_id: 9001, buyer_id: KRIS, seller_id: ME, kind: 'sell', price_php: 400, status: 'completed', created_at: ago(24 * 9), updated_at: ago(24 * 8), listing: { id: 9001, title: 'Medical-Surgical Nursing Handbook', listing_photos: [{ path: 'books-gold.png', position: 0 }] } },
      { id: 603, listing_id: 9002, buyer_id: ME, seller_id: BEA, kind: 'free', price_php: 0, status: 'completed', created_at: ago(24 * 15), updated_at: ago(24 * 14), listing: { id: 9002, title: 'Clinical Duty White Shoes (7)', listing_photos: [{ path: 'shirt-white.png', position: 0 }] } }
    ],
    vouches: [
      { voucher_id: BEA, vouchee_id: ME, note: 'Smooth handover at the library, item exactly as described.', created_at: ago(48) },
      { voucher_id: KRIS, vouchee_id: ME, note: 'On time and friendly. Thanks!', created_at: ago(24 * 8) },
      { voucher_id: MIGUEL, vouchee_id: ME, note: null, created_at: ago(24 * 20) }
    ],
    listing_photos: [],
    saves: [{ user_id: ME, listing_id: CALC.id, created_at: ago(5), listings: CALC }, { user_id: ME, listing_id: BAG.id, created_at: ago(9), listings: BAG }],
    meetup_codes: [{ meetup_id: 801, code: '482913' }],
    queue_entries: [{ listing_id: SHIRT.id, user_id: KRIS, created_at: ago(3) }],
    blocks: [],
    reports: [
      { id: 1, reporter_id: KRIS, reported_user_id: PAOLO, listing_id: null, listings: null, reason: 'No-show at meetup', details: 'Waited 30 minutes at the canteen.', status: 'open', created_at: ago(7) },
      { id: 2, reporter_id: BEA, reported_user_id: MIGUEL, listing_id: DRAW.id, listings: { id: DRAW.id, title: 'Engineering Drawing Set', status: 'reserved' }, reason: 'Wrong price', details: null, status: 'open', created_at: ago(26) }
    ],
    conversation_reads: [],
    verification_requests: [{ id: 1, user_id: ME, status: 'approved', created_at: ago(24 * 50) }, { id: 2, user_id: PAOLO, status: 'pending', school_email: 'paolo.cruz@ubaguio.edu', note: 'Freshman, ID attached at the office', created_at: ago(9) }],
    wanted_pings: [{ wanted_id: 902, user_id: ME, reason: 'You listed a calculator before', created_at: ago(11), wanted_posts: wanted_posts[1] }],
    wanted_replies: [{ wanted_id: 901, listing_id: ANAT.id, created_at: ago(5), listings: ANAT }],
    waitlist: [],
    guardian_alerts: [
      { id: 1, body: 'Andrea has a meetup: Guard house (UC), ' + meetLabel + ', buying "Engineering Drawing Set" from Miguel Reyes.', read: false, created_at: ago(2.5) },
      { id: 2, body: 'Handover done: Andrea sold "Medical-Surgical Nursing Handbook" at UC Library lobby.', read: true, created_at: ago(24 * 8) },
      { id: 3, body: 'Andrea linked your parent account. You will see her meetups here.', read: true, created_at: ago(24 * 5) }
    ],
    guardian_links: [], guardian_invites: []
  };

  var rpcs = {
    unread_counts: [{ conversation_id: 503, unread: 1 }],
    queue_count: 1, queue_position: 0, bump_view: null,
    wanted_matches: [ANAT, NURSE],
    my_family: { guardians: [{ id: MARIA, name: 'Maria Santos', email: 'maria.santos@gmail.com', since: ago(24 * 5), share_meetups: true, share_deals: true }], invite: null },
    create_guardian_invite: { code: '3FA94C0B21', expires_at: ahead(24 * 7) },
    check_guardian_invite: { student: 'Andrea Santos', school: UC, expires_at: ahead(24 * 6) },
    guardian_overview: [{ id: ME, name: 'Andrea Santos', school: UC, avatar_url: null, share_meetups: true, share_deals: true,
      meetups: [
        { id: 801, role: 'buying', title: 'Engineering Drawing Set', spot: 'Guard house', meet_at: MEET_AT, status: 'accepted', other_name: 'Miguel Reyes', other_school: 'UC', other_verified: true },
        { id: 802, role: 'selling', title: 'Medical-Surgical Nursing Handbook', spot: 'Library lobby', meet_at: ago(24 * 8), status: 'done', other_name: 'Kristine Dulay', other_school: 'UP Baguio', other_verified: true }],
      deals: [
        { role: 'sold', title: 'Medical-Surgical Nursing Handbook', kind: 'sell', price_php: 400, at: ago(24 * 8) },
        { role: 'bought', title: 'Clinical Duty White Shoes (7)', kind: 'free', price_php: 0, at: ago(24 * 14) },
        { role: 'bought', title: 'Anatomy & Physiology (Marieb, 11th ed.)', kind: 'sell', price_php: 850, at: ago(24 * 20) }] }],
    mfa_ok: true, is_admin: false,
    admin_stats: { users: 248, verified: 171, active_listings: 96, reserved_listings: 14, sold_listings: 35, completed_transactions: 52, cancelled_transactions: 6, open_reports: 2, pending_verifications: 3, messages: 1874 }
  };

  window.PASAU_DEMO_DATA = {
    tables: tables, rpcs: rpcs, ids: { ME: ME, MARIA: MARIA },
    L: { ANAT: ANAT.id, SHIRT: SHIRT.id, CALC: CALC.id, DRAW: DRAW.id, BAG: BAG.id },
    qr: '%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2043%2043%22%20shape-rendering%3D%22crispEdges%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M0%200h43v43H0z%22%2F%3E%3Cpath%20stroke%3D%22%23000000%22%20d%3D%22M1%201.5h7m1%200h1m3%200h2m1%200h2m3%200h3m1%200h1m1%200h1m2%200h2m3%200h7M1%202.5h1m5%200h1m2%200h5m2%200h3m1%200h1m3%200h3m1%200h1m5%200h1m5%200h1M1%203.5h1m1%200h3m1%200h1m1%200h3m2%200h1m1%200h2m1%200h1m2%200h1m1%200h2m1%200h1m1%200h1m1%200h1m1%200h1m1%200h1m1%200h3m1%200h1M1%204.5h1m1%200h3m1%200h1m3%200h4m4%200h2m6%200h1m2%200h1m2%200h1m1%200h1m1%200h3m1%200h1M1%205.5h1m1%200h3m1%200h1m2%200h1m2%200h1m1%200h1m2%200h2m1%200h2m3%200h2m7%200h1m1%200h3m1%200h1M1%206.5h1m5%200h1m1%200h1m3%200h2m1%200h1m2%200h1m5%200h1m3%200h3m3%200h1m5%200h1M1%207.5h7m1%200h1m1%200h1m1%200h1m1%200h1m1%200h1m1%200h1m1%200h1m1%200h1m1%200h1m1%200h1m1%200h1m1%200h1m1%200h1m1%200h7M10%208.5h1m2%200h2m1%200h1m3%200h2m1%200h1m1%200h1m3%200h1m1%200h1M1%209.5h1m1%200h1m3%200h2m2%200h7m2%200h3m1%200h2m1%200h2m2%200h3m2%200h1m2%200h1m1%200h1M1%2010.5h5m3%200h1m2%200h1m2%200h1m2%200h4m1%200h4m1%200h2m2%200h1m1%200h3m1%200h4M2%2011.5h4m1%200h2m1%200h2m2%200h1m2%200h1m2%200h2m1%200h2m3%200h2m1%200h5m4%200h1M2%2012.5h2m1%200h2m3%200h2m3%200h1m4%200h2m1%200h2m4%200h1m1%200h2m2%200h4M3%2013.5h1m1%200h1m1%200h1m1%200h3m1%200h2m1%200h1m6%200h3m2%200h2m4%200h1m6%200h1M1%2014.5h3m2%200h1m2%200h1m2%200h1m1%200h1m2%200h1m4%200h1m2%200h1m1%200h1m3%200h2m1%200h3m1%200h2m1%200h1M2%2015.5h3m2%200h1m2%200h1m1%200h3m2%200h1m1%200h2m1%200h2m1%200h1m1%200h4m1%200h2m1%200h2m1%200h1m1%200h2M1%2016.5h3m1%200h1m2%200h3m1%200h4m1%200h1m6%200h3m4%200h1m2%200h1m1%200h3m1%200h1M3%2017.5h1m1%200h1m1%200h3m4%200h8m5%200h3m5%200h1m5%200h1M1%2018.5h2m2%200h1m3%200h2m1%200h2m2%200h2m2%200h1m1%200h3m5%200h7m1%200h2m1%200h1M1%2019.5h1m3%200h1m1%200h1m1%200h2m1%200h3m1%200h6m2%200h1m1%200h2m1%200h4m2%200h1m1%200h2m1%200h2M2%2020.5h1m1%200h3m2%200h2m1%200h2m5%200h1m2%200h1m2%200h1m1%200h1m2%200h3m5%200h1m1%200h1M1%2021.5h3m1%200h8m2%200h2m1%200h2m1%200h2m1%200h1m1%200h4m1%200h3m1%200h1m4%200h2M1%2022.5h1m1%200h4m2%200h1m3%200h1m2%200h1m2%200h3m2%200h8m1%200h1m1%200h1m1%200h1m1%200h1m1%200h1M1%2023.5h1m3%200h1m1%200h3m1%200h4m1%200h2m1%200h2m1%200h1m1%200h2m2%200h2m2%200h1m1%200h3m2%200h1m1%200h1M1%2024.5h1m1%200h1m1%200h1m2%200h1m4%200h1m1%200h3m2%200h1m2%200h3m1%200h1m1%200h1m1%200h2m1%200h2m1%200h1m1%200h2M2%2025.5h1m1%200h2m1%200h1m2%200h4m6%200h2m1%200h1m2%200h1m1%200h1m3%200h1m2%200h1m4%200h2M1%2026.5h4m1%200h1m4%200h1m2%200h2m1%200h1m2%200h6m1%200h3m1%200h2m2%200h1m2%200h1m1%200h2M1%2027.5h1m3%200h4m2%200h2m2%200h4m1%200h1m1%200h1m1%200h1m1%200h1m1%200h1m1%200h1m1%200h3m1%200h6M3%2028.5h1m1%200h1m2%200h2m3%200h1m2%200h1m2%200h1m3%200h1m4%200h2m4%200h1m2%200h2m1%200h2M3%2029.5h1m3%200h3m2%200h1m1%200h1m5%200h2m2%200h1m4%200h1m3%200h4m3%200h2M2%2030.5h1m1%200h2m6%200h4m1%200h1m3%200h2m4%200h1m3%200h2m1%200h1m1%200h1m3%200h2M1%2031.5h9m3%200h1m7%200h4m1%200h2m1%200h2m2%200h1m1%200h1m1%200h1m3%200h1M4%2032.5h1m1%200h1m1%200h3m2%200h3m1%200h2m1%200h3m3%200h3m3%200h2m4%200h1M1%2033.5h5m1%200h1m1%200h5m2%200h4m1%200h1m2%200h1m1%200h2m1%200h1m1%200h1m1%200h6m2%200h1M9%2034.5h2m4%200h6m2%200h6m2%200h1m1%200h1m3%200h1m3%200h1M1%2035.5h7m1%200h1m10%200h4m4%200h1m1%200h2m1%200h1m1%200h1m1%200h3m1%200h1M1%2036.5h1m5%200h1m2%200h6m2%200h1m1%200h1m2%200h4m2%200h2m1%200h2m3%200h2m1%200h1M1%2037.5h1m1%200h3m1%200h1m2%200h4m2%200h3m1%200h7m2%200h1m1%200h8m2%200h1M1%2038.5h1m1%200h3m1%200h1m2%200h1m2%200h2m1%200h2m2%200h5m3%200h2m2%200h1m1%200h1m2%200h1m1%200h1M1%2039.5h1m1%200h3m1%200h1m1%200h2m1%200h1m1%200h4m1%200h3m1%200h2m1%200h3m1%200h1m2%200h2m2%200h1m1%200h1m1%200h1M1%2040.5h1m5%200h1m3%200h4m2%200h2m1%200h1m3%200h1m4%200h1m2%200h4m3%200h1M1%2041.5h7m1%200h2m6%200h1m1%200h3m2%200h2m2%200h2m3%200h1m2%200h2m3%200h1%22%2F%3E%3C%2Fsvg%3E%0A'
  };
})();
