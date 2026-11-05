# Player Extras (Stash plugin)

A handful of quality-of-life additions for the Stash scene player. Interface only: nothing runs on the server, no Python, no extra disk space. Every feature can be switched off in the plugin settings.

*Built with the help of AI (Claude). I use it daily on my own setup, and I'm happy to fix any bugs you find.*

## What you get

| Feature | What it does |
|---|---|
| **☰ Details-panel button** | Opens/closes the scene details panel from the player's control bar, so you don't have to hunt for the thin bar on the left. |
| **Motion heatmap** | A thin coloured strip above the progress bar: blue = little movement, through green and yellow, to red = lots. Built from the sprite thumbnails Stash already generates, so it costs nothing extra. Scenes without sprites simply show no strip. |
| **« » Marker skip** | Jump to the previous / next marker with the buttons or the **[** and **]** keys. A short label shows the marker name, number and time. |
| **☆ Rating popup** | Click ☆ on the player to rate without leaving the video. Adapts to your rating system (1–10 for Decimal, 1–5 stars, or half stars). The button shows the current rating. |
| **⚙ Task-queue button** | A floating button (bottom-right) whenever Stash has tasks queued. Cancel one task, cancel everything waiting in front of a task ("⏭ next"), or clear all. |
| **VR zoom** | While a VR mode (180 / 360) is on, the mouse wheel zooms the VR view in and out. Normal videos are unaffected. |
| **Scroll memory** | Going Back to a list or wall returns you to where you were scrolled. |

## Stash UI

If you use the **Stash UI** front end, Player Extras also adds these to Stash UI's player control bar:

- **☰** - opens/closes Stash UI's details panel (same as its ⓘ button or the **I** key)
- **☆ rating popup** - rate without leaving the video
- **« »** marker buttons and the **[** **]** keys

Stash UI already has its own heatmap (Highlights) and VR mode, so those aren't added. The same "Turn off …" settings apply. Needs a Stash UI version with the `player.controls` extension spot.

## Install

1. Stash → **Settings → Plugins → Available Plugins → Add Source**
   - Name: `Player Extras`
   - URL: `https://mothlight-tools.github.io/stash-player-extras/index.yml`
2. Tick **Player Extras** → **Install**, then **Reload plugins** and refresh the page (F5).

## Settings

All features are on by default. In **Settings → Plugins → Player Extras**, tick "Turn off …" for anything you don't want, then refresh the page.

## Notes

- The heatmap is an estimate based on how much each thumbnail differs from the next, so camera cuts can show as "busy" and slow scenes with a still camera can look calm.
- The details-panel button only has an effect on wide screens (1200px+), where Stash shows the side panel next to the player.
- The heatmap and marker-skip labels need the player controls to be visible (move the mouse over the video).
