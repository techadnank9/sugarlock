# Design tokens

The design thesis: gifts are sugarlock vessels of intention. The interface leans on
the metaphor of something waxed shut and waiting. This is deliberately NOT a
generic fintech look.

## Color

Gold appears ONLY where value is held in suspension (locked gifts, sugarlock
vessels). When a gift opens, color shifts to teal, signalling release. This is
the one rule that carries the whole visual identity — keep gold for "money
waiting," teal for "money freed."

| Token        | Hex       | Use                                   |
|--------------|-----------|---------------------------------------|
| ink          | #10182b   | Base background                       |
| ink-soft     | #1a2540   | Inputs, secondary surfaces            |
| ink-card     | #1f2c4d   | Cards                                 |
| gold         | #d9a441   | Locked state, seals, primary action   |
| gold-soft    | #e8c67e   | Gold highlights, accents              |
| gold-dim     | #8a6d33   | Muted gold, captions                  |
| paper        | #f3efe4   | Primary text on ink                   |
| paper-dim    | #c9c2b2   | Secondary text                        |
| teal         | #4ca894   | Unlocked / released state             |
| line         | rgba(233,198,126,0.16) | Hairline borders          |

## Type

- Display: Fraunces (serif). Used with restraint for headings, amounts, and gift
  names — makes gifts feel like heirlooms, not transactions.
- Body/UI: Inter (sans). Everything functional.
- Amounts always use Fraunces at a large size — the money is the emotional
  centerpiece, so it gets the characterful face.

## Motion

- Locked vessel: slow "breathe" scale loop (3.5s), signalling life held in wait.
- Unlock: a single orchestrated burst (scale + color shift to teal). This is the
  money shot — in the real build use Framer Motion and make it land hard.
- Respect prefers-reduced-motion.

## Voice

- Sentence case everywhere. Warm, plain, specific.
- Actions name what happens: "Fund & seal", "Withdraw $500.00".
- The locked state says the quiet part out loud: "You can see it. You can't
  touch it yet." That line is the product's whole feeling in eight words.
