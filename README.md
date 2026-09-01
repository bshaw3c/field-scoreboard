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

Open the five-field hub:

```text
http://localhost:4173/hub
```

Each field on the hub opens that field's full-size display page.

Open the personal game tracker:

```text
http://localhost:4173/tracker
```

The tracker is designed for phone portrait use. It stores batting order, pitcher names, batter count, active batter, and pitch totals in that phone's browser storage.

Open the personal position rotation page:

```text
http://localhost:4173/rotation
```

The rotation page stores a pasted inning-by-inning position plan in that phone's browser storage.

## Control Flow

- Ball, Strike, and Foul automatically add one pitch to the defensive pitcher.
- Top inning means the home pitcher gets the pitch count.
- Bottom inning means the visitor pitcher gets the pitch count.
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
https://your-scoreboard-site.example/hub
https://your-scoreboard-site.example/tracker
https://your-scoreboard-site.example/rotation
```

Available field rooms are `FIELD1`, `FIELD2`, `FIELD3`, `FIELD4`, and `FIELD5`.

## Render Persistence

The app can save live field scores to Render Key Value, which is Redis-compatible.

1. In Render, create a Key Value instance in the same region as the scoreboard web service.
2. Use a paid Key Value instance if you want disk-backed persistence.
3. Copy the Key Value internal connection string.
4. In the scoreboard web service, add an environment variable:

```text
REDIS_URL=your-render-key-value-internal-connection-string
```

5. Redeploy the web service.

If `REDIS_URL` is not set, the app still works, but scores are stored only in memory and reset when the service restarts.
