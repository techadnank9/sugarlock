# Functional flow

The lifecycle of a gift, in words. See diagrams/functional-flow.svg for the graph.

1. Sender creates a gift — chooses amount, recipient, note, and unlock condition.
   Gift status: draft.

2. Sender funds via Stripe — Checkout charges the sender; money moves into the
   platform balance (modeled as escrow via the ledger). Status: funded -> locked.

3. Gift is locked — the recipient can see it waiting (amount, note, condition)
   but cannot touch it. This "I can see it but can't have it yet" tension is the
   emotional engine of the product.

4. Unlock condition check — the unlock engine evaluates the condition:
   - time: has the unlock date passed?
   - self: did the recipient mark it done?
   - third_party: did the confirmer approve?
   - data: did the external signal fire?
   If not met, the gift stays locked and is checked again later.

5. Gift unlocks — when the condition passes, the engine flips locked -> unlocked.
   The recipient's screen plays the reveal animation.

6. Funds released — the recipient withdraws. Status: unlocked -> released.

The only automated transition is locked -> unlocked, done by the unlock engine.
Everything else is triggered by a user action (create, fund, withdraw).
