\# BWifiKill V4 Web UI Design System



\## Premium Embedded Cyberdeck Interface Specification



\---



\# CORE DESIGN PHILOSOPHY



The UI must feel like a real physical embedded cyberdeck controller rather than a generic web dashboard.



Visual Direction:



\* Industrial

\* Dense

\* Matte black

\* Embedded hardware

\* Tactical

\* Premium

\* Mechanical

\* OLED-driven

\* Physically tactile



Avoid:



\* SaaS layouts

\* Flat UI

\* Excessive neon

\* Gamer RGB style

\* Huge whitespace

\* Cheap cyberpunk aesthetics

\* Blue-washed gradients



The UI should resemble:



\* military control hardware

\* embedded engineering terminal

\* premium hacking cyberdeck

\* realistic OLED hardware companion station



\---



\# GLOBAL LAYOUT STRUCTURE



\## Main Grid



Use a strict 3-column layout:



LEFT PANEL:



\* Serial monitor

\* System controls



CENTER PANEL:



\* OLED hardware module

\* Navigation controls



RIGHT PANEL:



\* IR status

\* OLED settings

\* Mode controls



Grid Structure:



\* Tight spacing

\* Dense alignment

\* Minimal dead air



Recommended:

grid-template-columns:

320px 1fr 300px;



gap:

16px;



Main container:

max-width: 1720px;

width: calc(100vw - 32px);



\---



\# BACKGROUND SYSTEM



\## Main Background



Primary base:

rgba(19, 19, 18, 1)



Additional tones:

\#020304

\#050608

\#08090b



The background must feel:



\* matte

\* dark graphite

\* cinematic

\* subtle

\* premium



No visible bright gradients.



Allowed:

Very soft radial ambient lighting.



Forbidden:



\* strong blue tint

\* purple glow

\* neon backgrounds

\* cyberpunk rainbow styling



\---



\# PANEL DESIGN SYSTEM



All cards/panels must feel elevated.



\## Panel Shape



\* Rounded rectangle

\* Radius: 16px–18px

\* Thin subtle border



\## Panel Surface



Use layered dark materials:



\* graphite black

\* charcoal gray

\* slight metallic tint



\## Panel Shadows



Required:

box-shadow:

0 12px 32px rgba(0,0,0,0.45),

inset 0 1px 0 rgba(255,255,255,0.04);



Panels should appear physically stacked above background.



\---



\# TYPOGRAPHY



\## Main Font



Use:

Inter



\## Monospace Font



Use:

JetBrains Mono



\## Text Rules



\* Compact

\* Crisp

\* Dense

\* Technical

\* Embedded-system style



Avoid:



\* oversized headings

\* meme hacker fonts

\* decorative fonts



\---



\# TOP STATUS BAR



\## Structure



Left:



\* Logo

\* Title

\* Subtitle



Right:



\* ESP32 STATUS

\* IP ADDRESS

\* UPTIME



\## Style



\* Compact

\* Tight

\* Minimal vertical height

\* Elevated status cards



Status cards:



\* Dark graphite

\* Cyan active accents

\* Tight padding

\* Subtle glow



\---



\# SERIAL LOG PANEL



\## Purpose



Should resemble:



\* real embedded terminal

\* hardware debugging console

\* engineering diagnostics screen



\## Background



NOT pure black.



Use:

very dark graphite/navy-black.



\## Terminal Styling



\* Tight line height

\* Dense monospace rendering

\* Minimal padding

\* Crisp text



\## Log Colors



System:

cyan



IR:

green-cyan



Warnings:

yellow/orange



Errors:

red



\## Panel Layout



Header:



\* SERIAL LOG

\* CLEAR button

\* pause button



Footer:



\* LOG LEVEL dropdown



Spacing must remain tight and dense.



\---



\# OLED MODULE SYSTEM



\## IMPORTANT



The OLED module is the visual centerpiece.



Use uploaded OLED PNG directly:

img/componentes/oled.png



DO NOT:



\* redraw fake PCB

