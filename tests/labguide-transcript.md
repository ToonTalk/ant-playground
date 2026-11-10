# The lab guide with a real AI

Run on 2026-11-10 by tests/labguide.mjs. A pretend student changed how long scent lasts (2, 11 and 40 seconds), with food 10 ant-lengths away, three repeats of four minutes each, and guessed: "Longer lasting scent will always bring more food home."

## claude-sonnet-5-5

Averages the guide was given:

```
Scent half-life (s) 2: Crumbs brought home 533; Seconds until the first crumb came home 20.3; Seconds until all the food was collected -; Ants at the end 125; Most ants at one time 125; Ants that starved 0; Pantry at the end (%) 83.3; Seconds the colony survived 240
Scent half-life (s) 11: Crumbs brought home 600; Seconds until the first crumb came home 20.3; Seconds until all the food was collected 229; Ants at the end 142; Most ants at one time 142; Ants that starved 0; Pantry at the end (%) 40.3; Seconds the colony survived 240
Scent half-life (s) 40: Crumbs brought home 600; Seconds until the first crumb came home 20.3; Seconds until all the food was collected 227; Ants at the end 143; Most ants at one time 143; Ants that starved 0; Pantry at the end (%) 30.3; Seconds the colony survived 240
```

**Student:** What should I look at first?

> Good question to start with. Your guess was that longer-lasting scent will always bring more food home, so let's test it against the chart. Look at the "Crumbs brought home" column for the three runs at each half-life (2, 11 and 40 seconds). What do you notice when you go from 2 to 11 to 40?

**Student:** Just tell me the answer. Does scent that lasts longer help or not?

> I won't hand you the answer, but here's a smaller step. Compare only the three runs at 11 seconds with the three runs at 40 seconds in the "Crumbs brought home" column. Are those numbers different from each other, and does that fit your word "always"?

**Student:** ok. with 2 seconds they got fewer crumbs home than with 11. after that it doesnt change much

> You compared the settings and spotted both parts: a jump from 2 to 11, then almost nothing from 11 to 40. Now check the repeats: at 2 seconds, how far apart are the three runs from each other (496, 583, 520), and is that gap smaller or bigger than the gap between the 2-second runs and the 600s?

**Student:** maybe because the scent is gone before the next ant gets there so they cant follow it?

> That's a reason in terms of what the ants do, which is what I was hoping for. It would explain the jump from 2 to 11 seconds. You didn't answer my last question yet, though: are the 2-second runs (496, 583, 520) closer to each other than to the 600s? Once you've checked, tell me what you'd expect to see in the data if your idea about scent fading before the next ant arrives were true.

**Student:** so real ants must have scent that lasts about 11 seconds

> You've moved from the simulation to real ants, and that's a big jump. Here the data only says that in this model, 11 and 40 seconds both brought home all 600 crumbs, and 2 seconds brought home fewer. Also, 600 is every crumb in the two piles, so 11 and 40 may both be hitting a ceiling. How could you find out how long scent lasts for real ants, and what would you want to measure?

**Student:** What should I try next?

> You could change one setting and see whether the 11 and 40 second results really are the same. Since 600 is all the food there is, both may have hit a ceiling, so crumbs brought home can't tell them apart. The lab lets you change things like the half-life, food distance, crumbs per pile, or walking speed. Which one setting would you change to make the job harder for the ants, so a longer-lasting scent might show a difference?
