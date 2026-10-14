import React from 'react';
import { X, Download } from 'lucide-react';

interface LightboxModalProps {
  src: string;
  caption?: string;
  onClose: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  src,
  caption,
  onClose,
}) => {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <a
          href={src}
          download={caption || 'block_image'}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          title="Scarica / Apri a dimensione intera"
        >
          <Download className="w-5 h-5" />
        </a>
        <button
          onClick={onClose}
          className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          title="Chiudi"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-4xl max-h-[85vh] flex flex-col items-center"
      >
        <img
          src={src}
          alt={caption || 'Preview'}
          className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
          referrerPolicy="no-referrer"
        />
        {caption && (
          <p className="mt-3 text-sm text-neutral-300 text-center font-medium max-w-xl">
            {caption}
          </p>
        )}
      </div>
    </div>
  );
};
