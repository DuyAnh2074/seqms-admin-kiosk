/**
 * Vietnamese Input Method - Word Composition Algorithm
 * Xử lý Telex theo từ (Word-based Processing) thay vì từng ký tự
 */
class VietnameseIM {
    constructor() {
        // Bảng tra cứu nhanh: ký tự có dấu -> ký tự gốc
        this.toneMap = this.buildToneMap();
    }

    /**
     * Entry point: Xử lý phím nhập
     * @param {string} currentText - Toàn bộ nội dung input
     * @param {string} key - Phím vừa nhấn
     * @param {number} cursorPos - Vị trí con trỏ
     * @returns {Object} {text, newCursorPos}
     */
    processKey(currentText, key, cursorPos) {
        if (!key) return { text: currentText, newCursorPos: cursorPos };

        // Xử lý backspace
        if (key === 'Backspace' || key === '{bksp}') {
            return this.handleBackspace(currentText, cursorPos);
        }

        // Chèn ký tự mới vào vị trí cursor
        const before = currentText.substring(0, cursorPos);
        const after = currentText.substring(cursorPos);
        const textWithNewChar = before + key + after;
        const newCursorPos = cursorPos + 1;

        // === BƯỚC 1: Tách từ hiện tại ===
        const wordInfo = this.extractCurrentWord(textWithNewChar, newCursorPos);

        if (!wordInfo || wordInfo.word.length < 2) {
            // Không có từ để xử lý, giữ nguyên
            return { text: textWithNewChar, newCursorPos };
        }
        if (wordInfo.word.length > 7 || wordInfo.word.includes('@')) {
            return { text: textWithNewChar, newCursorPos };
        }

        // === BƯỚC 2: Áp dụng Telex lên toàn bộ từ ===
        const transformedWord = this.transformWord(wordInfo.word);

        // === BƯỚC 3: Thay thế từ cũ bằng từ mới ===
        if (transformedWord !== wordInfo.word) {
            const finalText =
                textWithNewChar.substring(0, wordInfo.startPos) +
                transformedWord +
                textWithNewChar.substring(wordInfo.endPos);

            // === BƯỚC 4: Điều chỉnh cursor position ===
            const cursorShift = transformedWord.length - wordInfo.word.length;
            const finalCursorPos = newCursorPos + cursorShift;

            return { text: finalText, newCursorPos: finalCursorPos };
        }

        return { text: textWithNewChar, newCursorPos };
    }

