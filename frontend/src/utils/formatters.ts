export function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function formatDecimal(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) return value

  const whole = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = (match[3] ?? '').padEnd(2, '0')
  return `${match[1]}${whole}.${fraction}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}