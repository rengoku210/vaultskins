import { useState, useEffect, useMemo, useRef } from 'react';
import { Maximize2, X, Play, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import './SkinViewer.css';

export default function SkinViewer({ skinNames }) {
  const [allSkins, setAllSkins] = useState([]);
  const [contentTiers, setContentTiers] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedSkinIndex, setSelectedSkinIndex] = useState(0);
  const [selectedLevelIndex, setSelectedLevelIndex] = useState(0);
  
  // Parallax state
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const previewRef = useRef(null);

  // Fullscreen & Media state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  
  const mainVideoRef = useRef(null);
  const fullVideoRef = useRef(null);
  const hoverVideoRefs = useRef({});

  useEffect(() => {
    // Fetch skins and content tiers (rarities)
    api.getValorantCache().then(({ skins, tiers }) => {
      setAllSkins(skins);
      
      const tiersMap = {};
      tiers?.forEach(tier => {
        tiersMap[tier.uuid] = tier.highlightColor;
      });
      setContentTiers(tiersMap);
      
      setLoading(false);
    }).catch(e => {
      console.error("Failed to load valorant DB:", e);
      setLoading(false);
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const matchedSkins = useMemo(() => {
    if (!allSkins.length) return [];
    const placeholder = 'https://via.placeholder.com/600x300/15151e/34d399?text=No+Image';
    
    return skinNames.map(nameOrUuid => {
      const skinMatch = allSkins.find(s => 
        s.uuid === nameOrUuid || s.displayName.toLowerCase() === nameOrUuid.toLowerCase()
      );
      if (skinMatch) return skinMatch;
      return {
        displayName: nameOrUuid,
        displayIcon: placeholder,
        levels: [{ displayName: nameOrUuid, displayIcon: placeholder, streamedVideo: null }]
      };
    });
  }, [skinNames, allSkins]);

  const activeSkin = matchedSkins[selectedSkinIndex];
  const activeLevel = activeSkin?.levels?.[selectedLevelIndex] || activeSkin?.levels?.[0];
  const activeTierColor = contentTiers[activeSkin?.contentTierUuid] ? `#${contentTiers[activeSkin.contentTierUuid].slice(0,6)}` : 'var(--accent-blue)';

  const safeImage = activeLevel?.displayIcon || activeSkin?.displayIcon || 'https://via.placeholder.com/600x300/15151e/34d399?text=No+Image';

  useEffect(() => {
    setVideoError(false);
    setIsMediaLoading(true);
    if (mainVideoRef.current && activeLevel?.streamedVideo) {
      setIsVideoBuffering(true);
      mainVideoRef.current.load();
      mainVideoRef.current.play().catch(() => {});
    } else {
       setIsVideoBuffering(false);
    }
  }, [activeLevel]);

  const handleMouseMove = (e) => {
    if (!previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -10; // Max 10 deg
    const rotateY = ((x - centerX) / centerX) * 10;
    
    setRotation({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
  };

  const playHoverVideo = (idx) => {
    if (hoverVideoRefs.current[idx]) {
      hoverVideoRefs.current[idx].play().catch(() => {});
    }
  };

  const pauseHoverVideo = (idx) => {
    if (hoverVideoRefs.current[idx]) {
      hoverVideoRefs.current[idx].pause();
      hoverVideoRefs.current[idx].currentTime = 0;
    }
  };

  if (loading) return <div className="sv-loading"><Loader2 className="sv-spinner-icon" /></div>;
  if (!matchedSkins.length) return null;

  return (
    <>
      <div className="skin-viewer">
        {/* Main Preview with Parallax */}
        <div 
          className="sv-main-preview" 
          ref={previewRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div 
            className="sv-parallax-container"
            style={{ 
              transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
              boxShadow: `0 20px 40px -10px ${activeTierColor}40`
            }}
          >
            {/* Cinematic Glow Behind */}
            <div className="sv-ambient-glow" style={{ background: activeTierColor }} />

            {/* Skeleton Loader */}
            {isMediaLoading && !videoError && <div className="sv-skeleton" />}

            {activeLevel?.streamedVideo && !videoError ? (
              <>
                {isVideoBuffering && <div className="sv-buffer-overlay"><Loader2 className="sv-spinner-icon" /></div>}
                <video
                  ref={mainVideoRef}
                  className={`sv-media sv-media--video ${isMediaLoading ? 'sv-hidden' : 'sv-visible'}`}
                  src={activeLevel.streamedVideo}
                  autoPlay loop muted playsInline
                  onPlaying={() => { setIsVideoBuffering(false); setIsMediaLoading(false); }}
                  onWaiting={() => setIsVideoBuffering(true)}
                  onError={() => { setVideoError(true); setIsMediaLoading(false); }}
                />
              </>
            ) : null}
            
            <img 
              className={`sv-media sv-media--image ${(activeLevel?.streamedVideo && !videoError) ? 'sv-hidden' : 'sv-visible'}`}
              src={safeImage} 
              alt={activeLevel?.displayName}
              onLoad={() => setIsMediaLoading(false)}
              onError={(e) => { 
                if (e.target.src !== 'https://via.placeholder.com/600x300/15151e/34d399?text=No+Image') {
                  e.target.src = 'https://via.placeholder.com/600x300/15151e/34d399?text=No+Image';
                }
                setIsMediaLoading(false);
              }}
            />
            
            <button className="sv-fullscreen-btn" onClick={() => setIsFullscreen(true)}>
              <Maximize2 size={20} />
            </button>

            <div className="sv-info-overlay">
              <h3 style={{ color: activeTierColor }}>{activeSkin.displayName}</h3>
              {activeLevel?.displayName !== activeSkin.displayName && (
                <span className="sv-level-name">{activeLevel.displayName}</span>
              )}
            </div>
          </div>
        </div>

        {/* Level Selector */}
        {activeSkin.levels && activeSkin.levels.length > 1 && (
          <div className="sv-levels">
            <span className="sv-levels-label">Effect Level:</span>
            <div className="sv-levels-track">
              {activeSkin.levels.map((lvl, idx) => (
                <button 
                  key={lvl.uuid || idx} 
                  className={`sv-level-btn ${selectedLevelIndex === idx ? 'active' : ''}`}
                  onClick={() => setSelectedLevelIndex(idx)}
                >
                  {lvl.streamedVideo ? <Play size={10} style={{ marginRight: 4 }}/> : ''}
                  Lvl {idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Thumbnail Strip (Hover Previews) */}
        <div className="sv-thumbnails-strip">
          <div className="sv-thumbnails-inner">
            {matchedSkins.map((skin, idx) => {
              const isSelected = selectedSkinIndex === idx;
              const thumbUrl = skin.displayIcon || skin.levels?.[0]?.displayIcon || 'https://via.placeholder.com/140x90/15151e/34d399?text=No+Icon';
              const hasVideo = skin.levels?.some(l => l.streamedVideo);
              const tierColor = contentTiers[skin.contentTierUuid] ? `#${contentTiers[skin.contentTierUuid].slice(0,6)}` : 'var(--border-subtle)';

              return (
                <button 
                   key={skin.uuid || idx}
                   className={`sv-thumb ${isSelected ? 'active' : ''}`}
                   style={{ '--tier-color': tierColor }}
                   onClick={() => { setSelectedSkinIndex(idx); setSelectedLevelIndex(0); }}
                   onMouseEnter={() => playHoverVideo(idx)}
                   onMouseLeave={() => pauseHoverVideo(idx)}
                >
                  <div className="sv-thumb-inner">
                    {hasVideo && skin.levels[skin.levels.length - 1].streamedVideo && (
                      <video 
                        ref={el => hoverVideoRefs.current[idx] = el}
                        className="sv-thumb-video"
                        src={skin.levels[skin.levels.length - 1].streamedVideo}
                        muted loop playsInline preload="none"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <img src={thumbUrl} alt="" className="sv-thumb-img" onError={(e) => { e.target.src = 'https://via.placeholder.com/140x90/15151e/34d399?text=No+Icon'; }} />
                    <div className="sv-thumb-glow" style={{ background: tierColor }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fullscreen Cinematic Mode Modal */}
      {isFullscreen && (
        <div className="sv-fullscreen-modal">
          <div className="sv-modal-backdrop" onClick={() => setIsFullscreen(false)} />
          <button className="sv-modal-close" onClick={() => setIsFullscreen(false)}><X size={32} /></button>
          
          <div className="sv-modal-content">
             {(activeLevel?.streamedVideo && !videoError) ? (
              <video
                ref={fullVideoRef}
                className="sv-full-media"
                src={activeLevel.streamedVideo}
                autoPlay loop muted playsInline
                onError={() => setVideoError(true)}
              />
            ) : (
              <img 
                className="sv-full-media"
                src={safeImage} 
                alt={activeLevel?.displayName}
                onError={(e) => { e.target.src = 'https://via.placeholder.com/600x300/15151e/34d399?text=No+Image'; }}
              />
            )}
            <div className="sv-modal-info">
              <h2 style={{ color: activeTierColor, textShadow: `0 0 20px ${activeTierColor}` }}>
                {activeSkin.displayName}
              </h2>
              <p>{activeLevel?.displayName}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
