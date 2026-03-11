/**
 * Envoi du message via WhatsApp (Twilio API)
 *
 * Alternatives supportées :
 * - Twilio WhatsApp (nécessite un compte Twilio)
 * - Console (dry-run / debug)
 *
 * Configuration via variables d'environnement :
 *   TWILIO_ACCOUNT_SID=ACxxxxxxx
 *   TWILIO_AUTH_TOKEN=xxxxxxx
 *   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  (numéro Twilio sandbox ou dédié)
 *   WHATSAPP_TO=whatsapp:+33612345678           (ton numéro)
 */

interface SendOptions {
  message: string;
  dryRun?: boolean;
}

export async function sendWhatsApp({
  message,
  dryRun,
}: SendOptions): Promise<void> {
  if (dryRun) {
    console.log("\n╔══════════════════════════════════════╗");
    console.log("║     🏄 DRY RUN — Message Preview     ║");
    console.log("╚══════════════════════════════════════╝\n");
    console.log(message);
    console.log(
      `\n📊 Message length: ${message.length} chars (WhatsApp limit: 65536)`,
    );
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const toRaw = process.env.WHATSAPP_TO;

  if (!accountSid || !authToken || !from || !toRaw) {
    console.error("❌ Variables d'environnement Twilio manquantes !");
    console.error("Requis :");
    console.error("  TWILIO_ACCOUNT_SID=ACxxxxxxx");
    console.error("  TWILIO_AUTH_TOKEN=xxxxxxx");
    console.error("  TWILIO_WHATSAPP_FROM=whatsapp:+14155238886");
    console.error("  WHATSAPP_TO=whatsapp:+33612345678,whatsapp:+33612345679");
    console.error("\n💡 Utilise --dry-run pour tester sans envoyer.");
    process.exit(1);
  }

  const recipients = toRaw.split(",").map((n) => n.trim());

  // Dynamic import to avoid requiring twilio when doing dry-run
  const twilio = await import("twilio");
  const client = twilio.default(accountSid, authToken);

  // WhatsApp a une limite de 1600 chars par message
  // On découpe si nécessaire
  const chunks = splitMessage(message, 1500);

  for (const to of recipients) {
    for (let i = 0; i < chunks.length; i++) {
      const chunk =
        i === 0 ? chunks[i] : `(suite ${i + 1}/${chunks.length})\n\n${chunks[i]}`;
      await client.messages.create({
        body: chunk,
        from,
        to,
      });
      console.log(`✅ Message ${i + 1}/${chunks.length} envoyé à ${to}`);

      if (i < chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
}

function splitMessage(message: string, maxLength: number): string[] {
  if (message.length <= maxLength) return [message];

  const chunks: string[] = [];
  const lines = message.split("\n");
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 > maxLength && current.length > 0) {
      chunks.push(current.trimEnd());
      current = "";
    }
    current += line + "\n";
  }
  if (current.trim()) chunks.push(current.trimEnd());

  return chunks;
}
