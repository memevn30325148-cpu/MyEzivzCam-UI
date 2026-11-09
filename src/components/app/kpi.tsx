export function Kpi({ label, value }: { label: string; value?: string }) {
  return (
    <div className="card">
      <div className="l">{label}</div>
      {value === undefined ? (
        <div className="skel" style={{ height: 30, marginTop: 6, width: '60%' }} />
      ) : (
        <div className="n">{value}</div>
      )}
    </div>
  )
}
