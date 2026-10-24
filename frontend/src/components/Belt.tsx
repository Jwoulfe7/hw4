// A grosgrain ribbon belt with a brass D-ring: the section divider of choice.
export default function Belt({ variant = 'navy' }: { variant?: 'navy' | 'red' | 'madras' }) {
  return (
    <div className={`belt belt-${variant}`} aria-hidden="true">
      <span className="belt-tab" />
      <span className="belt-ring" />
    </div>
  )
}
