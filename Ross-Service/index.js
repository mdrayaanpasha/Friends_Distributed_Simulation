import express from "express";
import amqp from "amqplib";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const app = express();
let connection, channel;
const QUEUE_NAME = 'Message-Q';
const CHARACTER_NAME = "Ross";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const MAX_TURNS = 6;

async function connectToRabbit() {
    connection = await amqp.connect("amqp://localhost");
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    // 👂 Ross listens for messages
    channel.consume(QUEUE_NAME, async (msg) => {
        if (!msg) return;

        const data = JSON.parse(msg.content.toString());
        const { from, to, message, turn = 1 } = data;



        console.log(`📩 ${from} ➡️ Ross: ${message}`);

        const prompt = `You're Ross from Friends. ${from} just told you: "${message}". Reply with a short, nerdy, sarcastic, or awkward one-liner. No narration, no character names, just the dialogue.`;

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

            const rossReply = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "*awkward silence*";
            console.log(`💬 Ross ➡️ ${from}: ${rossReply}`);

            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 2000) + 1000)); // delay 1–3 sec

            await channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify({
                from: CHARACTER_NAME,
                to: from,
                message: rossReply,
                turn: turn + 1
            })));
        } catch (err) {
            console.error("⚠️ Gemini API Error:", err?.response?.data || err.message);
        }

        channel.ack(msg);
    });
}

// 🎬 Ross starts the conversation
app.get("/make-ross-talk", async (req, res) => {
    try {
        const characters = ["Rachel", "Joe"];
        const randomCharacter = characters[Math.floor(Math.random() * characters.length)];

        const prompt = `Write a witty one-liner Ross from Friends would say to ${randomCharacter}. No narration, no character names, just the dialogue.`;

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

        const rossLine = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Ross is speechless.";


        await channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify({
            from: CHARACTER_NAME,
            to: randomCharacter,
            message: rossLine,
            turn: 1
        })));

        return res.status(200).json({ message: rossLine, to: randomCharacter });

    } catch (error) {
        console.error("Error in /make-ross-talk:", error?.response?.data || error.message);
        return res.status(500).json({ error: "Failed to generate Ross's line." });
    }
});

app.listen(3000, async () => {
    await connectToRabbit();
    console.log("🚀 Ross service running at http://localhost:3000");
});
