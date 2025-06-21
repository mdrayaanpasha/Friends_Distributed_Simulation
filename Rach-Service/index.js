import express from "express";
import amqp from "amqplib";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const app = express();
let connection, channel;
const QUEUE_NAME = 'Message-Q';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const MAX_TURNS = 6; // Limit the back-and-forth

async function connectToRabbit() {
    try {
        connection = await amqp.connect("amqp://localhost");
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        channel.consume(QUEUE_NAME, async (msg) => {
            if (!msg) return;

            const data = JSON.parse(msg.content.toString());
            const { from, to, message, turn = 1 } = data;

            // Ignore if message isn't for Rachel or is from Rachel herself


            console.log(`📩 ${from} ➡️ Rachel: ${message}`);

            const prompt = `Imagine you're Rachel from Friends. ${from} just told you: "${message}". Reply with a short, witty one-liner. No narration, no character names, just the dialogue.`;

            const geminiRequest = {
                contents: [{ parts: [{ text: prompt }], role: "user" }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 30,
                    topK: 20,
                    topP: 0.9,
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

                const rachelLine = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "🙄";
                console.log(`💬 Rachel ➡️ ${from}: ${rachelLine}`);

                await new Promise(res => setTimeout(res, Math.floor(Math.random() * 2000) + 1000)); // wait 1–3 sec

                await channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify({
                    from: "Rachel",
                    to: from,
                    message: rachelLine,
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

// 🎬 Rachel starts the conversation
app.get("/make-rachel-talk", async (req, res) => {
    try {
        const characters = ['Ross', 'Joe'];
        const randomCharacter = characters[Math.floor(Math.random() * characters.length)];

        const prompt = `Write a single witty sentence Rachel would say to ${randomCharacter} in Friends. No narration, no character names, just the dialogue.`;

        const geminiRequest = {
            contents: [{ parts: [{ text: prompt }], role: "user" }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 30,
                topK: 20,
                topP: 0.9,
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

        const rachelLine = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "🙄";

        await channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify({
            from: "Rachel",
            to: randomCharacter,
            message: rachelLine,
            turn: 1
        })));

        return res.status(200).json({ message: rachelLine });

    } catch (error) {
        console.error("Error in /make-rachel-talk:", error?.response?.data || error.message);
        return res.status(500).json({ error: "Failed to generate Rachel's opening line." });
    }
});

app.listen(3001, async () => {
    await connectToRabbit();
    console.log("🎙️ Rachel's listener running at http://localhost:3001");
});
