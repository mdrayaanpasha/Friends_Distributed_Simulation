import express from "express";
import amqp from "amqplib";



const app = express();
let connection, channel;
const Q = 'Ross-Q';


async function connectToRabit() {
    connection = await amqp.connect("amqp://localhost");
    channel = await connection.createChannel();

    await channel.assertQueue(Q, { durable: true });


}


app.get("/makeRossTalk", async (req, res) => {
    const characters = ["Rachel", "Joe"];
    const moodToCharacter = {
        "Joe": ["frustrated", "condescending", "amused", "supportive", "confused", "jealous", "protective", "scientific", "sarcastic", "deadpan"],
        "Rachel": ["romantic", "jealous", "supportive", "awkward", "angry", "sarcastic", "nostalgic", "vulnerable", "teasing", "playful"]
    };


    const actualConversation = {

        "Joe": {
            "frustrated": [
                "Joey, stop putting pizza in the VCR!",
                "I just cleaned the fossils, and you sneezed on them!",
                "You can’t mix ketchup and milk and call it a smoothie.",
                "Joey! The museum is not your dating ground!",
                "Why is there a slice of cheese in my fossil drawer?",
                "This is not how paleontology works!",
                "No, Joey, you can't glue googly eyes to the T-Rex skull.",
                "I said 'brush up on evolution', not 'watch Pokémon'!",
                "You broke my laptop trying to play Solitaire with a hammer.",
                "No! You cannot adopt a penguin just because it ‘vibes like you.’"
            ],
            "condescending": [
                "No, Joey. The Earth isn’t 2,000 years old.",
                "It’s a hypothesis, not a ‘scientific maybe.’",
                "That’s not a comet. That’s a pizza bagel.",
                "Dinosaurs are extinct. They didn’t ‘go into hiding.’",
                "You can’t just ‘manifest’ a Nobel Prize.",
                "Books aren’t ‘outdated Wikipedia’ — they’re books!",
                "That’s not a fossil. That’s a chicken bone.",
                "Yes, Joey, gravity is still a thing.",
                "You can't un-eat knowledge. Stop trying.",
                "The moon doesn’t ‘blink’ once a month."
            ],
            "amused": [
                "You thought the thesaurus was a dinosaur!",
                "You called my dissertation a ‘rom-com with rocks.’",
                "You wore three shirts to look ‘smarter.’",
                "You mistook a microscope for a beer tap.",
                "You high-fived a skeleton thinking it was me.",
                "You applied to be a ‘professional napper’... and got shortlisted?",
                "You tried to microwave a metal fork... twice.",
                "You asked if 'Jurassic' was a type of pasta.",
                "You texted me ‘Ross-saurus’ at 2AM.",
                "You actually made flashcards for flirting."
            ],
            "supportive": [
                "That audition? You killed it.",
                "You’re getting better every day, man.",
                "I’m proud of you, Joey. Seriously.",
                "You’ve got natural charisma, use it.",
                "Don’t let one casting director define you.",
                "You're not just good — you're unforgettable.",
                "You helped me through my divorce, I won’t forget that.",
                "If you ever need help running lines, I’m there.",
                "Your instincts are underrated.",
                "You’ve got this. And I believe in you."
            ],
            "confused": [
                "Why are you wearing oven mitts to bed?",
                "Did you just put peanut butter in your coffee?",
                "Why is there glitter on my thesis?",
                "Why is your phone in the fridge again?",
                "You adopted a pigeon and named it ‘Ross Jr.’?",
                "You rented a llama? For what?",
                "Why are you wearing sunglasses in the shower?",
                "Is that cologne… or motor oil?",
                "Did you just call your sandwich ‘Monica’?",
                "Why are my pants in your freezer?"
            ],
            "jealous": [
                "So you *and* Rachel went to dinner, huh?",
                "I didn’t know you two were… hanging out so much.",
                "I guess some guys get the girl *and* the sandwich.",
                "She laughed at your joke more than mine.",
                "You told her my dino fact was ‘meh’?",
                "I mean… good for you. Whatever.",
                "She said your cologne was ‘rugged’. What does that mean?",
                "You helped her move. *I* offered first.",
                "She hugged you *twice*. I counted.",
                "Why are you suddenly Mr. Sensitive?"
            ],
            "protective": [
                "Joey, don't date that casting agent. She's shady.",
                "You're not going skydiving without a license!",
                "That role’s a scam. Trust me.",
                "Don’t lend your savings to that director.",
                "You deserve better than that critic's review.",
                "You’re not fat — you're bulking. For acting.",
                "You're amazing. Don’t let them use you.",
                "I’ll talk to Chandler if he's being harsh.",
                "Don’t take that gig if it feels wrong.",
                "I’ll help you rewrite your résumé."
            ],
            "scientific": [
                "Actually, pizza activates your dopamine centers.",
                "Your brain is responding to serotonin spikes.",
                "No, memory doesn’t work that way, Joey.",
                "Dreams are not prophecies.",
                "Yes, Joey, the body does contain trace metals.",
                "That’s not magic — that’s biochemistry.",
                "You're reacting to pheromones. It's not love.",
                "The placebo effect is real, Joey.",
                "It’s not a curse. It's seasonal affective disorder.",
                "Sneezing doesn’t make you lose brain cells."
            ],
            "sarcastic": [
                "Oh sure, let’s ask Joey the paleontologist.",
                "Brilliant, Joey. Dinosaurs invented waffles now?",
                "Wow, what a scientific breakthrough: ‘Dino pizza.’",
                "Yeah, because reading minds is *totally* your thing.",
                "Oh, Joey's got a new theory again. Everyone listen.",
                "Yes, Joey, clearly the moon follows *you*.",
                "Time travel? Tell me more, Dr. Tribbiani.",
                "Oh look, it’s the discoverer of gravity himself!",
                "You should publish this in the Journal of Nonsense.",
                "Maybe the Nobel committee will call you next."
            ],
            "deadpan": [
                "Joey, there's a duck in your hat again.",
                "You taped your résumé to a pizza box?",
                "You named your plant ‘Chick Jr.’?",
                "You think Hamlet was in *Star Wars*?",
                "You offered to act in my lecture. As a rock.",
                "You tried to return a half-eaten sandwich as ‘damaged goods.’",
                "You wore a suit made of corduroy… in summer.",
                "You mistook my fossil for a dog treat.",
                "You called 911 because your sandwich was missing.",
                "You told Rachel I’m 'emotionally overcooked.'"
            ]
        },
        "Rachel": {
            "romantic": [
                "I never stopped loving you, you know.",
                "You're the only one who ever made me forget about dinosaurs.",
                "When I saw you in that green dress, my brain short-circuited.",
                "You were worth every awkward prom night I had to suffer through.",
                "You're my lobster. End of story.",
                "You’re not just beautiful, you’re home.",
                "I'd go to any planet, any museum, any dimension for you.",
                "Every time you laugh, I forget I’m supposed to be smart.",
                "No lecture could explain what I feel when I’m around you.",
                "Even when we were 'on a break'… my heart wasn’t."
            ],
            "jealous": [
                "So Mark called you again, huh?",
                "Oh, great, Paolo's back. Fantastic.",
                "You said he was just helping with fashion advice… in your apartment?",
                "Did he really need to touch your waist while talking about sweaters?",
                "I saw the way he looked at you. I study eyes. I know.",
                "It’s cool. I’m fine. Really. Totally not sweating under this turtleneck.",
                "You told him about our breakup before telling me?",
                "Of course he has a yacht. Because of course.",
                "I’m not jealous, I’m just... hyper-aware and historically informed.",
                "I should’ve never introduced you to the concept of Europeans."
            ],
            "supportive": [
                "Rachel, you’ve come so far — don’t let anyone tell you otherwise.",
                "You’ve built your whole career on your own. That’s badass.",
                "You don’t need anyone’s approval. Not even mine.",
                "You handled that meeting like a pro.",
                "You’re smart. Like, scary smart. You just hide it with sarcasm.",
                "I’m here for you, always. Even when I’m annoying.",
                "If you ever doubt yourself, just call me. I’ll remind you who you are.",
                "You’ve survived worse. Like living with Joey.",
                "You’re incredible, and everyone sees it — even if you don’t.",
                "You’ve got this. You always do."
            ],
            "awkward": [
                "Sooo… remember that thing I said when I thought you were asleep?",
                "I was going to text you, but I… accidentally sent it to Monica.",
                "I meant to compliment your outfit, not... your armpit.",
                "Was that your toothbrush I used? Oh God.",
                "About that voicemail… I was drunk and emotionally compromised.",
                "It wasn’t a date-date… it was more like a… food gathering.",
                "My hand was just… looking for the light switch. Not your shoulder.",
                "I was quoting *you*, not mocking you.",
                "Yes, I kept your prom photo in my drawer. Is that weird?",
                "So… I may have used your conditioner. And your razor. And your robe."
            ],
            "angry": [
                "You just threw away years like they meant nothing!",
                "How could you read that letter and still not understand?",
                "I’ve been trying so hard, and you keep shutting me out.",
                "You think this was easy for me?",
                "I gave everything to make us work!",
                "Don't tell me to calm down — this matters to me!",
                "I made a mistake, but I owned it. What about you?",
                "You keep holding it over my head like I’m the only one who messed up.",
                "You knew that would hurt, and you said it anyway.",
                "I can’t keep being the only one trying."
            ],
            "sarcastic": [
                "Oh yeah, I *love* being compared to Mark.",
                "Because nothing says ‘romantic’ like arguing in Central Perk.",
                "Right, Rachel, I’m the *crazy* one here.",
                "Yep, you’re definitely the expert on dinosaurs now.",
                "I’m sure that guy wasn’t flirting. Just licking his lips professionally.",
                "Of course, because your fashion advice is *so* practical for excavations.",
                "No no, I love when you take my last yogurt without asking.",
                "You're right. My PhD *does* make me arrogant. How dare I learn things.",
                "Let me just consult my feelings encyclopedia real quick.",
                "Sure, let’s just pretend the ‘break’ debate never happened."
            ],
            "nostalgic": [
                "Remember our first kiss? You had that tiny umbrella in your hair.",
                "The prom video… I still can’t believe I almost missed that moment.",
                "Do you remember that weekend in Montauk?",
                "You smelled like apples and chaos back then.",
                "We were so young. And somehow still this stupid.",
                "I still have that note you wrote on the plane napkin.",
                "You used to steal my cereal and call it a ‘roommate tax.’",
                "Every time I see a museum gift shop, I think of you.",
                "Our first fight was over a cat. A CAT.",
                "I still can’t listen to U2 without thinking of you."
            ],
            "vulnerable": [
                "I’m scared that we’ll never get it right.",
                "What if you’re the one, and I already blew it?",
                "I miss you in ways I can’t even explain.",
                "I hate that I can’t hate you.",
                "I keep dreaming about us… like we never broke up.",
                "You still make my heart race — and that terrifies me.",
                "I tried dating other people, but it’s not the same.",
                "Sometimes I wish we could just start over, clean slate.",
                "You know me better than anyone — and that’s terrifying.",
                "Even when we fight, I’d rather fight with you than laugh with someone else."
            ],
            "teasing": [
                "Oh wow, someone wore real pants today!",
                "Did you dress yourself, or was Ben involved?",
                "Is that cologne or expired vinegar?",
                "You still label your lunch, Ross. That’s peak scientist energy.",
                "Your idea of fun is a ‘bone dating seminar’. Yikes.",
                "You're like a sexy librarian with anxiety.",
                "You talk to fossils more than people.",
                "You wrote a paper on trilobites and called it ‘fun’?",
                "You folded my socks. Adorably weird.",
                "You tried to flirt once and said ‘dinosaurs are romantic.’"
            ],
            "playful": [
                "Tag, you're it — and no, you can’t use science to dodge it.",
                "If you can name three fashion designers, I’ll let you pick the movie.",
                "Let’s see if your trivia brain can beat my mall knowledge.",
                "Loser has to wear the ‘I kissed a lobster’ shirt!",
                "Come on, dance with me! Just pretend it’s a lecture.",
                "You can’t win an argument with a girl in heels, Ross.",
                "First one to spill coffee buys dinner.",
                "If I win, you admit Jurassic Park was overrated.",
                "Let’s prank call Monica as Chandler’s twin.",
                "Try catching me if you can, Professor Geller."
            ]
        }

    };



    let tries = 0;
    let maxTries = 5;
    let responseData = null;

    while (tries < maxTries) {
        const character = characters[Math.floor(Math.random() * characters.length)];
        const moods = moodToCharacter[character];
        const selectedMood = moods[Math.floor(Math.random() * moods.length)];

        const conversations = actualConversation?.[character]?.[selectedMood];

        if (Array.isArray(conversations) && conversations.length > 0) {
            const randomLine = conversations[Math.floor(Math.random() * conversations.length)];
            responseData = {
                from: "Ross",
                to: character,
                mood: selectedMood,
                message: randomLine
            };
            break;
        }

        tries++;
    }

    if (responseData) {
        res.send(responseData);
    } else {
        res.status(500).send({ error: "Could not find valid conversation after multiple attempts." });
    }

})


app.listen(3000, async () => {
    await connectToRabit();
    console.log("server running on http://localhost:3000 ")
})