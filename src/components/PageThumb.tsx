import { memo } from 'react';
import { svgToDataUrl } from '../lib/imageProcessing';

export const PageThumb = memo(function PageThumb({ svg, alt }: { svg: string; alt: string }) {
  return <img src={svgToDataUrl(svg)} alt={alt} loading="lazy" draggable={false} className="h-full w-full object-contain" />;
});
