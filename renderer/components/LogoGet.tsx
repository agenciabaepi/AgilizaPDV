/**
 * Logo "get" em SVG. Usa currentColor no fill para uma cor só (ex.: branco no
 * header escuro, escuro no login). Se a empresa tiver logo customizado (URL),
 * use <img> em vez deste componente.
 */
export function LogoGet({
  className,
  ...props
}: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-20 -120 890 900"
      className={className}
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
      {...props}
    >
      <g>
        <text
          transform="translate(7 601.99)"
          style={{
            fontFamily: 'DecogRegular, Decog, sans-serif',
            fontSize: 700,
            fill: 'currentColor',
            stroke: 'none',
          }}
        >
          <tspan style={{ letterSpacing: '-0.07em' }} x="0" y="0">
            g
          </tspan>
          <tspan style={{ letterSpacing: '-0.03em' }} x="319.9" y="0">
            et
          </tspan>
        </text>
      </g>
    </svg>
  )
}
