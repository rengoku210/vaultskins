import { useState, useEffect } from 'react';
import { X, Play, Maximize2 } from 'lucide-react';
import './SkinPreviewModal.css';

/**
 * SkinPreviewModal — Lightweight modal for viewing a single skin
 * Props:
 *   skin    : { displayName, weapon, displayIcon, video? } | null
 *   onClose : () => void
 */
export default function SkinPreviewModal({ skin, onClose }) {
  const [videoError, setVideoError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle ESC key
  useEffect(() => {
    if (!skin) return;
    setVideoError(false); // reset on new skin

    const handler = (e) => {
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [skin, onClose, isFullscreen]);

  if (!skin) return null;

  const hasVideo = skin.video || skin.streamedVideo || (skin.levels?.[0]?.streamedVideo);
  const videoSrc = skin.video || skin.streamedVideo || skin.levels?.[0]?.streamedVideo;

  const renderMedia = (className = '') => {
    if (hasVideo && !videoError) {
      return (
        <video
          key={videoSrc}
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          className={`spm-media ${className}`}
          onError={() => setVideoError(true)}
        />
      );
    }
    if (skin.displayIcon) {
      return (
        <img
          src={skin.displayIcon}
          alt={skin.displayName}
          className={`spm-media spm-media--img ${className}`}
          onError={e => { e.target.src = 'https://via.placeholder.com/600x300/15151e/34d399?text=No+Image'; }}
        />
      );
    }
    return (
      <div className="spm-no-preview">
        <Play size={36} />
        <span>No preview available</span>
      </div>
    );
  };

  return (
    <>
      {/* Fullscreen Mode */}
      {isFullscreen && (
        <div className="spm-fullscreen">
          <div className="spm-fullscreen__backdrop" onClick={() => setIsFullscreen(false)} />
          <button className="spm-fullscreen__close" onClick={() => setIsFullscreen(false)}>
            <X size={28} />
          </button>
          <div className="spm-fullscreen__content">
            {renderMedia('spm-fullscreen__media')}
            <div className="spm-fullscreen__label">
              <h2>{skin.displayName}</h2>
              {skin.weapon && <p>{skin.weapon}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Main Modal */}
      <div className="spm-overlay" onClick={onClose}>
        <div
          className="spm-modal"
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={`Preview: ${skin.displayName}`}
        >
          {/* Header */}
          <div className="spm-header">
            <div>
              <h3 className="spm-title">{skin.displayName}</h3>
              {skin.weapon && <p className="spm-subtitle">{skin.weapon}</p>}
            </div>
            <div className="spm-header-actions">
              {(hasVideo && !videoError) && (
                <button
                  className="spm-icon-btn"
                  onClick={() => setIsFullscreen(true)}
                  title="Fullscreen"
                >
                  <Maximize2 size={16} />
                </button>
              )}
              <button className="spm-icon-btn spm-icon-btn--close" onClick={onClose} title="Close">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Media */}
          <div className="spm-body">
            {renderMedia()}
          </div>

          {/* Footer hint */}
          <div className="spm-footer">
            {hasVideo && !videoError ? (
              <span className="spm-footer-hint">
                <Play size={12} style={{ display: 'inline', marginRight: 4 }} />
                Auto-playing skin animation
              </span>
            ) : (
              <span className="spm-footer-hint">Click outside to close</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
