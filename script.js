
// WRITEWISE - MAIN JAVASCRIPT
// STABLE UPDATED VERSION

// ELEMENTS

const slides = document.querySelectorAll(".slide");
console.log("Total slides:", slides.length);
console.log("About slide:", document.getElementById("slide-5"));
console.log(
    "About button:",
    document.querySelector('.nav-item[data-slide="5"]')
);
const navItems = document.querySelectorAll(".nav-item");

const loadingOverlay = document.getElementById("loadingOverlay");
const loadingTitle = document.getElementById("loadingTitle");
const loadingDescription = document.getElementById("loadingDescription");

const pageTitle = document.getElementById("pageTitle");
const currentSlide = document.getElementById("currentSlide");
const progressFill = document.getElementById("progressFill");

const writingInput = document.getElementById("writingInput");
const revisedText = document.getElementById("revisedText");

const analyzeButton = document.getElementById("analyzeButton");
const docxFile = document.getElementById("docxFile");

let activeSlide = 0;
let analysisResult = null;
let originalWriting = "";
let toastTimer = null;
let isAnalyzing = false;

const slideTitles = [
    "Welcome to WriteWise",
    "Writing Workspace",
    "AI Writing Analysis",
    "Writing Suggestions",
    "Revised Writing",
    "About WriteWise"
];

const loadingMessages = [
    ["Welcome to WriteWise", "Preparing your writing experience..."],
    ["Loading Workspace", "Preparing your writing environment..."],
    ["Loading AI Analysis", "Opening your writing feedback..."],
    ["Loading Suggestions", "Preparing your recommendations..."],
    ["Loading Revised Writing", "Preparing your improved draft..."],
    ["Loading About", "Discovering more about WriteWise..."]
];

// =====================================
// HELPER FUNCTIONS
// =====================================

function getElement(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const element = getElement(id);

    if (element) {
        element.textContent = value;
    }
}

function countWords(text) {
    const trimmed = String(text || "").trim();

    return trimmed ? trimmed.split(/\s+/).length : 0;
}

function formatFeedback(value, fallback) {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }

    if (Array.isArray(value)) {
        return value.length
            ? value.map(item => {
                if (typeof item === "string") return item;
                return JSON.stringify(item);
            }).join("\n")
            : fallback;
    }

    if (value && typeof value === "object") {
        return Object.entries(value)
            .map(([key, item]) => `${key}: ${item}`)
            .join("\n");
    }

    return fallback;
}

// Handles common response structures from the backend.
function normalizeAnalysis(data) {
    let result = data;

    if (result && typeof result === "object") {
        result =
            result.analysis ||
            result.result ||
            result.data ||
            result;
    }

    if (typeof result === "string") {
        try {
            result = JSON.parse(result);
        } catch {
            throw new Error(
                "The AI returned text instead of structured analysis. Check server.js."
            );
        }
    }

    if (!result || typeof result !== "object" || Array.isArray(result)) {
        throw new Error("The AI returned an invalid analysis format.");
    }

    return {
        grammar: result.grammar || result.grammarFeedback,
        spelling: result.spelling || result.spellingFeedback,
        vocabulary: result.vocabulary || result.vocabularyFeedback,
        clarity: result.clarity || result.clarityFeedback,

        suggestions: Array.isArray(result.suggestions)
            ? result.suggestions
            : [],

        revisedText:
            result.revisedText ||
            result.revised_text ||
            result.correctedText ||
            result.improvedText ||
            result.revised_writing ||
            ""
    };
}

// =====================================
// LOADIconst sNG ANIMATION
// =====================================

function showLoading(title, description) {
    if (!loadingOverlay) return;

    if (loadingTitle) loadingTitle.textContent = title;
    if (loadingDescription) {
        loadingDescription.textContent = description;
    }

    loadingOverlay.classList.add("show");
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.remove("show");
    }
}

// =====================================
// TOAST MESSAGE
// =====================================

