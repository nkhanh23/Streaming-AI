/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Fix: Import `Type` to define a response schema for structured JSON output.
import { GoogleGenAI, Type } from "@google/genai";

// State
let stream: MediaStream | null = null;

// DOM Elements
const startButton = document.getElementById('start-button') as HTMLButtonElement;
const setupContainer = document.getElementById('setup-container') as HTMLDivElement;
const screenStreamVideo = document.getElementById('screen-stream') as HTMLVideoElement;
const captureCanvas = document.getElementById('capture-canvas') as HTMLCanvasElement;
const floatingWidget = document.getElementById('floating-widget') as HTMLDivElement;
const widgetToggleButton = document.getElementById('widget-toggle-icon') as HTMLButtonElement;
const answerButton = document.getElementById('answer-button') as HTMLButtonElement;
const pipButton = document.getElementById('pip-button') as HTMLButtonElement;
const detachButton = document.getElementById('detach-button') as HTMLButtonElement;
const loadingSpinner = document.getElementById('loading-spinner') as HTMLDivElement;
const responseContainer = document.getElementById('response-container') as HTMLDivElement;
const errorContainer = document.getElementById('error-container') as HTMLDivElement;


// --- UI State Handling ---

function updateActionButtonsState() {
    const state = !stream;
    // We keep pipButton for consistency but it will be disabled.
    pipButton.disabled = state;
    detachButton.disabled = state;
}

document.addEventListener('DOMContentLoaded', () => {
    // Gracefully disable PiP and Detach buttons in sandboxed environments.
    const unsupportedMessage = "Tính năng này không được hỗ-trợ trong môi trường xem trước do các hạn chế về bảo mật.";
    pipButton.disabled = true;
    detachButton.disabled = true;
    pipButton.title = unsupportedMessage;
    detachButton.title = unsupportedMessage;
    
    startButton.disabled = false;
});


// --- Event Listeners ---

startButton.addEventListener('click', startStream);
answerButton.addEventListener('click', getAnswer);
// Event listeners for pipButton and detachButton are removed as they are disabled.


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
    // PiP and detached window logic removed as it's not supported.
    stream = null;
    screenStreamVideo.srcObject = null;
    
    setupContainer.style.display = 'flex';
    floatingWidget.style.display = 'none';
    screenStreamVideo.style.display = 'none';
    startButton.disabled = false;
    updateActionButtonsState();
}

/**
 * Starts the screen capture stream and displays the floating widget.
 */
async function startStream() {
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
        updateActionButtonsState();

        stream.getVideoTracks()[0].onended = stopStream;

    } catch (error) {
        console.error("Lỗi khi bắt đầu quay màn hình:", error);
        stopStream();
    } finally {
        startButton.textContent = 'Bắt đầu quay màn hình';
    }
}

/**
 * Displays an error message in the in-page widget.
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
 * Fetches the answer from the Google Gemini API and updates the UI.
 */
async function getAnswer() {
    if (!stream) return;
    
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
        // Capture the current frame
        captureCanvas.width = screenStreamVideo.videoWidth;
        captureCanvas.height = screenStreamVideo.videoHeight;
        const context = captureCanvas.getContext('2d');
        if (context) {
            context.drawImage(screenStreamVideo, 0, 0, captureCanvas.width, captureCanvas.height);
        }
        const base64ImageData = captureCanvas.toDataURL('image/jpeg').split(',')[1];

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const systemInstruction = `Bạn là một trợ lý thông minh. Nhiệm vụ của bạn là đọc và hiểu nội dung câu hỏi trong ảnh.
        Khi nhận được ảnh, bạn cần:
        1. Hiểu đúng nội dung câu hỏi.
        2. Trả lời ngắn gọn, chính xác, dễ hiểu, bằng tiếng Việt (hoặc cùng ngôn ngữ với câu hỏi).
        3. Giải thích ngắn gọn lý do hoặc cách ra đáp án (nếu cần).
        4. Đánh giá mức độ tin cậy của câu trả lời (ví dụ: Cao, Trung bình, Thấp).
        
        Hãy trả về kết quả dưới dạng một đối tượng JSON hợp lệ với các khóa sau: "answer", "explanation", "confidence".`;

        const imagePart = {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64ImageData,
          },
        };
        const textPart = { text: 'Phân tích và trả lời câu hỏi trong hình ảnh này.' };
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart, imagePart] },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        answer: {type: Type.STRING},
                        explanation: {type: Type.STRING},
                        confidence: {type: Type.STRING},
                    },
                    required: ["answer", "explanation", "confidence"],
                },
            }
        });

        const responseText = response.text;
        
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(responseText);
        } catch (parseError) {
            console.error("Lỗi phân tích JSON từ phản hồi của API:", parseError, "Phản hồi gốc:", responseText);
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
            if (error.message.toLowerCase().includes('api key not valid')) {
                displayMessage = 'Lỗi xác thực API. Khóa API của bạn không hợp lệ hoặc đã hết hạn.';
            } else if (error.message.includes('định dạng không hợp lệ')) {
                displayMessage = error.message;
            } else if (error.message.includes('[400 Bad Request]')) {
                 displayMessage = 'Lỗi yêu cầu: Có thể API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.';
            }
        }
        displayError(displayMessage);
    } finally {
        setLoading(false);
    }
}