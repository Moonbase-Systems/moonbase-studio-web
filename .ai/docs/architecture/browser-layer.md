# Browser layer

A browser layer is a page inside the scene preview. The source owns the address and the page viewport. The element owns the transform: position, size, rotation, and crop. Pixi does not draw the page. `SceneBrowserFrames` paints one clipped iframe per visible browser element, with `pointer-events: none` and `allow="autoplay"`. The composition engine skips the browser case so it does not also draw a placeholder.

Field lists are in [data-models.md](./data-models.md). Tab audio joins the graph in [audio-engine.md](./audio-engine.md).

## Address

`url` is empty, an `http` or `https` address, or a root-relative path on this Studio origin, such as `/overlay/lab`. A new layer starts with an empty address. The inspector asks for an address in a text field. There is no built-in catalog of pages.

`isExternalBrowserPageUrl` is true for `http` and `https`. A root-relative path is our own renderer, including Overlay Lab.

## Viewport

A new source stores `width` and `height` at 500. That size is a placeholder, not the layout of a typical alert overlay. Alert widgets are positioned in page pixels on the project frame, usually 1920×1080.

When the address is external, the stored size is still exactly 500×500, and the project video size is positive, the preview uses the project frame as the iframe's layout viewport. Saving the source from the inspector in that situation writes the video size back onto the source and expands elements that are still 500×500. Position is left alone. An element the operator has already resized stays at that size.

A same-origin path keeps the stored viewport. `zoom` (1–4) lays that page out smaller and the frame stretches it back. External pages always use zoom 1, so widget coordinates are not scaled twice. The inspector hides the zoom control for an external address.

The iframe is sized in CSS pixels to that layout viewport, then placed in the layer box with the same contain math as an image crop. A negative zero from that math is stored as zero.

New browser elements set `keepAspectRatio` when the caller omitted the flag. Alt near an edge crops. Alt near a corner rotates. Shift snaps rotation to 15°. Resize keeps aspect when Shift is held or the element already locks aspect.

## Sound switch

`audio` on the browser source is a registration flag, default false. Turning it on does not by itself open a device.

The command `setBrowserPageAudio` ensures one audio source whose `deviceId` is `moonbase:browser-tab`, and one global channel that owns that source. Every browser source with `audio: true` shares that channel, because the browser hands over one tab mix. The channel is named from the browser source only when the channel is created. An existing channel keeps its name and is marked `global`.

Turning the flag off clears it on that source. While another browser source still wants tab audio, the channel stays. If none do, and a scene `audioVisual` still references the channel, the channel remains and `global` becomes false. If nothing references it, the channel and the audio source are removed, which releases the capture. Removing the tab-audio source clears `audio` on every browser source. Removing a browser source that was the last one with `audio: true` follows the same release.

The capture is a separate gesture. The inspector turns the flag on only after `getDisplayMedia` returns a live audio track. Cancelling the share, or sharing without audio, leaves the flag false, so the project does not gain a silent channel. After a reload the flag can stay true while the stream is gone. The connect button starts a new share and arms the existing source on the one audio context. Video tracks from that share are stopped immediately. The request asks the browser to prefer the current tab, to include this page's own surface, to leave the studio graph out of the capture (`restrictOwnAudio`), to not play the captured page through the speakers as well (`suppressLocalAudioPlayback`), and to turn off echo cancellation, noise suppression, automatic gain, and voice isolation. Those hints are browser features, not a guarantee. Focus is asked not to jump when `CaptureController` exists.

Monitoring on the new channel stays `off`. The meter can move while the speakers stay quiet until the operator enables monitor on that strip.

`getDisplayMedia` is missing outside a secure context. `http://` on a LAN address cannot prompt. `localhost` can.

A parent cannot read audio or events out of a cross-origin iframe with `captureStream` or `createMediaElementSource`. Tab share is the browser path for a page such as StreamElements. That page still does not emit Studio cues. See the foreign-page section in [audio-engine.md](./audio-engine.md).

## What stays on the element

The scene element is `{ type: 'browser', sourceId, settings: {} }` plus the shared element fields. URL, size, zoom, refresh, and `audio` are not copied onto the element. Two scenes can point at one browser source and then share one address and one tab-audio registration.
