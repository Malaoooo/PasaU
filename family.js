/* PasaU family page: parents and guardians sign up here with a student's invite, then see that student's meetups,
   check-ins and (if the student allows) completed deals. Guardians can't buy, sell or chat. See db/guardians.sql. */
(function () {
  var db = window.supabase.createClient(window.UC_CONFIG.url, window.UC_CONFIG.key);
  var h = UI.h, field = UI.field, toast = UI.toast, peso = UI.peso, day = UI.day, when = UI.when, errText = UI.errText;
  var head = document.getElementById('family-head'), body = document.getElementById('family-body');
  var params = new URLSearchParams(location.search);
  var invite = (params.get('invite') || '').trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  var me = null, profile = null, booted = false;

  function rpc(name, args) { return db.rpc(name, args).then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function ok(r) { if (r.error) throw r.error; return r.data; }
  function panel(title, kids) { return h('section', { class: 'p-panel' }, [title ? h('h2', { class: 'f-h2', text: title }) : null].concat(kids)); }
  function setHead(title, sub) { head.replaceChildren(h('div', { class: 'p-who' }, [h('h1', { text: title }), sub ? h('p', { class: 'p-sub', text: sub }) : null])); }
  function authText(e) { return (e && e.message) || 'Something went wrong. Try again.'; }
  function dropInviteFromUrl() { invite = ''; history.replaceState(null, '', location.pathname); }

  function start(session) {
    me = session && session.user;
    if (!me) return guest();
    db.from('profiles').select('full_name, role').eq('id', me.id).maybeSingle().then(function (r) {
      profile = r.data;
      if (!profile || profile.role !== 'guardian') return student();
      if (invite) {
        return rpc('accept_guardian_invite', { p_code: invite })
          .then(function () { toast('Linked! You’ll see their meetups here.'); }, function (e) { toast(errText(e)); })
          .then(function () { dropInviteFromUrl(); dashboard(); });
      }
      dashboard();
    });
  }
  // Wait for the two-step check nav.js runs; a half-logged-in session gets sent to the home page from there
  db.auth.getSession().then(function (r) { booted = true; start(r.data.session); });
  db.auth.onAuthStateChange(function (ev, s) {
    if (booted && (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') && ((s && s.user && s.user.id) !== (me && me.id))) setTimeout(function () { start(s); }, 0);
  });

  // ---------- Not logged in: sign up with an invite ----------
  function guest() {
    setHead('PasaU for parents', 'See when your student has a campus meetup, and get a check-in if it isn’t marked done.');
    var loginNext = 'index.html?login=1&next=' + encodeURIComponent('family.html' + (invite ? '?invite=' + invite : ''));
    var n = UI.note(), who = h('p', { class: 'f-invite', 'aria-live': 'polite' });
    var code = h('input', { id: 'f-code', type: 'text', maxLength: 10, value: invite, autocomplete: 'off', autocapitalize: 'characters', spellcheck: false, placeholder: 'e.g. 3FA94C0B21' });
    var name = h('input', { id: 'f-name', type: 'text', maxLength: 80, autocomplete: 'name' });
    var email = h('input', { id: 'f-email', type: 'email', autocomplete: 'email', placeholder: 'you@gmail.com' });
    var pass = h('input', { id: 'f-pass', type: 'password', autocomplete: 'new-password', placeholder: 'At least 8 characters' });
    var ok18 = h('input', { type: 'checkbox', id: 'f-ok' });
    var checked = '';
    function check() {
      var c = code.value.trim().toUpperCase();
      if (c.length < 10 || c === checked) return;
      checked = c;
      rpc('check_guardian_invite', { p_code: c }).then(function (x) {
        if (code.value.trim().toUpperCase() !== c) return;
        who.textContent = x ? '✓ Invite from ' + x.student + (x.school ? ' (' + x.school + ')' : '') + '. It expires ' + day(x.expires_at) + '.' : 'This code is wrong, used or expired. Ask your student for a new one in Profile > Family.';
        who.classList.toggle('err', !x);
      }).catch(function () { checked = ''; });
    }
    code.addEventListener('input', check);
    var form = h('form', { class: 'p-form', novalidate: true }, [
      field('Invite code', code, 'From your student’s link, or ask them for it (Profile > Family on PasaU).'), who,
      field('Your full name', name), field('Your email', email, 'Any email works, like Gmail or Yahoo.'), field('Password', pass),
      h('label', { class: 'check', htmlFor: 'f-ok' }, [ok18, h('span', { text: 'I’m this student’s parent or guardian, and I’m 18 or older.' })]),
      h('button', { class: 'pill', type: 'submit', text: 'Create parent account' }), n,
      h('p', { class: 'p-hint' }, ['Already have a parent account? ', h('a', { href: loginNext, text: 'Log in' }), invite ? ' and this invite links your second student.' : '.'])
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var c = code.value.trim().toUpperCase(), em = email.value.trim();
      if (c.length !== 10) return UI.say(n, 'Enter the 10-character invite code.', true);
      if (!name.value.trim()) return UI.say(n, 'Enter your full name.', true);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return UI.say(n, 'Enter your email, like you@gmail.com.', true);
      if (pass.value.length < 8) return UI.say(n, 'Your password needs at least 8 characters.', true);
      if (!ok18.checked) return UI.say(n, 'Tick the box to confirm you’re their parent or guardian.', true);
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      UI.say(n, 'Creating your account…');
      db.auth.signUp({ email: em, password: pass.value, options: {
        data: { full_name: name.value.trim(), guardian_invite: c },
        emailRedirectTo: location.origin + location.pathname
      } }).then(function (res) {
        btn.disabled = false;
        var err = res.error;
        if (err) {
          if (/database error saving/i.test(err.message)) UI.say(n, 'This invite code is wrong, used or expired. Ask your student for a new one.', true);
          else if (/registered|exists/i.test(err.message)) UI.say(n, 'That email already has an account. Log in instead.', true);
          else if (/rate|seconds/i.test(err.message)) UI.say(n, 'Too many attempts just now. Wait a minute, then try again.', true);
          else UI.say(n, 'Couldn’t create your account: ' + authText(err), true);
          return;
        }
        var u = res.data.user;
        if (u && u.identities && u.identities.length === 0) return UI.say(n, 'That email already has an account. Log in instead.', true);
        if (!res.data.session) confirmBox(em);
      });
    });
    body.replaceChildren(panel('Create your parent account', [form]), panel('What you’ll see', [whatYouSee()]));
    check();
  }
  function whatYouSee() {
    return h('ul', { class: 'f-points' }, [
      h('li', { text: 'Your student’s meetups: the campus spot, time and item.' }),
      h('li', { text: 'A check-in if a meetup isn’t marked done 30 minutes after it starts.' }),
      h('li', { text: 'Completed buys and sells, only if your student turns this on.' }),
      h('li', { text: 'You never see their chats, and you can’t buy, sell or message anyone. Your student can unlink you at any time.' })
    ]);
  }
  function confirmBox(email) {
    var n = UI.note();
    var code = h('input', { id: 'f-otp', type: 'text', inputMode: 'numeric', autocomplete: 'one-time-code', maxLength: 10 });
    var form = h('form', { class: 'p-form', novalidate: true }, [
      h('p', { text: 'We sent a code to ' + email + '. Type it here, or tap the link in that email.' }),
      field('Code from the email', code),
      h('div', { class: 'p-row' }, [
        h('button', { class: 'pill', type: 'submit', text: 'Confirm' }),
        h('button', { class: 'pill light small', type: 'button', text: 'Send a new code', onclick: function () {
          db.auth.resend({ type: 'signup', email: email }).then(function (r) { UI.say(n, r.error ? 'Couldn’t send a new code: ' + authText(r.error) : 'New code sent to ' + email + '.', !!r.error); });
        } })
      ]), n
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var c = code.value.replace(/\D/g, '');
      if (c.length < 6) return UI.say(n, 'Enter the code from the email we sent.', true);
      UI.say(n, 'Checking…');
      db.auth.verifyOtp({ email: email, token: c, type: 'signup' }).then(function (r) {
        if (r.error) return UI.say(n, /invalid|expired/i.test(r.error.message) ? 'That code didn’t work. Check the newest email, or send a new code.' : 'Couldn’t check the code: ' + authText(r.error), true);
        dropInviteFromUrl();  // the invite was used at sign-up
      });
    });
    setHead('Check your email', 'One last step to finish your parent account.');
    body.replaceChildren(panel(null, [form]));
    code.focus();
  }

  // ---------- Logged in as a student ----------
  function student() {
    setHead('This page is for parents', 'Want a parent or guardian to see your meetups? Invite them from your profile.');
    body.replaceChildren(panel(null, [h('div', { class: 'p-row' }, [h('a', { class: 'pill', href: 'profile.html#family', text: 'Go to Profile > Family' })])]));
  }

  // ---------- Guardian dashboard ----------
  function dashboard() {
    var first = ((profile && profile.full_name) || '').trim().split(/\s+/)[0];
    setHead(first ? 'Hi, ' + first : 'Family dashboard', 'Meetups and check-ins for the students who linked you.');
    body.replaceChildren(panel(null, [h('p', { class: 'muted', text: 'Loading…' })]));
    Promise.all([
      rpc('guardian_overview'),
      db.from('guardian_alerts').select('*').order('created_at', { ascending: false }).limit(30).then(ok)
    ]).then(function (res) {
      var kids = res[0] || [], alerts = res[1] || [];
      var parts = kids.length ? kids.map(studentCard) : [panel(null, [UI.empty('No students linked yet.', 'Ask your student to open Profile > Family on PasaU and send you an invite code.')])];
      parts.push(panel('Alerts', [alertList(alerts)]), panel('Add another student', [addStudent()]));
      body.replaceChildren.apply(body, parts);
      var unread = alerts.filter(function (a) { return !a.read; }).map(function (a) { return a.id; });
      if (unread.length) db.from('guardian_alerts').update({ read: true }).in('id', unread).then(function () {});
    }).catch(function (e) { body.replaceChildren(panel(null, [UI.empty('Couldn’t load your dashboard.', errText(e))])); });
  }

  function studentCard(s) {
    var meetups = s.meetups || [], deals = s.deals || [];
    var kids = [h('div', { class: 'f-student' }, [UI.avatar(s.avatar_url, s.name, 48), h('div', { class: 'p-main' }, [
      h('h2', { class: 'f-h2', text: s.name || 'Student' }), h('p', { class: 'p-meta', text: s.school || '' })
    ])])];
    kids.push(h('h3', { class: 'f-h3', text: 'Meetups' }));
    if (!s.share_meetups) kids.push(h('p', { class: 'muted', text: (s.name || 'Your student').split(' ')[0] + ' has turned off meetup sharing.' }));
    else if (!meetups.length) kids.push(h('p', { class: 'muted', text: 'No meetups coming up.' }));
    else kids.push(h('ul', { class: 'p-list' }, meetups.map(function (m) {
      var done = m.status === 'done', late = !done && new Date(m.meet_at) < new Date(Date.now() - 30 * 60000);
      return h('li', { class: 'p-item' }, [h('div', { class: 'p-main' }, [
        h('p', { class: 'p-title', text: (m.role === 'buying' ? 'Buying ' : 'Selling ') + '“' + m.title + '”' }),
        h('p', { class: 'p-meta', text: m.spot + ' · ' + when(m.meet_at) }),
        h('p', { class: 'p-meta', text: 'With ' + (m.other_name || 'a student') + (m.other_school ? ' from ' + m.other_school : '') + (m.other_verified ? ' · ✓ Verified student' : '') })
      ]), done ? h('span', { class: 'p-chip ok', text: 'Handover done' }) : late ? h('span', { class: 'p-chip cancelled', text: 'Not marked done' }) : h('span', { class: 'p-chip meetup', text: 'Upcoming' })]);
    })));
    if (s.share_deals) {
      kids.push(h('h3', { class: 'f-h3', text: 'Completed deals (last 90 days)' }));
      if (!deals.length) kids.push(h('p', { class: 'muted', text: 'No completed buys or sells.' }));
      else {
        var spent = deals.filter(function (d) { return d.role === 'bought'; }).reduce(function (t, d) { return t + (d.price_php || 0); }, 0);
        kids.push(h('ul', { class: 'p-list' }, deals.map(function (d) {
          var price = d.kind === 'free' ? 'Free' : d.kind === 'swap' ? 'Swap' : peso(d.price_php);
          return h('li', { class: 'p-item' }, [h('div', { class: 'p-main' }, [
            h('p', { class: 'p-title', text: (d.role === 'bought' ? 'Bought ' : 'Sold ') + '“' + d.title + '”' }),
            h('p', { class: 'p-meta', text: price + ' · ' + day(d.at) })
          ])]);
        })), h('p', { class: 'p-meta', text: 'Spent in this period: ' + peso(spent) }));
      }
    }
    kids.push(concernBox(s, meetups), h('div', { class: 'p-row' }, [UI.action('Unlink from ' + (s.name || 'student').split(' ')[0], function (b) {
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Tap again to unlink'; return; }
      return db.from('guardian_links').delete().eq('student_id', s.id).eq('guardian_id', me.id).then(function (r) { ok(r); toast('Unlinked'); dashboard(); });
    }, null, 'linkish')]));
    return panel(null, kids);
  }

  function concernBox(s, meetups) {
    var n = UI.note(), id = 'fc-' + s.id;
    var which = h('select', { id: id + '-m' }, [UI.opt('', 'Not about a specific meetup')].concat(meetups.map(function (m) {
      return UI.opt(String(m.id), '“' + m.title + '” at ' + m.spot + ', ' + day(m.meet_at));
    })));
    var text = h('textarea', { id: id + '-t', maxLength: 1000, placeholder: 'What worries you? PasaU’s team reads every report.' });
    var form = h('div', { class: 'p-inline', hidden: true }, [
      meetups.length ? field('Which meetup?', which) : null, field('Your concern', text),
      h('div', { class: 'p-row' }, [UI.action('Send to PasaU', function () {
        if (text.value.trim().length < 5) { UI.say(n, 'Tell us a little about your concern.', true); return; }
        return rpc('guardian_concern', { p_student: s.id, p_details: text.value.trim(), p_meetup: which.value ? Number(which.value) : null }).then(function () {
          text.value = ''; form.hidden = true; toast('Sent. PasaU’s team will look into it.');
        });
      }, n, 'pill small')]), n
    ]);
    return h('div', { class: 'f-concern' }, [h('button', { class: 'pill light small', type: 'button', text: 'Report a concern', onclick: function () { form.hidden = !form.hidden; if (!form.hidden) text.focus(); } }), form]);
  }

  function alertList(alerts) {
    if (!alerts.length) return h('p', { class: 'muted', text: 'Nothing yet. Meetup alerts and check-ins show up here.' });
    return h('ul', { class: 'f-alerts' }, alerts.map(function (a) {
      return h('li', { class: a.read ? '' : 'unread' }, [h('p', { text: a.body }), h('small', { class: 'p-meta', text: when(a.created_at) })]);
    }));
  }

  function addStudent() {
    var n = UI.note();
    var code = h('input', { id: 'f-add', type: 'text', maxLength: 10, autocomplete: 'off', autocapitalize: 'characters', spellcheck: false });
    return h('div', { class: 'p-form' }, [field('Invite code from your other student', code), h('div', { class: 'p-row' }, [UI.action('Link student', function () {
      var c = code.value.trim().toUpperCase();
      if (c.length !== 10) { UI.say(n, 'Enter the 10-character invite code.', true); return; }
      return rpc('accept_guardian_invite', { p_code: c }).then(function () { toast('Linked!'); dashboard(); });
    }, n, 'pill small')]), n]);
  }
})();
