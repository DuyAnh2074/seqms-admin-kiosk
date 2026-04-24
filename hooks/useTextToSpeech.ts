import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTextToSpeechOptions {
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
}

interface UseTextToSpeechReturn {
    speak: (ticketNumber: string, counterName: string) => void;
    cancel: () => void;
    isSpeaking: boolean;
    isUnlocked: boolean;
}

/**
 * Custom Hook for Text-to-Speech using Web Speech API
 * Specifically designed for ticket announcement with Vietnamese language
 */
const useTextToSpeech = (options?: UseTextToSpeechOptions): UseTextToSpeechReturn => {
    const {
        lang = 'vi-VN',
        rate = 0.85,
        pitch = 1.0,
        volume = 1.0,
    } = options || {};

    const isSpeakingRef = useRef(false);
    const queueRef = useRef<Array<{ text: string; onEnd?: () => void }>>([]);
    const isProcessingRef = useRef(false);
    const voicesCacheRef = useRef<SpeechSynthesisVoice[]>([]);
    const isUnlockedRef = useRef(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isUnlocked, setIsUnlocked] = useState(false);
    /**
     * Convert ticket number to readable format
     * Example: "A001" -> "A, không, không, một"
     * Example: "B123" -> "B, một, hai, ba"
     */
    const formatTicketNumber = (ticketNumber: string): string => {
        const numberMap: { [key: string]: string } = {
            '0': 'không',
            '1': 'một',
            '2': 'hai',
            '3': 'ba',
            '4': 'bốn',
            '5': 'năm',
            '6': 'sáu',
            '7': 'bảy',
            '8': 'tám',
            '9': 'chín',
        };

        // Split ticket number into characters and convert each digit
        const parts: string[] = [];

        for (let i = 0; i < ticketNumber.length; i++) {
            const char = ticketNumber[i];

            if (numberMap[char]) {
                parts.push(numberMap[char]);
            } else {
                // Keep letters as is
                parts.push(char);
            }
        }

        // Join with comma and space for clear pronunciation
        return parts.join(', ');
    };

    /**
     * Extract counter number from counter name
     * Example: "Quầy 1" -> "một", "Counter 5" -> "năm"
     */
    const formatCounterName = (counterName: string): string => {
        const numberMap: { [key: string]: string } = {
            '0': 'không',
            '1': 'một',
            '2': 'hai',
            '3': 'ba',
            '4': 'bốn',
            '5': 'năm',
            '6': 'sáu',
            '7': 'bảy',
            '8': 'tám',
            '9': 'chín',
            '10': 'mười',
        };

        // Try to extract number from counter name
        const match = counterName.match(/\d+/);
        if (match) {
            const number = match[0];
            return numberMap[number] || number;
        }

        return counterName;
    };

    /**
     * Get Vietnamese voice with caching
     */
    const getVietnameseVoice = useCallback((): SpeechSynthesisVoice | null => {
        // Try cached voices first
        if (voicesCacheRef.current.length > 0) {
            const cached = voicesCacheRef.current.find(
                (voice) => voice.lang === 'vi-VN' && voice.name.includes('Google')
            );
            if (cached) return cached;

            const viVoice = voicesCacheRef.current.find((voice) => voice.lang === 'vi-VN');
            if (viVoice) return viVoice;
        }

        // Get fresh voices
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            voicesCacheRef.current = voices;

            const googleVoice = voices.find(
                (voice) => voice.lang === 'vi-VN' && voice.name.includes('Google')
            );
            if (googleVoice) {
                console.log('[TextToSpeech] Using voice:', googleVoice.name);
                return googleVoice;
            }

            const viVoice = voices.find((voice) => voice.lang === 'vi-VN');
            if (viVoice) {
                console.log('[TextToSpeech] Using voice:', viVoice.name);
                return viVoice;
            }
        }

        console.warn('[TextToSpeech] No Vietnamese voice found');
        return null;
    }, []);

    /**
     * Detect user interaction and unlock speech synthesis
     */
    useEffect(() => {
        const handleInteraction = () => {
            // Prime the speech engine (fix Chrome/Edge issues)
            if (window.speechSynthesis) {
                try {
                    // Speak empty string to wake up the engine
                    const primer = new SpeechSynthesisUtterance('');
                    window.speechSynthesis.speak(primer);
                    // Resume to ensure it's active
                    window.speechSynthesis.resume();
                } catch (error) {
                    console.warn('[TextToSpeech] Error priming speech engine:', error);
                }
            }

            // Update both ref and state
            isUnlockedRef.current = true;
            setIsUnlocked(true);
        };

        // Listen for real user interactions
        document.addEventListener('click', handleInteraction, { once: true });
        document.addEventListener('keypress', handleInteraction, { once: true });
        document.addEventListener('touchstart', handleInteraction, { once: true });

        return () => {
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('keypress', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
        };
    }, []);

    /**
     * Play dingdong sound before announcement
     */
    const playDingdong = useCallback((): Promise<void> => {
        return new Promise((resolve) => {
            try {
                if (!audioRef.current) {
                    audioRef.current = new Audio('/sounds/dingdong.mp3');
                    audioRef.current.volume = 0.8; // Increased from 0.7 to 0.8 for better audibility
                }

                // Reset audio to start
                audioRef.current.currentTime = 0;

                const handleEnded = () => {
                    // Remove all listeners to prevent duplicate calls
                    if (audioRef.current) {
                        audioRef.current.removeEventListener('ended', handleEnded);
                        audioRef.current.removeEventListener('error', handleError);
                    }
                    console.log('[TextToSpeech] Dingdong finished');
                    resolve();
                };

                const handleError = (error: Event) => {
                    // Remove all listeners to prevent duplicate calls
                    if (audioRef.current) {
                        audioRef.current.removeEventListener('ended', handleEnded);
                        audioRef.current.removeEventListener('error', handleError);
                    }
                    console.warn('[TextToSpeech] Dingdong audio error:', error);
                    resolve(); // Continue even if dingdong fails
                };

                // Remove any previous listeners before adding new ones
                if (audioRef.current) {
                    audioRef.current.removeEventListener('ended', handleEnded);
                    audioRef.current.removeEventListener('error', handleError);
                }

                audioRef.current.addEventListener('ended', handleEnded);
                audioRef.current.addEventListener('error', handleError);

                console.log('[TextToSpeech] Starting dingdong playback');
                audioRef.current.play().catch((error) => {
                    console.warn('[TextToSpeech] Dingdong play error:', error);
                    // Try to reload audio file in case of corruption
                    if (audioRef.current) {
                        audioRef.current.src = '/sounds/dingdong.mp3';
                    }
                    resolve(); // Continue even if play fails
                });
            } catch (error) {
                console.warn('[TextToSpeech] Dingdong setup error:', error);
                resolve(); // Continue even if setup fails
            }
        });
    }, []);

    /**
     * Process speech queue
     */
    const processQueue = useCallback(() => {
        if (isProcessingRef.current || queueRef.current.length === 0) {
            return;
        }

        if (!window.speechSynthesis) {
            console.error('Web Speech API is not supported in this browser');
            return;
        }

        isProcessingRef.current = true;
        const { text, onEnd } = queueRef.current.shift()!;

        // Play dingdong first, then speak
        playDingdong().then(() => {
            // Resume speech synthesis (Chrome pause bug fix)
            try {
                window.speechSynthesis.resume();
            } catch (e) {
                console.warn('[TextToSpeech] Resume error:', e);
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;
            utterance.rate = rate;
            utterance.pitch = pitch;
            utterance.volume = volume;

            // Get Vietnamese voice with improved logic
            const voice = getVietnameseVoice();
            if (voice) {
                utterance.voice = voice;
            }

            utterance.onstart = () => {
                isSpeakingRef.current = true;
            };

            utterance.onend = () => {
                isSpeakingRef.current = false;
                isProcessingRef.current = false;
                console.log('[TextToSpeech] Speaking ended');

                if (onEnd) {
                    onEnd();
                }

                // Process next item in queue
                if (queueRef.current.length > 0) {
                    setTimeout(processQueue, 100);
                }
            };

            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                isSpeakingRef.current = false;
                isProcessingRef.current = false;

                // Continue with next item even on error
                if (queueRef.current.length > 0) {
                    setTimeout(processQueue, 100);
                }
            };

            window.speechSynthesis.speak(utterance);
        });
    }, [lang, rate, pitch, volume, getVietnameseVoice, playDingdong]);

    /**
     * Add speech to queue and start processing
     */
    const addToQueue = useCallback(
        (text: string, onEnd?: () => void) => {
            queueRef.current.push({ text, onEnd });
            processQueue();
        },
        [processQueue]
    );

    /**
     * Main speak function for ticket announcement
     */
    const speak = useCallback(
        (ticketNumber: string, counterName: string) => {
            const formattedTicket = formatTicketNumber(ticketNumber);
            const formattedCounter = formatCounterName(counterName);

            // Create announcement text
            const announcement = `Mời khách hàng số ${formattedTicket}, đến quầy số ${formattedCounter}`;

            console.log('📢 Announcement:', announcement);

            // Check ref instead of state for immediate response
            if (!isUnlockedRef.current) {
                console.log('[TextToSpeech] Queuing (waiting for user interaction)');
                queueRef.current.push({ text: announcement });
                return;
            }

            addToQueue(announcement);
        },
        [addToQueue]
    );

    /**
     * Cancel all speech
     */
    const cancel = useCallback(() => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            queueRef.current = [];
            isSpeakingRef.current = false;
            isProcessingRef.current = false;
        }
    }, []);

    /**
     * Process queued announcements when unlocked
     */
    useEffect(() => {
        if (isUnlocked && queueRef.current.length > 0 && !isProcessingRef.current) {
            // console.log(`[TextToSpeech] Unlocked! Processing ${queueRef.current.length} queued announcements`);
            setTimeout(processQueue, 100);
        }
    }, [isUnlocked, processQueue]);

    /**
     * Load voices on mount and cache them
     */
    useEffect(() => {
        if (window.speechSynthesis) {
            // Initial load
            const initialVoices = window.speechSynthesis.getVoices();
            if (initialVoices.length > 0) {
                voicesCacheRef.current = initialVoices;
                // console.log(`[TextToSpeech] Loaded ${initialVoices.length} voices on mount`);
            }

            // Listen for voiceschanged event
            const handleVoicesChanged = () => {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    voicesCacheRef.current = voices;
                    //console.log(`[TextToSpeech] Voices updated: ${voices.length} voices available`);
                }
            };

            window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);

            return () => {
                window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
                cancel();
            };
        }
    }, [cancel]);

    return {
        speak,
        cancel,
        isSpeaking: isSpeakingRef.current,
        isUnlocked,
    };
};

export default useTextToSpeech;
