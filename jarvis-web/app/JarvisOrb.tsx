"use client";

import styles from "./orb.module.css";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

export default function JarvisOrb({ state }: { state: OrbState }) {
  return (
    <div className={styles.wrap} data-state={state}>
      <svg className={styles.svg} viewBox="0 0 260 260">
        {/* anillo HUD fino, de fondo */}
        <circle className={styles.ringOuter} cx="130" cy="130" r="118" />

        {/* orejas */}
        <rect className={styles.ear} x="48" y="108" width="20" height="44" rx="10" />
        <rect className={styles.ear} x="192" y="108" width="20" height="44" rx="10" />

        {/* cabeza */}
        <rect className={styles.head} x="68" y="66" width="124" height="116" rx="34" />

        {/* ojos */}
        <g className={styles.eyes}>
          <rect className={styles.eye} x="100" y="112" width="18" height="26" rx="8" />
          <rect className={styles.eye} x="142" y="112" width="18" height="26" rx="8" />
        </g>

        {/* boca / indicador de habla */}
        <rect className={styles.mouth} x="112" y="158" width="36" height="6" rx="3" />
      </svg>

      <div className={styles.bars} aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className={styles.bar} />
        ))}
      </div>
    </div>
  );
}
