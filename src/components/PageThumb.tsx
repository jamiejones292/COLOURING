import { memo } from 'react';
import { svgToDataUrl } from '../lib/imageProcessing';

export const PageThumb = memo(function PageThumb({ svg, src, alt }: { svg?: string; src?: string; alt: string }) {
  return <img src={src ?? svgToDataUrl(svg ?? '')} alt={alt} loading="lazy" draggable={false} className="h-full w-full object-contain" />;
});
