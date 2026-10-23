// Veg / non-veg marker (green or red square-dot) — no emoji.
export default function VegDot({ veg }) {
  return <span className={`veg-dot ${veg ? 'veg' : 'nonveg'}`} title={veg ? 'Veg' : 'Non-veg'} />;
}
