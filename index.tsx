/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Type } from "@google/genai";

// State
let stream: MediaStream | null = null;
let captureSource: 'stream' | 'image' | null = null;
let imageDataUrl: string | null = null;
let widgetWindow: Window | null = null; // Reference to the detached widget window

// DOM Elements
const startButton = document.getElementById('start-button') as HTMLButtonElement;
const uploadButton = document.getElementById('upload-button') as HTMLButtonElement;
const imageUploadInput = document.getElementById('image-upload-input') as HTMLInputElement;
const setupContainer = document.getElementById('setup-container') as HTMLDivElement;
const screenStreamVideo = document.getElementById('screen-stream') as HTMLVideoElement;
const uploadedImage = document.getElementById('uploaded-image') as HTMLImageElement;
const captureCanvas = document.getElementById('capture-canvas') as HTMLCanvasElement;

// --- Constants ---
const NOTIFICATION_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iNDhweCIgdmlld0JveD0iMCAwIDI0IDI0IiB3aWR0aD0iNDhweCIgZmlsbD0iIzQyODVGNCI+PHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0xOCAxNGgtMS4yOWMtLjQ1IDEuNTYtMS40OCAyLjg4LTIuOTEgMy42M2MuMy4xMi41OC4yOC44My41MmwuNDMuNDNjLjM5LjM5LjM5IDEuMDIgMCAxLjQxLS4zOS4zOS0xLjAyLjM5LTEuNDEgMGwtNDYtLjQ2Yy0uMjYtLjI0LS40My0uNTItLjU1LS44M0M5LjM2IDE4LjM5IDguMzMgMTcuMDcgNy44OCAxNS41MUg2Yy0uNTUgMC0xLS40NS0xLTFzLjQ1LTEgMS0xaDFsLjA1LS4yN0M3LjUgMTMuMDcgOC4zNyAxMyA5LjI1IDEzaDQuMWMuODggMCAxLjc1LjA3IDIuMjUuMjdsLjA1LjI3aDFjLjU1IDAgMSAuNDUgMSAxcy0uNDUgMS0xIDF6TTQgOGMwLTEuOTkgMS41Ny0zLjY0IDMuNS0zLjk1VjJoMWwuMDggM2gzLjg0bC4wOC0zSDE0djIuMDVjMS45My4zMSAzLjUgMS45NiAzLjUgMy45NWMwIDEuMzgtLjcyIDIuNTgtMS44MSAzLjI1VjEzYzEuNjUtLjUgMy4xNy0xLjM5IDQuMzEtMi41OC4zOS0uMzkgMS4wMi0uMzkgMS40MSAwIC4zOS4zOS4zOSAxLjAyIDAgMS40MWwtLjA5LjA5QzIwLjU1IDEyLjc4IDE5LjM4IDEzLjUgMTggMTRoLjVjLjI4IDAgLjUgLjIyLjUgLjVzLS4yMi41LS41LjVIMThjMCAuNDctLjAyLjkyLS4wNiAxLjM2LS4xMSAxLjE4LS40NCAyLjM1LS45NyAzLjQ0bC40My40M2MuMzkuMzkuMzkgMS4wMiAwIDEuNDEtLjM5LjM5LTEuMDIuMzktMS40MSAwbC0uNDMtLjQzYy0uMzktLjM1LS43My0uNzQtMS4wMy0xLjE2QzEzLjI2IDIwLjYxIDExLjkgMjEgMTAuNSAyMWgtMWMtMS40IDAtMi43Ni0uMzktNC4wMS0xLjA5LS4zLjQyLS42NC44MS0xLjAzIDEuMTZsLS40My40M2MtLjM5LjM5LTEuMDIuMzktMS40MSAwLS4zOS0uMzktLjM5LTEuMDIgMC0xLjQxbC40My0uNDNjLjU0LTEuMDguODctMi4yNi45Ny0zLjQ0QzUuMDIgMTUuNDIgNSAxNC45NyA1IDE0LjVINS41Yy0uMjggMC0uNS0uMjItLjUtLjVzLjIyLS41LjUtLjVoLjVjLTEuMzgtLjUgMi41LTEuMzkgMy42My0yLjU4bC0uMDktLjA5Yy0uMzktLjM5LS4zOS0xLjAyIDAtMS40MS4zOS0uMzkgMS4wMi0uMzkgMS40MSAwQzEyLjA1IDkuOTcgMTIuOTMgMTEgMTQuMTggMTF2LTJjLTEuMDktLTY3LTIuMS0xLjQ1LTMuMjYtMi4xMUgyMC43MUM4LjU1IDcuNTUgNy41NCA4LjMzIDYuMTggOVY3aC0uOUM0LjcxIDcgNCA3LjQ1IDQgOHoiLz48L3N2Zz4=';


