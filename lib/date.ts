export function hojeISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' }).format(new Date())
}
