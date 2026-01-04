import Image from 'next/image';

interface CardThumbnailProps {
  thumbnailUrl?: string;
  sourceName: string;
}

function PlaceholderIcon() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg
        className="h-10 w-10 text-neutral-700"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}

function ThumbnailImage({ url, alt }: Readonly<{ url: string; alt: string }>) {
  return (
    <Image
      src={url}
      alt={alt}
      fill
      className="object-cover"
      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      unoptimized
    />
  );
}

export function CardThumbnail({ thumbnailUrl, sourceName }: Readonly<CardThumbnailProps>) {
  return (
    <div
      className="relative mt-2 w-full rounded-md border border-neutral-800 bg-neutral-800/40"
      style={{ aspectRatio: '16 / 9', overflow: 'hidden' }}
    >
      {thumbnailUrl ? (
        <ThumbnailImage url={thumbnailUrl} alt={sourceName || 'Preview'} />
      ) : (
        <PlaceholderIcon />
      )}
    </div>
  );
}
