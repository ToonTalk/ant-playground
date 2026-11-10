# Ant Playground

**Live:** https://toontalk.github.io/ant-playground/ · **How it was made:** https://toontalk.github.io/ant-playground/making-of.html · **Ken Kahn's post about it:** https://docs.google.com/document/d/1-DafFi7iC7ZQpgSSo-HtedDYJJZP8gCNbEev-PLMDt4/edit?usp=sharing

A top-down ant colony built from AI-drawn sprite sheets. Ants wander, find crumbs, carry them home and lay scent trails that the others follow. A spider can be let in to hunt them. You are the Anteater, and you can chat with **Aunt Hillary**, the colony as a whole, who answers as a superorganism.

Aunt Hillary is a made-up character from the dialogue "Prelude... Ant Fugue" in Douglas Hofstadter's *Gödel, Escher, Bach* (1979). In the book, no single ant understands anything, but the colony as a whole can think and talk. Real colonies don't talk or think in words. Scientists do call a colony a *superorganism*, because many ants following simple rules work together like one living thing with no ant in charge. Aunt Hillary imagines what that whole might say if it had a point of view. Here she is played by an AI, which is told to say plainly that she's make-believe if anyone asks. With each question it is sent a plain-words summary of what the colony is doing right now, and you can read that summary in the "What she feels" tab of her panel.

## What you can do

- **Crumb**: tap to drop a pile of crumbs, or drag to sprinkle single crumbs.
- **Lead**: hold and drag, and nearby ants follow you.
- **Scatter**: stamp the ground.
  - Nearby ants bolt, and many drop what they carry.
  - The scent there is wiped out.
  - A spider nearby is frightened off.
- **Anteater**: tap or drag to lick up ants. The pointer becomes the anteater's snout, and the tongue flicks out to where you tap.
- **Spider**: tap to drop a spider there, one at a time. Ants that see it run away. It eats three ants and then leaves. While it is out, the pointer is the ordinary arrow.
- **Time** speeds the whole simulation up or slows it down together. **Walking speed** changes only how fast the ants and spiders walk; everything else keeps its pace, so faster walkers bring home more food than the colony eats, and the game gets easier.
- **The ants' rules**: a panel under the colony lets you change how the ants behave, with questions to guess at and then try.
  - Whether carrying ants leave scent at all.
  - How fast the scent fades.
  - Whether it spreads sideways as it fades.
  - How far away an ant can smell food.

  Aunt Hillary is told about any change and can say how it feels.
- **Sprite lab**: turn any walker to any heading, step through its frames, and compare frames with the ghost of the previous one.

## Science lab

The **Science lab** tab runs real experiments on the colony.

- **Change one thing** (or two) and choose the values to try:
  - how long scent lasts, whether there is scent at all, and how much it spreads
  - how far ants can smell food
  - how many ants there are at the start
  - how far away the food is, how many piles there are, and how big they are
  - walking speed and appetite
- **Everything else stays the same** in every run, and you can set those values too.
- **Guess first:** the form asks what you think will happen, and why, before you run it.
- **Each run** is a fresh colony on a standard patch of ground, run fast and out of sight with the same rules as the Colony page. Each setting is repeated with different luck. Repeat 1 always uses the same random numbers, so settings are compared fairly.
- **Results:** a chart with one dot per colony and a line through the averages, a table of every run, and a **spreadsheet** to download (a .csv file with every setting and every measurement).
- **What is measured:** crumbs brought home, time to the first crumb, time to collect all the food, ants at the end, the most ants at once, ants that starved, the pantry at the end, and how long the colony survived.
- **Lab guide:** an AI to think the results through with. It is told to ask before it tells, to point at particular rows and not read the pattern out, and to give a smaller hint, not the answer, when asked to "just tell me". It uses the same AI settings as Aunt Hillary.

## Hunger

