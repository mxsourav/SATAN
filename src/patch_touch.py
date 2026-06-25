import os

with open('App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add touch-none to hardware-key
text = text.replace('className="hardware-key', 'className="hardware-key touch-none select-none')

# Add touch-none to color wheel
text = text.replace('className="w-28 h-28 rounded-full cursor-crosshair color-wheel-conic', 'className="w-28 h-28 touch-none select-none rounded-full cursor-crosshair color-wheel-conic')

# Also fix the missing pointerCancel for the buttons, just in case!
text = text.replace("onPointerLeave={() => sendBtn('UP', false)}", "onPointerLeave={() => sendBtn('UP', false)} onPointerCancel={() => sendBtn('UP', false)}")
text = text.replace("onPointerLeave={() => sendBtn('DOWN', false)}", "onPointerLeave={() => sendBtn('DOWN', false)} onPointerCancel={() => sendBtn('DOWN', false)}")
text = text.replace("onPointerLeave={() => sendBtn('LEFT', false)}", "onPointerLeave={() => sendBtn('LEFT', false)} onPointerCancel={() => sendBtn('LEFT', false)}")
text = text.replace("onPointerLeave={() => sendBtn('RIGHT', false)}", "onPointerLeave={() => sendBtn('RIGHT', false)} onPointerCancel={() => sendBtn('RIGHT', false)}")
text = text.replace("onPointerLeave={() => sendBtn('OK', false)}", "onPointerLeave={() => sendBtn('OK', false)} onPointerCancel={() => sendBtn('OK', false)}")
text = text.replace("onPointerLeave={() => sendBtn('BACK', false)}", "onPointerLeave={() => sendBtn('BACK', false)} onPointerCancel={() => sendBtn('BACK', false)}")

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Patched touch-none successfully!')
