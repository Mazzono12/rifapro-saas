import React, { useEffect, useRef, useState } from 'react';
import { extractVimeoId, extractYouTubeId, getBunnyEmbedUrl } from '../utils/media';
import { SmartAutoPlayVideo } from './SmartAutoPlayVideo';

interface Props {
  mediaUrl: string;
  mediaType: 'video' | 'image' | 'youtube' | 'vimeo' | 'bunny';
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  playWhenVisible?: boolean;
  visibilityThreshold?: number;
  mediaFit?: 'cover' | 'contain' | 'fill';
  alt?: string;
  interactive?: boolean;
  priority?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  poster?: string;
  loop?: boolean;
  playsInline?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  onMetadata?: (width: number, height: number) => void;
}

export function MediaRenderer({ mediaUrl, mediaType, className, autoPlay = true, muted = true, playWhenVisible = false, visibilityThreshold = 0.55, mediaFit = 'cover', alt = "", interactive = true, priority = false, preload = 'metadata', poster, loop = true, playsInline = true, onLoad, onError, onMetadata }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [visible, setVisible] = useState(!playWhenVisible);

  useEffect(() => {
    if (!playWhenVisible) {
      setVisible(true);
      return;
    }
    const target = videoRef.current || iframeRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(entries => {
      const isVisible = Boolean(entries[0]?.isIntersecting && entries[0].intersectionRatio >= visibilityThreshold);
      setVisible(isVisible);
    }, { threshold: [0, visibilityThreshold, 1] });
    observer.observe(target);
    return () => observer.disconnect();
  }, [mediaUrl, playWhenVisible, visibilityThreshold]);

  useEffect(() => {
    if (!playWhenVisible || mediaType !== "video" || !videoRef.current) return;
    if (visible && autoPlay && videoRef.current.dataset.rifaproUserPaused !== "true") {
      videoRef.current.play().catch(() => null);
    } else {
      videoRef.current.pause();
    }
  }, [autoPlay, mediaType, playWhenVisible, visible]);

  if (!mediaUrl) return null;
  const fitClass = mediaFit === 'contain' ? 'object-contain' : mediaFit === 'fill' ? 'object-fill' : 'object-cover';
  const shouldPlay = autoPlay && visible;

  if (mediaType === 'image') {
    return (
      <img 
        src={mediaUrl} 
        alt={alt}
        className={`${fitClass} ${className}`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={event => {
          onMetadata?.(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
          onLoad?.();
        }}
        onError={onError}
      />
    );
  }

  if (mediaType === 'video') {
    if (!autoPlay) {
      return (
        <video
          ref={videoRef}
          src={mediaUrl}
          className={`${fitClass} ${className}`}
          data-rifapro-autoplay="false"
          data-rifapro-muted={String(muted)}
          muted={muted}
          poster={poster}
          preload={preload}
          loop={loop}
          playsInline={playsInline}
          controls={interactive}
          onLoadedMetadata={event => {
            onMetadata?.(event.currentTarget.videoWidth, event.currentTarget.videoHeight);
          }}
          onLoadedData={onLoad}
          onError={onError}
        />
      );
    }

    return (
      <SmartAutoPlayVideo
        src={mediaUrl}
        className={`${fitClass} ${className}`}
        mutedDefault={muted}
        priority={priority}
        preload={preload}
        controls={false}
        poster={poster}
        loop={loop}
        playsInline={playsInline}
        mediaFit={mediaFit}
        threshold={visibilityThreshold}
        onLoad={onLoad}
        onError={onError}
        onMetadata={onMetadata}
      />
    );
  }

  if (mediaType === 'youtube') {
    const videoId = extractYouTubeId(mediaUrl);
    if (!videoId) return <InvalidMedia className={className} label="Link do YouTube inválido" />;
    
    return (
      <iframe
        ref={iframeRef}
        className={className}
        src={`https://www.youtube.com/embed/${videoId}?autoplay=${shouldPlay ? 1 : 0}&mute=${muted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0`}
        title="YouTube video player"
        frameBorder="0"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    );
  }

  if (mediaType === 'vimeo') {
    const videoId = extractVimeoId(mediaUrl);
    if (!videoId) return <InvalidMedia className={className} label="Link do Vimeo inválido" />;

    return (
      <iframe 
         ref={iframeRef}
         src={`https://player.vimeo.com/video/${videoId}?autoplay=${shouldPlay ? 1 : 0}&loop=1&muted=${muted ? 1 : 0}&title=0&byline=0&portrait=0`} 
         className={className}
         frameBorder="0" 
         sandbox="allow-scripts allow-same-origin allow-presentation"
         referrerPolicy="strict-origin-when-cross-origin"
         allow="autoplay; fullscreen; picture-in-picture" 
      />
    );
  }

  if (mediaType === 'bunny') {
    const embedUrl = getBunnyEmbedUrl(mediaUrl, { autoPlay: shouldPlay, muted, controls: interactive });
    if (!embedUrl) return <InvalidMedia className={className} label="Link do Bunny.net inválido" />;

    return (
      <iframe
        ref={iframeRef}
        src={embedUrl}
        className={className}
        title="Bunny Stream video player"
        frameBorder="0"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  return null;
}

function InvalidMedia({ className, label }: { className?: string; label: string }) {
  return (
    <div className={`grid place-items-center bg-black p-4 text-center text-sm font-semibold text-white/75 ${className || ""}`}>
      {label}
    </div>
  );
}
