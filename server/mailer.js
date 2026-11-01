import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_TO, MAIL_FROM } = process.env;
const pass = SMTP_PASS?.replace(/\s+/g, ''); // Google affiche le mot de passe d'application par blocs de 4

const transporter = SMTP_USER && pass
  // Gmail par défaut ; SMTP_HOST permet d'utiliser un autre fournisseur (ex. Brevo : smtp-relay.brevo.com)
  ? nodemailer.createTransport(SMTP_HOST
    ? { host: SMTP_HOST, port: Number(SMTP_PORT) || 587, auth: { user: SMTP_USER, pass } }
    : { service: 'gmail', auth: { user: SMTP_USER, pass } })
  : null;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function verifyMailer() {
  if (!transporter) {
    console.warn('⚠ Notifications e-mail désactivées : configurez SMTP_USER et SMTP_PASS dans .env.');
    return false;
  }
  try {
    await transporter.verify();
    console.log(`✔ SMTP prêt. Les messages seront envoyés à : ${MAIL_TO || SMTP_USER}`);
    return true;
  } catch (err) {
    console.error(`✖ Vérification SMTP échouée : ${err.message}`);
    return false;
  }
}

// Envoie une notification pour un nouveau message de contact. Réponse directe au visiteur via Reply-To.
export async function notifyContact({ name, email, subject, body }) {
  if (!transporter) {
    throw new Error('SMTP non configuré : définissez SMTP_USER et SMTP_PASS dans le fichier .env.');
  }
  await transporter.sendMail({
    from: `"Portfolio" <${MAIL_FROM || SMTP_USER}>`,
    to: MAIL_TO || SMTP_USER,
    replyTo: { name, address: email },
    subject: `[Portfolio] ${subject} — ${name}`,
    text: `Nouveau message depuis votre portfolio\n\nNom : ${name}\nE-mail : ${email}\nSujet : ${subject}\n\n${body}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px">
        <h2 style="color:#6342f5;margin:0 0 16px">Nouveau message depuis votre portfolio</h2>
        <p><b>Nom :</b> ${esc(name)}<br><b>E-mail :</b> <a href="mailto:${esc(email)}">${esc(email)}</a><br><b>Sujet :</b> ${esc(subject)}</p>
        <div style="padding:16px;background:#f2f3f9;border-radius:8px;white-space:pre-wrap">${esc(body)}</div>
        <p style="color:#888;font-size:12px;margin-top:16px">Cliquez sur « Répondre » pour écrire directement à ${esc(name)}.</p>
      </div>`,
  });
}