function showToast(message) {
    const toast = getElement("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}

// =====================================
// SLIDE NAVIGATION
// =====================================

async function goToSlide(index) {
    if (index < 0 || index >= slides.length) return;
    if (index === activeSlide) return;
    if (isAnalyzing) return;

    const [title, description] = loadingMessages[index];

    showLoading(title, description);

    await new Promise(resolve => setTimeout(resolve, 350));

    slides.forEach(slide => slide.classList.remove("active"));
    navItems.forEach(item => item.classList.remove("active"));

    slides[index].classList.add("active");

    const selectedNav = document.querySelector(
        `.nav-item[data-slide="${index}"]`
    );

    if (selectedNav) {
        selectedNav.classList.add("active");
    }

    activeSlide = index;

    setText("pageTitle", slideTitles[index]);
    setText("currentSlide", String(index + 1).padStart(2, "0"));

    if (progressFill) {
        progressFill.style.width =
            ((index + 1) / slides.length) * 100 + "%";
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    hideLoading();
}

navItems.forEach(item => {
    item.addEventListener("click", () => {
        goToSlide(Number(item.dataset.slide));
    });
});

document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
        goToSlide(Number(button.dataset.go));
    });
});

document.addEventListener("keydown", event => {
    if (
        event.target.tagName === "TEXTAREA" ||
        event.target.tagName === "INPUT" ||
        event.target.isContentEditable
    ) {
        return;
    }

    if (event.key === "ArrowRight") {
        goToSlide(activeSlide + 1);
    }

    if (event.key === "ArrowLeft") {
        goToSlide(activeSlide - 1);
    }
});

// =====================================
// WORD COUNTER
// =====================================

writingInput.addEventListener("input", () => {
    const count = countWords(writingInput.value);

    setText(
        "wordCount",
        count + (count === 1 ? " word" : " words")
    );
});

revisedText.addEventListener("input", () => {
    const count = countWords(revisedText.value);

    setText(
        "revisedWordCount",
        count + (count === 1 ? " word" : " words")
    );
});

// =====================================
// DOCX UPLOAD
// =====================================

docxFile.addEventListener("change", async () => {
    const file = docxFile.files[0];

    if (!file) return;

    console.log("UPLOAD STARTED");
    console.log("Selected file:", file.name);

    if (isAnalyzing) {
        showToast("Please wait until the current analysis finishes.");
        docxFile.value = "";
        return;
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
        showToast("Please select a DOCX file.");
        docxFile.value = "";
        return;
    }

    setText("uploadStatus", "Uploading and reading document...");

    showLoading(
        "Reading Your Document",
        "Extracting text from your DOCX file..."
    );

    try {
        const formData = new FormData();
        formData.append("document", file);

        const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
            cache: "no-store"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Document upload failed.");
        }

        if (!data.text || typeof data.text !== "string") {
            throw new Error("No readable text was found in the document.");
        }

        writingInput.value = data.text;
        writingInput.dispatchEvent(new Event("input"));

        setText("uploadStatus", "✓ " + file.name);

        showToast("Document uploaded successfully!");

    } catch (error) {
        console.error("Upload Error:", error);

        setText("uploadStatus", "Upload failed.");

        showToast(error.message || "Document upload failed.");

    } finally {
        hideLoading();
        docxFile.value = "";
    }
});

// =====================================
// AI WRITING ANALYSIS
// =====================================

analyzeButton.addEventListener("click", analyzeWriting);

