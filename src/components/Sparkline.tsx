interface SparklineProps {
  values: number[];
  positive: boolean;
  className?: string;
}

export function Sparkline({ values, positive, className = "" }: SparklineProps) {
  if (!values.length) {
    return <div className={`h-12 ${className}`} />;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 200;
  const h = 48;
  const path = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const color = positive ? "var(--brand-positive)" : "var(--brand-negative)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`w-full h-12 ${className}`}>
      <path d={`${path} L${w} ${h} L0 ${h} Z`} fill={color} fillOpacity="0.12" />
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}