// --- Event Listeners ---
startButton.addEventListener('click', startStream);
uploadButton.addEventListener('click', () => imageUploadInput.click());
imageUploadInput.addEventListener('change', handleImageUpload);


// --- Keyboard Shortcuts ---
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (captureSource) {
            stopSession();
        }
    }

    if (e.ctrlKey && e.key === ' ') {
        e.preventDefault();
        if (captureSource) {
            getAnswer();
        }
    }
});

/**
 * Requests permission to show notifications.
 */
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.warn('Trình duyệt này không hỗ trợ thông báo.');
        return;
    }
    if (Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

/**
 * Stops the active session (stream or image view) and resets the UI.
 */
function stopSession() {
    if (widgetWindow && !widgetWindow.closed) {
        widgetWindow.close();
        widgetWindow = null;
    }

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    stream = null;
    imageDataUrl = null;
    captureSource = null;

    screenStreamVideo.srcObject = null;
    uploadedImage.src = '';
    
    setupContainer.style.display = 'flex';
    screenStreamVideo.style.display = 'none';
    uploadedImage.style.display = 'none';
    startButton.disabled = false;
    uploadButton.disabled = false;
}

/**
 * Starts the screen capture stream and displays the floating widget.
 */
async function startStream() {
    startButton.disabled = true;
    uploadButton.disabled = true;
    startButton.textContent = 'Đang chờ...';
    try {
        await requestNotificationPermission(); // Request permission
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        stream = displayStream;
        screenStreamVideo.srcObject = stream;
        await screenStreamVideo.play();
        
        captureSource = 'stream';
        setupContainer.style.display = 'none';
        screenStreamVideo.style.display = 'block';
        
        detachWidget();

        stream.getVideoTracks()[0].onended = stopSession;

    } catch (error) {
        console.error("Lỗi khi bắt đầu quay màn hình:", error);
        alert("Không thể bắt đầu quay màn hình. Điều này có thể do bạn đã từ chối quyền, hoặc do các hạn chế bảo mật trong môi trường này. Vui lòng thử tải ảnh lên.");
        stopSession();
    } finally {
        startButton.textContent = 'Quay màn hình';
    }
}

/**
 * Handles the image upload process.
 * @param event The file input change event.
 */
async function handleImageUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
        await requestNotificationPermission(); // Request permission
        const reader = new FileReader();
        reader.onload = (e) => {
            imageDataUrl = e.target?.result as string;
            uploadedImage.src = imageDataUrl;
            captureSource = 'image';

            setupContainer.style.display = 'none';
            uploadedImage.style.display = 'block';
            detachWidget();
        };
        reader.onerror = () => {
            alert('Đã xảy ra lỗi khi đọc tệp. Vui lòng thử lại.');
        };
        reader.readAsDataURL(file);
    }
    target.value = '';
}

/**
 * Opens the widget in a separate window by dynamically creating its content.
 */
