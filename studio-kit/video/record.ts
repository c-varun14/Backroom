// Each independent product supplies its own observed UI actions and timing markers.
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
const capture=process.env.BACKROOM_VIDEO_CAPTURE;
if(!capture||!existsSync(resolve(capture)))throw new Error('Set BACKROOM_VIDEO_CAPTURE to the authorized product capture module; follow studio-kit/video/references/capture.md.');
await import(resolve(capture));
