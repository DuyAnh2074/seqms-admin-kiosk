

export const SOUND_MAP = {
    // Special announcements
    intro: '/sounds/intro-north.mp3', // "Mời khách số"
    counter: '/sounds/den-quay-north.mp3', // "đến quầy"
    dingdong: '/sounds/dingdong.mp3', // Notification sound

    // Letters (A-Z)
    // Only A, B, C, D, E are available
    A: '/sounds/A-north.mp3',
    B: '/sounds/B-north.mp3',
    C: '/sounds/C-north.mp3',
    D: '/sounds/D-north.mp3',
    E: '/sounds/E-north.mp3',
    F: '/sounds/dingdong.mp3', // Fallback to dingdong if not available
    G: '/sounds/dingdong.mp3',
    H: '/sounds/dingdong.mp3',
    I: '/sounds/dingdong.mp3',
    J: '/sounds/dingdong.mp3',
    K: '/sounds/dingdong.mp3',
    L: '/sounds/dingdong.mp3',
    M: '/sounds/dingdong.mp3',
    N: '/sounds/dingdong.mp3',
    O: '/sounds/dingdong.mp3',
    P: '/sounds/dingdong.mp3',
    Q: '/sounds/dingdong.mp3',
    R: '/sounds/dingdong.mp3',
    S: '/sounds/dingdong.mp3',
    T: '/sounds/dingdong.mp3',
    U: '/sounds/dingdong.mp3',
    V: '/sounds/dingdong.mp3',
    W: '/sounds/dingdong.mp3',
    X: '/sounds/dingdong.mp3',
    Y: '/sounds/dingdong.mp3',
    Z: '/sounds/dingdong.mp3',

    // Numbers (0-9)
    '0': '/sounds/0-north.mp3',
    '1': '/sounds/1-north.mp3',
    '2': '/sounds/2-north.mp3',
    '3': '/sounds/3-north.mp3',
    '4': '/sounds/4-north.mp3',
    '5': '/sounds/5-north.mp3',
    '6': '/sounds/6-north.mp3',
    '7': '/sounds/7-north.mp3',
    '8': '/sounds/8-north.mp3',
    '9': '/sounds/9-north.mp3',
} as const;

export type SoundKey = keyof typeof SOUND_MAP;

/**
 * Get audio file path for a given character
 * @param char - Single character or special key (A-Z, 0-9, intro, counter, dingdong)
 * @returns Audio file path, or null if character not found
 */
export const getSoundPath = (char: string): string | null => {
    const key = char.toUpperCase() as SoundKey;
    return SOUND_MAP[key] || null;
};

/**
 * Validate if all characters in a string have corresponding audio files
 * @param input - String to validate
 * @returns Array of missing characters, empty if all found
 */
export const validateAudioAvailable = (input: string): string[] => {
    const missing: string[] = [];
    for (const char of input.toUpperCase()) {
        if (!getSoundPath(char)) {
            missing.push(char);
        }
    }
    return [...new Set(missing)]; // Remove duplicates
};
