import {
  PAYMENT_CADENCE_MONTHS,
  type PaymentCadence,
} from "@/lib/types";
import { addDays, addMonths } from "@/lib/utils";

/**
 * The arithmetic a payment plan is laid out with (0075 §2).
 *
 * Pure, and in its own module rather than beside the server action that uses
 * it, for one reason: the create form shows the client a PREVIEW of the twelve
 * dates it is about to write, and a preview computed by different code from the
 * thing it previews is a preview that eventually lies. Both sides import this.
 */

/** How many payments a plan may hold. Ten years of monthly — see the action. */
export const MAX_PAYMENTS = 120;

/**
 * The nth payment date of a plan.
 *
 * Every date is computed from the START, never by stepping off the previous
 * one. Stepping accumulates the month-end clamp — a plan beginning on the 31st
 * would slide to the 28th in February and then stay there for the rest of the
 * year, quietly moving ten payment dates the client agreed to.
 */
export function paymentDate(
  startsOn: string,
  cadence: PaymentCadence,
  index: number
): string {
  if (cadence === "weekly") return addDays(startsOn, 7 * index);
  return addMonths(startsOn, PAYMENT_CADENCE_MONTHS[cadence] * index);
}

/**
 * How many payments fit between two dates at this cadence.
 *
 * Inclusive of both ends: a plan running 1 Jan → 1 Dec monthly is twelve
 * payments, not eleven. Used when somebody gives an end date instead of a
 * count, which is the other way people describe the same agreement.
 */
export function countBetween(
  startsOn: string,
  endsOn: string,
  cadence: PaymentCadence
): number | null {
  if (endsOn < startsOn) return null;
  let count = 0;
  while (count < MAX_PAYMENTS && paymentDate(startsOn, cadence, count) <= endsOn) {
    count += 1;
  }
  return count > 0 ? count : null;
}

/**
 * Split a total across N payments without losing a cent.
 *
 * Every payment is the rounded share except the LAST, which absorbs whatever
 * the rounding left over. $1,000 in three is 333.33 / 333.33 / 333.34 — the
 * alternative is a plan that adds up to $999.99 and a client who notices.
 */
export function splitTotal(total: number, count: number): number[] {
  if (count <= 0) return [];
  const each = Math.round((total / count) * 100) / 100;
  const amounts = Array.from({ length: count }, () => each);
  const drift = Math.round((total - each * count) * 100) / 100;
  amounts[count - 1] = Math.round((each + drift) * 100) / 100;
  return amounts;
}

/**
 * The schedule a set of form answers implies — the one function the create
 * form's preview and the create action both go through.
 *
 * `each` wins over `total` when both are given: it is the more specific
 * statement, and it is the one the client was quoted. Neither given means no
 * schedule, which is a legitimate half-step (a bespoke plan built row by row),
 * not an error.
 */
export function layOutSchedule({
  startsOn,
  cadence,
  count,
  each,
  total,
}: {
  startsOn: string;
  cadence: PaymentCadence;
  count: number;
  each: number | null;
  total: number | null;
}): { seq: number; amount: number; due_on: string }[] {
  const capped = Math.max(0, Math.min(count, MAX_PAYMENTS));
  const amounts = each
    ? Array.from({ length: capped }, () => each)
    : total
      ? splitTotal(total, capped)
      : [];

  return amounts.map((amount, index) => ({
    seq: index + 1,
    amount,
    due_on: paymentDate(startsOn, cadence, index),
  }));
}
