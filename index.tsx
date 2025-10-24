/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Type } from "@google/genai";

// State
let stream: MediaStream | null = null;
let userApiKey: string | null = null;

// DOM Elements
const startButton = document.getElementById('start-button') as HTMLButtonElement;
const setupContainer = document.getElementById('setup-container') as HTMLDivElement;
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const screenStreamVideo = document.getElementById('screen-stream') as HTMLVideoElement;
const captureCanvas = document.getElementById('capture-canvas') as HTMLCanvasElement;
const floatingWidget = document.getElementById('floating-widget') as HTMLDivElement;
const widgetToggleButton = document.getElementById('widget-toggle-icon') as HTMLButtonElement;
const answerButton = document.getElementById('answer-button') as HTMLButtonElement;
const pipButton = document.getElementById('pip-button') as HTMLButtonElement;
const loadingSpinner = document.getElementById('loading-spinner') as HTMLDivElement;
const responseContainer = document.getElementById('response-container') as HTMLDivElement;
const errorContainer = document.getElementById('error-container') as HTMLDivElement;


// Gemini AI Model
const model = 'gemini-2.5-flash';
const API_KEY_STORAGE_KEY = 'gemini-api-key';

// --- API Key Handling ---

function updateStartButtonState() {
    startButton.disabled = !apiKeyInput.value.trim();
}

function updatePipButtonState() {
    pipButton.disabled = !stream;
}


document.addEventListener('DOMContentLoaded', () => {
    const storedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (storedApiKey) {
        apiKeyInput.value = storedApiKey;
        userApiKey = storedApiKey;
    }
    updateStartButtonState();
    updatePipButtonState();
    if (!document.pictureInPictureEnabled) {
        pipButton.style.display = 'none';
    }
});

apiKeyInput.addEventListener('input', () => {
    userApiKey = apiKeyInput.value.trim();
    if (userApiKey) {
        localStorage.setItem(API_KEY_STORAGE_KEY, userApiKey);
    } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
    updateStartButtonState();
});


// --- Event Listeners ---

startButton.addEventListener('click', startStream);
answerButton.addEventListener('click', getAnswer);
pipButton.addEventListener('click', togglePiP);


// --- Widget Dragging Logic ---
let isDragging = false;
let hasDragged = false;
let dragStartX = 0, dragStartY = 0;
let widgetInitialX = 0, widgetInitialY = 0;

function onDragStart(e: MouseEvent) {
    hasDragged = false;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = floatingWidget.getBoundingClientRect();
    widgetInitialX = rect.left;
    widgetInitialY = rect.top;

    floatingWidget.style.right = 'auto';
    floatingWidget.style.bottom = 'auto';
    floatingWidget.style.left = `${widgetInitialX}px`;
    floatingWidget.style.top = `${widgetInitialY}px`;
    
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
}

function onDragMove(e: MouseEvent) {
    if (!isDragging) return;

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasDragged = true;
    }

    let newX = widgetInitialX + dx;
    let newY = widgetInitialY + dy;
    
    const widgetRect = floatingWidget.getBoundingClientRect();
    const maxX = window.innerWidth - widgetRect.width;
    const maxY = window.innerHeight - widgetRect.height;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    floatingWidget.style.left = `${newX}px`;
    floatingWidget.style.top = `${newY}px`;
}

function onDragEnd() {
    isDragging = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
}

widgetToggleButton.addEventListener('mousedown', onDragStart);

widgetToggleButton.addEventListener('click', (e) => {
    if (hasDragged) {
        e.stopPropagation();
        return;
    }
    floatingWidget.classList.toggle('expanded');
});

// --- Keyboard Shortcuts ---
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (stream) {
            stopStream();
        } else if (!startButton.disabled) {
            startStream();
        }
    }

    if (e.ctrlKey && e.key === ' ') {
        e.preventDefault();
        if (stream && !answerButton.disabled) {
            getAnswer();
        }
    }
});


/**
 * Stops the screen capture stream and resets the UI.
 */
function stopStream() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
    }
    stream = null;
    screenStreamVideo.srcObject = null;
    
    setupContainer.style.display = 'flex';
    floatingWidget.style.display = 'none';
    screenStreamVideo.style.display = 'none';
    updateStartButtonState();
    updatePipButtonState();
}

/**
 * Starts the screen capture stream and displays the floating widget.
 */
async function startStream() {
    if (!userApiKey) {
        alert("Vui lòng nhập khóa API của bạn.");
        return;
    }
    startButton.disabled = true;
    startButton.textContent = 'Đang chờ cấp quyền...';
    try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        stream = displayStream;
        screenStreamVideo.srcObject = stream;
        await screenStreamVideo.play();
        
        setupContainer.style.display = 'none';
        screenStreamVideo.style.display = 'block';
        floatingWidget.style.display = 'block';
        updatePipButtonState();

        stream.getVideoTracks()[0].onended = stopStream;

    } catch (error) {
        console.error("Lỗi khi bắt đầu quay màn hình:", error);
        stopStream();
    } finally {
        startButton.textContent = 'Bắt đầu quay màn hình';
    }
}

