import { MetalRate } from "@/src/api/client"

export function goldPer10g(rate: MetalRate): number {
  return rate.inr_per_gram * 10
}

export function silverPerKg(rate: MetalRate): number {
  return rate.inr_per_gram * 1000
}
