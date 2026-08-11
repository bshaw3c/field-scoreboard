# Field Scoreboard

Phone-controlled baseball/softball scoreboard with a display page for an iPad.

The display and controller layouts are responsive for phone portrait, phone landscape, tablet, and desktop screens.

## Local Preview

Start the app:

```sh
node server.js
```

Open the display:

```text
http://localhost:4173/display?room=FIELD1
```

Open the controller:

```text
http://localhost:4173/control?room=FIELD1
```

Use the same room code on both devices.

## Control Flow

- Ball, Strike, and Foul automatically add one pitch to the defensive pitcher.
- Top inning means the home pitcher gets the pitch count.
- Bottom inning means the guest pitcher gets the pitch count.
- Ball 4 clears balls and strikes.
- Strike 3 clears balls and strikes, adds an out, and asks whether to end the half inning when it is the third out.
- Foul adds a pitch; with two strikes, the strike count stays at two.
- End Half switches top/bottom, clears balls, strikes, and outs, and advances the inning after the bottom half.
- Pitch count +/- buttons remain available for corrections.
- Each team has its own clear pitch-count button for pitching changes.

## Field Use

For phone + iPad field testing, this needs to be hosted somewhere public. The app is intentionally simple so it can run on a small cloud host such as Render, Railway, Fly.io, or another Node-capable service.

Once deployed, use:

```text
https://your-scoreboard-site.example/display?room=FIELD1
https://your-scoreboard-site.example/control?room=FIELD1
```

The app keeps game state in memory. If the host restarts, the score resets.
