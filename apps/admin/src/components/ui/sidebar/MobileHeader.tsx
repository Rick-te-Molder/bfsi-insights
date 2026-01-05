import Link from 'next/link';

interface MobileHeaderProps {
  isOpen: boolean;
  onToggle: () => void;
}

function LogoLink() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="text-lg font-normal tracking-tight text-white">BFSI</span>
      <span className="text-xs font-bold uppercase text-sky-400">Admin</span>
    </Link>
  );
}

function CloseIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

export function MobileHeader({ isOpen, onToggle }: Readonly<MobileHeaderProps>) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 md:hidden">
      <LogoLink />
      <button
        onClick={onToggle}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        {isOpen ? <CloseIcon /> : <MenuIcon />}
      </button>
    </div>
  );
}