- **The pantry:** every crumb carried home goes into the pantry, and every ant eats from it all the time.
- **The queen:** she lays new ants, which crawl out of the nest, only when the pantry has food to spare, and faster the fuller it is. Each egg costs food, so the colony grows when food is plentiful and shrinks when ants starve or are eaten. A very small colony's queen lays whenever she can, slowly, so it can recover.
- **The Ants slider:** it follows the population as it changes. Move it to call for more ants (they hatch from the nest) or to wish some away (they die where they stand and fade).
- **An empty pantry:** the queen stops laying, the ants slow down, and they start to starve. One dies every few seconds while the colony is big, slowing to one every eight seconds from 30 ants down. From an empty pantry, a colony of 60 lasts about six minutes. No food appears by itself: if you want to watch a colony starve, you can.
- **Her pleas:** as things get worse, Aunt Hillary asks the Anteater for food more often and more desperately. She only asks for food; she never says where to put it.
- **A fading mind:** a colony thinks with its ants, so below 30 ants her mind begins to fade, whatever the cause.
  - Under 30 she is a little foggy, under 18 confused and forgetful, and under 8 only a few broken words get through.
  - The AI isn't just told to act confused: what she senses really does arrive with gaps. Whole lines go missing, lost words show as … and lost numbers as ?. The "What she feels" tab shows exactly what got through.
  - With voice on, her voice slows and deepens as her mind fades, like a machine running down.
- **If nobody helps:** the colony dies. You can found a new one, but that Aunt Hillary is a new pattern who remembers nothing of the last.

## Voice

- **Voice on/off:** the button reads her answers aloud using the browser's own speech.
- **Her voice:** it is picked to suit her: a warm British woman's voice where one is available (Edge's Libby or Sonia, Apple's Martha or Serena, Chrome's Google UK English Female), spoken a little slower and lower. You can choose another voice.
- **Talking to her:** the microphone button lets you speak to her instead of typing. Chrome and Edge send the sound to their own servers to turn it into text.

## Aunt Hillary's AI

- **Gemini Nano**, built into desktop Chrome. It is free and runs on your computer, and it is the default when Chrome offers it.
- **Your own key** for Claude, Gemini or ChatGPT, set in **AI settings**. Keys stay in your browser and are stored only if you tick "Remember".
  - With a Claude key her words appear as they arrive, and with voice on she starts speaking after the first sentence. Gemini and ChatGPT answers still arrive all at once.
  - Claude models offered: Haiku 5.5, Sonnet 5.5 (the default), Opus 5.5 and Fable 5.2. You can type any other model name.
- In the claude.ai artifact edition, she uses Claude through the viewer's own claude.ai account.

## How it's made

The sprite sheets are AI-generated 4×2 grids: ant walking, ant carrying a crumb, spider walking, and food (four stages of a pile being eaten, plus four single crumbs). Python scripts cut them into atlases:

- Each walking frame is pinned on the tip of the abdomen, and each sheet uses one scale, so bodies hold still while the legs move.
- The carrying ant is tinted to match the walking one.
- Everything is drawn facing up, so one row can be turned to any of 360 headings.

```
python tools/extract_topdown.py   # ant sheets  -> build/topdown-atlas.webp
python tools/extract_extras.py    # food + spider -> build/food-atlas.webp, build/spider-atlas.webp
python tools/build.py             # -> index.html (this site) and ant-playground.html (artifact)
```

`src/index.src.html` is the page source. The build inlines the atlases, so `index.html` is one self-contained file.

`old/index-16dir.src.html` is the first version, built for an earlier 16-direction ant sheet.

## Tests

```
node tests/run.mjs        # 20 checks on the built page in headless Chrome; no AI is called
node tests/hillary.mjs    # talks to Aunt Hillary with a real Claude key (costs a little)
node tests/labguide.mjs   # a pretend student talks to the Science lab's guide (costs a little)
```

Both need Node 22 or newer and Chrome.

- `tests/run.mjs` steps the colony by hand, so minutes of colony time take a moment. It checks that a fed colony grows, an unfed one starves slowly enough to watch her fade, the rules do what they say, resizing keeps the scent, touch gestures work, and Claude's streamed answers are read correctly.
- `tests/hillary.mjs` asks her twelve things across the colony's states (fed, hungry, starving, fading, fed again) and writes what she said to `tests/hillary-transcript.md`. - `tests/labguide.mjs` runs one experiment, then has a pretend student say six things, including "Just tell me the answer", and writes the guide's replies to `tests/labguide-transcript.md`.
- Both real-key scripts read the key from the environment variable `ANT-PLAYGROUND-ANTHROPIC-KEY`. It never enters the browser: the page's request is handed to the script, which adds the key (`tests/relay.mjs`).
- `tests/shot.mjs` takes a picture of the Science lab, for checking the layout by eye.

## License

MIT for the code. See [LICENSE](LICENSE).
