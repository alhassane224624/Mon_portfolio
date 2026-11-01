import { sendTestMail } from './mailer.js';

try {
  const to = await sendTestMail();
  console.log(`✔ E-mail de test envoyé à ${to}. Vérifiez la boîte de réception (et les spams).`);
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exitCode = 1;
}
