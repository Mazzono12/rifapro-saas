import React, { useEffect, useRef, useState } from 'react';
import { extractVimeoId, extractYouTubeId, getBunnyEmbedUrl } from '../utils/media';

interface Props {
  mediaUrl: string;
  mediaType: 'video' | 'image' | 'youtube' | 'vimeo' | 'bunny';
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  playWhenVisible?: boolean;
  visibilityThreshold?: number;
  mediaFit?: 'cover' | 'contain' | 'fill';
  interactive?: boolean;
}

export function MediaRenderer({ mediaUrl, mediaType, className, autoPlay = true, muted = true, playWhenVisible = false, visibilityThreshold = 0.55, mediaFit = 'cover', interactive = true }: Props) {
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
        alt="Media" 
        className={`${fitClass} ${className}`}
        loading="lazy" 
      />
    );
  }

  if (mediaType === 'video') {
    const toggleVideo = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        video.dataset.rifaproUserPaused = "false";
        video.muted = muted;
        video.play().catch(() => null);
      } else {
        video.dataset.rifaproUserPaused = "true";
        video.pause();
      }
    };

    return (
      <video 
        ref={videoRef}
        src={mediaUrl} 
        className={`${fitClass} ${className}`}
        autoPlay={shouldPlay} 
        data-rifapro-autoplay={String(autoPlay)}
        data-rifapro-muted={String(muted)}
        muted={muted}
        loop 
        playsInline 
        onClick={interactive ? toggleVideo : undefined}
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
