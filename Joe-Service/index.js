import express from "express";
import amqp from "amqplib";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const app = express();
let connection, channel;
const QUEUE_NAME = 'Message-Q';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const CHARACTER_NAME = "Joe";
const MAX_TURNS = 6;

async function connectToRabbit() {
    try {
        connection = await amqp.connect("amqp://localhost");
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        channel.consume(QUEUE_NAME, async (msg) => {
            if (!msg) return;

            const data = JSON.parse(msg.content.toString());
            const { from, to, message, turn = 1 } = data;


            console.log(`📩 ${from} ➡️ Joe: ${message}`);

            const prompt = `You're Joey from Friends. ${from} just told you: "${message}". Reply with a short, funny, or clueless one-liner. No narration, no character names, just the dialogue.`;

            const geminiRequest = {
                contents: [{ parts: [{ text: prompt }], role: "user" }],
                generationConfig: {
                    temperature: 0.85,
                    maxOutputTokens: 30,
                    topK: 20,
                    topP: 0.95,
                    stopSequences: ["\n"]
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: 3 },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: 3 },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: 3 },
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: 3 },
                    { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: 3 }
                ]
            };

            try {
                const geminiResponse = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
                    geminiRequest,
                    { headers: { "Content-Type": "application/json" } }
                );

                const joeLine = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "How you doin'?";
                console.log(`💬 Joe ➡️ ${from}: ${joeLine}`);

                await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 2000) + 1000)); // delay 1–3 sec

                await channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify({
                    from: CHARACTER_NAME,
                    to: from,
                    message: joeLine,
                    turn: turn + 1
                })));
            } catch (err) {
                console.error("⚠️ Gemini API Error:", err?.response?.data || err.message);
            }

            channel.ack(msg);
        });

    } catch (error) {
        console.error("❌ RabbitMQ connection failed:", error.message);
    }
}

// 🎬 Joe starts the convo with random friend
app.get("/make-joe-talk", async (req, res) => {
    try {
        const characters = ['Rachel', 'Ross'];
        const randomCharacter = characters[Math.floor(Math.random() * characters.length)];

        const prompt = `You're Joey from Friends. Say something completely Joey-like to ${randomCharacter}. Keep it short, funny, or mildly clueless. Just one line of dialogue, no narration.`;

        const geminiRequest = {
            contents: [{ parts: [{ text: prompt }], role: "user" }],
            generationConfig: {
                temperature: 0.85,
                maxOutputTokens: 30,
                topK: 20,
                topP: 0.95,
                stopSequences: ["\n"]
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: 3 },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: 3 },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: 3 },
                { category: "HARM_CATEGORY_HARASSMENT", threshold: 3 },
                { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: 3 }
            ]
        };

        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            geminiRequest,
            { headers: { "Content-Type": "application/json" } }
        );

        const joeLine = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "How you doin'?";

        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 2000) + 1000)); // delay 1–3 sec

        await channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify({
            from: CHARACTER_NAME,
            to: randomCharacter,
            message: joeLine,
            turn: 1
        })));

        return res.status(200).json({ message: joeLine });

    } catch (error) {
        console.error("Error in /make-joe-talk:", error?.response?.data || error.message);
        return res.status(500).json({ error: "Failed to generate Joe's line." });
    }
});

app.listen(3002, async () => {
    await connectToRabbit();
    console.log("🕺 Joe's listener running at http://localhost:3002");
});