/**
 * Toggles Picture-in-Picture mode for the screen stream video.
 */
async function togglePiP() {
    if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
    } else {
        if (document.pictureInPictureEnabled && screenStreamVideo.srcObject) {
            try {
                await screenStreamVideo.requestPictureInPicture();
            } catch(error) {
                console.error("Lỗi khi mở PiP:", error);
                displayError("Không thể mở chế độ Picture-in-Picture.");
            }
        }
    }
}

screenStreamVideo.addEventListener('enterpictureinpicture', () => {
    pipButton.textContent = 'Thoát PiP';
});

screenStreamVideo.addEventListener('leavepictureinpicture', () => {
    pipButton.textContent = 'Vào PiP';
});

/**
 * Converts the current video frame on a canvas to a Gemini API Part object.
 */
function canvasToGenerativePart(canvas: HTMLCanvasElement): { inlineData: { data: string; mimeType: string; }; } {
    const base64EncodedData = canvas.toDataURL('image/jpeg').split(',')[1];
    return {
        inlineData: { data: base64EncodedData, mimeType: 'image/jpeg' },
    };
}

/**
 * Displays an error message in the widget.
 * @param message The error message to display.
 */
function displayError(message: string) {
    if (!floatingWidget.classList.contains('expanded')) {
        floatingWidget.classList.add('expanded');
    }
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
    responseContainer.style.display = 'none';
}

/**
 * Fetches the answer from the Gemini API and updates the UI.
 */
async function getAnswer() {
    if (!stream) return;
    if (!userApiKey) {
        displayError("Không tìm thấy khóa API. Vui lòng quay lại màn hình chính để thiết lập.");
        return;
    }

    const setLoading = (isLoading: boolean) => {
        loadingSpinner.style.display = isLoading ? 'block' : 'none';
        answerButton.disabled = isLoading;
        if (isLoading) {
           responseContainer.style.display = 'none';
           errorContainer.style.display = 'none';
        }
    };
    
    setLoading(true);

    try {
        const ai = new GoogleGenAI({ apiKey: userApiKey });

        captureCanvas.width = screenStreamVideo.videoWidth;
        captureCanvas.height = screenStreamVideo.videoHeight;
        const context = captureCanvas.getContext('2d');
        if (context) {
            context.drawImage(screenStreamVideo, 0, 0, captureCanvas.width, captureCanvas.height);
        }
        
        const imagePart = canvasToGenerativePart(captureCanvas);
        
        const systemInstruction = `Bạn là một trợ lý thông minh. Nhiệm vụ của bạn là đọc và hiểu nội dung câu hỏi trong ảnh.
        Khi nhận được ảnh, bạn cần:
        1. Hiểu đúng nội dung câu hỏi.
        2. Trả lời ngắn gọn, chính xác, dễ hiểu, bằng tiếng Việt (hoặc cùng ngôn ngữ với câu hỏi).
        3. Giải thích ngắn gọn lý do hoặc cách ra đáp án (nếu cần).
        4. Đánh giá mức độ tin cậy của câu trả lời (ví dụ: Cao, Trung bình, Thấp).
        
        Hãy trả về kết quả dưới dạng JSON theo schema đã cho.`;
        
        const response = await ai.models.generateContent({
            model: model,
            contents: { 
                parts: [
                    { text: "Phân tích và trả lời câu hỏi trong hình ảnh này." },
                    imagePart
                ]
            },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        answer: { type: Type.STRING, description: 'Câu trả lời ngắn gọn, chính xác.' },
                        explanation: { type: Type.STRING, description: 'Giải thích ngắn gọn cho câu trả lời.' },
                        confidence: { type: Type.STRING, description: 'Mức độ tin cậy (Cao, Trung bình, Thấp).' },
                    },
                    required: ['answer', 'explanation', 'confidence'],
                },
            },
        });

        let jsonResponse;
        try {
            const cleanedText = response.text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            jsonResponse = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("Lỗi phân tích JSON từ phản hồi của API:", parseError, "Phản hồi gốc:", response.text);
            throw new Error("Không thể xử lý phản hồi từ AI vì định dạng không hợp lệ.");
        }

        (document.getElementById('answer-text') as HTMLParagraphElement).textContent = jsonResponse.answer;
        (document.getElementById('explanation-text') as HTMLParagraphElement).textContent = jsonResponse.explanation;
        (document.getElementById('confidence-text') as HTMLParagraphElement).textContent = jsonResponse.confidence;
        responseContainer.style.display = 'block';
        errorContainer.style.display = 'none';

    } catch (error) {
        console.error(error);
        
        let displayMessage = 'Đã xảy ra lỗi khi nhận câu trả lời. Vui lòng thử lại.';
        if (error instanceof Error) {
            if (error.message.toLowerCase().includes('api key')) {
                displayMessage = 'Lỗi xác thực API. Khóa API của bạn không hợp lệ hoặc thiếu quyền truy cập.';
            } else if (error.message.includes('không hợp lệ')) {
                displayMessage = error.message;
            }
        }
        displayError(displayMessage);
    } finally {
        setLoading(false);
    }
}