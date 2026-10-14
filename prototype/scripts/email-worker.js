// Cloudflare Email Worker for order-email forwarding (PRD FR#6). Email Routing sends every
// message for the inbound domain (e.g. orders+abc123@in.thewardrobeos.com) here; the worker
// posts the raw message to the app, which reads only the clothing lines and drops the rest.
// Settings on the worker: APP_URL (https://app.thewardrobeos.com) and INBOUND_SECRET (secret,
// the same value as WARDROBE_INBOUND_SECRET on Vercel). No dependencies: paste into the dashboard.
export default {
  async email(message, env) {
    if (message.rawSize > 8_000_000) { message.setReject('This email is too large.'); return; }
    const raw = await new Response(message.raw).text();
    const response = await fetch(env.APP_URL.replace(/\/$/, '') + '/api/wardrobe/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Inbound-Secret': env.INBOUND_SECRET },
      body: JSON.stringify({ to: message.to, raw: raw.slice(0, 4_000_000) })
    });
    // An unknown address is accepted quietly; only a broken setup bounces, so it gets noticed.
    if (response.status === 401 || response.status >= 500) message.setReject('Forwarding is not set up correctly. Please try again later.');
  }
};
