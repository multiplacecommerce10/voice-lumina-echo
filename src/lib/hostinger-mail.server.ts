// Hostinger Agentic Mail sender. Each mailbox has its own bearer token
// (stored as a secret); mailbox resource IDs are not secret.

export type HostingerMailbox = "subscription" | "confirm" | "scholarship";

const MAILBOXES: Record<HostingerMailbox, { id: string; tokenEnv: string; address: string }> = {
  subscription: {
    id: "AC2d7d9ec039070bcd963850167bd0",
    tokenEnv: "HOSTINGER_MAIL_API_TOKEN",
    address: "subscription@consciousvoice.tecendosom.com",
  },
  confirm: {
    id: "ACed1326e0639d079fbe5ae820231e",
    tokenEnv: "HOSTINGER_MAIL_TOKEN_CONFIRM",
    address: "contact@confirm.tecendosom.com",
  },
  scholarship: {
    id: "AC606f82d1474a4b9ab2a93f9049de",
    tokenEnv: "HOSTINGER_MAIL_TOKEN_SCHOLARSHIP",
    address: "contact@tecendosom.com",
  },
};

export async function sendHostingerMail(
  mailbox: HostingerMailbox,
  msg: { to: string; subject: string; html: string; text?: string; displayName?: string },
): Promise<{ ok: boolean; status: number; message?: string }> {
  const box = MAILBOXES[mailbox];
  const token = process.env[box.tokenEnv];
  if (!token) return { ok: false, status: 0, message: `${box.tokenEnv} missing` };
  const res = await fetch(`https://api.mail.hostinger.com/api/v1/mailboxes/${box.id}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      displayName: msg.displayName ?? "Cuca Medina — The Power of Conscious Voice",
    }),
  });
  if (res.ok) return { ok: true, status: res.status };
  return { ok: false, status: res.status, message: (await res.text()).slice(0, 300) };
}