function detachWidget() {
    if (widgetWindow && !widgetWindow.closed) {
        widgetWindow.focus();
        return;
    }

    const width = 400;
    const height = 600;
    const left = window.screen.width - width - 50;
    const top = 50;
    
    widgetWindow = window.open('about:blank', 'FloatingWidget', `width=${width},height=${height},left=${left},top=${top}`);
    
    if (widgetWindow) {
        const widgetCSS = `
:root {
    --primary-color: #4285F4; --danger-color: #d93025; --background-color: #ffffff;
    --text-color: #3c4043; --font-family: 'Inter', sans-serif; --icon-background: #34A853;
    --icon-hover: #2c9546; --border-color: #dadce0;
}
html, body { margin: 0; padding: 0; font-family: var(--font-family); background-color: var(--background-color); color: var(--text-color); }
#widget-root { padding: 1.5rem; box-sizing: border-box; display: flex; flex-direction: column; height: 100vh; }
#answer-button {
    width: 100%; padding: 12px 24px; font-size: 1rem; font-weight: 700; color: white;
    background-color: var(--icon-background); border: none; border-radius: 8px; cursor: pointer;
    transition: background-color 0.2s, transform 0.1s ease; margin-bottom: 1rem; display: flex;
    align-items: center; justify-content: center; gap: 8px;
}
#answer-button:hover:not(:disabled) { background-color: var(--icon-hover); transform: translateY(-1px); }
#answer-button:active:not(:disabled) { transform: translateY(0); }
#answer-button:disabled { background-color: #cccccc; cursor: not-allowed; }
.spinner {
    border: 4px solid rgba(0, 0, 0, 0.1); width: 36px; height: 36px; border-radius: 50%;
    border-left-color: var(--primary-color); animation: spin 1s ease infinite; margin: 1.5rem auto;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.response-container {
    background-color: #f1f3f4; border: 1px solid var(--border-color); padding: 1rem 1.5rem;
    border-radius: 8px; text-align: left; margin-top: 1rem; overflow-y: auto; flex-grow: 1;
}
.response-container h2, .response-container h3 {
    margin-top: 0; margin-bottom: 0.5rem; color: var(--text-color); font-size: 0.9rem;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
}
.response-container p {
    margin: 0 0 1rem 0; line-height: 1.6; word-wrap: break-word; color: #5f6368;
}
.response-container p:last-child { margin-bottom: 0; }
.error-container {
    background-color: #fce8e6; border: 1px solid #f9ab9f; padding: 1rem 1.5rem;
    border-radius: 8px; color: #a50e04; font-weight: 500; text-align: left;
    margin-top: 1rem; word-wrap: break-word;
}
`;

        const widgetJS = `
document.addEventListener('DOMContentLoaded', () => {
    const answerButton = document.getElementById('answer-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const responseContainer = document.getElementById('response-container');
    const errorContainer = document.getElementById('error-container');
    const answerText = document.getElementById('answer-text');
    const explanationText = document.getElementById('explanation-text');
    const confidenceText = document.getElementById('confidence-text');

    if (!window.opener) {
        document.body.innerHTML = '<h1>Lỗi: Cửa sổ này phải được mở từ ứng dụng chính.</h1>';
        return;
    }

    // Functions to update UI
    function setLoading(isLoading) {
        loadingSpinner.style.display = isLoading ? 'block' : 'none';
        answerButton.disabled = isLoading;
        if (isLoading) {
           responseContainer.style.display = 'none';
           errorContainer.style.display = 'none';
        }
    }

    function showResult(result) {
        answerText.textContent = result.answer;
        explanationText.textContent = result.explanation;
        confidenceText.textContent = result.confidence;
        responseContainer.style.display = 'block';
        errorContainer.style.display = 'none';
    }

    function showError(message) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        responseContainer.style.display = 'none';
    }

    // Event Listeners
    answerButton.addEventListener('click', () => {
        if (window.opener && typeof window.opener.getAnswer === 'function') {
            window.opener.getAnswer();
        } else {
            showError("Không thể kết nối với cửa sổ chính. Hãy thử đóng và mở lại widget.");
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === ' ') {
            e.preventDefault();
            if (!answerButton.disabled) {
                answerButton.click();
            }
        }
    });

    // Expose functions to the main window
    window.setLoading = setLoading;
    window.showResult = showResult;
    window.showError = showError;
});
`;

        const widgetHTML = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Widget Trả lời</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
    <style>${widgetCSS}</style>
</head>
<body>
    <div id="widget-root">
        <button id="answer-button">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM6 22v-3c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v3H6zm1-13.5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM20 10c.83 0 1.5-.67 1.5-1.5S20.83 7 20 7s-1.5.67-1.5 1.5.67 1.5 1.5 1.5zM3.5 10c.83 0 1.5-.67 1.5-1.5S4.33 7 3.5 7 2 7.67 2 8.5 2.67 10 3.5 10zm8-6c.83 0 1.5-.67 1.5-1.5S12.33 1 11.5 1 10 1.67 10 2.5s.67 1.5 1.5 1.5z"/></svg>
            <span>Trả lời (Ctrl+Space)</span>
        </button>
        <div id="loading-spinner" class="spinner" style="display: none;" role="status" aria-label="Đang tải"></div>
        <div id="response-container" class="response-container" style="display: none;" aria-live="assertive">
            <h2>Câu trả lời:</h2>
            <p id="answer-text"></p>
            <h3>Giải thích:</h3>
            <p id="explanation-text"></p>
            <h3>Mức độ tin cậy:</h3>
            <p id="confidence-text"></p>
        </div>
        <div id="error-container" class="error-container" style="display: none;" role="alert"></div>
    </div>
    <script>${widgetJS}</script>
</body>
</html>
`;
        widgetWindow.document.write(widgetHTML);
        widgetWindow.document.close();
        
        widgetWindow.onbeforeunload = stopSession;
    }
}

/**
 * Captures, resizes, and compresses the current frame, then sends it to the Gemini API.
 */
async function getAnswer() {
    let base64Image: string | null = null;

    if (!widgetWindow || widgetWindow.closed) {
        console.warn("Attempted to get answer, but widget window is closed. Stopping session.");
        stopSession();
        return;
    }
    
    (widgetWindow as any).setLoading(true);

    try {
        const MAX_DIMENSION = 768; // Max dimension for performance
        const quality = 0.9; // JPEG quality
        const context = captureCanvas.getContext('2d');
        let sourceWidth = 0;
        let sourceHeight = 0;
        let sourceElement: HTMLVideoElement | HTMLImageElement | null = null;

        if (captureSource === 'stream' && screenStreamVideo.readyState >= 2) {
            sourceElement = screenStreamVideo;
            sourceWidth = screenStreamVideo.videoWidth;
            sourceHeight = screenStreamVideo.videoHeight;
        } else if (captureSource === 'image' && uploadedImage.src) {
            sourceElement = uploadedImage;
            sourceWidth = uploadedImage.naturalWidth;
            sourceHeight = uploadedImage.naturalHeight;
        } else {
            throw new Error("Nguồn ảnh không hợp lệ hoặc chưa sẵn sàng.");
        }

        if (!sourceElement || !context || sourceWidth === 0 || sourceHeight === 0) {
             throw new Error("Không thể lấy kích thước ảnh nguồn hoặc context.");
        }

        // Calculate new dimensions to preserve aspect ratio
        let newWidth = sourceWidth;
        let newHeight = sourceHeight;
        if (newWidth > MAX_DIMENSION || newHeight > MAX_DIMENSION) {
            if (newWidth > newHeight) {
                newHeight = Math.round((newHeight * MAX_DIMENSION) / newWidth);
                newWidth = MAX_DIMENSION;
            } else {
                newWidth = Math.round((newWidth * MAX_DIMENSION) / newHeight);
                newHeight = MAX_DIMENSION;
            }
        }
        
        captureCanvas.width = newWidth;
        captureCanvas.height = newHeight;

        context.drawImage(sourceElement, 0, 0, newWidth, newHeight);
        base64Image = captureCanvas.toDataURL('image/jpeg', quality).split(',')[1];

        if (!base64Image) {
            throw new Error("Không thể chụp và xử lý ảnh màn hình.");
        }
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: base64Image,
                        },
                    },
                    {
                        text: "Based on the screenshot, what is the answer to the question? The question might be highlighted or implied. Respond in Vietnamese with a JSON object containing 'answer', 'explanation', and 'confidence' (high, medium, or low)."
                    }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        answer: { type: Type.STRING },
                        explanation: { type: Type.STRING },
                        confidence: { type: Type.STRING }
                    },
                    required: ["answer", "explanation", "confidence"]
                },
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        const result = JSON.parse(response.text);

        if (widgetWindow && !widgetWindow.closed) {
            (widgetWindow as any).showResult(result);
            if (Notification.permission === 'granted') {
                const notification = new Notification('Trợ lý có câu trả lời!', {
                    body: result.answer,
                    icon: NOTIFICATION_ICON,
                    silent: true,
                });
                notification.onclick = () => {
                    widgetWindow?.focus();
                };
            }
        }

    } catch (error) {
        console.error("Lỗi khi lấy câu trả lời:", error);
        const errorMessage = `Đã xảy ra lỗi: ${error instanceof Error ? error.message : String(error)}`;
        if (widgetWindow && !widgetWindow.closed) {
            (widgetWindow as any).showError(errorMessage);
            if (Notification.permission === 'granted') {
                 new Notification('Đã xảy ra lỗi', {
                    body: errorMessage,
                    icon: NOTIFICATION_ICON
                });
            }
        }
    } finally {
        if (widgetWindow && !widgetWindow.closed) {
            (widgetWindow as any).setLoading(false);
        }
    }
}
(window as any).getAnswer = getAnswer;
