"use server";

import { revalidatePath } from "next/cache";

import { updateDealerStatus } from "@/db/services";
import { DEALER_STATUSES } from "@/lib/domain";

export async function updateDealerStatusAction(formData: FormData): Promise<void> {
  const dealerId = Number(formData.get("dealerId"));
  const requestedStatus = String(formData.get("status") ?? "");
  const status = DEALER_STATUSES.find((item) => item === requestedStatus);
  if (!Number.isInteger(dealerId) || dealerId < 1 || !status) {
    throw new Error("Некорректные данные дилера");
  }
  updateDealerStatus(dealerId, status);
  revalidatePath("/dealers");
}
