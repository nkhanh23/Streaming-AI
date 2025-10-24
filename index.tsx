/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// State
let stream: MediaStream | null = null;
let apiKey: string = '';

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


// OpenAI API Configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o';

// --- API Key Handling ---

function updatePipButtonState() {
    pipButton.disabled = !stream;
}

document.addEventListener('DOMContentLoaded', () => {
    updatePipButtonState();
    if (!document.pictureInPictureEnabled) {
        pipButton.style.display = 'none';
    }

    // Load API Key from localStorage
    const savedApiKey = localStorage.getItem('openai-api-key');
    if (savedApiKey) {
        apiKey = savedApiKey;
        apiKeyInput.value = savedApiKey;
        startButton.disabled = false;
    }
});

apiKeyInput.addEventListener('input', () => {
    apiKey = apiKeyInput.value.trim();
    localStorage.setItem('openai-api-key', apiKey);
    startButton.disabled = !apiKey;
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
    startButton.disabled = !apiKey; // Re-enable based on API key presence
    updatePipButtonState();
}

/**
 * Starts the screen capture stream and displays the floating widget.
 */
async function startStream() {
    if (!apiKey) {
        alert("Vui lòng nhập API Key của bạn để bắt đầu.");
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
 * Fetches the answer from the OpenAI API and updates the UI.
 */
async function getAnswer() {
    if (!stream) return;
    if (!apiKey) {
        displayError("Không tìm thấy API Key. Vui lòng quay lại màn hình chính và nhập key của bạn.");
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
        // Capture the current frame
        captureCanvas.width = screenStreamVideo.videoWidth;
        captureCanvas.height = screenStreamVideo.videoHeight;
        const context = captureCanvas.getContext('2d');
        if (context) {
            context.drawImage(screenStreamVideo, 0, 0, captureCanvas.width, captureCanvas.height);
        }
        const base64ImageData = captureCanvas.toDataURL('image/jpeg').split(',')[1];

        const systemInstruction = `Bạn là một trợ lý thông minh. Nhiệm vụ của bạn là đọc và hiểu nội dung câu hỏi trong ảnh.
        Khi nhận được ảnh, bạn cần:
        1. Hiểu đúng nội dung câu hỏi.
        2. Trả lời ngắn gọn, chính xác, dễ hiểu, bằng tiếng Việt (hoặc cùng ngôn ngữ với câu hỏi).
        3. Giải thích ngắn gọn lý do hoặc cách ra đáp án (nếu cần).
        4. Đánh giá mức độ tin cậy của câu trả lời (ví dụ: Cao, Trung bình, Thấp).
        
        Hãy trả về kết quả dưới dạng một đối tượng JSON hợp lệ với các khóa sau: "answer", "explanation", "confidence".`;

        const payload = {
            model: OPENAI_MODEL,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: systemInstruction
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Phân tích và trả lời câu hỏi trong hình ảnh này."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64ImageData}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 500
        };

        const apiResponse = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            throw new Error(`Lỗi từ API OpenAI: ${errorData.error?.message || apiResponse.statusText}`);
        }

        const data = await apiResponse.json();
        const messageContent = data.choices[0].message.content;
        
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(messageContent);
        } catch (parseError) {
            console.error("Lỗi phân tích JSON từ phản hồi của API:", parseError, "Phản hồi gốc:", messageContent);
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
            if (error.message.toLowerCase().includes('incorrect api key')) {
                displayMessage = 'Lỗi xác thực API. Khóa API của bạn không hợp lệ hoặc đã hết hạn.';
            } else if (error.message.includes('Lỗi từ API OpenAI:')) {
                displayMessage = error.message;
            } else if (error.message.includes('định dạng không hợp lệ')) {
                displayMessage = error.message;
            }
        }
        displayError(displayMessage);
    } finally {
        setLoading(false);
    }
}