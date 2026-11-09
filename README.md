# Ant Sprite Playground

**Live:** https://toontalk.github.io/ant-sprite-playground/

A top-down ant colony built from AI-drawn sprite sheets. Ants wander, find crumbs, carry them home and lay scent trails that the others follow. A spider can be let in to hunt them. You are the Anteater, and you can chat with **Aunt Hillary**, the colony as a whole, who answers as a superorganism.

Aunt Hillary comes from the dialogue "Prelude... Ant Fugue" in Douglas Hofstadter's *Gödel, Escher, Bach* (1979). In the book, no single ant understands anything, but the colony as a whole can think and talk. Here she is played by an AI. With each question it is sent a plain-words summary of what the colony is doing right now, and you can read that summary under "What she can feel right now".

## What you can do

- **Crumb**: tap to drop a pile of crumbs, or drag to sprinkle single crumbs.
- **Lead**: hold and drag, and nearby ants follow you.
- **Scatter**: stamp the ground.
  - Nearby ants bolt, and many drop what they carry.
  - The scent there is wiped out.
  - A spider nearby is frightened off.
- **Anteater**: tap or drag to lick up ants. The queen lays a new ant at the nest every second and a half until the colony is back to size.
- **Let in a spider**: a spider comes in to hunt. Ants that see it run away. It eats up to three ants and then leaves.
- **Sprite lab**: turn any walker to any heading, step through its frames, and compare frames with the ghost of the previous one.

## Aunt Hillary's AI

- **Gemini Nano**, built into desktop Chrome. It is free and runs on your computer, and it is the default when Chrome offers it.
- **Your own key** for Claude, Gemini or ChatGPT, set in **AI settings**. Keys stay in your browser and are stored only if you tick "Remember".
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

## License

MIT for the code. See [LICENSE](LICENSE).
