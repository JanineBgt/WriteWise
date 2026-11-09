
import express from "express";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import mammoth from "mammoth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

// =====================================
// DOCX FILE UPLOAD
// =====================================

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.originalname.toLowerCase().endsWith(".docx")) {
            cb(null, true);
        } else {
            cb(new Error("Please upload a DOCX file only."));
        }
    }
});

app.get("/api/upload-test", (req, res) => {
    res.json({
        success: true,
        message: "WriteWise upload route is working!"
    });
});
app.use(express.static(__dirname));

app.post("/api/upload", upload.single("document"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: "Please select a DOCX file."
            });
        }

        const result = await mammoth.extractRawText({
            buffer: req.file.buffer
        });

        const extractedText = result.value.trim();

        if (!extractedText) {
            return res.status(400).json({
                error: "No readable text found in the document."
            });
        }

        return res.json({
            success: true,
            text: extractedText
        });

    } catch (error) {
        console.error("DOCX UPLOAD ERROR:", error.message);

        return res.status(500).json({
            error: "Unable to read the DOCX document."
        });
    }
});

// =====================================
// GROQ CONFIGURATION
// =====================================

if (!process.env.GROQ_API_KEY) {
    console.error("ERROR: GROQ_API_KEY is missing from .env");
    process.exit(1);
}

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    timeout: 60000,
    maxRetries: 2
});

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

// =====================================
// AI WRITING ANALYSIS
// =====================================

app.post("/api/analyze", async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || typeof text !== "string" || !text.trim()) {
            return res.status(400).json({
                error: "Please enter your writing first."
            });
        }

        if (text.length > 20000) {
            return res.status(400).json({
                error: "Your writing is too long. Please shorten it."
            });
        }

        console.log("--------------------------------");
        console.log("Starting Groq AI analysis...");
        console.log("Model:", GROQ_MODEL);


        const completion = await groq.chat.completions.create({
            model: GROQ_MODEL,

            messages: [
                {
                    role: "system",
                    content: `You are WriteWise, a friendly AI writing assistant for students and non-native English speakers.

Analyze the student's writing in these categories:
1. Grammar
2. Spelling
3. Vocabulary and word choice
4. Clarity and sentence structure
5. Suggestions for improvement
6. Complete corrected version

Return ONE valid JSON object with exactly these fields:

{
  "grammar": "Grammar feedback",
  "spelling": "Spelling feedback",
  "vocabulary": "Vocabulary feedback",
  "clarity": "Clarity and sentence structure feedback",
  "suggestions": [
    {
      "original": "Original phrase",
      "replacement": "Improved phrase",
      "explanation": "Simple explanation"
    }
  ],
  "revisedText": "Complete corrected version of the writing"
}

RULES:
- Return valid JSON only. No Markdown or code fences.
- Include all six required fields.
- Grammar, spelling, vocabulary, and clarity must be strings.
- Suggestions must always be an array.
- Include only relevant and useful suggestions. Do not invent errors.
- Preserve the student's original meaning and ideas.
- Do not unnecessarily change correct sentences.
- Keep explanations simple, supportive, and student-friendly.
- The revisedText must contain the entire corrected document.
- Do not shorten or summarize the student's writing.
- If a category has no errors, state that the writing looks good in that category.
- Make sure all JSON strings are properly escaped.`
                },
                {
                    role: "user",
                    content: `Analyze this student writing:\n\n${text}`
                }
            ],

            temperature: 0.2,

            reasoning_effort: "low",
            reasoning_format: "hidden",
            max_completion_tokens: 16000,

            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "writewise_analysis",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            grammar: { type: "string" },
                            spelling: { type: "string" },
                            vocabulary: { type: "string" },
                            clarity: { type: "string" },
                            suggestions: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        original: { type: "string" },
                                        replacement: { type: "string" },
                                        explanation: { type: "string" }
                                    },
                                    required: ["original", "replacement", "explanation"],
                                    additionalProperties: false
                                }
                            },
                            revisedText: { type: "string" }
                        },
                        required: [
                            "grammar",
                            "spelling",
                            "vocabulary",
                            "clarity",
                            "suggestions",
                            "revisedText"
                        ],
                        additionalProperties: false
                    }
                }
            }

        });

        const output = completion.choices[0]?.message?.content;

        if (!output) {
            throw new Error("Groq returned an empty response.");
        }

        const result = JSON.parse(output);

        const requiredFields = [
            "grammar",
            "spelling",
            "vocabulary",
            "clarity",
            "suggestions",
            "revisedText"
        ];

        for (const field of requiredFields) {
            if (!(field in result)) {
                throw new Error(`Missing response field: ${field}`);
            }
        }

        if (!Array.isArray(result.suggestions)) {
            result.suggestions = [];
        }

        // Keep a combined feedback field for frontend compatibility.
        result.feedback = [
            `GRAMMAR:\n${result.grammar}`,
            `SPELLING:\n${result.spelling}`,
            `VOCABULARY:\n${result.vocabulary}`,
            `CLARITY:\n${result.clarity}`
        ].join("\n\n");

        console.log("Groq response received.");
        console.log("Groq analysis completed successfully.");
        console.log("--------------------------------");

        return res.json(result);


    } catch (error) {
        console.error("GROQ ANALYSIS ERROR:", {
            message: error.message,
            status: error.status,
            code: error.code,
            type: error.type,
            details: error.error
        });
        console.log("--------------------------------");

        const status = Number(error.status || error.statusCode);

        let message = "AI analysis failed. Please try again.";

        if (status === 401 || status === 403) {
            message = "Groq API authentication failed. Please check your GROQ_API_KEY.";
        } else if (status === 429) {
            message = "Groq API usage limit reached. Please wait before trying again.";
        } else if (status === 400) {
            message = "Groq rejected the request. Check the model and request settings.";
        } else if (status === 503 || status === 502) {
            message = "Groq is temporarily unavailable. Please try again later.";
        } else if (error instanceof SyntaxError) {
            message = "The AI returned an invalid JSON response. Please try again.";
        }

        return res.status(500).json({
            error: message
        });
    }
});

// =====================================
// GENERAL ERROR HANDLER
// =====================================

app.use((err, req, res, next) => {
    console.error("SERVER ERROR:", err.message);

    res.status(400).json({
        error: err.message || "Something went wrong."
    });
});

// =====================================
// START SERVER
// =====================================

app.listen(PORT, "0.0.0.0", () => {
    console.log("--------------------------------");
    console.log("WRITEWISE GROQ SERVER IS RUNNING");
    console.log(`Server running on port ${PORT}`);
    console.log("Groq model:", GROQ_MODEL);
    console.log("--------------------------------");
});