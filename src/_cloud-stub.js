/* 仅用于本地回归测试：内存版云客户端，接口形状对齐 workbuddy-cloud-sdk */
(function (g) {
  'use strict';
  var TABLES = { wb_records: new Map(), wb_kv: new Map() };

  function rows(t) {
    var m = TABLES[t];
    if (!m) { TABLES[t] = m = new Map(); }
    return Array.from(m.values());
  }
  function keyOf(t, r) {
    if (t === 'wb_records') return r.key;
    return r.k;
  }

  function Query(table) {
    this.table = table;
    this._op = 'select';
    this._cols = '*';
    this._opts = {};
    this._filters = [];
    this._order = null;
    this._range = null;
    this._limit = null;
    this._mode = null;
    this._payload = null;
    this._single = 0;
  }
  Query.prototype.select = function (cols, opts) {
    this._cols = cols || '*'; this._opts = opts || {};
    if (this._op !== 'select') this._mode = 'returning';
    return this;
  };
  Query.prototype.order = function (col) { this._order = col; return this; };
  Query.prototype.range = function (a, b) { this._range = [a, b]; return this; };
  Query.prototype.limit = function (n) { this._limit = n; return this; };
  Query.prototype.eq = function (c, v) { this._filters.push(['eq', c, v]); return this; };
  Query.prototype.in = function (c, v) { this._filters.push(['in', c, v]); return this; };
  Query.prototype.maybeSingle = function () { this._single = 1; return this; };
  Query.prototype.single = function () { this._single = 2; return this; };
  Query.prototype.insert = function (p) { this._op = 'insert'; this._payload = p; return this; };
  Query.prototype.upsert = function (p) { this._op = 'upsert'; this._payload = p; return this; };
  Query.prototype.update = function (p) { this._op = 'update'; this._payload = p; return this; };
  Query.prototype.delete = function () { this._op = 'delete'; return this; };

  function project(row, cols) {
    if (!cols || cols === '*' || cols.indexOf('*') >= 0) return Object.assign({}, row);
    var out = {};
    cols.split(',').forEach(function (c) {
      var k = c.trim();
      if (k in row) out[k] = row[k];
    });
    return out;
  }

  Query.prototype._run = function () {
    var t = this.table, self = this;
    var list = rows(t).filter(function (r) {
      return self._filters.every(function (f) {
        if (f[0] === 'eq') return r[f[1]] === f[2];
        return f[2].indexOf(r[f[1]]) >= 0;
      });
    });
    var res = { data: null, error: null, count: null };

    if (this._op === 'select') {
      if (this._order) list.sort(function (a, b) {
        var x = a[self._order], y = b[self._order];
        return x < y ? -1 : x > y ? 1 : 0;
      });
      if (this._opts && this._opts.count === 'exact') res.count = list.length;
      if (this._opts && this._opts.head) { res.data = null; return res; }
      if (this._range) list = list.slice(this._range[0], this._range[1] + 1);
      if (this._limit) list = list.slice(0, this._limit);
      res.data = list.map(function (r) { return project(r, self._cols); });
      if (this._single) {
        if (!list.length) {
          if (this._single === 1) { res.data = null; return res; }
          res.error = { code: 'PGRST116', message: 'no rows' };
          return res;
        }
        res.data = project(list[0], this._cols);
      }
      return res;
    }

    if (this._op === 'upsert' || this._op === 'insert') {
      var arr = Array.isArray(this._payload) ? this._payload : [this._payload];
      arr.forEach(function (r) { TABLES[t].set(keyOf(t, r), Object.assign({}, r)); });
      res.data = arr.map(function (r) { return project(r, '*' === self._cols ? '*' : self._cols); });
      return res;
    }
    if (this._op === 'delete') {
      list.forEach(function (r) { TABLES[t].delete(keyOf(t, r)); });
      res.data = list;
      return res;
    }
    if (this._op === 'update') {
      list.forEach(function (r) {
        var cur = TABLES[t].get(keyOf(t, r));
        Object.assign(cur, self._payload);
      });
      res.data = list;
      return res;
    }
    return res;
  };

  Query.prototype.then = function (ok, bad) {
    var self = this;
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(self._run()); }, 2);
    }).then(ok, bad);
  };

  var SESSION = { user: { uid: 'u-test', name: '王涛' }, accessToken: 'test' };

  g.WorkBuddyCloud = {
    createWorkBuddyCloud: function () {
      return {
        database: { from: function (t) { return new Query(t); }, rpc: function () { return new Query('_rpc'); } },
        auth: {
          getSession: function () { return Promise.resolve({ data: SESSION, error: null }); },
          getUser: function () { return Promise.resolve({ data: SESSION.user, error: null }); },
          refreshSession: function () { return Promise.resolve({ data: SESSION, error: null }); },
          onAuthStateChange: function () { return function () {}; },
          signOut: function () { return Promise.resolve({ error: null }); },
          signInWithOAuth: function () { return Promise.resolve({ data: { url: 'about:blank' }, error: null }); },
          sendOtp: function () { return Promise.resolve({ data: { verificationId: 'v', isExistingUser: true }, error: null }); },
          verifyOtp: function () { return Promise.resolve({ data: SESSION, error: null }); }
        }
      };
    },
    __TABLES: TABLES
  };
})(window);
