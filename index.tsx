/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
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
const loadingSpinner = document.getElementById('loading-spinner') as HTMLDivElement;
const responseContainer = document.getElementById('response-container') as HTMLDivElement;
const errorContainer = document.getElementById('error-container') as HTMLDivElement;


// Gemini AI Model
const model = 'gemini-2.5-flash';

// Event Listeners
startButton.addEventListener('click', startStream);
widgetToggleButton.addEventListener('click', () => {
    floatingWidget.classList.toggle('expanded');
});
answerButton.addEventListener('click', getAnswer);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+S to start/stop stream
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (stream) {
            stopStream();
        } else {
            startStream();
        }
    }

    // Ctrl+Space to get answer
    if (e.ctrlKey && e.key === ' ') {
        e.preventDefault();
        // Only get answer if stream is active and not already loading
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
    stream = null;
    screenStreamVideo.srcObject = null;
    
    // Reset UI to initial state
    setupContainer.style.display = 'flex';
    floatingWidget.style.display = 'none';
    screenStreamVideo.style.display = 'none';
    startButton.disabled = false;
    startButton.textContent = 'Bắt đầu quay màn hình';
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
        
        // Update UI
        setupContainer.style.display = 'none';
        screenStreamVideo.style.display = 'block';
        floatingWidget.style.display = 'block';

        // Listen for the user stopping sharing from the browser UI
        stream.getVideoTracks()[0].onended = stopStream;

    } catch (error) {
        console.error("Lỗi khi bắt đầu quay màn hình:", error);
        stopStream(); // Clean up on error
    }
}

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
 * Fetches the answer from the Gemini API and updates the UI.
 */
async function getAnswer() {
    if (!stream) return;

    // Helper to set loading state
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
        // Initialize AI client here to avoid crash on load if key is missing
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        // Capture frame
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
            // The API response for JSON can sometimes be wrapped in markdown.
            const cleanedText = response.text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            jsonResponse = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("Lỗi phân tích JSON từ phản hồi của API:", parseError, "Phản hồi gốc:", response.text);
            throw new Error("Không thể xử lý phản hồi từ AI vì định dạng không hợp lệ.");
        }


        // Display response
        (document.getElementById('answer-text') as HTMLParagraphElement).textContent = jsonResponse.answer;
        (document.getElementById('explanation-text') as HTMLParagraphElement).textContent = jsonResponse.explanation;
        (document.getElementById('confidence-text') as HTMLParagraphElement).textContent = jsonResponse.confidence;
        responseContainer.style.display = 'block';
        errorContainer.style.display = 'none';

    } catch (error) {
        console.error(error);
        
        let displayMessage = 'Đã xảy ra lỗi khi nhận câu trả lời. Vui lòng thử lại.'; // Default message
        if (error instanceof Error) {
            if (error.message.toLowerCase().includes('api key')) {
                displayMessage = 'Lỗi xác thực API. Vui lòng đảm bảo API key đã được cấu hình chính xác.';
            } else if (error.message.includes('không hợp lệ')) { // Catches the custom JSON error
                displayMessage = error.message;
            }
        }

        // Display error
        if (!floatingWidget.classList.contains('expanded')) {
            floatingWidget.classList.add('expanded');
        }
        errorContainer.textContent = displayMessage;
        errorContainer.style.display = 'block';
        responseContainer.style.display = 'none';
    } finally {
        setLoading(false);
    }
}
