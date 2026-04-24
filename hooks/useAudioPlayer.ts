import { useCallback, useEffect, useRef, useState } from 'react';
import { SOUND_MAP, getSoundPath } from '../constants/soundMap';

export interface AudioPlayerOptions {
    volume?: number;
    autoPlay?: boolean;
}

interface QueuedAnnouncement {
    ticketNumber: string;
    counterName: string;
    id: string; // Unique identifier for tracking
}

/**
 * Custom Hook for Audio-based Ticket Announcement System
 * 
 * Features:
 * - File stitching (concatenates pre-recorded audio files)
 * - Sequential playback (plays files one after another)
 * - Queue management (handles multiple announcements)
 * - Automatic cleanup on unmount or when new announcement is queued
 * 
 * Example usage:
 * const { playAnnouncement, isPlaying, queue } = useAudioPlayer();
 * playAnnouncement('A001', '01'); // Plays: dingdong + intro + A + 0 + 0 + 1 + counter + 0 + 1
 */
export const useAudioPlayer = (options?: AudioPlayerOptions) => {
    const { volume = 1.0, autoPlay = true } = options || {};

    // State management
    const [isPlaying, setIsPlaying] = useState(false);
    const [queueLength, setQueueLength] = useState(0);
    const [currentlyPlaying, setCurrentlyPlaying] = useState<QueuedAnnouncement | null>(null);
    const [audioUnlocked, setAudioUnlocked] = useState(false);

    // Refs for managing audio playback
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);
    const playlistRef = useRef<string[]>([]);
    const currentIndexRef = useRef(0);
    const announcementQueueRef = useRef<QueuedAnnouncement[]>([]);
    const isPlayingRef = useRef(false);
    const currentAnnouncementRef = useRef<QueuedAnnouncement | null>(null);

    // Unlock audio on user interaction
    useEffect(() => {
        const handleUserInteraction = () => {
            if (!audioUnlocked) {
                console.log('[AudioPlayer] Audio unlocked via user interaction (click/keypress)');
                setAudioUnlocked(true);

                // Try to play silent audio to fully unlock browser policy
                const silentAudio = new Audio();
                silentAudio.src = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';
                silentAudio.play().catch(e => console.log('[AudioPlayer] Silent unlock attempt:', e.message));
            }
        };

        // Add listeners for user interaction (no 'once' - we remove them on cleanup)
        document.addEventListener('click', handleUserInteraction);
        document.addEventListener('keypress', handleUserInteraction);
        document.addEventListener('touchstart', handleUserInteraction);

        return () => {
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keypress', handleUserInteraction);
            document.removeEventListener('touchstart', handleUserInteraction);
        };
    }, []);

    // When audio is unlocked, play any queued announcements
    useEffect(() => {
        if (audioUnlocked && announcementQueueRef.current.length > 0 && !isPlayingRef.current) {
            console.log(`[AudioPlayer] Audio unlocked! Processing ${announcementQueueRef.current.length} queued announcements`);
            // Will be handled after playAnnouncement is defined
        }
    }, [audioUnlocked]);

    /**
     * Convert ticket number and counter name to a playlist of sound file paths
     * 
     * Logic:
     * 1. Start with dingdong sound (notification)
     * 2. Add intro ("Mời khách số")
     * 3. Break down ticket number into individual characters
     * 4. Add counter sound ("đến quầy")
     * 5. Break down counter name into individual digits
     * 
     * Example:
     * Input: ticketNumber="A001", counterName="01"
     * Output: ['dingdong.mp3', 'intro.mp3', 'A.mp3', '0.mp3', '0.mp3', '1.mp3', 'counter.mp3', '0.mp3', '1.mp3']
     */
    const generatePlaylist = useCallback(
        (ticketNumber: string, counterName: string): string[] => {
            const playlist: string[] = [];

            try {
                // 1. Notification sound
                if (SOUND_MAP.dingdong) {
                    playlist.push(SOUND_MAP.dingdong);
                }

                // 2. Intro ("Mời khách số")
                if (SOUND_MAP.intro) {
                    playlist.push(SOUND_MAP.intro);
                }

                // 3. Ticket number characters
                for (const char of ticketNumber.toUpperCase()) {
                    const soundPath = getSoundPath(char);
                    if (soundPath) {
                        playlist.push(soundPath);
                    } else {
                        console.warn(`[AudioPlayer] No sound found for character: ${char}`);
                    }
                }

                // 4. Counter announcement ("đến quầy")
                if (SOUND_MAP.counter) {
                    playlist.push(SOUND_MAP.counter);
                }

                // 5. Counter number digits
                for (const digit of counterName) {
                    const soundPath = getSoundPath(digit);
                    if (soundPath) {
                        playlist.push(soundPath);
                    } else {
                        console.warn(`[AudioPlayer] No sound found for digit: ${digit}`);
                    }
                }

                console.log(`[AudioPlayer] Generated playlist for ${ticketNumber}/${counterName}:`, playlist);
                return playlist;
            } catch (error) {
                console.error('Error generating playlist:', error);
                return [];
            }
        },
        []
    );

    /**
     * Clean up the current audio element
     */
    const cleanupAudio = useCallback(() => {
        if (currentAudioRef.current) {
            try {
                currentAudioRef.current.pause();
                currentAudioRef.current.src = '';
                currentAudioRef.current.load();
            } catch (error) {
                console.error('Error cleaning up audio:', error);
            }
            currentAudioRef.current = null;
        }
    }, []);

    /**
     * Play the next file in the playlist
     */
    const playNextFile = useCallback((): void => {
        if (currentIndexRef.current >= playlistRef.current.length) {
            // Playlist finished, move to next announcement in queue
            cleanupAudio();
            isPlayingRef.current = false;
            setIsPlaying(false);
            currentAnnouncementRef.current = null;
            setCurrentlyPlaying(null);

            // Process next item in queue
            if (announcementQueueRef.current.length > 0) {
                const nextAnnouncement = announcementQueueRef.current.shift();
                setQueueLength(announcementQueueRef.current.length);
                if (nextAnnouncement) {
                    playAnnouncement(nextAnnouncement.ticketNumber, nextAnnouncement.counterName);
                }
            }
            return;
        }

        try {
            // Create or reuse audio element
            if (!currentAudioRef.current) {
                currentAudioRef.current = new Audio();
                currentAudioRef.current.volume = volume;
            }

            const audioPath = playlistRef.current[currentIndexRef.current];
            currentAudioRef.current.src = audioPath;

            // Handle audio ended event
            currentAudioRef.current.onended = () => {
                currentIndexRef.current++;
                playNextFile();
            };

            // Handle errors
            currentAudioRef.current.onerror = (e) => {
                console.warn(`[AudioPlayer] Error loading audio file: ${audioPath}`, e);
                currentIndexRef.current++;
                playNextFile();
            };

            // Play the audio
            const playPromise = currentAudioRef.current.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        // Audio playback started successfully
                    })
                    .catch((error: any) => {
                        // Ignore AbortError which occurs when play is interrupted
                        if (error.name !== 'AbortError') {
                            console.warn(`[AudioPlayer] Error playing ${audioPath}:`, error.name);
                        }
                        currentIndexRef.current++;
                        playNextFile();
                    });
            }
        } catch (error) {
            console.error('[AudioPlayer] Error in playNextFile:', error);
            currentIndexRef.current++;
            playNextFile();
        }
    }, [volume, cleanupAudio]);

    /**
     * Main function to play an announcement
     * Generates playlist and starts playback
     * If already playing, queues the announcement
     */
    const playAnnouncement = useCallback(
        (ticketNumber: string, counterName: string) => {
            try {
                const announcement: QueuedAnnouncement = {
                    ticketNumber,
                    counterName,
                    id: `${Date.now()}-${Math.random()}`,
                };

                // If audio not yet unlocked (no user interaction), queue it
                if (!audioUnlocked) {
                    announcementQueueRef.current.push(announcement);
                    setQueueLength(announcementQueueRef.current.length);
                    console.log(
                        `[AudioPlayer] Announcement queued (waiting for user interaction): ${ticketNumber} (${counterName}). Queue length: ${announcementQueueRef.current.length}`
                    );
                    return;
                }

                // If already playing, add to queue
                if (isPlayingRef.current) {
                    announcementQueueRef.current.push(announcement);
                    setQueueLength(announcementQueueRef.current.length);
                    console.log(
                        `[AudioPlayer] Announcement queued: ${ticketNumber} (${counterName}). Queue length: ${announcementQueueRef.current.length}`
                    );
                    return;
                }

                // Start new announcement
                console.log(`[AudioPlayer] Playing announcement: ${ticketNumber} (${counterName})`);
                const playlist = generatePlaylist(ticketNumber, counterName);

                if (playlist.length === 0) {
                    console.warn(
                        `[AudioPlayer] No audio files generated for ticket ${ticketNumber} at counter ${counterName}`
                    );
                    return;
                }

                // Set up for playback
                playlistRef.current = playlist;
                currentIndexRef.current = 0;
                isPlayingRef.current = true;
                currentAnnouncementRef.current = announcement;
                setIsPlaying(true);
                setCurrentlyPlaying(announcement);

                // Start playback
                playNextFile();
            } catch (error) {
                console.error('[AudioPlayer] Error in playAnnouncement:', error);
                isPlayingRef.current = false;
                setIsPlaying(false);
            }
        },
        [generatePlaylist, playNextFile]
    );

    /**
     * Cancel current announcement and clear queue
     */
    const stopAnnouncement = useCallback(() => {
        cleanupAudio();
        playlistRef.current = [];
        currentIndexRef.current = 0;
        announcementQueueRef.current = [];
        isPlayingRef.current = false;
        currentAnnouncementRef.current = null;
        setIsPlaying(false);
        setCurrentlyPlaying(null);
        setQueueLength(0);
    }, [cleanupAudio]);

    // Track previous unlock state to detect transition
    const wasUnlockedRef = useRef(false);

    /**
     * Process queued announcements when audio is unlocked
     */
    useEffect(() => {
        if (audioUnlocked && !wasUnlockedRef.current) {
            console.log('[AudioPlayer] Audio just unlocked! Processing queued announcements...');
            wasUnlockedRef.current = true;

            // Process queue
            if (announcementQueueRef.current.length > 0 && !isPlayingRef.current) {
                const timer = setTimeout(() => {
                    const nextAnnouncement = announcementQueueRef.current.shift();
                    setQueueLength(announcementQueueRef.current.length);
                    if (nextAnnouncement) {
                        console.log(`[AudioPlayer] Playing queued announcement: ${nextAnnouncement.ticketNumber} (${nextAnnouncement.counterName})`);
                        const playlist = generatePlaylist(nextAnnouncement.ticketNumber, nextAnnouncement.counterName);
                        if (playlist.length > 0) {
                            playlistRef.current = playlist;
                            currentIndexRef.current = 0;
                            isPlayingRef.current = true;
                            currentAnnouncementRef.current = nextAnnouncement;
                            setIsPlaying(true);
                            setCurrentlyPlaying(nextAnnouncement);
                            playNextFile();
                        }
                    }
                }, 100);
                return () => clearTimeout(timer);
            }
        } else if (!audioUnlocked) {
            wasUnlockedRef.current = false;
        }
    }, [audioUnlocked]);

    /**
     * Get current queue info (excluding currently playing)
     */
    const getQueueInfo = useCallback((): QueuedAnnouncement[] => {
        return [...announcementQueueRef.current];
    }, []);

    /**
     * Cleanup on unmount
     */
    useEffect(() => {
        return () => {
            cleanupAudio();
        };
    }, [cleanupAudio]);

    /**
     * Update volume dynamically
     */
    useEffect(() => {
        if (currentAudioRef.current) {
            currentAudioRef.current.volume = volume;
        }
    }, [volume]);

    return {
        /**
         * Play an announcement with the given ticket number and counter name
         * If already playing, queues the announcement
         */
        playAnnouncement,

        /**
         * Stop current announcement and clear queue
         */
        stopAnnouncement,

        /**
         * Whether audio is currently playing
         */
        isPlaying,

        /**
         * Number of announcements waiting in queue
         */
        queueLength,

        /**
         * Currently playing announcement info
         */
        currentlyPlaying,

        /**
         * Get queued announcements (excluding currently playing)
         */
        getQueueInfo,

        /**
         * Generate playlist without playing (for debugging)
         */
        generatePlaylist,
    };
};

export default useAudioPlayer;