async function analyzeWriting() {
    if (isAnalyzing) return;

    const text = writingInput.value.trim();

    if (!text) {
        showToast("Please enter or upload your writing first.");
        return;
    }

    if (text.length > 20000) {
        showToast("Your writing is too long. Maximum is 20,000 characters.");
        return;
    }

    originalWriting = text;
    isAnalyzing = true;

    analyzeButton.disabled = true;
    analyzeButton.textContent = "Analyzing...";

    showLoading(
        "Analyzing Your Writing",
        "WriteWise AI is checking grammar, spelling, vocabulary, and clarity..."
    );

    const controller = new AbortController();

    const requestTimer = setTimeout(() => {
        controller.abort();
    }, 180000);

    try {
        console.log("================================");
        console.log("WRITEWISE: Starting new analysis");
        console.log("Writing length:", text.length);
        console.log("================================");

        const response = await fetch("/api/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text }),
            signal: controller.signal,
            cache: "no-store"
        });

        const responseText = await response.text();

        console.log("HTTP Status:", response.status);
        console.log("Raw API Response:", responseText);

        let rawData;

        try {
            rawData = JSON.parse(responseText);
        } catch {
            throw new Error(
                "The server returned an invalid JSON response."
            );
        }

        if (!response.ok) {
            throw new Error(
                rawData.error || "AI analysis failed."
            );
        }

        const data = normalizeAnalysis(rawData);

        console.log("Normalized Analysis:", data);

        // Do not discard successful feedback just because
        // the revised text field is missing.
        if (!data.revisedText.trim()) {
            console.warn(
                "No revisedText returned. Using original writing as fallback."
            );

            data.revisedText = originalWriting;
        }

        // Save the latest successful analysis.
        analysisResult = data;

        // Display all feedback.
        displayAnalysis(data);

        // Display suggestions even if the array is empty.
        displaySuggestions(data.suggestions);

        // Display revised writing.
        revisedText.value = data.revisedText;
        revisedText.dispatchEvent(new Event("input"));

        // Open the AI Analysis slide.
        const analysisSlide = getElement("slide-2");

        const analysisNav = document.querySelector(
            '.nav-item[data-slide="2"]'
        );

        if (!analysisSlide || !analysisNav) {
            throw new Error("AI Analysis slide could not be found.");
        }

        slides.forEach(slide => slide.classList.remove("active"));
        navItems.forEach(item => item.classList.remove("active"));

        analysisSlide.classList.add("active");
        analysisNav.classList.add("active");

        activeSlide = 2;

        setText("pageTitle", slideTitles[2]);
        setText("currentSlide", "03");

        if (progressFill) {
            progressFill.style.width =
                ((activeSlide + 1) / slides.length) * 100 + "%";
        }

        console.log("WRITEWISE: Analysis displayed successfully.");

        showToast("Your writing analysis is ready!");

    } catch (error) {
        console.error("WRITEWISE ANALYSIS ERROR:", error);

        if (error.name === "AbortError") {
            showToast("Analysis timed out. Please try again.");
        } else {
            showToast(
                error.message || "Unable to analyze your writing."
            );
        }

    } finally {
        clearTimeout(requestTimer);

        isAnalyzing = false;

        analyzeButton.disabled = false;
        analyzeButton.textContent = "Analyze My Writing";

        hideLoading();
    }
}

// =====================================
// DISPLAY AI FEEDBACK
// =====================================

function displayAnalysis(data) {
    setText(
        "grammarFeedback",
        formatFeedback(
            data.grammar,
            "No grammar feedback provided."
        )
    );

    setText(
        "spellingFeedback",
        formatFeedback(
            data.spelling,
            "No spelling feedback provided."
        )
    );

    setText(
        "vocabularyFeedback",
        formatFeedback(
            data.vocabulary,
            "No vocabulary feedback provided."
        )
    );

    setText(
        "clarityFeedback",
        formatFeedback(
            data.clarity,
            "No clarity feedback provided."
        )
    );

    setText(
        "analysisMessage",
        "✓ Analysis complete! Review the feedback below to understand how your writing can improve."
    );
}

// =====================================
// DISPLAY SUGGESTIONS
// =====================================

