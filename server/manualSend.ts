import { addLeadEvent, updateLeadStatus } from "./db";

export async function markLeadSentManually(id: number) {
  const detail = "Manually submitted after CAPTCHA review";
  await updateLeadStatus(id, "sent", false, detail);
  await addLeadEvent({ leadId: id, eventType: "outreach", outcome: "sent", detail });
  return { success: true as const };
}
