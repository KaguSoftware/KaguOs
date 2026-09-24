// Istanbul, not the device: the whole team shares one working day, and a
// teammate travelling shouldn't be greeted "evening" at 10am in Kadıköy.
export function istanbulGreeting(now: Date | number = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "numeric",
      hour12: false,
    }).format(now)
  );
  return hour < 5 ? "Still up" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
}
