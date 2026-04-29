"use client";

import { useEffect, useState } from 'react';
import { useRef } from 'react';
import { useParams } from 'next/navigation';
import api from '../../../lib/api.js';

function resolveApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const configured = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    if (!configured || configured.includes('localhost') || configured.includes('127.0.0.1')) {
      return `${window.location.protocol}//${window.location.hostname}:4000`;
    }
    return configured;
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
}

const API_BASE_URL = resolveApiBaseUrl();

export default function WatchPage() {
  const params = useParams();
  const videoId = params.videoId;
  const [video, setVideo] = useState(null);
  const [message, setMessage] = useState('Loading stream...');
  const [videoSrc, setVideoSrc] = useState('');
  const videoRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function loadVideo() {
      try {
        const response = await api.get('/api/videos/catalog');
        const found = response.data.videos.find((item) => String(item.id) === String(videoId));
        if (mounted) {
          setVideo(found || null);
          setMessage('');

          if (found) {
            try {
              const tokenResp = await api.post(`/api/videos/token/${videoId}`);
              const token = tokenResp.data?.token;
              if (token) {
                setVideoSrc(`${API_BASE_URL}/api/videos/stream/${videoId}?token=${encodeURIComponent(token)}`);
              } else {
                setMessage('Could not obtain stream token.');
              }
            } catch (err) {
              setMessage(err?.response?.data?.message || 'Failed to obtain stream token.');
            }
          }
        }
      } catch (error) {
        if (mounted) {
          setMessage(error?.response?.data?.message || 'Unable to load stream metadata.');
        }
      }
    }

    loadVideo();
    return () => {
      mounted = false;
    };
  }, [videoId]);

  async function pushHistory(completed = false) {
    if (!videoRef.current) {
      return;
    }

    try {
      await api.post('/api/videos/history', {
        videoId,
        positionSeconds: Math.floor(videoRef.current.currentTime || 0),
        completed
      });
    } catch {
      // Ignore telemetry-style history failures on client UX.
    }
  }

  return (
    <div className="playflix-shell py-8 md:py-12">
      <div className="glass-panel overflow-hidden rounded-[36px] p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-white/45">Now playing</div>
            <h1 className="heading-font mt-3 text-4xl font-bold text-white">{video?.title || 'PlayFlix Stream'}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">A focused playback view with cinema-style controls and a clean watch experience.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white/72">
            <div className="text-xs uppercase tracking-[0.35em] text-white/45">Status</div>
            <div className="mt-2">{message || 'Ready'}</div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[30px] border border-white/10 bg-black">
          <video
            ref={videoRef}
            controls
            autoPlay={false}
            playsInline
            crossOrigin="use-credentials"
            className="aspect-video w-full"
            src={videoSrc || `${API_BASE_URL}/api/videos/stream/${videoId}`}
            onPause={() => pushHistory(false)}
            onEnded={() => pushHistory(true)}
          />
        </div>
      </div>
    </div>
  );
}
