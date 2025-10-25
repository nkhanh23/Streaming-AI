// DOM Elements
const answerButton = document.getElementById('answer-button') as HTMLButtonElement;
const loadingSpinner = document.getElementById('loading-spinner') as HTMLDivElement;
const responseContainer = document.getElementById('response-container') as HTMLDivElement;
const errorContainer = document.getElementById('error-container') as HTMLDivElement;
const answerText = document.getElementById('answer-text') as HTMLParagraphElement;
const explanationText = document.getElementById('explanation-text') as HTMLParagraphElement;
const confidenceText = document.getElementById('confidence-text') as HTMLParagraphElement;

// Check if it's opened by our main window
if (!window.opener) {
    document.body.innerHTML = '<h1>Lỗi: Cửa sổ này phải được mở từ ứng dụng chính.</h1>';
}

// --- Functions to update UI ---

// Fix: Declared as a function to be accessible throughout the script's scope and fix reference errors.
function setLoading(isLoading: boolean) {
    loadingSpinner.style.display = isLoading ? 'block' : 'none';
    answerButton.disabled = isLoading;
    if (isLoading) {
       responseContainer.style.display = 'none';
       errorContainer.style.display = 'none';
    }
}

// Fix: Declared as a function for consistency and better code structure.
function showResult(result: { answer: string, explanation: string, confidence: string }) {
    answerText.textContent = result.answer;
    explanationText.textContent = result.explanation;
    confidenceText.textContent = result.confidence;
    responseContainer.style.display = 'block';
    errorContainer.style.display = 'none';
}

// Fix: Declared as a function to be accessible throughout the script's scope and fix reference errors.
function showError(message: string) {
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
    responseContainer.style.display = 'none';
}


// --- Event Listeners ---

answerButton.addEventListener('click', () => {
    // Call the getAnswer function from the main window
    // @ts-ignore
    if (window.opener && typeof window.opener.getAnswer === 'function') {
        // @ts-ignore
        window.opener.getAnswer();
    } else {
        // Fix: `showError` is now a declared function and can be called here without an error.
        showError("Không thể kết nối với cửa sổ chính.");
    }
});

// --- Functions exposed to the main window ---

// @ts-ignore
window.setLoading = setLoading;

// @ts-ignore
window.showResult = showResult;

// @ts-ignore
window.showError = showError;
