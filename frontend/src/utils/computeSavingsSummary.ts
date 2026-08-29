import { MetalWallet, Rates, SavingsSummary, SipEnrollment } from "@/src/api/client"

export function computeSavingsSummary(
  enrollments: SipEnrollment[],
  wallet: MetalWallet,
  rates: Rates
): SavingsSummary {
  let totalInvested = 0
  let goldG = wallet.gold_grams
  let silverG = wallet.silver_grams

  for (const e of enrollments) {
    const s = e.summary
    totalInvested += s?.total_paid ?? 0
    const grams = s?.grams_accrued ?? 0
    if ((e.metal || "gold") === "silver") silverG += grams
    else goldG += grams
  }

  const currentValue = goldG * rates.gold.inr_per_gram + silverG * rates.silver.inr_per_gram
  const gain = currentValue - totalInvested

  return {
    total_invested: Math.round(totalInvested * 100) / 100,
    current_value: Math.round(currentValue * 100) / 100,
    gain: Math.round(gain * 100) / 100,
    gold_grams: Math.round(goldG * 10000) / 10000,
    silver_grams: Math.round(silverG * 10000) / 10000,
  }
}
