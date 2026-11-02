/* API client: JSON, CSRF, offline queue with idempotent replay. */
(function () {
  var csrf = null, listeners = [];
  /* Where /api/ lives, worked out from where this script was loaded, so the app works at a domain root,
     at /expense-tracker/ and at /expense-tracker/frontend/ alike. */
  var ROOT = (function () {
    try {
      var s = document.currentScript || document.querySelector('script[src$="assets/js/api.js"]');
      return new URL('../../', s.src).pathname.replace(/frontend\/$/, '');
    } catch (e) { return '/'; }
  })();
  function apiUrl(u) { return typeof u === 'string' ? u.replace(/^\.\.\/api\//, ROOT + 'api/') : u; }
  var QKEY = 'et_offline_queue';
  var QUEUEABLE = /^(?:\.\.\/)?\/?api\/(income|expenses)$/;

  function ApiError(message, status, errors, code) { this.message = message; this.status = status; this.errors = errors || {}; this.code = code || ''; }
  ApiError.prototype = Object.create(Error.prototype);

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /* Real connectivity state. navigator.onLine is unreliable (installed apps often report "offline" while the network works),
     so the app trusts what actually happens to requests: any answer from the server means we are online. */
  var net = { online: true }, netListeners = [];
  function setNet(ok) { var changed = net.online !== ok; net.online = ok; if (changed) netListeners.forEach(function (f) { try { f(ok); } catch (e) {} }); }
  /* fetch with a time limit, so a stalled connection fails fast instead of hanging the app forever */
  function fetchT(url, opts, ms) {
    if (!window.AbortController) return fetch(url, opts);
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms);
    opts.signal = c.signal;
    return fetch(url, opts).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }

  async function raw(method, url, body, isForm) {
    url = apiUrl(url);
    var opts = { method: method, credentials: 'same-origin', headers: { 'Accept': 'application/json' } };
    if (method !== 'GET') {
      if (!csrf) await Api.csrf();
      opts.headers['X-CSRF-Token'] = csrf;
    }
    if (body !== undefined && body !== null) {
      if (isForm) opts.body = body; else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    }
    var res;
    try { res = await fetchT(url, opts, isForm ? 60000 : method === 'GET' ? 20000 : 30000); }
    catch (e) { setNet(false); throw e; }
    setNet(true);
    var json = null;
    try { json = await res.json(); } catch (e) {}
    if (method !== 'GET') { try { sessionStorage.removeItem('et_me_fast'); sessionStorage.removeItem('et_pub_fast'); } catch (e) {} }
    if (!res.ok || !json || json.success === false) {
      var err = new ApiError((json && json.message) || 'Something went wrong. Please try again.', res.status, json && json.errors, json && json.code);
      err.data = json; throw err;
    }
    return json;
  }

  async function call(method, url, body, isForm) {
    try { return await raw(method, url, body, isForm); }
    catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'csrf' && !call._retry) { call._retry = true; csrf = null; try { return await call(method, url, body, isForm); } finally { call._retry = false; } }
        throw e;
      }
      // Network failure
      var path = url.split('?')[0];
      if (method === 'POST' && !isForm && QUEUEABLE.test(path) && body) {
        body.client_uuid = body.client_uuid || uuid();
        Queue.add(path, body);
        return { success: true, queued: true, message: 'Saved offline. It will sync when you are back online.', data: { queued: true } };
      }
      var ne = new ApiError('You appear to be offline. Please check your connection and try again.', 0); ne.offline = true; throw ne;
    }
  }

  var Queue = {
    all: function () { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch (e) { return []; } },
    save: function (q) { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch (e) {} listeners.forEach(function (f) { f(q.length); }); },
    add: function (path, body) { var q = this.all(); q.push({ path: path, body: body, at: Date.now() }); this.save(q); },
    count: function () { return this.all().length; },
    clear: function () { this.save([]); },
    syncing: false,
    /* Replays queued items in order. Safe to run repeatedly: the server de-duplicates on client_uuid. */
    async sync() {
      if (this.syncing) return { synced: 0, failed: 0 };
      this.syncing = true; var synced = 0, failed = 0;
      try {
        var q = this.all(), rest = [];
        for (var i = 0; i < q.length; i++) {
          try { await raw('POST', q[i].path, q[i].body); synced++; }
          catch (e) {
            if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.code !== 'csrf' && e.status !== 401) { failed++; q[i].error = e.message; q[i].rejected = true; rest.push(q[i]); }
            else if (e instanceof ApiError && (e.status === 401 || e.code === 'csrf')) { rest.push.apply(rest, q.slice(i)); break; }
            else { rest.push.apply(rest, q.slice(i)); break; }
          }
        }
        this.save(rest);
      } finally { this.syncing = false; }
      return { synced: synced, failed: failed };
    },
    onChange: function (f) { listeners.push(f); }
  };

  var Api = {
    ApiError: ApiError, uuid: uuid, queue: Queue, url: apiUrl,
    async csrf() {
      var r; try { r = await fetchT(apiUrl('../api/auth/csrf'), { credentials: 'same-origin' }, 15000); } catch (e) { setNet(false); throw e; }
      setNet(true); var j = await r.json(); csrf = j.data.csrf; return csrf;
    },
    /* Is the server really reachable right now? Any reply (even an error page) counts as online. */
    async ping() {
      try { await fetchT(apiUrl('../api/auth/csrf') + '?_=' + Date.now(), { credentials: 'same-origin', cache: 'no-store' }, 7000); setNet(true); return true; }
      catch (e) { setNet(false); return false; }
    },
    isOnline: function () { return net.online; },
    onNet: function (f) { netListeners.push(f); },
    setCsrf: function (t) { csrf = t; },
    get: function (u) { return call('GET', u); },
    post: function (u, b) { return call('POST', u, b === undefined ? {} : b); },
    put: function (u, b) { return call('PUT', u, b); },
    del: function (u) { return call('DELETE', u); },
    upload: function (u, formData) { return call('POST', u, formData, true); },
    qs: function (o) { var p = new URLSearchParams(); Object.keys(o || {}).forEach(function (k) { if (o[k] !== '' && o[k] != null) p.set(k, o[k]); }); var s = p.toString(); return s ? '?' + s : ''; }
  };
  window.Api = Api;
})();
