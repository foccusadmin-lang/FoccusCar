"use client";

import Image from "next/image";
import { useState } from "react";

/** Galeria da vitrine (seção 27): foto principal e miniaturas; toque troca a foto. */
export function Gallery({ photos, fallback, alt }: { photos: string[]; fallback: string; alt: string }) {
  const [index, setIndex] = useState(0);
  const list = photos.length ? photos : [fallback];
  const current = list[Math.min(index, list.length - 1)]!;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="vehicle-media">
          <Image src={current} alt={alt} fill priority sizes="(max-width: 960px) 100vw, 60vw" unoptimized={current.startsWith("/api/")} />
        </div>
      </div>
      {list.length > 1 && (
        <div className="thumbs" role="list" aria-label="Fotos do veículo">
          {list.map((src, i) => (
            <button key={src} type="button" role="listitem" className={i === index ? "thumb active" : "thumb"} onClick={() => setIndex(i)} aria-label={`Foto ${i + 1} de ${list.length}`} aria-pressed={i === index}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
