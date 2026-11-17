# Browser audio engine

The project document owns the mix. The browser engine in `layers/studio/app/infrastructure/audio/` only plays that document. It is not MoonBase Bridge and it does not publish RTMP. Bridge still renders Program Output. This graph is the editor's program audio: one `MediaStream` after the master, plus a separate headphone bus.

Domain types stay free of Web Audio nodes ([ADR-009](./decisions.md)). Field lists are in [data-models.md](./data-models.md).

## What a channel is

`AudioChannel` lives on `project.audioMixer` and is the same strip in every scene. A channel owns `sourceIds`. Those sources are summed, then the strip runs once. A source belongs to at most one channel.

`audioVisual` does not have a fader. It stores `channelId`. A visible layer in the active scene enables that channel. Adding the same source to another scene reuses the channel instead of creating a second strip.

`trimDb` (−24…+24) and `faderDb` (−60…+12, unity at 0) are separate. `pan`, `muted`, `solo`, and `monitoring` (`off` | `monitor` | `monitor-and-output`) are on the channel. `syncOffsetMs` (−1000…1000) is stored and not applied. `filters` and `effects` are stored. The effects insert is empty.

## Graph

```mermaid
flowchart LR
  sources[SourceNodes] --> sum[ChannelSum]
  sum --> trim[Trim]
  trim --> insert[EffectsInsert empty]
  insert --> fader[Fader]
  fader --> pan[Pan]
  pan --> mute[Mute]
  mute --> post[PostStrip]
  post --> channelMeter[Channel RMS and peak]
  post --> program[Program sum]
  post --> monitor[Monitor sum]
  program --> master[Master volume then mute]
  master --> masterMeter[Master RMS and peak]
  masterMeter --> stream[MediaStreamDestination]
  monitor --> speakers[AudioContext destination]
```

The channel meter and both sends read `PostStrip`, so mute silences the meter, the program, and the headphones. Solo does not bypass mute.

The master meter reads the same node that feeds the single `MediaStreamAudioDestinationNode`. That stream is not played through the speakers.

## Monitor and solo

Program send, for a channel enabled in the active scene:

- `monitoring: 'off'` and `'monitor-and-output'` go to the program
- `monitoring: 'monitor'` stays off the program
- solo never changes this send

Headphone send, from `PostStrip`, not through the master:

- no solo in the active scene: channels whose monitoring is not `off`
- any solo in the active scene: only the soloed channels

Solo outside the active scene does not steal the headphones.

## Capture is not registration

A source in the project does not open a device. `getUserMedia`, `getDisplayMedia`, and file playback start only from a user gesture. Screen or tab audio is never opened while loading a project or changing scenes.

After a successful start the stream stays for the session. Scene changes only retarget program and monitor sends. The source node is not reconnected when a fader moves. The device closes when the source leaves the project or the engine session ends.

Microphone capture asks the browser to turn off echo cancellation, noise suppression, and automatic gain. Those defaults chop speech and dull the tone. The mixer itself has no gate, compressor, or EQ.

## Meters

Each analyser reports RMS and peak in dB, floored at −60. Channel meters sit after mute. The master meter sits after master volume and master mute. UI ballistics smooth the RMS and hold the peak. They do not change the audio.

## Migration

`ProjectFile` is format 3. A v2 file is upgraded in memory. Scene strips for the same source become one channel when they agree. When they differ, the channel is written neutral (`monitoring: 'off'` included) and the session keeps a conflict report. Save stays blocked until that report is dismissed. The migration does not write the file.

## Not in this graph

EQ, compressor, limiter, noise gate, overlay sounds, and the Bridge mix. The empty effects insert is the place those channel effects will connect: after trim, before the fader.
