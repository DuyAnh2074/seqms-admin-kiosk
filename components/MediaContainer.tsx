import React, { useState, useEffect, useRef } from 'react';

interface Media {
    id: number;
    file_type: 'image' | 'video';
    file_url: string;
    description: string | null;
    sort_order: number;
}

interface MediaContainerProps {
    mediaFiles: Media[];
}

const MediaContainer = React.memo(
    ({ mediaFiles }: MediaContainerProps) => {
        const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
        const videoRef = useRef<HTMLVideoElement>(null);

        const currentMedia = mediaFiles.length > 0 ? mediaFiles[currentMediaIndex] : null;

        // Handle image slideshow
        useEffect(() => {
            if (!currentMedia || currentMedia.file_type === 'video') {
                return; // Don't auto-rotate for videos
            }

            const timer = setTimeout(() => {
                setCurrentMediaIndex((prev) => (prev + 1) % mediaFiles.length);
            }, 5000); // Change image every 5 seconds

            return () => clearTimeout(timer);
        }, [currentMediaIndex, currentMedia, mediaFiles.length]);

        // Handle video ended event
        const handleVideoEnded = () => {
            setCurrentMediaIndex((prev) => (prev + 1) % mediaFiles.length);
        };

        // When media index changes, auto-play if it's a video
        useEffect(() => {
            if (videoRef.current && currentMedia?.file_type === 'video') {
                videoRef.current.play().catch((err) => {
                    console.warn('Auto-play failed:', err);
                });
            }
        }, [currentMediaIndex, currentMedia]);

        if (mediaFiles.length === 0) {
            return (
                <div className="h-full flex items-center justify-center bg-slate-900">
                    <p className="text-3xl text-slate-500 font-bold uppercase tracking-widest">
                        Chưa có media nào được tải lên
                    </p>
                </div>
            );
        }

        if (!currentMedia) {
            return null;
        }

        return (
            <>
                {currentMedia.file_type === 'image' ? (
                    <img
                        key={`image-${currentMedia.id}`}
                        src={currentMedia.file_url}
                        alt={`Slide ${currentMedia.id}`}
                        className="w-full h-full object-cover"
                        loading="eager"
                        fetchPriority="high"
                    />
                ) : (
                    <video
                        key={`video-${currentMedia.id}`}
                        ref={videoRef}
                        src={currentMedia.file_url}
                        autoPlay
                        muted
                        preload="metadata"
                        onEnded={handleVideoEnded}
                        className="w-full h-full object-cover"
                        style={{ display: 'block' }}
                    />
                )}
            </>
        );
    },
    (prevProps, nextProps) => {
        if (prevProps.mediaFiles.length !== nextProps.mediaFiles.length) {
            return false;
        }

        // Compare each media object's id and url
        return prevProps.mediaFiles.every(
            (media, index) =>
                nextProps.mediaFiles[index] &&
                media.id === nextProps.mediaFiles[index].id &&
                media.file_url === nextProps.mediaFiles[index].file_url
        );
    }
);

MediaContainer.displayName = 'MediaContainer';

export default MediaContainer;
