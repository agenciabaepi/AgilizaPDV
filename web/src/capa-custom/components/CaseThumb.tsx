import { useEffect, useId, useState } from 'react';
import { caseGeometry, type PhoneModel } from '../phoneModels';
import { getMockup, loadMockup, type LoadedMockup, type MockupImages } from '../lib/mockups';

export function CaseThumb({ model, className }: { model: PhoneModel; className?: string }) {
  const mockup = getMockup(model.id);
  return mockup ? <PhotoThumb mockup={mockup} model={model} className={className} /> : <DrawnThumb model={model} className={className} />;
}

/** Recorta a foto pela área visível, ignorando a margem transparente do PNG. */
function PhotoThumb({ mockup, model, className }: { mockup: MockupImages; model: PhoneModel; className?: string }) {
  const [loaded, setLoaded] = useState<LoadedMockup | null>(null);
  useEffect(() => {
    let alive = true;
    loadMockup(mockup).then(
      (m) => alive && setLoaded(m),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [mockup]);

  if (!loaded) return <DrawnThumb model={model} className={className} />;
  const b = loaded.photoBox;
  return (
    <svg viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} className={className} aria-hidden>
      <image href={mockup.photo} width={loaded.width} height={loaded.height} />
    </svg>
  );
}

function DrawnThumb({ model, className }: { model: PhoneModel; className?: string }) {
  const clipId = useId();
  const g = caseGeometry(model);
  const c = g.camera;
  return (
    <svg viewBox={`-20 -20 ${g.width + 40} ${g.height + 40}`} className={className} aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <rect width={g.width} height={g.height} rx={g.radius} />
        </clipPath>
      </defs>
      <rect width={g.width} height={g.height} rx={g.radius} fill="#fafafa" />
      <g clipPath={`url(#${clipId})`}>
        <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={c.r} fill="#27272a" />
        {c.lenses.map((l, i) => (
          <circle key={i} cx={l.cx} cy={l.cy} r={l.r} fill="#52525b" stroke="#18181b" strokeWidth={l.r * 0.25} />
        ))}
        {c.flash && <circle cx={c.flash.cx} cy={c.flash.cy} r={c.flash.r} fill="#e7e5e4" />}
      </g>
      <rect width={g.width} height={g.height} rx={g.radius} fill="none" stroke="#d4d4d8" strokeWidth={14} />
    </svg>
  );
}