    /**
     * Tách từ hiện tại dựa trên cursor position
     * @returns {Object} {word, startPos, endPos}
     */
    extractCurrentWord(text, cursorPos) {
        // Tìm ranh giới từ (whitespace, dấu câu)
        const boundary = /[\s\.,;:!?\(\)\[\]{}"""''<>\/\\@#\$%\^&\*\-_=]/;

        let start = cursorPos - 1;
        let end = cursorPos;

        // Quét ngược để tìm đầu từ
        while (start >= 0 && !boundary.test(text[start])) {
            start--;
        }
        start++; // Bỏ qua ký tự boundary

        // Quét tiến để tìm cuối từ
        while (end < text.length && !boundary.test(text[end])) {
            end++;
        }

        const word = text.substring(start, end);
        return { word, startPos: start, endPos: end };
    }

    /**
     * Phát hiện loại dấu thanh hiện tại của từ
     * @param {string} word - Từ cần kiểm tra
     * @returns {number} 0=không dấu, 1=sắc, 2=huyền, 3=hỏi, 4=ngã, 5=nặng
     */
    detectCurrentTone(word) {
        const toneMap = {
            'á': 1, 'ắ': 1, 'ấ': 1, 'é': 1, 'ế': 1, 'í': 1, 'ó': 1, 'ố': 1, 'ớ': 1, 'ú': 1, 'ứ': 1, 'ý': 1,
            'Á': 1, 'Ắ': 1, 'Ấ': 1, 'É': 1, 'Ế': 1, 'Í': 1, 'Ó': 1, 'Ố': 1, 'Ớ': 1, 'Ú': 1, 'Ứ': 1, 'Ý': 1,
            'à': 2, 'ằ': 2, 'ầ': 2, 'è': 2, 'ề': 2, 'ì': 2, 'ò': 2, 'ồ': 2, 'ờ': 2, 'ù': 2, 'ừ': 2, 'ỳ': 2,
            'À': 2, 'Ằ': 2, 'Ầ': 2, 'È': 2, 'Ề': 2, 'Ì': 2, 'Ò': 2, 'Ồ': 2, 'Ờ': 2, 'Ù': 2, 'Ừ': 2, 'Ỳ': 2,
            'ả': 3, 'ẳ': 3, 'ẩ': 3, 'ẻ': 3, 'ể': 3, 'ỉ': 3, 'ỏ': 3, 'ổ': 3, 'ở': 3, 'ủ': 3, 'ử': 3, 'ỷ': 3,
            'Ả': 3, 'Ẳ': 3, 'Ẩ': 3, 'Ẻ': 3, 'Ể': 3, 'Ỉ': 3, 'Ỏ': 3, 'Ổ': 3, 'Ở': 3, 'Ủ': 3, 'Ử': 3, 'Ỷ': 3,
            'ã': 4, 'ẵ': 4, 'ẫ': 4, 'ẽ': 4, 'ễ': 4, 'ĩ': 4, 'õ': 4, 'ỗ': 4, 'ỡ': 4, 'ũ': 4, 'ữ': 4, 'ỹ': 4,
            'Ã': 4, 'Ẵ': 4, 'Ẫ': 4, 'Ẽ': 4, 'Ễ': 4, 'Ĩ': 4, 'Õ': 4, 'Ỗ': 4, 'Ỡ': 4, 'Ũ': 4, 'Ữ': 4, 'Ỹ': 4,
            'ạ': 5, 'ặ': 5, 'ậ': 5, 'ẹ': 5, 'ệ': 5, 'ị': 5, 'ọ': 5, 'ộ': 5, 'ợ': 5, 'ụ': 5, 'ự': 5, 'ỵ': 5,
            'Ạ': 5, 'Ặ': 5, 'Ậ': 5, 'Ẹ': 5, 'Ệ': 5, 'Ị': 5, 'Ọ': 5, 'Ộ': 5, 'Ợ': 5, 'Ụ': 5, 'Ự': 5, 'Ỵ': 5
        };
        for (let char of word) {
            if (toneMap[char]) return toneMap[char];
        }
        return 0;
    }

    /**
     * Xóa tất cả dấu thanh nhưng GIỮ dấu mũ/sừng
     */
    removeAllTonesKeepMarkers(word) {
        const toneToBase = {
            'á': 'a', 'à': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a', 'Á': 'A', 'À': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
            'ắ': 'ă', 'ằ': 'ă', 'ẳ': 'ă', 'ẵ': 'ă', 'ặ': 'ă', 'Ắ': 'Ă', 'Ằ': 'Ă', 'Ẳ': 'Ă', 'Ẵ': 'Ă', 'Ặ': 'Ă',
            'ấ': 'â', 'ầ': 'â', 'ẩ': 'â', 'ẫ': 'â', 'ậ': 'â', 'Ấ': 'Â', 'Ầ': 'Â', 'Ẩ': 'Â', 'Ẫ': 'Â', 'Ậ': 'Â',
            'é': 'e', 'è': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e', 'É': 'E', 'È': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
            'ế': 'ê', 'ề': 'ê', 'ể': 'ê', 'ễ': 'ê', 'ệ': 'ê', 'Ế': 'Ê', 'Ề': 'Ê', 'Ể': 'Ê', 'Ễ': 'Ê', 'Ệ': 'Ê',
            'í': 'i', 'ì': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i', 'Í': 'I', 'Ì': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
            'ó': 'o', 'ò': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o', 'Ó': 'O', 'Ò': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
            'ố': 'ô', 'ồ': 'ô', 'ổ': 'ô', 'ỗ': 'ô', 'ộ': 'ô', 'Ố': 'Ô', 'Ồ': 'Ô', 'Ổ': 'Ô', 'Ỗ': 'Ô', 'Ộ': 'Ô',
            'ớ': 'ơ', 'ờ': 'ơ', 'ở': 'ơ', 'ỡ': 'ơ', 'ợ': 'ơ', 'Ớ': 'Ơ', 'Ờ': 'Ơ', 'Ở': 'Ơ', 'Ỡ': 'Ơ', 'Ợ': 'Ơ',
            'ú': 'u', 'ù': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u', 'Ú': 'U', 'Ù': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
            'ứ': 'ư', 'ừ': 'ư', 'ử': 'ư', 'ữ': 'ư', 'ự': 'ư', 'Ứ': 'Ư', 'Ừ': 'Ư', 'Ử': 'Ư', 'Ữ': 'Ư', 'Ự': 'Ư',
            'ý': 'y', 'ỳ': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y', 'Ý': 'Y', 'Ỳ': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y'
        };
        let result = '';
        for (let char of word) {
            result += toneToBase[char] || char;
        }
        return result;
    }

    /**
     * Áp dụng Telex lên toàn bộ từ với Back-scan Algorithm
     * Hỗ trợ "Bỏ dấu ở cuối từ" (End-of-word accentuation)
     */
    transformWord(word) {
        if (!word || word.length === 0) return word;
        if (word.length > 7) return word; // Giới hạn độ dài từ để tránh lỗi
        let result = word;

        // === BƯỚC 0: VOWEL ESCAPE LOGIC (Thoát dấu mũ) ===
        // Logic này xử lý khi người dùng gõ ký tự gốc (a, e, o, u) sau khi đã có dấu mũ/sừng
        // Ví dụ: đâya -> đaya, tăna -> tana, đême -> deme, tômo -> tomo
        const lastCharVowel = result[result.length - 1]?.toLowerCase();

        if (lastCharVowel === 'a') {
            // Kiểm tra xem có â, Â, ă, Ă không
            if (/[âÂăĂ]/.test(result)) {
                // Thay thế tất cả â -> a, Â -> A, ă -> a, Ă -> A
                result = result
                    .replace(/â/g, 'a')
                    .replace(/Â/g, 'A')
                    .replace(/ă/g, 'a')
                    .replace(/Ă/g, 'A');
                return result;
            }
        } else if (lastCharVowel === 'e') {
            // Kiểm tra xem có ê, Ê không
            if (/[êÊ]/.test(result)) {
                result = result
                    .replace(/ê/g, 'e')
                    .replace(/Ê/g, 'E');
                return result;
            }
        } else if (lastCharVowel === 'o') {
            // Kiểm tra xem có ô, Ô, ơ, Ơ không
            if (/[ôÔơƠ]/.test(result)) {
                result = result
                    .replace(/ô/g, 'o')
                    .replace(/Ô/g, 'O')
                    .replace(/ơ/g, 'o')
                    .replace(/Ơ/g, 'O');
                return result;
            }
        } else if (lastCharVowel === 'u') {
            // Kiểm tra xem có ư, Ư không
            if (/[ưƯ]/.test(result)) {
                result = result
                    .replace(/ư/g, 'u')
                    .replace(/Ư/g, 'U');
                return result;
            }
        } else if (lastCharVowel === 'w') {
            // Kiểm tra xem có ă, Ă, ơ, Ơ, ư, Ư không
            if (/[ăĂơƠưƯ]/.test(result)) {
                result = result
                    .replace(/ă/g, 'a')
                    .replace(/Ă/g, 'A')
                    .replace(/ơ/g, 'o')
                    .replace(/Ơ/g, 'O')
                    .replace(/ư/g, 'u')
                    .replace(/Ư/g, 'U');
                return result;
            }
        }

        let toggled = false;

        // Đ + d -> dd
        if (/đd/i.test(result)) {
            result = result.replace(/đd/g, 'dd').replace(/Đd/g, 'Dd').replace(/đD/g, 'dD').replace(/ĐD/g, 'DD');
            toggled = true;
        }
        // Â + a -> aa
        else if (/âa/i.test(result)) {
            result = result.replace(/âa/g, 'aa').replace(/Âa/g, 'Aa').replace(/âA/g, 'aA').replace(/ÂA/g, 'AA');
            toggled = true;
        }
        // Ê + e -> ee
        else if (/êe/i.test(result)) {
            result = result.replace(/êe/g, 'ee').replace(/Êe/g, 'Ee').replace(/êE/g, 'eE').replace(/ÊE/g, 'EE');
            toggled = true;
        }
        // Ô + o -> oo
        else if (/ôo/i.test(result)) {
            result = result.replace(/ôo/g, 'oo').replace(/Ôo/g, 'Oo').replace(/ôO/g, 'oO').replace(/ÔO/g, 'OO');
            toggled = true;
        }
        // Ă + w -> aw
        else if (/ăw/i.test(result)) {
            result = result.replace(/ăw/g, 'aw').replace(/Ăw/g, 'Aw').replace(/ăW/g, 'aW').replace(/ĂW/g, 'AW');
            toggled = true;
        }

        // QUAN TRỌNG: Nếu đã toggle, trả về ngay, không chạy tiếp các rule dưới
        if (toggled) return result;
        // === QUY TẮC 1: Phụ âm đ (dd → đ) ===
        result = result.replace(/dd/gi, match => match[0] === 'D' ? 'Đ' : 'đ');

        // === QUY TẮC 2: Xử lý phím chức năng ở cuối từ (Back-scan) ===
        // Kiểm tra ký tự cuối cùng có phải là marker không
        const endChar = result[result.length - 1]?.toLowerCase();

        // Bảng chuyển đổi nguyên âm với marker
        const vowelTransform = {
            'w': {
                // aw → ă, ow → ơ, uw → ư
                'a': 'ă', 'A': 'Ă',
                'o': 'ơ', 'O': 'Ơ',
                'u': 'ư', 'U': 'Ư'
            },
            'a': {
                // aa → â
                'a': 'â', 'A': 'Â',
                'ă': 'â', 'Ă': 'Â' // ăa → â
            },
            'e': {
                // ee → ê
                'e': 'ê', 'E': 'Ê'
            },
            'o': {
                // oo → ô
                'o': 'ô', 'O': 'Ô'
            }
        };

        // Nếu ký tự cuối là marker (w, a, e, o)
        if (vowelTransform[endChar]) {
            const transformMap = vowelTransform[endChar];
            if (endChar === 'w') {
                // Ưu tiên xử lý cặp "uo" -> "ươ" trước
                if (/uo/i.test(result)) {
                    result = result.replace(/uo/i, 'ươ').replace(/UO/i, 'ƯƠ').replace(/Uo/i, 'Ươ').replace(/uO/i, 'ưƠ');
                    // Xóa ký tự w ở cuối (do logic replace trên chưa xóa w)
                    result = result.substring(0, result.length - 1);
                    return result; // Return luôn
                }
            }
            // === BACK-SCAN: Quét ngược để tìm nguyên âm hợp lệ ===
            for (let i = result.length - 2; i >= 0; i--) {
                const char = result[i];

                if (transformMap[char]) {
                    // Tìm thấy nguyên âm có thể transform
                    const newVowel = transformMap[char];

                    // Thay thế nguyên âm và xóa marker cuối
                    result = result.substring(0, i) +
                        newVowel +
                        result.substring(i + 1, result.length - 1);

                    break; // Chỉ transform nguyên âm đầu tiên tìm thấy
                }
            }
        }

        // === QUY TẮC 3: Xử lý pattern liền nhau (cho case nhập liên tục) ==   =
        // Các pattern còn sót từ back-scan
        // Xử lý aa -> â
        // Điều kiện: Chưa có â VÀ Không phải là chuỗi aaa
        if (!/[âÂ]/.test(result) && !/aaa/i.test(result)) {
            result = result.replace(/aa/i, match => match[0] === 'A' ? 'Â' : 'â');
        }

        // Xử lý aw -> ă
        if (!/[ăĂ]/.test(result)) {
            result = result.replace(/aw/i, match => match[0] === 'A' ? 'Ă' : 'ă');
        }

        // Xử lý ee -> ê
        // Điều kiện: Chưa có ê VÀ Không phải là chuỗi eee
        if (!/[êÊ]/.test(result) && !/eee/i.test(result)) {
            result = result.replace(/ee/i, match => match[0] === 'E' ? 'Ê' : 'ê');
        }

        // Xử lý oo -> ô
        // Điều kiện: Chưa có ô VÀ Không phải là chuỗi ooo
        if (!/[ôÔ]/.test(result) && !/ooo/i.test(result)) {
            result = result.replace(/oo/i, match => match[0] === 'O' ? 'Ô' : 'ô');
        }

        // Xử lý ow -> ơ
        if (!/[ơƠ]/.test(result)) {
            result = result.replace(/ow/i, match => match[0] === 'O' ? 'Ơ' : 'ơ');
        }

        // Xử lý uw -> ư
        if (!/[ưƯ]/.test(result)) {
            result = result.replace(/uw/i, match => match[0] === 'U' ? 'Ư' : 'ư');
        }

        // === QUY TẮC 4: Dấu thanh (s/f/r/x/j) với HIGHEST PRIORITY cho Escape Tone ===
        const toneMarkers = { s: 1, f: 2, r: 3, x: 4, j: 5 };
        let toneType = 0;
        let toneMarkerChar = null;

        // Quét từ cuối lên để tìm marker (ưu tiên marker gần cursor nhất)
        for (let i = result.length - 1; i >= 0; i--) {
            const char = result[i].toLowerCase();
            if (toneMarkers[char]) {
                // === Kiểm tra vị trí và ngữ cảnh ===
                const nextChar = result[i + 1];
                const ambiguousMarkers = ['x', 's', 'r']; // j và f thường không đứng trước nguyên âm trong tiếng Việt

                if (ambiguousMarkers.includes(char) && nextChar) {
                    // Kiểm tra xem ký tự sau có phải nguyên âm hoặc phụ âm không
                    // Nếu sau là bất kỳ chữ cái nào → BỎ QUA (coi ký tự này là chữ cái bình thường)
                    if (/[aăâeêioôơuưybcdghklmnpqrstvwxz]/i.test(nextChar)) {
                        continue; // Bỏ qua, đây là phụ âm hoặc nguyên âm, không xử lý dấu
                    }
                }
                // 1. KHÔNG xử lý nếu marker ở vị trí đầu tiên (đây là consonant)
                if (i === 0) {
                    continue;
                }

                // 2. PHẢI có ít nhất 1 nguyên âm TRƯỚC marker (không nhất thiết liền kề)
                const beforeMarker = result.substring(0, i);
                const normalizedBefore = this.removeAllTonesKeepMarkers(beforeMarker);
                const hasVowelBefore = /[aăâeêioôơuưy]/i.test(normalizedBefore);

                if (!hasVowelBefore) {
                    continue;
                }

                // === BƯỚC 1 - KIỂM TRA TRÙNG DẤU NGAY LẬP TỨC (HIGHEST PRIORITY) ===
                // Xác định tone marker
                toneType = toneMarkers[char];
                toneMarkerChar = char;

                // Lấy từ KHÔNG BAO GỒM marker để detect tone
                const wordBeforeMarker = result.substring(0, i) + result.substring(i + 1);
                const currentTone = this.detectCurrentTone(wordBeforeMarker);

                // Nếu TRÙNG DẤU → Thực hiện Escape Tone và RETURN NGAY
                if (currentTone === toneType && currentTone !== 0) {
                    // Ví dụ: "đáng" + s (cùng dấu sắc) → "đang" + "s" = "đangs"
                    const wordWithoutTone = this.removeAllTonesKeepMarkers(wordBeforeMarker);
                    return wordWithoutTone + toneMarkerChar;
                }

                // === BƯỚC 2 - KHÔNG TRÙNG DẤU: Xóa marker và tiếp tục xử lý ===
                result = wordBeforeMarker;
                break;
            }
        }

        // === Áp dụng dấu mới (nếu có và không trùng) ===
        if (toneType > 0) {
            result = this.applyToneToWord(result, toneType);
        }

        return result;
    }

    /**
     * Áp dụng dấu thanh vào nguyên âm CHÍNH của từ
     * Quy tắc chính tả tiếng Việt chuẩn (Vietnamese Orthography Rules)
     */
    applyToneToWord(word, toneType) {
        // === BƯỚC 0: XÓA TẤT CẢ DẤU THANH CŨ (Khử đa dấu) ===
        // Trước khi đặt dấu mới, xóa hết dấu thanh cũ (giữ dấu mũ/sừng)
        word = this.removeAllTonesKeepMarkers(word);

        // Map toneType thành ký tự marker
        const toneMarkerMap = { 1: 's', 2: 'f', 3: 'r', 4: 'x', 5: 'j' };
        const toneMarkerChar = toneMarkerMap[toneType] || '';

        // === BƯỚC 0.5: KIỂM TRA CẤU TRÚC ÂM TIẾT (Syllable Structure Validator) ===
        // Nếu từ không hợp lệ, thêm ký tự marker nhưng không áp dụng dấu thanh

        const vowels = 'aăâeêioôơuưy';
        const consonants = 'bcdfghjklmnpqrstvwxz';
        const finalCharIndex = word.length - 1;
        const finalChar = word[finalCharIndex]?.toLowerCase();

        // QUY TẮC 1: Kiểm tra phụ âm cuối hợp lệ
        // Phụ âm cuối CHỈ ĐƯỢC PHÉP là: c, p, t, m, n hoặc ch, nh, ng
        if (consonants.includes(finalChar)) {
            const validFinalConsonants = ['c', 'p', 't', 'm', 'n'];
            let isValidFinal = validFinalConsonants.includes(finalChar);

            // Kiểm tra phụ âm kép cuối
            if (!isValidFinal && word.length >= 2) {
                const lastTwo = word.substring(word.length - 2).toLowerCase();
                isValidFinal = ['ch', 'nh', 'ng'].includes(lastTwo);
            }

            // Nếu phụ âm cuối không hợp lệ → Thêm marker mà không áp dụng dấu
            if (!isValidFinal) {
                return word + toneMarkerChar; // Ví dụ: khôngd + s → khôngds
            }
        }

        // QUY TẮC 2: Kiểm tra cấu trúc V-C-V (Vowel-Consonant-Vowel ở cuối)
        // Chặn cấu trúc: ...[Nguyên âm] + [Phụ âm] + [Nguyên âm]$
        // Ngoại lệ: Các từ bắt đầu bằng "qu" hoặc "gi" (q, g là phụ âm đầu)
        if (word.length >= 3) {
            const beforeLastTwo = word.substring(word.length - 3, word.length - 1).toLowerCase();
            const vowelBeforeConsoNow = vowels.includes(beforeLastTwo[0]);
            const consoNow = consonants.includes(beforeLastTwo[1]);
            const vowelNow = vowels.includes(finalChar);

            if (vowelBeforeConsoNow && consoNow && vowelNow) {
                // Cấu trúc V-C-V được phát hiện
                // Kiểm tra ngoại lệ: từ không bắt đầu bằng "qu" hoặc "gi"
                const startTwo = word.substring(0, 2).toLowerCase();
                const isQu = startTwo === 'qu';
                const isGi = startTwo === 'gi';

                if (!isQu && !isGi) {
                    return word + toneMarkerChar; // Ví dụ: trene + s → trenes
                }
            }
        }

        // Danh sách nguyên âm (bao gồm cả có dấu mũ/sừng)
        const vowelsExtended = 'aăâeêioôơuưy';

        // Tìm các vị trí nguyên âm trong từ
        const vowelPositions = [];
        for (let i = 0; i < word.length; i++) {
            if (vowelsExtended.includes(word[i].toLowerCase())) {
                vowelPositions.push(i);
            }
        }

        if (vowelPositions.length === 0) return word;

        // === BƯỚC 1: Tìm phụ âm cuối (Final Consonant) ===
        const finalConsonants = ['c', 'p', 't', 'm', 'n'];
        const lastCharIndex = word.length - 1;
        const lastChar = word[lastCharIndex]?.toLowerCase();

        let hasFinalConsonant = false;
        let finalConsonantPos = -1;

        // Kiểm tra phụ âm đơn cuối (c, p, t, m, n)
        if (finalConsonants.includes(lastChar)) {
            hasFinalConsonant = true;
            finalConsonantPos = lastCharIndex;
        }
        // Kiểm tra phụ âm kép cuối (ng, nh, ch)
        else if (word.length >= 2) {
            const lastTwo = word.substring(word.length - 2).toLowerCase();
            if (lastTwo === 'ng' || lastTwo === 'nh' || lastTwo === 'ch') {
                hasFinalConsonant = true;
                finalConsonantPos = word.length - 2;
            }
        }

        // === BƯỚC 2: Xác định vị trí đặt dấu ===
        let targetIndex = -1;

        if (vowelPositions.length === 1) {
            // QUY TẮC 1: Chỉ có 1 nguyên âm → đặt dấu vào đó
            targetIndex = vowelPositions[0];
        }
        else if (hasFinalConsonant) {
            // QUY TẮC 2: Có phụ âm cuối → đặt dấu vào nguyên âm CUỐI CÙNG trước phụ âm
            // Tìm nguyên âm cuối cùng nằm trước phụ âm cuối
            for (let i = vowelPositions.length - 1; i >= 0; i--) {
                if (vowelPositions[i] < finalConsonantPos) {
                    targetIndex = vowelPositions[i];
                    break;
                }
            }

            // Fallback: nếu không tìm thấy, lấy nguyên âm cuối cùng
            if (targetIndex === -1) {
                targetIndex = vowelPositions[vowelPositions.length - 1];
            }
        }
        else {
            // QUY TẮC 3: Không có phụ âm cuối → áp dụng quy tắc đặc biệt

            if (vowelPositions.length === 2) {
                const first = word[vowelPositions[0]].toLowerCase();
                const second = word[vowelPositions[1]].toLowerCase();
                const isQu = word.toLowerCase().startsWith('qu');
                const isGi = word.toLowerCase().startsWith('gi');
                // Quy tắc đặc biệt: oa, oe, uy → dấu vào nguyên âm thứ 2
                if ((first === 'o' && (second === 'a' || second === 'e')) ||
                    (first === 'u' && second === 'y') ||
                    isQu || isGi) {
                    targetIndex = vowelPositions[1];
                } else {
                    // Các trường hợp khác: dấu vào nguyên âm thứ 1
                    targetIndex = vowelPositions[0];
                }
            }
            else if (vowelPositions.length >= 3) {
                // 3+ nguyên âm: Kiểm tra các case đặc biệt
                const firstVowel = word[vowelPositions[0]].toLowerCase();
                const secondVowel = word[vowelPositions[1]].toLowerCase();

                // uya, uyê, uyê → dấu vào nguyên âm thứ 2 (y)
                if (firstVowel === 'u' && secondVowel === 'y') {
                    targetIndex = vowelPositions[1]; // y
                }
                // iêu, yêu → dấu vào nguyên âm thứ 2 (ê)
                else if ((firstVowel === 'i' || firstVowel === 'y') &&
                    (secondVowel === 'ê' || secondVowel === 'e')) {
                    targetIndex = vowelPositions[1]; // ê
                }
                // Default: dấu vào nguyên âm thứ 2
                else {
                    targetIndex = vowelPositions[1];
                }
            }
        }

        // Fallback cuối cùng
        if (targetIndex === -1) {
            targetIndex = vowelPositions[0];
        }

        // === BƯỚC 3: Thêm dấu thanh ===
        const char = word[targetIndex];
        const newChar = this.addTone(char, toneType);

        return word.substring(0, targetIndex) + newChar + word.substring(targetIndex + 1);
    }

    /**
     * Thêm dấu thanh vào 1 nguyên âm
     */
    addTone(char, toneType) {
        const isUpper = char === char.toUpperCase();
        const base = char.toLowerCase();

        // Bảng tra: [không dấu, sắc, huyền, hỏi, ngã, nặng]
        const toneTable = {
            'a': ['a', 'á', 'à', 'ả', 'ã', 'ạ'],
            'ă': ['ă', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ'],
            'â': ['â', 'ấ', 'ầ', 'ẩ', 'ẫ', 'ậ'],
            'e': ['e', 'é', 'è', 'ẻ', 'ẽ', 'ẹ'],
            'ê': ['ê', 'ế', 'ề', 'ể', 'ễ', 'ệ'],
            'i': ['i', 'í', 'ì', 'ỉ', 'ĩ', 'ị'],
            'o': ['o', 'ó', 'ò', 'ỏ', 'õ', 'ọ'],
            'ô': ['ô', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ'],
            'ơ': ['ơ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ'],
            'u': ['u', 'ú', 'ù', 'ủ', 'ũ', 'ụ'],
            'ư': ['ư', 'ứ', 'ừ', 'ử', 'ữ', 'ự'],
            'y': ['y', 'ý', 'ỳ', 'ỷ', 'ỹ', 'ỵ']
        };

        // Nếu char đã có dấu thanh, tìm base gốc của nó
        let baseVowel = base;
        for (let key in toneTable) {
            if (toneTable[key].includes(base)) {
                baseVowel = key;
                break;
            }
        }

        const result = toneTable[baseVowel]?.[toneType] || char;
        return isUpper ? result.toUpperCase() : result;
    }

    /**
     * Xử lý backspace thông minh: xóa dấu trước khi xóa ký tự
     */
    handleBackspace(text, cursorPos) {
        if (cursorPos === 0) return { text, newCursorPos: 0 };

        const before = text.substring(0, cursorPos);
        const after = text.substring(cursorPos);
        const lastChar = before[before.length - 1];

        // Kiểm tra có thể xóa dấu thanh không
        const baseLess = this.removeTone(lastChar);

        if (baseLess && baseLess !== lastChar) {
            // Xóa dấu thanh
            return {
                text: before.substring(0, before.length - 1) + baseLess + after,
                newCursorPos: cursorPos
            };
        } else {
            // Xóa ký tự hoàn toàn
            return {
                text: before.substring(0, before.length - 1) + after,
                newCursorPos: cursorPos - 1
            };
        }
    }

    /**
     * Xóa dấu thanh khỏi ký tự (ế -> ê -> e)
     */
    removeTone(char) {
        const map = this.toneMap[char] || this.toneMap[char.toLowerCase()];
        if (!map) return null;

        const isUpper = char === char.toUpperCase();
        return isUpper ? map.toUpperCase() : map;
    }

    /**
     * Build bảng tra: ký tự có dấu -> ký tự base hơn (để backspace)
     */
    buildToneMap() {
        return {
            // a family
            'á': 'a', 'à': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
            'ắ': 'ă', 'ằ': 'ă', 'ẳ': 'ă', 'ẵ': 'ă', 'ặ': 'ă',
            'ă': 'a',
            'ấ': 'â', 'ầ': 'â', 'ẩ': 'â', 'ẫ': 'â', 'ậ': 'â',
            'â': 'a',
            // e family
            'é': 'e', 'è': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
            'ế': 'ê', 'ề': 'ê', 'ể': 'ê', 'ễ': 'ê', 'ệ': 'ê',
            'ê': 'e',
            // i family
            'í': 'i', 'ì': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
            // o family
            'ó': 'o', 'ò': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
            'ố': 'ô', 'ồ': 'ô', 'ổ': 'ô', 'ỗ': 'ô', 'ộ': 'ô',
            'ô': 'o',
            'ớ': 'ơ', 'ờ': 'ơ', 'ở': 'ơ', 'ỡ': 'ơ', 'ợ': 'ơ',
            'ơ': 'o',
            // u family
            'ú': 'u', 'ù': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
            'ứ': 'ư', 'ừ': 'ư', 'ử': 'ư', 'ữ': 'ư', 'ự': 'ư',
            'ư': 'u',
            // y family
            'ý': 'y', 'ỳ': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
            // đ
            'đ': 'd'
        };
    }

    /**
     * Xóa TẤT CẢ dấu thanh khỏi từ (giữ lại dấu mũ/sừng)
     * Ví dụ: Chủẩn → Chuân, Hòa → Hoa
     */
    removeAllTones(word) {
        // Bảng map: ký tự có dấu thanh → ký tự base (giữ dấu mũ/sừng)
        const toneToBase = {
            // a family (giữ ă, â)
            'á': 'a', 'à': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
            'Á': 'A', 'À': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
            'ắ': 'ă', 'ằ': 'ă', 'ẳ': 'ă', 'ẵ': 'ă', 'ặ': 'ă',
            'Ắ': 'Ă', 'Ằ': 'Ă', 'Ẳ': 'Ă', 'Ẵ': 'Ă', 'Ặ': 'Ă',
            'ấ': 'â', 'ầ': 'â', 'ẩ': 'â', 'ẫ': 'â', 'ậ': 'â',
            'Ấ': 'Â', 'Ầ': 'Â', 'Ẩ': 'Â', 'Ẫ': 'Â', 'Ậ': 'Â',
            // e family (giữ ê)
            'é': 'e', 'è': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
            'É': 'E', 'È': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
            'ế': 'ê', 'ề': 'ê', 'ể': 'ê', 'ễ': 'ê', 'ệ': 'ê',
            'Ế': 'Ê', 'Ề': 'Ê', 'Ể': 'Ê', 'Ễ': 'Ê', 'Ệ': 'Ê',
            // i family
            'í': 'i', 'ì': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
            'Í': 'I', 'Ì': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
            // o family (giữ ô, ơ)
            'ó': 'o', 'ò': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
            'Ó': 'O', 'Ò': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
            'ố': 'ô', 'ồ': 'ô', 'ổ': 'ô', 'ỗ': 'ô', 'ộ': 'ô',
            'Ố': 'Ô', 'Ồ': 'Ô', 'Ổ': 'Ô', 'Ỗ': 'Ô', 'Ộ': 'Ô',
            'ớ': 'ơ', 'ờ': 'ơ', 'ở': 'ơ', 'ỡ': 'ơ', 'ợ': 'ơ',
            'Ớ': 'Ơ', 'Ờ': 'Ơ', 'Ở': 'Ơ', 'Ỡ': 'Ơ', 'Ợ': 'Ơ',
            // u family (giữ ư)
            'ú': 'u', 'ù': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
            'Ú': 'U', 'Ù': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
            'ứ': 'ư', 'ừ': 'ư', 'ử': 'ư', 'ữ': 'ư', 'ự': 'ư',
            'Ứ': 'Ư', 'Ừ': 'Ư', 'Ử': 'Ư', 'Ữ': 'Ư', 'Ự': 'Ư',
            // y family
            'ý': 'y', 'ỳ': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
            'Ý': 'Y', 'Ỳ': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y'
        };

        // Xóa dấu thanh khỏi mỗi ký tự trong từ
        let result = '';
        for (let char of word) {
            result += toneToBase[char] || char;
        }

        return result;
    }
}

// ==================== END VIETNAMESE IM ====================

// ==================== VIRTUAL KEYBOARD MODULE ====================

/**
 * Virtual Keyboard Manager
 * Quản lý bàn phím ảo với Vietnamese Input Method
 */
class VirtualKeyboardManager {
    constructor(config = {}) {
        this.keyboard = null;
        this.currentInput = null;
        this.vnIM = new VietnameseIM(); // Khởi tạo Vietnamese Input Method
        this.shiftActive = false;
        this.capsLockActive = false;

        // DOM Elements
        this.keyboardContainer = config.keyboardContainer || document.getElementById('keyboardContainer');
        this.closeKeyboardBtn = config.closeKeyboardBtn || document.getElementById('closeKeyboard');
        this.printBtn = config.printBtn || document.getElementById('printBtn');

        // Configuration
        this.config = {
            enablePrint: config.enablePrint !== false,
            enableActivityTracking: config.enableActivityTracking !== false,
            ...config
        };
    }

    /**
     * Initialize keyboard
     */
    init() {
        this.initKeyboard();
        this.attachInputListeners();
        this.attachEventListeners();
    }

    /**
     * Initialize Simple Keyboard
     */
    initKeyboard() {
        if (!window.SimpleKeyboard) {
            console.error('SimpleKeyboard library not loaded');
            return;
        }

        this.keyboard = new window.SimpleKeyboard.default({
            onKeyPress: button => this.handleKeyPress(button),
            layout: {
                default: [
                    '1 2 3 4 5 6 7 8 9 0 - = {bksp}',
                    'q w e r t y u i o p [ ] \\',
                    '{lock} a s d f g h j k l ; \' {enter}',
                    '{shift} z x c v b n m , . / {shift}',
                    '{space}'
                ],
                shift: [
                    '! @ # $ % ^ & * ( ) _ + {bksp}',
                    'Q W E R T Y U I O P { } |',
                    '{lock} A S D F G H J K L : " {enter}',
                    '{shift} Z X C V B N M < > ? {shift}',
                    '{space}'
                ],
                capslock: [
                    '1 2 3 4 5 6 7 8 9 0 - = {bksp}',
                    'Q W E R T Y U I O P [ ] \\',
                    '{lock} A S D F G H J K L ; \' {enter}',
                    '{shift} Z X C V B N M , . / {shift}',
                    '{space}'
                ]
            },
            display: {
                '{bksp}': '⌫ Xóa',
                '{enter}': '↵ Enter',
                '{shift}': '⇧ Shift',
                '{lock}': '⇪ Caps',
                '{space}': '———— Khoảng trắng ————'
            },
            theme: 'hg-theme-default hg-layout-default',
            buttonTheme: [
                {
                    class: "hg-red",
                    buttons: "{bksp}"
                },
                {
                    class: "hg-highlight",
                    buttons: "{enter} {shift} {lock}"
                }
            ],
            disableCaretPositioning: true
        });
    }

    /**
     * Handle key press với Vietnamese IM
     */
    handleKeyPress(button) {
        if (!this.currentInput) return;

        // Xử lý các phím đặc biệt
        if (button === '{enter}') {
            this.hideKeyboard();
            return;
        }

        if (button === '{shift}') {
            this.shiftActive = !this.shiftActive;
            const newLayout = this.shiftActive ? 'shift' : (this.capsLockActive ? 'capslock' : 'default');
            this.keyboard.setOptions({ layoutName: newLayout });
            return;
        }

        if (button === '{lock}') {
            this.capsLockActive = !this.capsLockActive;
            this.shiftActive = false;
            const newLayout = this.capsLockActive ? 'capslock' : 'default';
            this.keyboard.setOptions({ layoutName: newLayout });
            return;
        }

        // Lấy giá trị hiện tại và cursor position
        const currentValue = this.currentInput.value;
        const cursorPos = this.currentInput.selectionStart || currentValue.length;

        // Xử lý ký tự thường
        let keyToProcess = button;

        if (button === '{space}') {
            keyToProcess = ' ';
        } else if (button === '{bksp}') {
            keyToProcess = 'Backspace';
        }

        // === GỌI VIETNAMESE IM XỬ LÝ ===
        const result = this.vnIM.processKey(currentValue, keyToProcess, cursorPos);

        // Cập nhật input
        this.currentInput.value = result.text;

        // Trigger input event
        this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Set cursor position trước khi sync với keyboard
        this.currentInput.setSelectionRange(result.newCursorPos, result.newCursorPos);

        // Đồng bộ với keyboard display SAU khi đã set cursor
        this.keyboard.setInput(result.text);

        // Force focus và restore cursor position (keyboard.setInput có thể reset cursor)
        requestAnimationFrame(() => {
            this.currentInput.focus();
            this.currentInput.setSelectionRange(result.newCursorPos, result.newCursorPos);
        });

        // Reset shift sau khi gõ
        if (this.shiftActive && button !== '{bksp}' && button !== '{space}') {
            setTimeout(() => {
                this.shiftActive = false;
                const newLayout = this.capsLockActive ? 'capslock' : 'default';
                this.keyboard.setOptions({ layoutName: newLayout });
            }, 50);
        }

        // Send activity heartbeat
        if (this.config.enableActivityTracking && window.parent !== window) {
            window.parent.postMessage({
                type: 'USER_ACTIVITY',
                source: 'html-form-keyboard'
            }, '*');
        }
    }

    /**
     * Show keyboard
     */
    showKeyboard(inputElement) {
        this.currentInput = inputElement;
        this.keyboardContainer.classList.add('active');

        // Set keyboard input to current value
        if (this.keyboard) {
            this.keyboard.setInput(inputElement.value || '');
        }

        // Scroll to keep input visible above keyboard
        setTimeout(() => {
            const inputRect = inputElement.getBoundingClientRect();
            const keyboardHeight = this.keyboardContainer.offsetHeight;
            const windowHeight = window.innerHeight;

            if (inputRect.bottom > (windowHeight - keyboardHeight - 20)) {
                window.scrollBy({
                    top: inputRect.bottom - (windowHeight - keyboardHeight - 20),
                    behavior: 'smooth'
                });
            }
        }, 100);
    }

    /**
     * Hide keyboard
     */
    hideKeyboard() {
        this.keyboardContainer.classList.remove('active');
        this.currentInput = null;
        this.shiftActive = false;
        this.capsLockActive = false;
        if (this.keyboard) {
            this.keyboard.clearInput();
            this.keyboard.setOptions({
                layoutName: 'default'
            });
        }
    }

    /**
     * Attach focus listeners to all inputs
     */
    attachInputListeners() {
        const inputs = document.querySelectorAll('input[type="text"], textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', (e) => {
                e.preventDefault();
                this.showKeyboard(input);
            });

            // Send heartbeat on regular input events too (for desktop keyboard)
            if (this.config.enableActivityTracking) {
                input.addEventListener('input', () => {
                    if (window.parent !== window) {
                        window.parent.postMessage({
                            type: 'USER_ACTIVITY',
                            source: 'html-form-input'
                        }, '*');
                    }
                });
            }
        });
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close keyboard button
        if (this.closeKeyboardBtn) {
            this.closeKeyboardBtn.addEventListener('click', () => this.hideKeyboard());
        }

        // Click outside to close keyboard
        document.addEventListener('click', (e) => {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
            const isKeyboard = this.keyboardContainer.contains(e.target);

            if (!isInput && !isKeyboard && this.keyboardContainer.classList.contains('active')) {
                this.hideKeyboard();
            }
        });
    }
}

// ==================== AUTO INITIALIZATION ====================

// Initialize on page load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        // Auto-initialize if elements exist
        const keyboardContainer = document.getElementById('keyboardContainer');
        if (keyboardContainer) {
            window.virtualKeyboard = new VirtualKeyboardManager();
            window.virtualKeyboard.init();
        }
    });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VietnameseIM, VirtualKeyboardManager };
}
