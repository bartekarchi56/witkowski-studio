/*
 * Connection to the Supabase database (supabase/schema.sql).
 * Every call is a database function that checks who is asking, so the
 * anon key in config.js is safe to publish.
 * When CONFIG.supabase is empty, Remote.enabled is false and the pages run
 * the browser-only demo instead.
 */
(function () {
  const cfg = (window.CONFIG && CONFIG.supabase) || {};
  const enabled = Boolean(cfg.url && cfg.anonKey && window.supabase);
  // Timbro's tables and functions live in their own schema (see supabase/schema.sql).
  const sb = enabled ? supabase.createClient(cfg.url, cfg.anonKey, { db: { schema: 'timbro' } }) : null;
  const DEVICE = 'timbro:device';
  const ROOT = new URL('../../', document.currentScript.src);

  async function rpc(fn, args = {}) {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.message || 'Something went wrong. Try again.');
    return data;
  }
  const device = () => { try { return JSON.parse(localStorage.getItem(DEVICE)); } catch (e) { return null; } };

  window.Remote = {
    enabled,

    // ---- customers ----
    getCard: id => rpc('get_card', { p_card_id: id }),
    joinCard: (id, name) => rpc('join_card', { p_card_id: id, p_name: name }),
    getMyCard: (code, secret) => rpc('get_my_card', { p_code: code, p_secret: secret }),

    // ---- the cashier's phone ----
    device,
    async linkDevice(code, name) {
      const r = await rpc('device_link', { p_code: code, p_name: name });
      localStorage.setItem(DEVICE, JSON.stringify({ token: r.token, business: r.business, name }));
      return r;
    },
    unlinkDevice() { localStorage.removeItem(DEVICE); },
    lookup: code => rpc('stamper_lookup', { p_token: device().token, p_code: code }),
    stamp: (code, delta) => rpc('stamper_stamp', { p_token: device().token, p_code: code, p_delta: delta }),
    redeem: code => rpc('stamper_redeem', { p_token: device().token, p_code: code }),

    // ---- owner login ----
    async session() { return (await sb.auth.getSession()).data.session; },
    async signIn(email, password) { const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; return data; },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: new URL('dashboard.html', location.href).href } });
      if (error) throw error; return data;
    },
    async resetPassword(email) { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL('login.html?reset=1', location.href).href }); if (error) throw error; },
    async updatePassword(password) { const { error } = await sb.auth.updateUser({ password }); if (error) throw error; },
    async signOut() { await sb.auth.signOut(); },
    // Sends people who are not logged in to the login page.
    async requireLogin() {
      const s = await this.session();
      if (!s) {
        const here = location.href.slice(ROOT.href.length);   // e.g. 'app/dashboard.html?card=…' or 'studio/'
        location.href = new URL('app/login.html?next=' + encodeURIComponent(here), ROOT).href;
        return null;
      }
      return s;
    },

    // ---- owner dashboard ----
    ownerData: () => rpc('owner_data'),
    saveCard: card => rpc('owner_save_card', { p_card: card }),
    sendDesign: (cardId, kind, design, note, images, links) => rpc('owner_send_design', { p_card_id: cardId, p_kind: kind, p_design: design, p_note: note, p_images: images, p_links: links }),
    linkCode: () => rpc('owner_link_code'),
    removeDevice: id => rpc('owner_remove_device', { p_device_id: id }),

    // ---- Witkowski Design ----
    adminCards: () => rpc('admin_cards'),
    publish: (cardId, design) => rpc('admin_publish', { p_card_id: cardId, p_design: design }),
    askChanges: (cardId, reply) => rpc('admin_ask_changes', { p_card_id: cardId, p_reply: reply }),
    setPlan: (cardId, plan) => rpc('admin_set_plan', { p_card_id: cardId, p_plan: plan })
  };
})();
