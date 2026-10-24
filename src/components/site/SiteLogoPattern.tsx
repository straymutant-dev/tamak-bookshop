const LOGOS = Array.from({ length: 256 }, (_, index) => {
  const randomValue = (seed: number) => {
    const value = Math.sin((index + 1) * seed) * 10_000;
    return value - Math.floor(value);
  };

  return {
    width: `${4.5 + randomValue(39.346)}rem`,
    rotation: `${Math.round(randomValue(54.532) * 360 - 180)}deg`,
  };
});

export default function SiteLogoPattern({ variant = 'site' }: { variant?: 'site' | 'auth' }) {
  return (
    <div className={`site-logo-pattern site-logo-pattern--${variant}`} aria-hidden="true">
      {LOGOS.map((logo, index) => (
        <span
          key={index}
          className="site-logo-pattern__item"
          style={{
            width: logo.width,
            transform: `rotate(${logo.rotation})`,
          }}
        />
      ))}
    </div>
  );
}