function displaySuggestions(suggestions) {
    const container = getElement("suggestionsList");

    if (!container) return;

    const validSuggestions = Array.isArray(suggestions)
        ? suggestions
        : [];

    setText(
        "suggestionCount",
        validSuggestions.length +
        (validSuggestions.length === 1
            ? " suggestion found"
            : " suggestions found")
    );

    container.innerHTML = "";

    if (validSuggestions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✓</div>
                <h3>No specific suggestions</h3>
                <p>Your writing may not need specific phrase replacements.</p>
            </div>
        `;

        return;
    }

    validSuggestions.forEach((suggestion, index) => {
        const card = document.createElement("div");
        card.className = "suggestion-card";

        const content = document.createElement("div");

        const heading = document.createElement("h3");
        heading.textContent = "Suggestion " + (index + 1);

        const original = document.createElement("p");
        original.textContent =
            "Original: " + (suggestion.original || "");

        const replacement = document.createElement("p");
        replacement.className = "replacement";
        replacement.textContent =
            "Suggested: " + (suggestion.replacement || "");

        const explanation = document.createElement("p");
        explanation.textContent =
            suggestion.explanation || "No explanation provided.";

        content.append(
            heading,
            original,
            replacement,
            explanation
        );

        const actions = document.createElement("div");
        actions.className = "suggestion-actions";

        const applyButton = document.createElement("button");
        applyButton.className = "small-button apply";
        applyButton.textContent = "Apply";

        const rejectButton = document.createElement("button");
        rejectButton.className = "small-button";
        rejectButton.textContent = "Reject";

        applyButton.addEventListener("click", () => {
            applySuggestion(suggestion, applyButton);
        });

        rejectButton.addEventListener("click", () => {
            applyButton.disabled = true;
            rejectButton.disabled = true;
            rejectButton.textContent = "Rejected";

            showToast("Suggestion rejected.");
        });

        actions.append(applyButton, rejectButton);
        card.append(content, actions);

        container.appendChild(card);
    });
}

// =====================================
// APPLY SUGGESTION
// =====================================

function applySuggestion(suggestion, button) {
    const original = suggestion.original;
    const replacement = suggestion.replacement;

    if (!original || !replacement) {
        showToast("This suggestion cannot be applied.");
        return;
    }

    let currentText = revisedText.value;

    if (currentText.includes(original)) {
        currentText = currentText.replace(original, replacement);

    } else if (writingInput.value.includes(original)) {
        currentText = writingInput.value.replace(original, replacement);

    } else {
        showToast("This phrase was not found in the current draft.");
        return;
    }

    revisedText.value = currentText;
    revisedText.dispatchEvent(new Event("input"));

    button.disabled = true;
    button.textContent = "Applied ✓";

    showToast("Suggestion applied to your revised writing.");
}

// =====================================
// CONTINUE TO REVISED WRITING
// =====================================

getElement("continueButton").addEventListener("click", () => {
    if (!analysisResult) {
        showToast("Please analyze your writing first.");
        return;
    }

    goToSlide(4);
});

// =====================================
// COPY TEXT
// =====================================

async function copyRevisedText() {
    const text = revisedText.value.trim();

    if (!text) {
        showToast("There is no revised text to copy.");
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        showToast("Revised writing copied!");

    } catch (error) {
        revisedText.select();

        const copied = document.execCommand("copy");

        showToast(
            copied ? "Text copied!" : "Unable to copy text."
        );
    }
}

getElement("copyButton").addEventListener(
    "click",
    copyRevisedText
);

getElement("copyFinalButton").addEventListener(
    "click",
    copyRevisedText
);

// =====================================
// ANALYZE AGAIN
// =====================================

getElement("reanalyzeButton").addEventListener("click", async () => {
    if (isAnalyzing) return;

    if (!revisedText.value.trim()) {
        showToast("There is no revised writing to analyze.");
        return;
    }

    writingInput.value = revisedText.value;
    writingInput.dispatchEvent(new Event("input"));

    await goToSlide(1);

    showToast("Your revised writing is ready for another analysis.");
});

// =====================================
// INITIALIZE
// =====================================

function initializeWriteWise() {
    setText("currentSlide", "01");

    if (progressFill) {
        progressFill.style.width =
            (1 / slides.length) * 100 + "%";
    }

    showLoading(
        "Welcome to WriteWise",
        "Preparing your writing experience..."
    );

    setTimeout(() => {
        hideLoading();
    }, 800);
}

initializeWriteWise();
