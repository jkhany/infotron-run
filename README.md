# Infotron Run

A Supaplex-style puzzle game in a single HTML file: 39 boards (all open from the start), synthesised music and sound effects, keyboard and touch controls. It detects a touch screen and switches to a full-screen board with floating on-screen controls.

## Enemies

- **Snik snak** and **electron**: follow walls, deadly on contact. Electrons burst into infotrons.
- **Ping**: a glowing bouncer that flies in a straight line and turns round at anything solid. Only deadly if it runs into you, so a side niche is a safe place to let one pass.
- **Hunter**: a slow chaser (half your speed) that wakes within nine tiles. It cannot dig through base, so pillars and walls stall it.
- **Pulse mine**: sits in the wall and cycles dark, amber, red. It goes off if you are next to it while it is red.

A zonk landing on any enemy destroys it. Boards 36-39 introduce the new ones.

**Play:** https://jkhany.github.io/infotron-run/

## Controls

- Arrows / WASD: move (hold against a zonk to push)
- Space + arrow: eat without moving
- X: drop a red disk
- R: restart · Esc: boards · M: music · N: sound

## Players

Set your name in the Boards menu. Best times are kept per player in this browser; the win screen ranks everyone on this device for each board.

To run locally, open `index.html` in a browser.

To check the engine headlessly (boards load and settle, enemy behaviour), run `node test/harness.js`.

## On a phone or tablet

- Drag the round pad (bottom left) to move; hold it to keep moving or to push a zonk. The pad has a dead zone and keeps your current direction through small thumb wobble, so sliding round the diagonal no longer flips Murphy.
- **EAT**: tap, then a direction, to eat without moving (hold it while steering to keep eating in place).
- **DISK**: drops a red disk; the badge shows how many you carry.
- **Pause**: resume, restart the board, pick a board, music and sound.