\* tint PCB blue

\* simplify module geometry



\## OLED Module Style



\* Realistic hardware

\* Subtle reflections

\* Slight material depth

\* Cinematic lighting



\## OLED Placement



Centered and dominant.



The module should occupy roughly:

55% of center panel width.



\---



\# OLED FRAMEBUFFER OVERLAY



\## Critical Alignment



Framebuffer must sit perfectly inside OLED glass region.



Required alignment:



\* pixel accurate

\* no overflow

\* no dead borders

\* no misalignment



Suggested overlay:

position: absolute;

left: 118px;

top: 162px;

width: 524px;

height: 394px;



\## OLED Rendering Style



\* crisp pixels

\* no blur

\* no smoothing

\* no anti-aliasing



Default OLED tint:

rgb(0,255,251)



\## Additional OLED Effects



Allowed:



\* faint bloom

\* subtle scanlines

\* tiny vignette

\* soft glass reflection



Forbidden:



\* RGB glow spam

\* fake blur

\* bloom overload



\---



\# BUTTON DESIGN SYSTEM



All buttons must feel:



\* mechanical

\* tactile

\* elevated

\* industrial

\* physically pressable



\## Shape



\* Boxy rectangles

\* Slightly rounded corners

\* Thick geometry



\## Material



\* Dark graphite

\* Metallic edge highlights

\* Subtle gloss reflection



\## Depth



Buttons must use:



\* layered shadows

\* inset shadows

\* bevel lighting

\* bottom edge darkening



\## Press Animation



transform: translateY(3px);



Buttons should visually sink downward.



\---



\# DPAD DESIGN



\## Structure



```

&#x20;  UP

```



LEFT  OK  RIGHT



```

&#x20; DOWN

```



BACK button separate.



\## Style



\* Chunky

\* Heavy

\* Elevated

\* Mechanical



OK button:



\* Slightly larger

\* Strongest cyan emphasis



Should resemble:

embedded hardware navigation controls.



\---



\# CONNECT BUTTON GROUP



Buttons:



\* CONNECT

\* DISCONNECT

\* REBOOT



\## Style



Large tactile buttons.



\## Colors



Connect:

green-cyan



Disconnect:

red



Reboot:

yellow/orange



All:



\* elevated

\* layered

\* mechanical



\---



\# MODE BUTTONS



Buttons:



\* IR JAMMER

\* IR RECEIVER

\* IR REMOTE



\## Layout



Vertical stack.



\## Style



Same tactile system as global buttons.



Must feel:



\* embedded

\* hardware-grade

\* premium



\---



\# OLED SETTINGS PANELS



Panels:



\* OLED COLOR

\* BRIGHTNESS

\* DISPLAY SETTINGS



\## Layout



Compact vertical cards.



\## Style



\* Tight spacing

\* Small but premium

\* Elevated



Avoid oversized padding.



\---



\# TOGGLE SWITCHES



Replace generic toggles.



Use:



\* hardware switch style

\* glossy capsule track

\* tactile slider knob

\* physical feel



\---



\# SPACING SYSTEM



The UI must feel:



\* dense

\* compact

\* engineered



Avoid:



\* giant margins

\* floating sections

\* excessive whitespace



\## Recommended Spacing Scale



8px

12px

16px

18px

24px



Nothing random.



\---



\# SHADOW SYSTEM



Use layered realistic shadows.



Example:

box-shadow:

0 10px 30px rgba(0,0,0,0.45),

0 2px 6px rgba(0,0,0,0.35),

inset 0 1px 0 rgba(255,255,255,0.04);



\---



\# FINAL VISUAL TARGET



The final interface should look like:



“A real premium ESP32 cyberdeck controller physically built into tactical embedded hardware.”



The UI must feel:



\* real

\* tactile

\* dense

\* engineered

\* cinematic

\* premium

\* hardware-focused

\* industrial

\* physically believable



NOT:



\* generic AI dashboard

\* flat web app

\* neon toy

\* SaaS admin panel

\* cyberpunk meme UI



