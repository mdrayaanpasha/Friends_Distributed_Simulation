import 'dotenv/config';
import express from "express";
import amqp from "amqplib";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

const app = express();
const EXCHANGE_NAME = 'friends-exchange';
const CHARACTER_NAME = "Joe";
const MAX_TURNS = 6;

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  apiKey: process.env.GEMINI_API_KEY,
});

const JoeSchema = z.object({ reply: z.string().describe("Joey's funny/clueless one-liner.") });
const structuredJoe = model.withStructuredOutput(JoeSchema);

let channel;

async function connect() {

    
    const conn = await amqp.connect("amqp://localhost");
    channel = await conn.createChannel();
    
    await channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });
    const q = await channel.assertQueue(`q-${CHARACTER_NAME}`, { durable: true });
    
    await channel.bindQueue(q.queue, EXCHANGE_NAME, CHARACTER_NAME);

    console.log(`[*] ${CHARACTER_NAME} is looking for food...`);

    channel.consume(q.queue, async (msg) => {
        if (!msg) return;
        const { from, message, turn } = JSON.parse(msg.content.toString());
        if (turn > MAX_TURNS) return channel.ack(msg);

        console.log(`\n📩 ${from} -> Joe: ${message}`);
        try {
            const result = await structuredJoe.invoke([
                new HumanMessage(`You're Joey Tribbiani. ${from} said: "${message}". Reply with something clueless or funny.`)
            ]);
            console.log(`💬 Joe -> ${from}: ${result.reply}`);
            await new Promise(r => setTimeout(r, 2000));
            channel.publish(EXCHANGE_NAME, from, Buffer.from(JSON.stringify({ from: CHARACTER_NAME, message: result.reply, turn: turn + 1 })));
        } catch (e) { console.error(e); }
        channel.ack(msg);
    });
}

app.listen(3002, connect);