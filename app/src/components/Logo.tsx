export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="OK2Merge"
    >
      <rect x="0" y="0" width="1024" height="1024" fill="#0D1117" />
      <g transform="rotate(-8 512 512)">
        <circle
          cx="512"
          cy="512"
          r="330"
          fill="none"
          stroke="#22C55E"
          strokeWidth="64"
        />
        <circle
          cx="512"
          cy="512"
          r="232"
          fill="none"
          stroke="#22C55E"
          strokeWidth="18"
          opacity="0.5"
        />
        <path
          d="M417 525 L487 595 L607 465"
          fill="none"
          stroke="#F6F8FA"
          strokeWidth="64"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M547 465 H607 V525"
          fill="none"
          stroke="#F6F8FA"
          strokeWidth="64"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
