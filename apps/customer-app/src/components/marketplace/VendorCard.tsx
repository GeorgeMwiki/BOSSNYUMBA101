'use client';

import Link from 'next/link';

interface VendorCardProps {
  id: string;
  name: string;
  category: string;
  image?: string;
  rating?: number;
  price?: string;
}

export function VendorCard({ name, category, image, rating, price }: VendorCardProps) {
  return (
    <Link href={`/marketplace/${name.toLowerCase().replace(/\s/g, '-')}`} className="vendor-card">
      <div className="aspect-[3/4] bg-surface-elevated relative overflow-hidden">
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl font-bold text-spotify-green opacity-50">
              {name.charAt(0)}
            </span>
          </div>
        )}
        {price && (
          <span className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-sm font-semibold px-2 py-1 rounded text-center">
            {price}
          </span>
        )}
      </div>
      <div className="p-2">
        <p className="font-semibold text-sm truncate">{name}</p>
        <p className="text-xs text-gray-500 truncate">{category}</p>
        {rating !== undefined && (
          <p className="text-xs text-spotify-green mt-0.5">★ {rating}</p>
        )}
      </div>
    </Link>
  );
}
