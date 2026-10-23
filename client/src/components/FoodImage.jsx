import { useState } from 'react';
import { DEFAULT_PHOTO } from '../utils/foodImage';

// Real food photo. If one file is ever missing it swaps to a default photo
// once; if that also fails it shows a plain neutral block (never an emoji).
export default function FoodImage({ photo, alt = '', className = '', eager = false }) {
  const [src, setSrc] = useState(photo.src);
  const [failed, setFailed] = useState(false);

  if (failed) return <div className={`food-fallback ${className}`} aria-hidden="true" />;
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => {
        if (src !== DEFAULT_PHOTO) setSrc(DEFAULT_PHOTO);
        else setFailed(true);
      }}
    />
  );
}
