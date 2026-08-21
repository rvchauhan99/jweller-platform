import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { getSipEnrollments } from "@/src/api/client";
import { getCustomerToken } from "@/src/api/customerToken";
import { useStore } from "@/src/theme/StoreProvider";

export interface DueReminder {
  enrollment_id: string;
  plan_name: string;
  amount: number;
  due_date: string;
}

interface RemindersValue {
  dueCount: number;
  next: DueReminder | null;
  refresh: () => void;
}

const Ctx = createContext<RemindersValue | undefined>(undefined);

export function SipRemindersProvider({ children }: { children: React.ReactNode }) {
  const { code, status } = useStore();
  const [dueCount, setDueCount] = useState(0);
  const [next, setNext] = useState<DueReminder | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (!getCustomerToken()) {
        setDueCount(0);
        setNext(null);
        return;
      }
      const enrollments = await getSipEnrollments(code);
      const now = Date.now();
      const due: DueReminder[] = [];
      for (const e of enrollments) {
        if (e.status !== "active") continue;
        const inst = e.installments.find((i) => i.status === "due");
        if (inst && new Date(inst.due_date).getTime() <= now) {
          due.push({ enrollment_id: e.id, plan_name: e.plan_name, amount: e.monthly_amount, due_date: inst.due_date });
        }
      }
      due.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      setDueCount(due.length);
      setNext(due[0] ?? null);
    } catch {
      setDueCount(0);
      setNext(null);
    }
  }, [code]);

  useEffect(() => {
    if (status === "ready") refresh();
  }, [status, refresh]);

  return <Ctx.Provider value={{ dueCount, next, refresh }}>{children}</Ctx.Provider>;
}

export function useSipReminders(): RemindersValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSipReminders must be used within SipRemindersProvider");
  return ctx;
}
