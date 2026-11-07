import { buildPayPalAccountAccessEmail } from "@/lib/paypal-emails";

/** Never sets passwords; existing accounts retain their login and recovery flow. */
export async function prepareStripeAccountAccess(admin: any, input: { email: string; fullName: string | null; eventId: string }) {
  const email = input.email.toLowerCase();
  const marker = `stripe:${input.eventId}`;
  const find = async () => {
    for (let page = 1; ; page++) {
      const { data, error } = await admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const users = data?.users ?? [];
      const found = users.find((u: any) => u.email?.toLowerCase() === email);
      if (found) return found;
      if (users.length < 1000) return null;
    }
  };
  let user = await find();
  if (!user) {
    const { data, error } = await admin.createUser({ email, email_confirm: true,
      user_metadata: { full_name: input.fullName ?? undefined, created_via: marker } });
    user = data?.user ?? await find();
    if (!user) throw error ?? new Error("Could not prepare student account");
  }
  let setPasswordUrl: string | null = null;
  if (user.user_metadata?.created_via === marker) {
    const { data, error } = await admin.generateLink({ type: "recovery", email,
      options: { redirectTo: "https://consciousvoice.tecendosom.com/reset-password" } });
    if (error || !data?.properties?.action_link) throw error ?? new Error("Could not prepare secure access link");
    setPasswordUrl = data.properties.action_link;
  }
  return { ...buildPayPalAccountAccessEmail({ fullName: input.fullName, email, setPasswordUrl }), requiredTokens: [] as string[] };
}