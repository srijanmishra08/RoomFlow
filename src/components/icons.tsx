// Hand-written inline SVG icon set, modeled on Lucide icon shapes.
// 24x24 viewBox, stroke-based, currentColor — no external deps.

export interface IconProps {
  className?: string;
  size?: number;
}

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function LayoutDashboard({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function FolderOpen({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1H6.5a2 2 0 0 0-1.94 1.5L3 18V7Z" />
      <path d="M3 18l2.06-7.5A2 2 0 0 1 7 9h13.5a1 1 0 0 1 .97 1.24l-1.8 7A2 2 0 0 1 17.75 19H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}

export function HardDrive({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <line x1="2.5" y1="13" x2="21.5" y2="13" />
      <path d="M5.5 13 8 4h8l2.5 9" />
      <rect x="2.5" y="13" width="19" height="7" rx="1.5" />
      <circle cx="7" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="11" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CheckSquare({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="m8 12 3 3 6-6.5" />
    </svg>
  );
}

export function CalendarClock({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M8 3v3M16 3v3" />
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <line x1="3.5" y1="10" x2="20.5" y2="10" />
      <circle cx="15" cy="16" r="4" />
      <path d="M15 14.3V16l1.2 1" />
    </svg>
  );
}

export function Users({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="9" cy="8" r="3.3" />
      <path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16 8.2a3.3 3.3 0 1 1 0 6.4" />
      <path d="M17.8 13.8a6.2 6.2 0 0 1 3.4 5.5" />
    </svg>
  );
}

export function Palette({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 21 9.7C21 6 17 3 12 3Z" />
      <circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CreditCard({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.2" />
      <line x1="2.5" y1="9.5" x2="21.5" y2="9.5" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </svg>
  );
}

export function Settings({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  );
}

export function Plus({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  );
}

export function Trash2({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 7h16" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
      <path d="M6 7l1 12.5A2 2 0 0 0 9 21h6a2 2 0 0 0 2-1.5L18 7" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function Menu({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

export function X({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

export function Camera({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.2-2h6.6l1.2 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  );
}

export function ImageIcon({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="3" y="3.5" width="18" height="17" rx="2" />
      <circle cx="8.5" cy="9" r="1.6" />
      <path d="m4 17 4.5-4.5a2 2 0 0 1 2.8 0L15 16" />
      <path d="m13.5 14.5 1.7-1.7a2 2 0 0 1 2.8 0L20.5 15.3" />
    </svg>
  );
}

export function Upload({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 16V4" />
      <path d="m7 8.5 5-4.5 5 4.5" />
      <path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15" />
    </svg>
  );
}

export function Sofa({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M5 12V7.5A1.5 1.5 0 0 1 6.5 6h11A1.5 1.5 0 0 1 19 7.5V12" />
      <path d="M3.5 12h17a1 1 0 0 1 1 1v3a1.5 1.5 0 0 1-1.5 1.5h-16A1.5 1.5 0 0 1 2.5 16v-3a1 1 0 0 1 1-1Z" />
      <path d="M4.5 17.5V20M19.5 17.5V20" />
      <path d="M6 12V9.5M18 12V9.5" />
    </svg>
  );
}

export function Ruler({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="2.5" y="7" width="19" height="10" rx="1.5" transform="rotate(0 12 12)" />
      <path d="M6 7v3M9.5 7v2M13 7v3M16.5 7v2" />
    </svg>
  );
}

export function Building({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="m3 10 9-6 9 6" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M10 21v-5h4v5" />
      <path d="M9 12h.01M15 12h.01M9 15.5h.01M15 15.5h.01" />
    </svg>
  );
}

export function LogOut({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="M16 17l5-5-5-5" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function ChevronRight({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function ExternalLink({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5" />
      <path d="M14.5 3H21v6.5" />
      <line x1="10.5" y1="13.5" x2="20.5" y2="3.5" />
    </svg>
  );
}

export function Copy({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5.5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5v1" />
    </svg>
  );
}

export function Eye({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function Sparkles({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M11 3 12.5 8 18 9.5 12.5 11 11 16.5 9.5 11 4 9.5 9.5 8 11 3Z" />
      <path d="M18.5 14.5 19.3 17 21.5 17.8 19.3 18.6 18.5 21 17.7 18.6 15.5 17.8 17.7 17 18.5 14.5Z" />
    </svg>
  );
}

// Convenience aliases
export const Home = Building;

const Icons = {
  LayoutDashboard,
  FolderOpen,
  HardDrive,
  CheckSquare,
  CalendarClock,
  Users,
  Palette,
  CreditCard,
  Settings,
  Plus,
  Trash2,
  Menu,
  X,
  Camera,
  ImageIcon,
  Upload,
  Sofa,
  Ruler,
  Building,
  Home,
  LogOut,
  ChevronRight,
  ExternalLink,
  Copy,
  Eye,
  Sparkles,
};

export default Icons;

export function Grid({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}

export function Magnet({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M6 15a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1a2 2 0 0 0-2 2v10a1 1 0 0 1-2 0V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2z" />
      <path d="M6 8h5M13 8h5" />
    </svg>
  );
}

export function Undo2({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

export function Redo2({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0-6 6v1" />
    </svg>
  );
}

export function Move({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 2v20M2 12h20" />
      <path d="m9 5 3-3 3 3M9 19l3 3 3-3M5 9 2 12l3 3M19 9l3 3-3 3" />
    </svg>
  );
}

export function RotateCw({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function Scaling({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M21 3 9 15" />
      <path d="M21 8V3h-5" />
      <rect x="3" y="11" width="10" height="10" rx="1.5" />
    </svg>
  );
}

export function Globe({ className, size = 24 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  );
}
